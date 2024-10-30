use crate::combridage::CommunicationChannel;
use crate::combridage::Message;
use crate::global::get_app_handle;
use async_trait::async_trait;
use serde_json;
use std::error::Error;
use std::time::Duration;
use std::{io::Read, sync::Arc};
use tauri::Emitter;
use tauri::{Manager, Wry};
use tokio::time::timeout; // Don't forget to import timeout for your send_and_wait method
use tokio::{io::AsyncWriteExt, sync::Mutex};
use tokio_serial::SerialStream; // Import for serial communication
pub struct SerialPortChannel {
    port: Arc<Mutex<SerialStream>>,
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
        let serialbuilder = tokio_serial::new(port_name, baud_rate);

        let port = SerialStream::open(
            &serialbuilder
                .data_bits(databit)
                .flow_control(fowctrl)
                .parity(parity)
                .stop_bits(stopbit),
        )?;

        Ok(Self {
            port: Arc::new(Mutex::new(port)),
        })
    }

    pub async fn close(&self) -> Result<(), Box<dyn Error + Send + Sync>> {
        let mut port = self.port.lock().await;
        port.shutdown().await?;
        Ok(())
    }
}

#[async_trait]
impl CommunicationChannel for SerialPortChannel {
    async fn send(&self, message: &Message) -> Result<(), Box<dyn Error + Send + Sync>> {
        let mut port = self.port.lock().await;
        // let serialized = bincode::serialize(message)?;
        let message_bytes = message.content.as_bytes();
        port.write_all(message_bytes).await?;
        println!("SerialPortChannel Sent: {:?}", message);
        Ok(())
    }

    async fn receive(&self) -> Result<Message, Box<dyn Error + Send + Sync>> {
        let mut port = self.port.lock().await;
        let mut buffer = vec![0; 1024]; // 缓冲区大小适合串口通信
        let n = port.read(&mut buffer)?; // 等待异步读取，返回读取到的字节数

        // 使用读取到的字节创建 Message
        let message_content = String::from_utf8(buffer[..n].to_vec())?; // 仅截取实际读取的部分
        let message = Message::new(message_content.into_bytes());

        println!("SerialPortChannel Received: {:?}", message);
        Ok(message)
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
            "channel": "serialport",
            "reason": "The serialport channel has been disconnected",
        });
        println!("SerialPortChannel disconnected");
        // 发送断开连接事件
        app_handle
            .emit("channel-disconnected", serde_json::to_string(&payload)?)
            .unwrap();

        Ok(())
    }
}
