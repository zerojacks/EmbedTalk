// Re-export the channel types
mod bluetooth;
mod commanger;
mod mqtt;
mod serial_port;
mod tcp_client;
mod tcp_server;

pub use bluetooth::BluetoothChannel;
pub use commanger::CommunicationManager;
pub use mqtt::MqttChannel;
use serde::{Deserialize, Serialize};
use serde_json::Number;
pub use serial_port::SerialPortChannel;
pub use tcp_client::TcpClientChannel;
pub use tcp_server::TcpServerChannel;
// Define the CommunicationChannel trait here
use async_trait::async_trait;
use std::error::Error;
use std::sync::Arc;
use tauri::{Manager, Wry};
use tokio_serial::{DataBits, FlowControl, Parity, StopBits};
use uuid::Uuid;

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct Message {
    id: String,
    content: String,
    timestamp: i64,
}

impl Message {
    fn new(content: Vec<u8>) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            content: String::from_utf8(content).unwrap(),
            timestamp: chrono::Utc::now().timestamp(),
        }
    }
}

#[derive(Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum ChannelType {
    TcpClient(String, u16),                                // Address, port
    TcpServer(String, u16),                                // Address, port
    SerialPort(String, u32, u8, u8, String, u8), // Port name, baud rate, data bits, flowctrl, parity, stop bits
    Mqtt(String, u16, String, String, String, u8, String), // ip, port, username, password, client id, qos, topic
    Bluetooth(String, String, String), // Device name or MAC address, service UUID, characteristic UUID
}

#[async_trait]
pub trait CommunicationChannel: Send + Sync {
    async fn send(&self, message: &Message) -> Result<(), Box<dyn Error + Send + Sync>>;
    async fn receive(&self) -> Result<Message, Box<dyn Error + Send + Sync>>;
    async fn send_and_wait(
        &self,
        message: &Message,
        timeout_secs: u64,
    ) -> Result<Message, Box<dyn Error + Send + Sync>>;
    async fn close(&self) -> Result<(), Box<dyn Error + Send + Sync>>;
    async fn on_disconnect(&self) -> Result<(), Box<dyn Error + Send + Sync>>;
}
