use crate::combridage::messagemanager::{MessageDirection, MessageManager};
use crate::combridage::{ChannelState, CommunicationChannel, Message};
use crate::global::get_app_handle;
use async_trait::async_trait;
use serde_json;
use std::error::Error;
use std::sync::Arc;
use std::time::Duration;
use tauri::Emitter;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::sync::broadcast;
use tokio::sync::{mpsc, Mutex};
use tokio::task::JoinHandle;
use tokio::time::{sleep, timeout};
use tokio_serial::SerialStream;
use uuid::Uuid;

pub struct SerialPortChannel {
    channeltype: String,
    channelid: String,
    channel_name: String,
    port_name: String,
    writer: Arc<Mutex<Option<tokio::io::WriteHalf<SerialStream>>>>,
    reader: Arc<Mutex<Option<tokio::io::ReadHalf<SerialStream>>>>,
    sender: broadcast::Sender<Vec<u8>>,
    data_tx: mpsc::Sender<Vec<u8>>,
    data_rx: Arc<Mutex<mpsc::Receiver<Vec<u8>>>>,
    send_task_handle: Arc<Mutex<Option<JoinHandle<()>>>>,
    receive_task_handle: Arc<Mutex<Option<JoinHandle<()>>>>,
    process_task_handle: Arc<Mutex<Option<JoinHandle<()>>>>,
}

impl SerialPortChannel {
    pub async fn new(
        port_name: &str,
        baud_rate: u32,
        databit: tokio_serial::DataBits,
        fowctrl: tokio_serial::FlowControl,
        parity: tokio_serial::Parity,
        stopbit: tokio_serial::StopBits,
    ) -> Result<Self, Box<dyn Error + Send + Sync>> {
        let (tx, _) = broadcast::channel::<Vec<u8>>(100);
        let (data_tx, data_rx) = mpsc::channel::<Vec<u8>>(100);

        let writer = Arc::new(Mutex::new(None));
        let reader = Arc::new(Mutex::new(None));
        let send_task_handle = Arc::new(Mutex::new(None));
        let receive_task_handle = Arc::new(Mutex::new(None));
        let process_task_handle = Arc::new(Mutex::new(None));

        let channel = Self {
            channeltype: "serial".to_string(),
            channelid: "serial".to_string() + &Uuid::new_v4().to_string(),
            channel_name: "Serial".to_string() + &port_name.to_string(),
            port_name: port_name.to_string(),
            writer,
            reader,
            sender: tx,
            data_tx,
            data_rx: Arc::new(Mutex::new(data_rx)),
            send_task_handle,
            receive_task_handle,
            process_task_handle,
        };

        channel
            .connect(port_name, baud_rate, databit, fowctrl, parity, stopbit)
            .await?;
        if let Err(e) = channel.on_statechange(ChannelState::Connected).await {
            eprintln!("Failed to send connect event: {:?}", e);
            return Err(e);
        }
        Ok(channel)
    }

    pub async fn connect(
        &self,
        port_name: &str,
        baud_rate: u32,
        databit: tokio_serial::DataBits,
        fowctrl: tokio_serial::FlowControl,
        parity: tokio_serial::Parity,
        stopbit: tokio_serial::StopBits,
    ) -> Result<(), Box<dyn Error + Send + Sync>> {
        const MAX_RETRIES: u32 = 3;
        const RETRY_DELAY: Duration = Duration::from_secs(1);

        let mut last_error = None;
        for retry in 0..MAX_RETRIES {
            if retry > 0 {
                println!("重试串口连接，第 {} 次尝试", retry + 1);
                sleep(RETRY_DELAY).await;
            }

            let builder = tokio_serial::new(port_name, baud_rate)
                .data_bits(databit)
                .flow_control(fowctrl)
                .parity(parity)
                .stop_bits(stopbit);

            match SerialStream::open(&builder) {
                Ok(port) => {
                    println!("串口连接成功: {}", port_name);
                    let (reader, writer) = tokio::io::split(port);

                    *self.reader.lock().await = Some(reader);
                    *self.writer.lock().await = Some(writer);

                    let app_handle = get_app_handle();
                    let message_manager = MessageManager::new(app_handle)?;
                    let _ = message_manager.register_channel(&port_name).await;

                    let message_send = message_manager.clone();
                    let message_rec = message_manager.clone();
                    self.start_send_task(message_send).await?;
                    self.start_receive_task(message_rec).await?;

                    return Ok(());
                }
                Err(e) => {
                    last_error = Some(e);
                    eprintln!(
                        "串口连接失败 (尝试 {}/{}): {:?}",
                        retry + 1,
                        MAX_RETRIES,
                        last_error
                    );
                }
            }
        }

        Err(format!(
            "串口连接失败，已重试 {} 次: {:?}",
            MAX_RETRIES,
            last_error.unwrap()
        )
        .into())
    }

    async fn start_send_task(
        &self,
        message_manager: MessageManager,
    ) -> Result<(), Box<dyn Error + Send + Sync>> {
        let writer = self.writer.clone();
        let mut rx = self.sender.subscribe();
        let channeltype = self.channeltype.clone();
        let channelid = self.channelid.clone();

        let handle = tokio::spawn(async move {
            while let Ok(data) = rx.recv().await {
                if let Some(mut writer) = writer.lock().await.as_mut() {
                    if let Err(e) = writer.write_all(&data).await {
                        eprintln!("发送数据时发生错误: {:?}", e);
                        break;
                    }
                }
            }
        });

        *self.send_task_handle.lock().await = Some(handle);
        Ok(())
    }

    async fn start_receive_task(
        &self,
        message_manager: MessageManager,
    ) -> Result<(), Box<dyn Error + Send + Sync>> {
        let reader = self.reader.clone();
        let data_sender = self.data_tx.clone();
        let channeltype = self.channeltype.clone();
        let channelid = self.channelid.clone();

        // 启动数据接收任务
        let receive_handle = tokio::spawn(async move {
            let mut buffer = vec![0; 1024];
            while let Some(mut reader) = reader.lock().await.as_mut() {
                match reader.read(&mut buffer).await {
                    Ok(n) if n > 0 => {
                        let received_data = buffer[..n].to_vec();
                        println!("接收到 {} 字节的数据", n);

                        // 将数据放入队列
                        if let Err(e) = data_sender.send(received_data).await {
                            eprintln!("发送数据到队列失败: {:?}", e);
                            continue;
                        }
                    }
                    Ok(_) => {}
                    Err(e) => {
                        eprintln!("读取数据时发生错误: {:?}", e);
                        break;
                    }
                }
            }
        });

        *self.receive_task_handle.lock().await = Some(receive_handle);

        // 启动数据处理任务
        let process_handle = tokio::spawn({
            let data_rx = self.data_rx.clone();
            let channeltype = self.channeltype.clone();
            let channelid = self.channelid.clone();
            let channel_name = self.channel_name.clone();
            let message_manager = message_manager.clone();

            async move {
                while let Some(data) = data_rx.lock().await.recv().await {
                    let message = Message::new(serde_json::json!({
                        "data": data
                    }));

                    // 记录消息
                    if let Err(e) = message_manager
                        .record_message(
                            &channeltype,
                            &channelid,
                            &channel_name,
                            &message,
                            MessageDirection::Received,
                            None,
                        )
                        .await
                    {
                        eprintln!("记录消息失败: {:?}", e);
                    }
                }
            }
        });

        *self.process_task_handle.lock().await = Some(process_handle);
        Ok(())
    }

    pub async fn is_connected(&self) -> bool {
        self.writer.lock().await.is_some() && self.reader.lock().await.is_some()
    }
}

#[async_trait]
impl CommunicationChannel for SerialPortChannel {
    async fn send(
        &self,
        message: &Message,
        _clientid: Option<String>,
    ) -> Result<(), Box<dyn Error + Send + Sync>> {
        let content = message.get_content();
        let data = if let Some(arr) = content["data"].as_array() {
            arr.iter()
                .filter_map(|v| v.as_u64())
                .map(|v| v as u8)
                .collect::<Vec<u8>>()
        } else {
            return Err("Invalid data format".into());
        };

        self.sender.send(data)?;

        let app_handle = get_app_handle();
        let message_manager = MessageManager::new(app_handle.clone())?;

        let mut message_clone = message.clone();
        message_clone.update_timestamp();
        if let Err(e) = message_manager
            .record_message(
                &self.channeltype,
                &self.channelid,
                &self.channel_name,
                &message_clone,
                MessageDirection::Sent,
                None,
            )
            .await
        {
            eprintln!("记录发送消息失败: {:?}", e);
        }
        Ok(())
    }

    async fn receive(&self) -> Result<Message, Box<dyn Error + Send + Sync>> {
        if let Some(message) = self.data_rx.lock().await.recv().await {
            let payload = serde_json::json!({
                "data": message
            });
            Ok(Message::new(payload))
        } else {
            Err("接收消息失败".into())
        }
    }

    async fn send_and_wait(
        &self,
        message: &Message,
        timeout_secs: u64,
    ) -> Result<Message, Box<dyn Error + Send + Sync>> {
        self.send(message, None).await?;
        match timeout(Duration::from_secs(timeout_secs), self.receive()).await {
            Ok(result) => result,
            Err(_) => Err("等待响应超时".into()),
        }
    }

    async fn close(&self) -> Result<(), Box<dyn Error + Send + Sync>> {
        // 中止所有任务
        if let Some(handle) = self.send_task_handle.lock().await.take() {
            handle.abort();
        }
        if let Some(handle) = self.receive_task_handle.lock().await.take() {
            handle.abort();
        }
        if let Some(handle) = self.process_task_handle.lock().await.take() {
            handle.abort();
        }

        // 关闭读写流
        *self.reader.lock().await = None;
        *self.writer.lock().await = None;

        if let Err(e) = self.on_statechange(ChannelState::Disconnected).await {
            eprintln!("发送断开连接事件失败: {:?}", e);
            return Err(e);
        }
        Ok(())
    }

    async fn on_statechange(
        &self,
        state: ChannelState,
    ) -> Result<(), Box<dyn Error + Send + Sync>> {
        let app_handle = get_app_handle();
        let payload = serde_json::json!({
            "channeltype": "serial",
            "channelId": self.port_name.clone(),
            "state": state,
            "data": serde_json::Value::Null,
            "reason": "串口已断开连接",
        });
        app_handle
            .emit("channel-state", serde_json::to_string(&payload)?)
            .unwrap();

        Ok(())
    }

    fn get_channel_id(&self) -> String {
        self.channelid.clone()
    }

    async fn subscribe_topic(
        &self,
        _topic: &str,
        _qos: u8,
    ) -> Result<(), Box<dyn Error + Send + Sync>> {
        Err("Serial port does not support topic subscription".into())
    }

    async fn unsubscribe_topic(&self, _topic: &str) -> Result<(), Box<dyn Error + Send + Sync>> {
        Err("Serial port does not support topic unsubscription".into())
    }
}
