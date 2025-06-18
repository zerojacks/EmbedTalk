use crate::combridage::messagemanager::{MessageDirection, MessageManager};
use crate::combridage::CommunicationChannel;
use crate::combridage::{ChannelState, Message};
use crate::global::get_app_handle;
use async_trait::async_trait;
use rumqttc::{AsyncClient, Event, MqttOptions, Packet, QoS};
use serde_json;
use std::collections::HashMap;
use std::error::Error;
use std::sync::Arc;
use std::time::Duration;
use tauri::Emitter;
use tokio::sync::{broadcast, mpsc, Mutex};
use tokio::time::{sleep, timeout};
use uuid::Uuid;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct MqttMessage {
    topic: String,
    payload: String,
    qos: u8,
    retain: bool,
}

pub struct MqttChannel {
    channeltype: String,
    channelid: String,
    channel_name: String,
    client: AsyncClient,
    topic: String,
    shutdown_signal: broadcast::Sender<()>,
    tx_send: mpsc::Sender<MqttMessage>,
    rx_recv: Arc<Mutex<mpsc::Receiver<MqttMessage>>>,
    topics: Arc<Mutex<HashMap<String, QoS>>>,
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

        let (client, eventloop) = AsyncClient::new(mqttoptions, 10);
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
            topics: Arc::new(Mutex::new(HashMap::new())),
        };

        // 初始化消息管理器
        let app_handle = get_app_handle();
        let message_manager = MessageManager::new(app_handle)?;
        let _ = message_manager
            .register_channel(&format!("{}:{}", broker, port))
            .await;

        // 启动发送任务
        let send_client = client.clone();
        let channeltype = channel.channeltype.clone();
        let channelid = channel.channelid.clone();
        let channel_name = channel.channel_name.clone();
        let message_manager_send = message_manager.clone();
        tokio::spawn(async move {
            if let Err(e) = Self::send_task(
                send_client,
                rx_send,
                channeltype,
                channelid,
                channel_name,
                message_manager_send,
            )
            .await
            {
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
                shutdown,
            )
            .await
            {
                eprintln!("MQTT receive task error: {}", e);
            }
        });

        Ok(channel)
    }

    // 发送任务
    async fn send_task(
        client: AsyncClient,
        mut rx_send: mpsc::Receiver<MqttMessage>,
        channeltype: String,
        channelid: String,
        channel_name: String,
        message_manager: MessageManager,
    ) -> Result<(), Box<dyn Error + Send + Sync>> {
        while let Some(data) = rx_send.recv().await {
            client
                .publish(
                    &data.topic,
                    QoSLevel::from(data.qos).into_inner(),
                    data.retain,
                    data.payload.as_bytes(),
                )
                .await?;

            let payload = serde_json::json!({
                "data": data,
                "topic": data.topic,
                "qos": u8::from(QoSLevel::from(data.qos))
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
                    None,
                ),
            )
            .await
            {
                eprintln!("Timeout recording sent message: {:?}", e);
            }
        }
        Ok(())
    }

    // 接收任务
    async fn receive_task(
        mut eventloop: rumqttc::EventLoop,
        tx_recv: mpsc::Sender<MqttMessage>,
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
                                "data": received_data.clone(),
                                "topic": publish.topic,
                                "qos": u8::from(QoSLevel::from(publish.qos))
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
                            let mqtt_message = MqttMessage {
                                topic: publish.topic.to_string(),
                                payload: String::from_utf8(received_data).unwrap_or_default(),
                                qos: u8::from(QoSLevel::from(publish.qos)),
                                retain: publish.retain
                            };

                            // 使用 try_send 发送到接收队列
                            if let Err(e) = tx_recv.try_send(mqtt_message) {
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

    pub async fn disconnect_mqtt(&self) -> Result<(), Box<dyn Error + Send + Sync>> {
        // 先发送关闭信号，通知所有任务准备关闭
        let _ = self.shutdown_signal.send(());

        // 等待任务正常退出
        sleep(Duration::from_millis(300)).await;

        // 尝试断开MQTT连接，但使用timeout避免永久阻塞
        // 如果出现错误，记录但不返回失败
        match timeout(Duration::from_secs(2), self.client.disconnect()).await {
            Ok(result) => {
                if let Err(e) = result {
                    eprintln!("MQTT断开连接时发生错误，但将继续处理: {}", e);
                    // 不返回错误，继续处理
                }
            }
            Err(_) => {
                eprintln!("MQTT断开连接超时，但将继续处理");
                // 超时也继续处理
            }
        }

        // 无论断开连接成功与否，都发送状态变更事件
        if let Err(e) = self.on_statechange(ChannelState::Disconnected).await {
            eprintln!("发送MQTT断开连接状态变更事件失败: {}", e);
        }

        // 始终返回成功，确保调用方能正确处理
        Ok(())
    }
}

#[derive(Debug, Clone, Copy)]
pub struct QoSLevel(QoS);

impl QoSLevel {
    pub fn into_inner(self) -> QoS {
        self.0
    }
}

impl From<QoS> for QoSLevel {
    fn from(qos: QoS) -> Self {
        QoSLevel(qos)
    }
}

impl From<u8> for QoSLevel {
    fn from(value: u8) -> Self {
        match value {
            0 => QoSLevel(QoS::AtMostOnce),
            1 => QoSLevel(QoS::AtLeastOnce),
            2 => QoSLevel(QoS::ExactlyOnce),
            _ => QoSLevel(QoS::AtLeastOnce), // Default to QoS 1 for invalid values for better reliability
        }
    }
}

impl From<QoSLevel> for u8 {
    fn from(qos: QoSLevel) -> Self {
        match qos.0 {
            QoS::AtMostOnce => 0,
            QoS::AtLeastOnce => 1,
            QoS::ExactlyOnce => 2,
        }
    }
}

#[async_trait]
impl CommunicationChannel for MqttChannel {
    async fn send(
        &self,
        message: &Message,
        _clientid: Option<String>,
    ) -> Result<(), Box<dyn Error + Send + Sync>> {
        let content = message.get_content();
        //需要将content中提取"data"字段，再从这个data里面提取"topic"字段，然后根据这个topic字段，将message的内容发送出去
        let topic = content["data"]["topic"].as_str().unwrap_or("default_topic");
        let qos = content["data"]["qos"].as_u64().unwrap_or(0);
        let payload = content["data"]["payload"]
            .as_str()
            .unwrap_or("default_payload");
        let qos_level = QoSLevel::from(qos as u8);
        let retain = content["data"]["retain"].as_bool().unwrap_or(false);

        self.tx_send
            .send(MqttMessage {
                topic: topic.to_string(),
                payload: payload.to_string(),
                qos: qos as u8,
                retain: retain,
            })
            .await
            .map_err(|e| {
                Box::<dyn Error + Send + Sync>::from(format!("Failed to send message: {:?}", e))
            })?;

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
        self.disconnect_mqtt().await?;
        Ok(())
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

    async fn subscribe_topic(
        &self,
        topic: &str,
        qos: u8,
    ) -> Result<(), Box<dyn Error + Send + Sync>> {
        self.client
            .subscribe(topic, QoSLevel::from(qos).into_inner())
            .await?;
        self.topics
            .lock()
            .await
            .insert(topic.to_string(), QoSLevel::from(qos).into_inner());
        println!("MQTT subscribe topic: {}", topic);
        Ok(())
    }

    async fn unsubscribe_topic(&self, topic: &str) -> Result<(), Box<dyn Error + Send + Sync>> {
        self.client.unsubscribe(topic).await?;
        self.topics.lock().await.remove(topic);
        println!("MQTT unsubscribe topic: {}", topic);
        Ok(())
    }
}
