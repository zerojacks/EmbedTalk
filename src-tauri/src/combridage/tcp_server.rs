use crate::combridage::CommunicationChannel;
use crate::combridage::{Message, ChannelState};
use crate::global::get_app_handle;
use async_trait::async_trait;
use serde_json;
use std::collections::HashMap;
use std::error::Error;
use std::io::Error as IoError;
use std::sync::Arc;
use tauri::Emitter;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::Mutex;
use tokio::sync::{broadcast, mpsc};
use tokio::time::{sleep, timeout, Duration};

#[derive(Clone, Debug)]
pub struct TcpClientOfServer {
    stream: Arc<Mutex<TcpStream>>,
    shutdown_signal: broadcast::Sender<()>,
    tx_send: mpsc::Sender<Vec<u8>>,
    rx_recv: Arc<Mutex<mpsc::Receiver<Vec<u8>>>>,
}

impl TcpClientOfServer {
    pub async fn new(stream: TcpStream) -> Result<Self, Box<dyn Error + Send + Sync>> {
        println!("new TcpClientOfServer {:?}", stream);
        let std_stream = stream.into_std()?;
        std_stream.set_nonblocking(true)?;
        std_stream.set_nodelay(true)?;

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
            stream: mut_stream.clone(),
            shutdown_signal: shutdown_signal.clone(),
            tx_send,
            rx_recv: Arc::new(Mutex::new(rx_recv)),
        };

        // 启动发送任务
        let channelclone = channel.clone();
        tokio::spawn(async move {
            if let Err(e) = channelclone.send_task(writer, rx_send).await {
                eprintln!("Send task error: {}", e);
            }
        });

        // 启动接收任务
        let channelsend = channel.clone();
        tokio::spawn(async move {
            if let Err(e) = channelsend.receive_task(reader, tx_recv).await {
                eprintln!("Receive task error: {}", e);
            }
        });

        Ok(channel)
    }

    pub async fn close(&self) -> Result<(), Box<dyn Error + Send + Sync>> {
        println!("TcpClientOfServer closing...");
    
        // 发送关闭信号
        let _ = self.shutdown_signal.send(());
    
        // 给一些时间让任务退出
        sleep(Duration::from_millis(100)).await;
    
        // 关闭流
        if let Ok(mut stream) = self.stream.try_lock() {
            // 使用 tokio TcpStream 的 shutdown 方法
            if let Err(e) = stream.shutdown().await {
                eprintln!("Error shutting down stream: {:?}", e);
            }
        }
    
        println!("TcpClientOfServer closed successfully");
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
        self.rx_recv.lock().await.recv().await
    }

    async fn send_task(
        &self,
        mut writer: tokio::io::WriteHalf<TcpStream>,
        mut rx_send: mpsc::Receiver<Vec<u8>>,
    ) -> Result<(), IoError> {
        let mut shutdown_receiver = self.shutdown_signal.subscribe();

        loop {
            tokio::select! {
                Some(data) = rx_send.recv() => {
                    println!("Sending data {:?}", data);
                    if let Err(e) = writer.write_all(&data).await {
                        eprintln!("Failed to write data: {:?}", e);
                        break;
                    }
                }
                _ = shutdown_receiver.recv() => {
                    break;
                }
            }
        }
        Ok(())
    }

    async fn receive_task(
        self,
        mut reader: tokio::io::ReadHalf<TcpStream>,
        tx_recv: mpsc::Sender<Vec<u8>>,
    ) -> Result<(), Box<dyn Error + Send + Sync>> {
        let mut buffer = vec![0; 1024];
        let mut shutdown_receiver = self.shutdown_signal.subscribe();

        loop {
            tokio::select! {
                result = reader.read(&mut buffer) => {
                    match result {
                        Ok(n) if n > 0 => {
                            let received_data = buffer[..n].to_vec();
                            println!("Received data {:?}", received_data);
                            if let Err(e) = tx_recv.send(received_data).await {
                                eprintln!("Failed to send received data to queue: {:?}", e);
                                break;
                            }
                        }
                        Ok(0) => {
                            println!("Connection closed by peer");
                            break;
                        }
                        Err(e) => {
                            eprintln!("Read error: {:?}", e);
                            break;
                        }
                        _ => {}
                    }
                }
                _ = shutdown_receiver.recv() => {
                    break;
                }
            }
        }

        Ok(())
    }
}

#[derive(Clone, Debug)]
pub struct TcpServerChannel {
    clients: Arc<Mutex<HashMap<String, Arc<Mutex<TcpClientOfServer>>>>>,
    shutdown_signal: broadcast::Sender<()>,
    listener: Arc<Mutex<Option<TcpListener>>>, // 改为 Option 以支持完全关闭
}

impl TcpServerChannel {
    pub async fn new(
        ipaddr: &str,
        port: u16,
    ) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let address = format!("{}:{}", ipaddr, port);
        let (shutdown_signal, _) = broadcast::channel(1);
        println!("TcpServerChannel listening on: {}", address);
        
        let std_listener = std::net::TcpListener::bind(address)?;
        std_listener.set_nonblocking(true)?;
        let listener = TcpListener::from_std(std_listener)?;

        let server = Self {
            clients: Arc::new(Mutex::new(HashMap::new())),
            shutdown_signal: shutdown_signal.clone(),
            listener: Arc::new(Mutex::new(Some(listener))),
        };

        let server_clone = server.clone();
        tokio::spawn(async move {
            if let Err(e) = server_clone.accept_loop().await {
                eprintln!("Accept loop error: {:?}", e);
            }
        });

        Ok(server)
    }

    async fn accept_loop(&self) -> Result<(), Box<dyn Error + Send + Sync>> {
        let mut shutdown_receiver = self.shutdown_signal.subscribe();

        loop {
            tokio::select! {
                _ = shutdown_receiver.recv() => {
                    println!("Accept loop received shutdown signal");
                    break;
                }
                accept_result = async {
                    if let Some(listener) = &*self.listener.lock().await {
                        listener.accept().await
                    } else {
                        Err(std::io::Error::new(std::io::ErrorKind::Other, "Listener closed"))
                    }
                } => {
                    match accept_result {
                        Ok((stream, addr)) => {
                            let addr_str = addr.to_string();
                            println!("New client connected: {}", addr_str);
                            
                            match TcpClientOfServer::new(stream).await {
                                Ok(client) => {
                                    self.clients.lock().await.insert(addr_str, Arc::new(Mutex::new(client)));
                                }
                                Err(e) => {
                                    eprintln!("Error creating client: {:?}", e);
                                }
                            }
                        }
                        Err(e) => {
                            if e.kind() != std::io::ErrorKind::WouldBlock {
                                eprintln!("Accept error: {:?}", e);
                            }
                        }
                    }
                }
            }
        }

        Ok(())
    }

    pub async fn close(&self) -> Result<(), Box<dyn Error + Send + Sync>> {
        // 1. 发送关闭信号
        let _ = self.shutdown_signal.send(());

        // 2. 关闭所有客户端连接
        let mut clients = self.clients.lock().await;
        for client in clients.values() {
            if let Err(e) = client.lock().await.close().await {
                eprintln!("Error closing client: {:?}", e);
            }
        }
        clients.clear();

        // 3. 关闭监听器
        if let Some(listener) = self.listener.lock().await.take() {
            // 转换回标准库的 TcpListener 并显式关闭
            if let Ok(std_listener) = listener.into_std() {
                std_listener.set_nonblocking(false)?;
                // 在某些平台上，shutdown可能不会立即释放地址
                sleep(Duration::from_millis(100)).await;
            }
        }

        Ok(())
    }
}

#[async_trait]
impl CommunicationChannel for TcpServerChannel {
    async fn send(&self, message: &Message) -> Result<(), Box<dyn Error + Send + Sync>> {
        let clients = self.clients.lock().await;
        let serialized = bincode::serialize(message)?;
        
        for client in clients.values() {
            if let Err(e) = client.lock().await.send(serialized.clone()).await {
                eprintln!("Error sending to client: {:?}", e);
            }
        }
        Ok(())
    }

    async fn receive(&self) -> Result<Message, Box<dyn Error + Send + Sync>> {
        let mut clients = self.clients.lock().await;
        for client in clients.values_mut() {
            let mut client = client.lock().await;
            if let Some(data) = client.receive().await {
                let message: serde_json::Value = serde_json::from_slice(&data)?;
                let message = Message::new(message);
                return Ok(message);
            }
        }
        Err("No data received".into())
    }

    async fn send_and_wait(
        &self,
        message: &Message,
        timeout_secs: u64,
    ) -> Result<Message, Box<dyn Error + Send + Sync>> {
        self.send(message).await?;
        timeout(Duration::from_secs(timeout_secs), self.receive()).await?
    }

    async fn close(&self) -> Result<(), Box<dyn Error + Send + Sync>> {
        self.close().await
    }

    async fn on_statechange(&self, state:ChannelState) -> Result<(), Box<dyn Error + Send + Sync>> {
        let app_handle = get_app_handle();
        let payload = serde_json::json!({
            "channel": "tcpserver",
            "state": state,
            "reason": "The tcpserver channel has been disconnected",
        });

        app_handle
            .emit("channel-state", serde_json::to_string(&payload)?)
            .unwrap();

        Ok(())
    }
}