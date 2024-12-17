use crate::combridage::CommunicationChannel;
use crate::combridage::{ChannelState, Message};
use async_trait::async_trait;
use serde_json;
use socket2::{Socket, TcpKeepalive};
use std::borrow::Borrow;
use std::error::Error;
use std::io;
use std::io::Error as IoError;
use std::sync::Arc;
use tauri::Emitter;
use tauri::{Manager, Wry};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::sync::mpsc;
use tokio::sync::{broadcast, Mutex, TryLockError};
use tokio::time::{sleep, timeout, Duration};
//global.rs
use crate::combridage::messagemanager::{MessageDirection, MessageManager};
use crate::global::get_app_handle;
#[derive(Clone, Debug)]
pub struct TcpClientChannel {
    adress: String,
    stream: Arc<Mutex<TcpStream>>,
    shutdown_signal: broadcast::Sender<()>,
    tx_send: mpsc::Sender<Vec<u8>>,
    rx_recv: Arc<Mutex<mpsc::Receiver<Vec<u8>>>>,
}

impl TcpClientChannel {
    pub async fn new(ipaddr: &str, port: u16) -> Result<Self, Box<dyn Error + Send + Sync>> {
        let address = format!("{}:{}", ipaddr, port);
        let stream = TcpStream::connect(address.clone()).await?;

        println!("TcpClientChannel connected to {} {:?}", address, stream);
        let std_stream = stream.into_std()?;

        let (shutdown_signal, _) = broadcast::channel(1);

        // 创建一个克隆的流用于读取
        let split_stream = std_stream.try_clone()?;
        let tokio_stream = TcpStream::from_std(split_stream)?;
        let (reader, writer) = tokio::io::split(tokio_stream);

        let (tx_send, rx_send) = mpsc::channel(100); // 发送队列
        let (tx_recv, rx_recv) = mpsc::channel(100); // 接收队列

        let arc_stream = std_stream.try_clone()?;
        let mut_stream = Arc::new(Mutex::new(TcpStream::from_std(arc_stream)?));

        let channel = Self {
            adress: address.clone(),
            stream: mut_stream.clone(),
            shutdown_signal: shutdown_signal.clone(),
            tx_send: tx_send,
            rx_recv: Arc::new(Mutex::new(rx_recv)),
        };
        let app_handle = get_app_handle();
        let message_manager = MessageManager::new(app_handle)?;
        message_manager.register_channel(&address).await;
        let mut subscriber = message_manager.subscribe_to_messages();

        let channelclone = channel.clone();
        let _ = channelclone
            .set_tcp_keepalive(&std_stream.try_clone()?)
            .await;

        // 启动发送任务
        let channelclone = channel.clone();
        let message_manager_send = message_manager.clone();
        tokio::spawn(async move {
            if let Err(e) = channelclone
                .send_task(writer, rx_send, message_manager_send)
                .await
            {
                eprintln!("Send task error: {}", e);
            }
        });

        // 启动接收任务
        let channelsend = channel.clone();
        let message_manager_rec = message_manager.clone(); // 克隆 message_manager
        tokio::spawn(async move {
            if let Err(e) = channelsend
                .receive_task(reader, tx_recv, message_manager_rec)
                .await
            {
                eprintln!("Receive task error: {}", e);
            }
        });
        if let Err(e) = channel.on_statechange(ChannelState::Connected).await {
            eprintln!("Failed to send disconnect event: {:?}", e);
            return Err(e); // 返回 on_statechange 的错误
        }
        Ok(channel)
    }

    pub async fn close(&self) -> Result<(), Box<dyn Error + Send + Sync>> {
        println!("TcpClientChannel closing...");

        // 发送关闭信号
        let _ = self.shutdown_signal.send(());

        // 给一些时间让 detect_disconnection_with_timeout 退出
        sleep(Duration::from_millis(100)).await;

        // 使用 try_lock 来避免死锁
        let mut attempts = 0;
        let max_attempts = 5;

        while attempts < max_attempts {
            match self.stream.try_lock() {
                Ok(mut stream) => {
                    match tokio::time::timeout(Duration::from_secs(5), stream.shutdown()).await {
                        Ok(result) => match result {
                            Ok(_) => {
                                println!("TcpClientChannel closed successfully");
                                break;
                            }
                            Err(e) => println!("Error during shutdown: {:?}", e),
                        },
                        Err(_) => println!("TcpClientChannel shutdown timed out"),
                    }
                    break;
                }
                Err(_) => {
                    attempts += 1;
                    sleep(Duration::from_millis(50)).await;
                }
            }
        }

        if attempts == max_attempts {
            println!("Failed to acquire lock for closing TcpClientChannel");
        }

        println!("TcpClientChannel close operation finished");
        // 先发送断开状态变更消息
        if let Err(e) = self.on_statechange(ChannelState::Disconnected).await {
            eprintln!("Failed to send disconnect event: {:?}", e);
            return Err(e); // 返回 on_statechange 的错误
        }
        Ok(())
    }

    // Function to set TCP keepalive
    pub async fn set_tcp_keepalive(
        &self,
        stream: &std::net::TcpStream,
    ) -> Result<(), Box<dyn Error + Send + Sync>> {
        // Clone the std::net::TcpStream
        let cloned_stream = stream.try_clone()?;

        // Create a socket2::Socket from the cloned TcpStream
        let socket = Socket::from(cloned_stream);

        // 方案1：使用单独的方法设置各个参数
        let keepalive = TcpKeepalive::new().with_time(Duration::from_secs(60)); // Idle time

        socket.set_tcp_keepalive(&keepalive)?;

        Ok(())
    }

    // 发送消息
    pub async fn send(&self, message: Vec<u8>) -> Result<(), Box<dyn Error + Send + Sync>> {
        self.tx_send
            .send(message)
            .await
            .map_err(|e| format!("Failed to send message: {:?}", e).into())
    }

    // 接收消息
    pub async fn receive(&mut self) -> Option<Vec<u8>> {
        // self.rx_recv.lock().recv().await
        self.rx_recv.lock().await.recv().await
    }

    // 发送任务：从发送队列读取消息并发送到写入器
    async fn send_task(
        &self,
        mut writer: tokio::io::WriteHalf<TcpStream>,
        mut rx_send: mpsc::Receiver<Vec<u8>>,
        message_manager: MessageManager,
    ) -> Result<(), IoError> {
        while let Some(data) = rx_send.recv().await {
            let message: serde_json::Value = serde_json::from_slice(&data)?;
            let message = Message::new(message);
            println!("TcpClientChannel received {:?}", message);
            message_manager
                .record_message(
                    "tcpclient",
                    &self.adress.clone(),
                    &message,
                    MessageDirection::Sent,
                    None,
                )
                .await
                .map_err(|e| IoError::new(io::ErrorKind::Other, e))?; // 修改此行
            writer.write_all(&data).await?;
        }
        Ok(())
    }
    // 接收任务：从读取器读取消息，并检测断开连接
    async fn receive_task(
        self,
        mut reader: tokio::io::ReadHalf<TcpStream>,
        tx_recv: mpsc::Sender<Vec<u8>>,
        message_manager: MessageManager,
    ) -> Result<(), Box<dyn Error + Send + Sync>> {
        let mut buffer = [0; 1024];
        let mut shutdown_receiver = self.shutdown_signal.subscribe();

        loop {
            tokio::select! {
                _ = shutdown_receiver.recv() => {
                    println!("Receive task received shutdown signal");
                    return Ok(()); // 收到关闭信号时正常退出
                }
                result = reader.read(&mut buffer) => {
                    match result {
                        Ok(n) if n > 0 => {
                            let received_data = buffer[..n].to_vec();
                            println!("Received {} bytes: {:?}", n, received_data);

                            let payload = serde_json::json!({
                                "data": received_data
                            });
                            let message = Message::new(payload);
                            message_manager.record_message(
                                "tcpclient",
                                &self.adress.clone(),
                                &message,
                                MessageDirection::Received,
                                None
                            ).await?;

                            if let Err(e) = tx_recv.send(received_data).await {
                                eprintln!("Failed to send received message to queue: {:?}", e);
                                return Err(Box::new(e)); // 将 SendError 包装成 Box<dyn Error> 并返回
                            }
                        }
                        Ok(0) => {
                            println!("Server disconnected (EOF received).");
                            if let Err(e) = self.on_statechange(ChannelState::Disconnected).await {
                                eprintln!("Failed to send disconnect event: {:?}", e);
                                return Err(e); // 返回 on_statechange 的错误
                            }
                            return Ok(()); // 正常退出
                        }
                        Ok(_) => {
                            // 处理读取了 0 字节以外的情况
                            // 这里不应该出现这种情况，因为 `read` 方法不会返回 0 到 n 之间的值
                            eprintln!("Unexpected read result: 0 bytes read but not EOF.");
                            return Ok(()); // 或者你可以选择其他方式处理这种情况
                        }
                        Err(e) => {
                            eprintln!("Failed to receive message or timeout: {:?}", e);
                            return Err(Box::new(e)); // 返回读取错误
                        }
                    }
                }
            }
        }
    }
}

#[async_trait]
impl CommunicationChannel for TcpClientChannel {
    async fn send(&self, message: &Message) -> Result<(), Box<dyn Error + Send + Sync>> {
        let mut stream = self.stream.lock().await;
        let message_bytes = bincode::serialize(message)?;

        // 发送提取的 u8 数组
        stream.write_all(&message_bytes).await?;
        stream.flush().await?;
        println!("TcpClientChannel sent {:?}", message_bytes);
        Ok(())
    }

    async fn receive(&self) -> Result<Message, Box<dyn Error + Send + Sync>> {
        let mut stream = self.stream.lock().await;
        let mut buffer = vec![0; 1024];
        let n = stream.read(&mut buffer).await?;
        if n == 0 {
            return Err("Connection closed by peer".into());
        }
        // let message: Message = bincode::deserialize(&buffer[..n])?;
        let message: serde_json::Value = serde_json::from_slice(&buffer[..n])?;
        let message = Message::new(message);
        println!("TcpClientChannel received {:?}", message);
        Ok(message)
    }

    async fn send_and_wait(
        &self,
        message: &Message,
        timeout_secs: u64,
    ) -> Result<Message, Box<dyn Error + Send + Sync>> {
        let send_message = bincode::serialize(message)?;
        self.send(send_message).await?;
        tokio::time::timeout(std::time::Duration::from_secs(timeout_secs), self.receive()).await?
    }

    async fn close(&self) -> Result<(), Box<dyn Error + Send + Sync>> {
        self.close().await?;
        Ok(())
    }

    // 构造断开连接事件的 payload
    async fn on_statechange(
        &self,
        state: ChannelState,
    ) -> Result<(), Box<dyn Error + Send + Sync>> {
        let app_handle = get_app_handle();
        let stream = self.stream.lock().await;
        let ip = stream.peer_addr()?.ip().to_string();
        let port = stream.peer_addr()?.port();
        // Construct the disconnect event payload
        let data = serde_json::json!({
            "ip": ip,
            "port": port,
        });
        let payload = serde_json::json!({
            "channeltype": "tcpclient",
            "channelid": self.adress.clone(),
            "state": state,
            "data": data,
            "reason": "The TCP Client has disconnected",
        });
        println!("TcpClientChannel disconnected {:?}", payload);
        // Send the disconnect event
        app_handle
            .emit("channel-state", serde_json::to_string(&payload)?)
            .unwrap();

        Ok(())
    }
}
