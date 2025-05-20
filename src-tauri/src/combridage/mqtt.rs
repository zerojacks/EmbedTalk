use crate::combridage::CommunicationChannel;
use crate::combridage::{ChannelState, Message};
use crate::combridage::messagemanager::{MessageDirection, MessageManager};
use crate::global::get_app_handle;
use async_trait::async_trait;
use rumqttc::{AsyncClient, Event, MqttOptions, Packet, QoS};
use serde_json;
use uuid::Uuid;
use std::error::Error;
use std::sync::Arc;
use std::time::Duration;
use tauri::Emitter;
use tokio::sync::{mpsc, broadcast, Mutex};
use tokio::time::{timeout, sleep};

pub struct MqttChannel {
    channeltype: String,
    channelid: String,
    channel_name: String,
    client: AsyncClient,
    topic: String,
    shutdown_signal: broadcast::Sender<()>,
    tx_send: mpsc::Sender<Vec<u8>>,
    rx_recv: Arc<Mutex<mpsc::Receiver<Vec<u8>>>>,
}

impl MqttChannel {
    pub async fn new(
        broker: &str,
        port: u16,
        username: &str,
        password: &str,
        client_id: &str,
        qos: QoS,
        topic: &str,
    ) -> Result<Self, Box<dyn Error + Send + Sync>> {
        let mut mqttoptions = MqttOptions::new(client_id, broker, port);
        mqttoptions.set_keep_alive(Duration::from_secs(5));

        let (client, mut eventloop) = AsyncClient::new(mqttoptions, 10);
        client.subscribe(topic, qos).await?;

        let (shutdown_signal, _) = broadcast::channel(1);
        let (tx_send, rx_send) = mpsc::channel(100); // 发送队列
        let (tx_recv, rx_recv) = mpsc::channel(100); // 接收队列

        let channel = Self {
            channeltype: "mqtt".to_string(),
            channelid: "mqtt".to_string() + &Uuid::new_v4().to_string(),
            channel_name: "mqtt".to_string() + &broker.to_string() + ":" + &port.to_string(),
            client: client.clone(),
            topic: topic.to_string(),
            shutdown_signal,
            tx_send,
            rx_recv: Arc::new(Mutex::new(rx_recv)),
        };

        // 初始化消息管理器
        let app_handle = get_app_handle();
        let message_manager = MessageManager::new(app_handle)?;
        let _ = message_manager.register_channel(&format!("{}:{}", broker, port)).await;

        // 启动发送任务
        let send_client = client.clone();
        let send_topic = topic.to_string();
        let channeltype = channel.channeltype.clone();
        let channelid = channel.channelid.clone();
        let channel_name = channel.channel_name.clone();
        let message_manager_send = message_manager.clone();
        tokio::spawn(async move {
            if let Err(e) = Self::send_task(
                send_client,
                send_topic,
                rx_send,
                channeltype,
                channelid,
                channel_name,
                message_manager_send
            ).await {
                eprintln!("MQTT send task error: {}", e);
            }
        });

        // 启动接收任务
        let channeltype = channel.channeltype.clone();
        let channelid = channel.channelid.clone();
        let channel_name = channel.channel_name.clone();
        let message_manager_rec = message_manager.clone();
        let shutdown = channel.shutdown_signal.subscribe();
        tokio::spawn(async move {
            if let Err(e) = Self::receive_task(
                eventloop,
                tx_recv,
                channeltype,
                channelid,
                channel_name,
                message_manager_rec,
                shutdown
            ).await {
                eprintln!("MQTT receive task error: {}", e);
            }
        });

        Ok(channel)
    }

    // 发送任务
    async fn send_task(
        client: AsyncClient,
        topic: String,
        mut rx_send: mpsc::Receiver<Vec<u8>>,
        channeltype: String,
        channelid: String,
        channel_name: String,
        message_manager: MessageManager,
    ) -> Result<(), Box<dyn Error + Send + Sync>> {
        while let Some(data) = rx_send.recv().await {
            client.publish(&topic, QoS::AtLeastOnce, false, data.clone()).await?;
            
            let payload = serde_json::json!({
                "data": data
            });
            let message = Message::new(payload);
            
            if let Err(e) = timeout(
                Duration::from_secs(1),
                message_manager.record_message(
                    &channeltype,
                    &channelid,
                    &channel_name,
                    &message,
                    MessageDirection::Sent,
                    None
                )
            ).await {
                eprintln!("Timeout recording sent message: {:?}", e);
            }
        }
        Ok(())
    }

    // 接收任务
    async fn receive_task(
        mut eventloop: rumqttc::EventLoop,
        tx_recv: mpsc::Sender<Vec<u8>>,
        channeltype: String,
        channelid: String,
        channel_name: String,
        message_manager: MessageManager,
        mut shutdown: broadcast::Receiver<()>,
    ) -> Result<(), Box<dyn Error + Send + Sync>> {
        let mut dropped_messages = 0;
        let mut last_log_time = std::time::Instant::now();

        loop {
            tokio::select! {
                _ = shutdown.recv() => {
                    println!("MQTT receive task received shutdown signal");
                    return Ok(());
                }
                event = eventloop.poll() => {
                    match event {
                        Ok(Event::Incoming(Packet::Publish(publish))) => {
                            let received_data = publish.payload.to_vec();
                            
                            let payload = serde_json::json!({
                                "data": received_data.clone()
                            });
                            let message = Message::new(payload);
                            
                            // 记录消息
                            if let Err(e) = timeout(
                                Duration::from_secs(1),
                                message_manager.record_message(
                                    &channeltype,
                                    &channelid,
                                    &channel_name,
                                    &message,
                                    MessageDirection::Received,
                                    None
                                )
                            ).await {
                                eprintln!("Timeout recording received message: {:?}", e);
                            }

                            // 使用 try_send 发送到接收队列
                            if let Err(e) = tx_recv.try_send(received_data) {
                                dropped_messages += 1;
                                
                                if dropped_messages % 100 == 0 || std::time::Instant::now().duration_since(last_log_time).as_secs() >= 10 {
                                    eprintln!("Queue full, dropped {} messages so far: {:?}", dropped_messages, e);
                                    last_log_time = std::time::Instant::now();
                                }
                                
                                sleep(Duration::from_millis(10)).await;
                            } else {
                                if dropped_messages > 0 {
                                    println!("Queue recovered after dropping {} messages", dropped_messages);
                                    dropped_messages = 0;
                                }
                            }
                        }
                        Ok(_) => continue,
                        Err(e) => {
                            eprintln!("MQTT event loop error: {:?}", e);
                            return Err(Box::new(e));
                        }
                    }
                }
            }
        }
    }

    pub async fn set_subscriber(
        &mut self,
        topic: &str,
    ) -> Result<(), Box<dyn Error + Send + Sync>> {
        self.client.subscribe(topic, QoS::AtLeastOnce).await?;
        Ok(())
    }

    pub async fn close(&self) -> Result<(), Box<dyn Error + Send + Sync>> {
        // 发送关闭信号
        let _ = self.shutdown_signal.send(());
        
        // 等待一段时间让任务正常退出
        sleep(Duration::from_millis(100)).await;
        
        // 断开 MQTT 连接
        self.client.disconnect().await?;
        
        // 发送状态变更事件
        self.on_statechange(ChannelState::Disconnected).await?;
        
        Ok(())
    }
}

#[async_trait]
impl CommunicationChannel for MqttChannel {
    async fn send(&self, message: &Message, _clientid: Option<String>) -> Result<(), Box<dyn Error + Send + Sync>> {
        let content = message.get_content();
        
        let bytes_to_send = if content.is_object() && content.get("data").is_some() {
            let data = &content["data"];
            
            if data.is_array() {
                let mut bytes = Vec::new();
                for item in data.as_array().unwrap() {
                    if let Some(byte) = item.as_u64() {
                        bytes.push(byte as u8);
                    }
                }
                bytes
            } else {
                serde_json::to_vec(data)?
            }
        } else {
            serde_json::to_vec(content)?
        };

        self.tx_send.send(bytes_to_send).await
            .map_err(|e| Box::<dyn Error + Send + Sync>::from(format!("Failed to send message: {:?}", e)))?;
        
        Ok(())
    }

    async fn receive(&self) -> Result<Message, Box<dyn Error + Send + Sync>> {
        let mut receiver = self.rx_recv.lock().await;
        if let Some(data) = receiver.recv().await {
            let payload = serde_json::json!({
                "data": data
            });
            Ok(Message::new(payload))
        } else {
            Err("MQTT channel closed".into())
        }
    }

    async fn send_and_wait(
        &self,
        message: &Message,
        timeout_secs: u64,
    ) -> Result<Message, Box<dyn Error + Send + Sync>> {
        self.send(message, None).await?;
        tokio::time::timeout(Duration::from_secs(timeout_secs), self.receive()).await?
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
            "channeltype": "mqtt",
            "channelId": self.channelid.clone(),
            "state": state,
            "data": {
                "topic": self.topic
            },
            "reason": "MQTT channel state changed"
        });
        
        app_handle.emit("channel-state", serde_json::to_string(&payload)?)?;
        Ok(())
    }

    fn get_channel_id(&self) -> String {
        self.channelid.clone()
    }
}
