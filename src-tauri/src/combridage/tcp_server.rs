use crate::combridage::CommunicationChannel;
use crate::combridage::Message;
use crate::global::get_app_handle;
use async_trait::async_trait;
use serde_json;
use std::collections::HashMap;
use std::os::windows::io::AsRawSocket;
use std::os::windows::io::AsSocket;
use socket2::{Socket, TcpKeepalive};
use std::error::Error;
use std::io::Error as IoError;
use std::sync::Arc;
use tauri::{Manager, Wry};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::Mutex;
use tokio::sync::{broadcast, mpsc};
use tokio::time::{sleep, timeout, Duration};
use tauri::Emitter;

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
            tx_send: tx_send,
            rx_recv: Arc::new(Mutex::new(rx_recv)),
        };

        // let channelclone = channel.clone();
        // let _ = channelclone
        //     .set_tcp_keepalive(&std_stream.try_clone()?)
        //     .await;

        
        // 启动接收任务
        let channelsend = channel.clone();
        println!("Before spawning receive task");
        let handle = tokio::spawn(async move {
            println!("Inside spawned task");
            if let Err(e) = channelsend.receive_task(reader, tx_recv).await {
                eprintln!("Receive task error: {}", e);
            }
        });
        println!("After spawning receive task");
        // 在某处等待任务完成
        // handle.await?;
        
        // 启动发送任务
        let channelclone = channel.clone();
        let send_handle = tokio::spawn(async move {
            if let Err(e) = channelclone.send_task(writer, rx_send).await {
                eprintln!("Send task error: {}", e);
            }
        });
        // send_handle.await?;
        tokio::time::sleep(Duration::from_millis(100)).await;
        Ok(channel)
    }

    pub async fn close(&self) -> Result<(), Box<dyn Error + Send + Sync>> {
        println!("TcpClientOfServer closing...");

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
                                println!("TcpClientOfServer closed successfully");
                                return Ok(());
                            }
                            Err(e) => println!("Error during shutdown: {:?}", e),
                        },
                        Err(_) => println!("TcpClientOfServer shutdown timed out"),
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

        println!("TcpClientOfServer close operation finished");
        Ok(())
    }

    // Function to set TCP keepalive
    pub async fn set_tcp_keepalive(
        &self,
        stream: &std::net::TcpStream,
    ) -> Result<(), Box<dyn Error + Send + Sync>> {
        // Clone the std::net::TcpStream so that the original stream is not moved
        let cloned_stream = stream.try_clone()?;

        // Create a socket2::Socket from the cloned TcpStream
        let socket = Socket::from(cloned_stream);

        // Create a TcpKeepalive structure and configure it
        let keepalive = TcpKeepalive::new()
            .with_time(Duration::from_secs(60)); // Idle time before sending keepalive probes
        // Set the TCP keepalive options using the constructed TcpKeepalive
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
    ) -> Result<(), IoError> {
        println!("TcpClientOfServer send task started {:?}", writer);
        while let Some(data) = rx_send.recv().await {
            writer.write_all(&data).await?;
        }
        Ok(())
    }
    // 接收任务：从读取器读取消息，并检测断开连接
    async fn receive_task(
        self,
        mut reader: tokio::io::ReadHalf<TcpStream>,
        tx_recv: mpsc::Sender<Vec<u8>>,
    ) -> Result<(), Box<dyn Error + Send + Sync>> {
        println!("TcpClientOfServer receive task started11 {:?}", reader);
        let mut buffer = [0; 1024];
        let mut shutdown_receiver = self.shutdown_signal.subscribe();
        println!("TcpClientOfServer receive task started {:?}", reader);
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
                            if let Err(e) = tx_recv.send(received_data).await {
                                eprintln!("Failed to send received message to queue: {:?}", e);
                                return Err(Box::new(e)); // 将 SendError 包装成 Box<dyn Error> 并返回
                            }
                        }
                        Ok(0) => {
                            println!("Client disconnected (EOF received).");
                            // if let Err(e) = self.on_disconnect().await {
                            //     eprintln!("Failed to send disconnect event: {:?}", e);
                            //     return Err(e); // 返回 on_disconnect 的错误
                            // }
                            self.close().await?;
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

#[derive(Clone, Debug)]
pub struct TcpServerChannel {
    clients: Arc<Mutex<HashMap<String, Arc<Mutex<TcpClientOfServer>>>>>,
    shutdown_signal: broadcast::Sender<()>,
    listener: Arc<Mutex<TcpListener>>, // TcpListener 的实例
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
        // let sock = std_listener.
        let listener = TcpListener::from_std(std_listener)?;

        // Spawn the accept loop in a separate task
        let tcpserver = Self {
            clients: Arc::new(Mutex::new(HashMap::new())),
            shutdown_signal: shutdown_signal.clone(),
            listener: Arc::new(Mutex::new(listener)),
        };

        let mut tcpserver_clone = tcpserver.clone();
        let newchandle = tokio::spawn(async move {
            TcpServerChannel::handle_new_connections(&mut tcpserver_clone).await;
        });
        // let _ = newchandle.await;
        Ok(tcpserver.clone())
    }

    async fn handle_new_connections(&mut self) {
        let mut shutdown_receiver = self.shutdown_signal.subscribe();
        let listener = self.listener.lock().await;
        loop {
            tokio::select! {
                accept_result = listener.accept() => {
                    match accept_result {
                        Ok((stream, addr)) => {
                            let addr_str = addr.to_string();
                            println!("TcpServerChannel Client connected: {}", addr_str);
                            let tcpclient = TcpClientOfServer::new(stream).await;
                            println!("TcpServerChannel Client : {:?}", tcpclient);
                            match tcpclient {
                                Ok(channel) => {
                                    // Use channel here
                                    self.clients.lock().await.insert(addr_str, Arc::new(Mutex::new(channel)));
                                },
                                Err(e) => {
                                    eprintln!("Error creating TcpClientOfServer: {}", e);
                                    // Handle error appropriately
                                }
                            }
                        }
                        Err(e) => {
                            eprintln!("Failed to accept connection: {}", e);
                        }
                    }
                }
                _ = shutdown_receiver.recv() => {
                    println!("TcpServerChannel shutting down");
                    break;
                }
            }
        }
    }

    async fn get_connected_clients(&self) -> Vec<String> {
        let clients = self.clients.lock().await;
        clients.keys().cloned().collect()
    }

    pub async fn close(&self) -> Result<(), Box<dyn Error + Send + Sync>> {
        let _ = self.shutdown_signal.send(());

        // 2. 关闭监听器
        
        
        for client in self.clients.lock().await.values() {
            client.lock().await.close().await?;
        }
        
        self.clients.lock().await.clear();
        
        let listener = self.listener.lock().await.as_raw_socket();
        // socket.shutdown(Shutdown::Both)?;
        drop(listener);

        Ok(())
    }
}

#[async_trait]
impl CommunicationChannel for TcpServerChannel {
    async fn send(&self, message: &Message) -> Result<(), Box<dyn Error + Send + Sync>> {
        let clients = self.clients.lock().await;
        let serialized = bincode::serialize(message)?;
        for client in clients.values() {
            let mut stream = client.lock().await;
            // stream.write_all(&serialized).await?;
        }
        Ok(())
    }

    async fn receive(&self) -> Result<Message, Box<dyn Error + Send + Sync>> {
        let clients = self.clients.lock().await;
        let mut buffer = vec![0; 1024];
        for client in clients.values() {
            let mut stream = client.lock().await;
            // let n = stream.read(&mut buffer).await?;
            // if n > 0 {
            //     // let message: Message = bincode::deserialize(&buffer[..n])?;
            //     let message_content = String::from_utf8(buffer[..n].to_vec())?;
            //     let message = Message::new(message_content.into_bytes());

            //     return Ok(message);
            // }
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
        self.close().await?;
        Ok(())
    }

    async fn on_disconnect(&self) -> Result<(), Box<dyn Error + Send + Sync>> {
        let app_handle = get_app_handle();
        // 构造断开连接事件的 payload
        let payload = serde_json::json!({
            "channel": "tcpserver",
            "reason": "The tcpserver channel has been disconnected",
        });

        // 发送断开连接事件
        app_handle
            .emit("channel-disconnected", serde_json::to_string(&payload)?)
            .unwrap();

        Ok(())
    }
}
