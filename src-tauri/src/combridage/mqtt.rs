use crate::combridage::ChannelType;
use crate::combridage::CommunicationChannel;
use crate::combridage::{Message, ChannelState};
use crate::global::get_app_handle;
use async_trait::async_trait;
use rumqttc::{AsyncClient, Event, MqttOptions, Packet, QoS};
use serde_json;
use std::collections::HashMap;
use std::error::Error;
use std::sync::Arc;
use std::time::Duration;
use tauri::Emitter;
use tauri::{Manager, Wry};
use tokio::sync::mpsc;
use tokio::sync::Mutex;
pub struct MqttChannel {
    client: AsyncClient,
    topic: String,
    receiver: Arc<Mutex<mpsc::Receiver<String>>>,
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

        let (tx, rx) = mpsc::channel(100);
        tokio::spawn(async move {
            while let Ok(event) = eventloop.poll().await {
                if let Event::Incoming(Packet::Publish(publish)) = event {
                    if let Ok(message) = bincode::deserialize(&publish.payload) {
                        let _ = tx.send(message).await;
                    }
                }
            }
        });

        Ok(Self {
            client,
            topic: topic.to_string(),
            receiver: Arc::new(Mutex::new(rx)),
        })
    }

    pub async fn set_subscriber(
        &mut self,
        topic: &str,
    ) -> Result<(), Box<dyn Error + Send + Sync>> {
        self.client.subscribe(topic, QoS::AtLeastOnce).await?;
        Ok(())
    }

    pub async fn close(&self) -> Result<(), Box<dyn Error + Send + Sync>> {
        self.client.disconnect().await?;
        Ok(())
    }
}

#[async_trait]
impl CommunicationChannel for MqttChannel {
    async fn send(&self, message: &Message) -> Result<(), Box<dyn Error + Send + Sync>> {
        // let serialized = bincode::serialize(message.content)?;
        let serialized = serde_json::to_vec(&message.content)?;
        self.client
            .publish(&self.topic, QoS::AtLeastOnce, false, serialized)
            .await?;
        println!("MqttChannel Sent message: {:?}", message.content);
        Ok(())
    }

    async fn receive(&self) -> Result<Message, Box<dyn Error + Send + Sync>> {
        let mut receiver = self.receiver.lock().await; // 获取可变引用
        if let Some(payload) = receiver.recv().await {
            let content: serde_json::Value = serde_json::from_str(&payload)?;
            let message = Message::new(content);
            println!("MqttChannel Received message: {:?}", message);
            Ok(message)
        } else {
            Err("MQTT channel closed".into())
        }
    }

    async fn send_and_wait(
        &self,
        message: &Message,
        timeout_secs: u64,
    ) -> Result<Message, Box<dyn Error + Send + Sync>> {
        self.send(message).await?;
        tokio::time::timeout(Duration::from_secs(timeout_secs), self.receive()).await?
    }

    async fn close(&self) -> Result<(), Box<dyn Error + Send + Sync>> {
        self.close().await?;
        Ok(())
    }

    async fn on_statechange(&self, state:ChannelState) -> Result<(), Box<dyn Error + Send + Sync>> {
        let app_handle = get_app_handle();
        // 构造断开连接事件的 payload
        let payload = serde_json::json!({
            "channel": "MQTT",
            "reason": "The MQTT channel has been disconnected",
        });
        println!("MQTT channel disconnected. Reason: {:?}", payload);
        // 发送断开连接事件
        app_handle
            .emit("channel-state", serde_json::to_string(&payload)?)
            .unwrap();

        Ok(())
    }
}
