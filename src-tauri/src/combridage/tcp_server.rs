use crate::combridage::messagemanager::{MessageDirection, MessageManager};
use crate::combridage::CommunicationChannel;
use crate::combridage::{ChannelState, Message};
use crate::global::get_app_handle;
use async_trait::async_trait;
use chrono;
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
use uuid::Uuid;

#[derive(Clone, Debug)]
pub struct TcpClientOfServer {
    channeltype: String,
    channelid: String,
    channel_name: String,
    shutdown_signal: broadcast::Sender<()>,
    tx_send: mpsc::Sender<Vec<u8>>,
    rx_message: Arc<Mutex<mpsc::Receiver<Vec<u8>>>>,
}

impl TcpClientOfServer {
    pub async fn new(stream: TcpStream) -> Result<Self, Box<dyn Error + Send + Sync>> {
        println!("创建新的 TcpClientOfServer");
        let peer_addr = stream.peer_addr()?;
        println!("客户端地址: {}", peer_addr);

        let std_stream = stream.into_std()?;
        std_stream.set_nonblocking(true)?;
        std_stream.set_nodelay(true)?;

        let (shutdown_signal, _) = broadcast::channel(1);
        let (tx_send, mut rx_send) = mpsc::channel::<Vec<u8>>(100); // 发送队列
        let (tx_message, rx_message) = mpsc::channel::<Vec<u8>>(100); // 消息队列

        let tokio_stream = TcpStream::from_std(std_stream)?;
        let (mut reader, mut writer) = tokio::io::split(tokio_stream);

        // 启动发送任务
        let shutdown = shutdown_signal.subscribe();
        tokio::spawn(async move {
            let mut shutdown_rx = shutdown;
            loop {
                tokio::select! {
                    Some(data) = rx_send.recv() => {
                        println!("准备发送数据到 {}，长度: {}", peer_addr, data.len());
                        if let Err(e) = writer.write_all(&data).await {
                            eprintln!("写入数据失败: {:?}", e);
                            break;
                        }
                        if let Err(e) = writer.flush().await {
                            eprintln!("刷新数据失败: {:?}", e);
                            break;
                        }
                        println!("数据发送完成");
                    }
                    _ = shutdown_rx.recv() => {
                        println!("发送任务收到关闭信号");
                        break;
                    }
                }
            }
        });

        // 启动接收任务
        let shutdown = shutdown_signal.subscribe();
        let tx_message = tx_message.clone();
        let peer_addr_str = peer_addr.to_string();

        tokio::spawn(async move {
            println!("[{}] 启动读取任务", peer_addr_str);
            let mut buffer = vec![0; 1024];

            loop {
                match reader.read(&mut buffer).await {
                    Ok(n) if n > 0 => {
                        println!("[{}] 读取到数据，长度: {}", peer_addr_str, n);
                        let data = buffer[..n].to_vec();
                        match tx_message.send(data).await {
                            Ok(_) => println!("[{}] 数据已发送到消息通道", peer_addr_str),
                            Err(e) => {
                                eprintln!("[{}] 发送数据到消息通道失败: {:?}", peer_addr_str, e);
                                break;
                            }
                        }
                    }
                    Ok(0) => {
                        println!("[{}] 连接已关闭", peer_addr_str);
                        break;
                    }
                    Ok(n) => {
                        println!("[{}] 读取到 {} 字节的数据", peer_addr_str, n);
                        continue;
                    }
                    Err(e) => {
                        if e.kind() == std::io::ErrorKind::WouldBlock {
                            println!("[{}] 暂无数据可读", peer_addr_str);
                            tokio::time::sleep(Duration::from_millis(10)).await;
                            continue;
                        } else {
                            eprintln!("[{}] 读取错误: {:?}", peer_addr_str, e);
                            break;
                        }
                    }
                }
            }
            println!("[{}] 读取任务结束", peer_addr_str);
        });

        let channel = Self {
            channeltype: "tcpserver".to_string(),
            channelid: "tcpserver".to_string() + &Uuid::new_v4().to_string(),
            channel_name: "TCP".to_string() + &peer_addr.to_string(),
            shutdown_signal: shutdown_signal.clone(),
            tx_send,
            rx_message: Arc::new(Mutex::new(rx_message)),
        };

        let channeltype = channel.channeltype.clone();
        let channelid = channel.channelid.clone();
        let channel_for_spawn = channel.clone();
        let channel_name = channel.channel_name.clone();
        tokio::spawn(async move {
            let app_handle = get_app_handle();
            let message_manager = match MessageManager::new(app_handle.clone()) {
                Ok(manager) => manager,
                Err(e) => {
                    eprintln!("创建消息管理器失败: {:?}", e);
                    return;
                }
            };
            let mut channel_clone = channel_for_spawn.clone();
            while let Some(data) = channel_clone.receive().await {
                println!("接收到消息，长度: {}", data.len());
                // 记录发送的消息
                if let Err(e) = message_manager
                    .record_message(
                        &channeltype,
                        &channelid,
                        &channel_name,
                        &Message::new(serde_json::json!({
                            "data": data
                        })),
                        MessageDirection::Received,
                        None,
                    )
                    .await
                {
                    eprintln!("记录发送消息失败: {:?}", e);
                }
            }
        });

        println!("TcpClientOfServer 创建完成");
        Ok(channel.clone())
    }

    pub async fn send(&self, message: Vec<u8>) -> Result<(), Box<dyn Error + Send + Sync>> {
        println!("尝试发送消息，长度: {}", message.len());
        self.tx_send.send(message).await.map_err(|e| e.into())
    }

    pub async fn receive(&mut self) -> Option<Vec<u8>> {
        let mut rx = self.rx_message.lock().await;
        rx.recv().await.map_or(None, |data| {
            println!(
                "TcpClientOfServer::receive - 接收到数据，长度: {}",
                data.len()
            );
            Some(data)
        })
    }

    pub async fn close(&self) -> Result<(), Box<dyn Error + Send + Sync>> {
        println!("关闭客户端连接");
        let _ = self.shutdown_signal.send(());
        Ok(())
    }
}

#[derive(Clone, Debug)]
pub struct TcpServerChannel {
    channeltype: String,
    channelid: String,
    channel_name: String,
    clients: Arc<Mutex<HashMap<String, TcpClientOfServer>>>,
    shutdown_signal: broadcast::Sender<()>,
    listener: Arc<Mutex<Option<TcpListener>>>,
    message_manager: Arc<MessageManager>,
}

impl TcpServerChannel {
    pub async fn new(
        ipaddr: &str,
        port: u16,
    ) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let address = format!("{}:{}", ipaddr, port);
        let (shutdown_signal, _) = broadcast::channel(1);
        println!("TcpServerChannel listening on: {}", address);
        let channel_name = "TCP".to_string() + &address.clone();
        let std_listener = std::net::TcpListener::bind(address)?;
        std_listener.set_nonblocking(true)?;
        let listener = TcpListener::from_std(std_listener)?;

        let app_handle = get_app_handle();
        let message_manager = Arc::new(MessageManager::new(app_handle.clone())?);

        let server = Self {
            channeltype: "tcpserver".to_string(),
            channelid: "tcpserver".to_string() + &Uuid::new_v4().to_string(),
            channel_name: channel_name,
            clients: Arc::new(Mutex::new(HashMap::new())),
            shutdown_signal: shutdown_signal.clone(),
            listener: Arc::new(Mutex::new(Some(listener))),
            message_manager,
        };

        let server_clone = server.clone();
        tokio::spawn(async move {
            if let Err(e) = server_clone.accept_loop().await {
                eprintln!("Accept loop error: {:?}", e);
            }
        });

        Ok(server)
    }

    async fn start_client_message_handler(
        &self,
        client_addr: String,
        mut client: TcpClientOfServer,
    ) {
        println!("启动客户端消息处理器: {}", client_addr);
        let message_manager = self.message_manager.clone();

        tokio::spawn(async move {
            println!("开始监听客户端消息: {}", client_addr);
            while let Some(data) = client.receive().await {
                println!("收到客户端消息: {} 长度: {}", client_addr, data.len());

                // 创建消息内容
                let content = serde_json::json!({
                    "data": data
                });

                if let Err(e) = message_manager
                    .record_message(
                        &client.channeltype.clone(),
                        &client.channelid,
                        &client.channel_name,
                        &Message::new(content.clone()),
                        MessageDirection::Received,
                        None,
                    )
                    .await
                {
                    eprintln!("记录消息失败: {:?}", e);
                } else {
                    println!("消息已记录并处理: {} -> {:?}", client_addr, content);
                }
            }
            println!("客户端消息处理器停止: {}", client_addr);
        });
    }

    async fn accept_loop(&self) -> Result<(), Box<dyn Error + Send + Sync>> {
        let mut shutdown_receiver = self.shutdown_signal.subscribe();

        println!("TCP服务器开始接受连接");

        loop {
            tokio::select! {
                _ = shutdown_receiver.recv() => {
                    println!("Accept loop received shutdown signal");
                    break;
                }
                accept_result = async {
                    if let Some(listener) = &*self.listener.lock().await {
                        match listener.accept().await {
                            Ok(result) => Ok(result),
                            Err(e) => {
                                eprintln!("接受连接时出错: {:?}", e);
                                Err(e)
                            }
                        }
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
                                    {
                                        let mut clients = self.clients.lock().await;
                                        clients.insert(client.channelid.clone(), client.clone());
                                    }

                                    let client_clone = client.clone();
                                    // 启动消息处理器
                                    self.start_client_message_handler(addr_str.clone(), client_clone).await;

                                    // 发送连接事件
                                    let app_handle = get_app_handle();
                                    let channel_info = serde_json::json!({
                                        "channel": "tcpserver",
                                        "eventType": "clientConnected",
                                        "clientId": client.channelid.clone(),
                                        "ip": addr.ip().to_string(),
                                        "port": addr.port()
                                    });

                                    if let Ok(event_payload) = serde_json::to_string(&channel_info) {
                                        if let Err(e) = app_handle.emit("tcp-client-event", event_payload) {
                                            eprintln!("发送客户端连接事件失败: {:?}", e);
                                        }
                                    }
                                },
                                Err(e) => {
                                    eprintln!("创建客户端对象失败: {} 错误: {:?}", addr_str, e);
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
            if let Err(e) = client.close().await {
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

    pub async fn is_client_connected(&self, client_id: &str) -> bool {
        let clients = self.clients.lock().await;
        clients.contains_key(client_id)
    }
}

#[async_trait]
impl CommunicationChannel for TcpServerChannel {
    async fn send(
        &self,
        message: &Message,
        clientid: Option<String>,
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
        println!(
            "TcpServerChannel::send - 发送消息{:?} data: {:?}",
            message, data
        );
        let app_handle = get_app_handle();
        let message_manager = MessageManager::new(app_handle.clone())?;

        let mut message_clone = message.clone();
        message_clone.update_timestamp();

        if let Some(clientid) = clientid {
            let client_arc = {
                let clients = self.clients.lock().await;
                clients.get(clientid.as_str()).cloned()
            };
            println!("client_arc: {:?}", client_arc);
            if let Some(client) = client_arc {
                println!("准备发送消息");
                client.send(data.clone()).await?;
                println!("消息发送完成");
                // 记录发送的消息

                if let Err(e) = message_manager
                    .record_message(
                        &client.channeltype,
                        &client.channelid,
                        &client.channel_name,
                        &message_clone,
                        MessageDirection::Sent,
                        None,
                    )
                    .await
                {
                    eprintln!("记录发送消息失败: {:?}", e);
                }
                Ok(())
            } else {
                Err(format!("客户端 {} 不存在", clientid).into())
            }
        } else {
            let clients = self.clients.lock().await;
            for client in clients.values() {
                client.send(data.clone()).await?;

                if let Err(e) = message_manager
                    .record_message(
                        &client.channeltype,
                        &client.channelid,
                        &client.channel_name,
                        &message_clone,
                        MessageDirection::Sent,
                        None,
                    )
                    .await
                {
                    eprintln!("记录发送消息失败: {:?}", e);
                }
            }
            Ok(())
        }
    }

    async fn receive(&self) -> Result<Message, Box<dyn Error + Send + Sync>> {
        // 使用带超时的通道来接收消息
        let (tx, mut rx) = mpsc::channel::<(String, Vec<u8>)>(32);
        let timeout_duration = Duration::from_millis(100);

        let client_refs: Vec<(String, TcpClientOfServer)> = {
            let clients = self.clients.lock().await;
            if clients.is_empty() {
                return Err("No clients connected".into());
            }
            clients
                .iter()
                .map(|(addr, client)| (addr.clone(), client.clone()))
                .collect()
        };

        // 为每个客户端创建一个异步任务尝试接收消息
        // let mut tasks = Vec::new();
        // for (client_addr, mut client) in client_refs {
        //     let tx = tx.clone();
        //     let task = tokio::spawn(async move {
        //         if let Some(data) = client.receive().await {
        //             let _ = tx.send((client_addr, data)).await;
        //         }
        //     });
        //     tasks.push(task);
        // }
        Err("No message received".into())
    }

    async fn send_and_wait(
        &self,
        message: &Message,
        timeout_secs: u64,
    ) -> Result<Message, Box<dyn Error + Send + Sync>> {
        self.send(message, None).await?;
        timeout(Duration::from_secs(timeout_secs), self.receive()).await?
    }

    async fn close(&self) -> Result<(), Box<dyn Error + Send + Sync>> {
        self.close().await
    }

    async fn on_statechange(
        &self,
        state: ChannelState,
    ) -> Result<(), Box<dyn Error + Send + Sync>> {
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

    fn get_channel_id(&self) -> String {
        self.channelid.clone()
    }

    async fn subscribe_topic(
        &self,
        _topic: &str,
        _qos: u8,
    ) -> Result<(), Box<dyn Error + Send + Sync>> {
        Err("TCP server does not support topic subscription".into())
    }

    async fn unsubscribe_topic(&self, _topic: &str) -> Result<(), Box<dyn Error + Send + Sync>> {
        Err("TCP server does not support topic unsubscription".into())
    }
}
