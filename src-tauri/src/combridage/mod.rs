// Re-export the channel types
mod bluetooth;
mod commanger;
mod messagemanager;
mod mqtt;
mod serial_port;
mod tcp_client;
mod tcp_server;

pub use bluetooth::BluetoothChannel;
pub use commanger::CommunicationManager;
pub use mqtt::MqttChannel;
use serde::{Deserialize, Serialize};
pub use serial_port::SerialPortChannel;
pub use tcp_client::TcpClientChannel;
pub use tcp_server::TcpServerChannel;
// Define the CommunicationChannel trait here
use async_trait::async_trait;
use serde_json::Value;
use std::error::Error;
use uuid::Uuid;

#[derive(Clone, Serialize, Deserialize, Debug)]
pub enum ChannelState {
    Connected,
    Disconnected,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct Message {
    id: String,
    content: Value,
    timestamp: i64,
}

impl Message {
    pub fn new(content: Value) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            content: content,
            timestamp: chrono::Utc::now().timestamp_millis(), // 使用 timestamp_millis 获取毫秒级时间戳
        }
    }

    // 添加 getter 方法，获取 content 字段
    pub fn get_content(&self) -> &Value {
        &self.content
    }
    
    // 添加 get_payload 方法作为 get_content 的别名，以保持兼容性
    pub fn get_payload(&self) -> &Value {
        &self.content
    }
    pub fn update_timestamp(&mut self) {
        self.timestamp = chrono::Utc::now().timestamp_millis();
    }
}

#[derive(Clone, Serialize, Deserialize, PartialEq, Eq, Hash, Debug)]
pub enum ChannelType {
    TcpClient(String, u16),                                // Address, port
    TcpServer(String, u16),                                // Address, port
    SerialPort(String, u32, u8, u8, String, u8), // Port name, baud rate, data bits, flowctrl, parity, stop bits
    Mqtt(String, u16, String, String, String, u8, String), // ip, port, username, password, client id, qos, topic
    Bluetooth(String, String, String), // Device name or MAC address, service UUID, characteristic UUID
}

#[async_trait]
pub trait CommunicationChannel: Send + Sync {
    fn get_channel_id(&self) -> String;
    async fn send(&self, message: &Message, clientid: Option<String>) -> Result<(), Box<dyn Error + Send + Sync>>;
    async fn receive(&self) -> Result<Message, Box<dyn Error + Send + Sync>>;
    async fn send_and_wait(
        &self,
        message: &Message,
        timeout_secs: u64,
    ) -> Result<Message, Box<dyn Error + Send + Sync>>;
    async fn close(&self) -> Result<(), Box<dyn Error + Send + Sync>>;
    async fn on_statechange(&self, state: ChannelState)
        -> Result<(), Box<dyn Error + Send + Sync>>;
}
