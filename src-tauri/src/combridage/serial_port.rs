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
use tokio::time::timeout;
use tokio_serial::SerialStream;
pub struct SerialPortChannel {
    port_name: String,
    port: Arc<Mutex<Option<SerialStream>>>,
    sender: broadcast::Sender<Vec<u8>>,
    receiver: mpsc::Receiver<Message>,
    send_task_handle: Arc<Mutex<Option<JoinHandle<()>>>>,
    receive_task_handle: Arc<Mutex<Option<JoinHandle<()>>>>,
    msg_sender: mpsc::Sender<Message>, // 添加msg_sender字段来存储发送端
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
        // Change to broadcast channel instead of mpsc
        let (tx, _) = broadcast::channel::<Vec<u8>>(100);
        let (msg_tx, msg_rx) = mpsc::channel::<Message>(100);

        let port = Arc::new(Mutex::new(None));
        let send_task_handle = Arc::new(Mutex::new(None));
        let receive_task_handle = Arc::new(Mutex::new(None));

        let channel = Self {
            port_name: port_name.to_string().clone(),
            port,
            sender: tx,
            receiver: msg_rx,
            send_task_handle,
            receive_task_handle,
            msg_sender: msg_tx, // 保存msg_sender
        };

        // Connect immediately
        channel
            .connect(port_name, baud_rate, databit, fowctrl, parity, stopbit)
            .await?;
        if let Err(e) = channel.on_statechange(ChannelState::Connected).await {
            eprintln!("Failed to send disconnect event: {:?}", e);
            return Err(e); // 返回 on_statechange 的错误
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
        let serialbuilder = tokio_serial::new(port_name, baud_rate);
        let port = SerialStream::open(
            &serialbuilder
                .data_bits(databit)
                .flow_control(fowctrl)
                .parity(parity)
                .stop_bits(stopbit),
        )?;

        // Store the serial port instance
        *self.port.lock().await = Some(port);

        // Start send and receive tasks
        let app_handle = get_app_handle();
        let message_manager = MessageManager::new(app_handle)?;
        let _ = message_manager.register_channel(&port_name).await;
        let subscriber = message_manager.subscribe_to_messages();

        let message_send = message_manager.clone();
        let message_rec = message_manager.clone();
        self.start_send_task(message_send).await?;
        self.start_receive_task(message_rec).await?;

        Ok(())
    }

    async fn start_send_task(
        &self,
        message_manager: MessageManager,
    ) -> Result<(), Box<dyn Error + Send + Sync>> {
        let port = self.port.clone();
        let mut rx = self.sender.subscribe();
        let port_name = self.port_name.clone();

        let handle = tokio::spawn(async move {
            while let Ok(data) = rx.recv().await {
                if let Some(port) = port.lock().await.as_mut() {
                    // Handle port write errors
                    if let Err(e) = port.write_all(&data).await {
                        eprintln!("Error sending data: {:?}", e);
                        break;
                    }

                    let payload = serde_json::json!({
                        "data": data
                    });
                    let message = Message::new(payload);

                    // Record the message
                    if let Err(e) = message_manager
                        .record_message(
                            "serial",
                            &port_name,
                            &message,
                            MessageDirection::Sent,
                            None,
                        )
                        .await
                    {
                        eprintln!("Error recording message: {:?}", e);
                    }
                }
            }
        });

        // Store the handle
        *self.send_task_handle.lock().await = Some(handle);
        Ok(())
    }

    async fn start_receive_task(
        &self,
        message_manager: MessageManager,
    ) -> Result<(), Box<dyn Error + Send + Sync>> {
        let port = self.port.clone();
        let msg_tx = self.msg_sender.clone();
        let port_name = self.port_name.clone();

        let handle = tokio::spawn(async move {
            let mut buffer = vec![0; 1024];
            while let Some(port) = port.lock().await.as_mut() {
                match port.read(&mut buffer).await {
                    Ok(n) if n > 0 => {
                        let received_data = buffer[..n].to_vec();
                        println!("Received {} bytes: {:?}", n, received_data);

                        let payload = serde_json::json!({
                            "data": received_data
                        });
                        let message = Message::new(payload);

                        // Send Message object using mpsc sender
                        if msg_tx.send(message.clone()).await.is_err() {
                            eprintln!("Receiver dropped");
                            break;
                        }

                        if let Err(e) = message_manager
                            .record_message(
                                "tcpclient",
                                &port_name,
                                &message,
                                MessageDirection::Received,
                                None,
                            )
                            .await
                        {
                            eprintln!("Error recording message: {:?}", e);
                        }
                    }
                    Ok(n) => {
                        println!("Read {} bytes (zero bytes read)", n);
                    }
                    Err(e) => {
                        eprintln!("Error receiving data: {:?}", e);
                        break;
                    }
                }
            }
        });

        *self.receive_task_handle.lock().await = Some(handle);
        Ok(())
    }
    async fn receive(&mut self) -> Result<Message, Box<dyn Error + Send + Sync>> {
        if !self.is_connected().await {
            return Err("Serial port not connected".into());
        }

        if let Some(message) = self.receiver.recv().await {
            println!("SerialPortChannel Received: {:?}", message);
            Ok(message)
        } else {
            Err("Failed to receive message".into())
        }
    }

    pub async fn is_connected(&self) -> bool {
        self.port.lock().await.is_some()
    }
}
#[async_trait]
impl CommunicationChannel for SerialPortChannel {
    async fn send(&self, message: &Message) -> Result<(), Box<dyn Error + Send + Sync>> {
        if !self.is_connected().await {
            return Err("Serial port not connected".into());
        }

        let serialized = serde_json::to_vec(&message.content)?;
        self.sender.send(serialized)?;
        println!("SerialPortChannel Sent: {:?}", message);
        Ok(())
    }

    async fn send_and_wait(
        &self,
        message: &Message,
        timeout_secs: u64,
    ) -> Result<Message, Box<dyn Error + Send + Sync>> {
        if !self.is_connected().await {
            return Err("Serial port not connected".into());
        }

        self.send(message).await?;
        match timeout(Duration::from_secs(timeout_secs), self.receive()).await {
            Ok(result) => result,
            Err(_) => Err("Timeout waiting for response".into()),
        }
    }
    async fn receive(&self) -> Result<Message, Box<dyn Error + Send + Sync>> {
        self.receive().await
    }
    async fn close(&self) -> Result<(), Box<dyn Error + Send + Sync>> {
        // 停止发送和接收任务
        if let Some(handle) = self.send_task_handle.lock().await.take() {
            handle.abort();
        }
        if let Some(handle) = self.receive_task_handle.lock().await.take() {
            handle.abort();
        }

        // 关闭串口
        if let Some(mut port) = self.port.lock().await.take() {
            port.shutdown().await?;
        }
        if let Err(e) = self.on_statechange(ChannelState::Disconnected).await {
            eprintln!("Failed to send disconnect event: {:?}", e);
            return Err(e); // 返回 on_statechange 的错误
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
            "reason": "The TCP Client has disconnected",
        });
        app_handle
            .emit("channel-state", serde_json::to_string(&payload)?)
            .unwrap();

        Ok(())
    }
}
