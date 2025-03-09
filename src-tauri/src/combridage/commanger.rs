use crate::combridage::BluetoothChannel;
use crate::combridage::ChannelType;
use crate::combridage::CommunicationChannel;
use crate::combridage::Message;
use crate::combridage::MqttChannel;
use crate::combridage::SerialPortChannel;
use crate::combridage::TcpClientChannel;
use crate::combridage::TcpServerChannel;
use rumqttc::QoS;
use std::collections::HashMap;
use std::error::Error;
use std::sync::Arc;
use async_trait::async_trait;
use serde_json::Value;
use uuid::Uuid;

pub struct CommunicationManager {
    channels: HashMap<ChannelType, Box<dyn CommunicationChannel>>,
    channel_ids: HashMap<ChannelType, String>,
}

impl CommunicationManager {
    pub fn new() -> Self {
        CommunicationManager {
            channels: HashMap::new(),
            channel_ids: HashMap::new(),
        }
    }

    pub async fn add_channel(
        &mut self,
        channel_type: ChannelType,
    ) -> Result<String, Box<dyn Error + Send + Sync>> {
        let channel: Box<dyn CommunicationChannel> = match &channel_type {
            ChannelType::TcpClient(ipaddr, port) => {
                Box::new(TcpClientChannel::new(ipaddr, *port).await?)
            }
            ChannelType::TcpServer(ipaddr, port) => {
                Box::new(TcpServerChannel::new(ipaddr, *port).await?)
            }
            ChannelType::SerialPort(port, baud_rate, databit, flowctrl, parity, stopbit) => {
                let databit = match *databit {
                    5 => tokio_serial::DataBits::Five,
                    6 => tokio_serial::DataBits::Six,
                    7 => tokio_serial::DataBits::Seven,
                    8 => tokio_serial::DataBits::Eight,
                    _ => tokio_serial::DataBits::Eight,
                };
                let flowctrl = match *flowctrl {
                    0 => tokio_serial::FlowControl::None,
                    1 => tokio_serial::FlowControl::Software,
                    2 => tokio_serial::FlowControl::Hardware,
                    _ => tokio_serial::FlowControl::None,
                };
                let parity = match parity.as_str() {
                    "无校验" => tokio_serial::Parity::None,
                    "奇校验" => tokio_serial::Parity::Odd,
                    "偶校验" => tokio_serial::Parity::Even,
                    _ => tokio_serial::Parity::None,
                };
                let stopbits = match *stopbit {
                    1 => tokio_serial::StopBits::One,
                    2 => tokio_serial::StopBits::Two,
                    _ => tokio_serial::StopBits::One,
                };
                Box::new(
                    SerialPortChannel::new(port, *baud_rate, databit, flowctrl, parity, stopbits)
                        .await?,
                )
            }
            ChannelType::Mqtt(ipaddr, port, username, password, clientid, qos, topic) => {
                let qos = match *qos {
                    0 => QoS::AtMostOnce,
                    1 => QoS::AtLeastOnce,
                    2 => QoS::ExactlyOnce,
                    _ => QoS::AtMostOnce,
                };

                Box::new(
                    MqttChannel::new(ipaddr, *port, username, password, clientid, qos, topic)
                        .await?,
                )
            }
            ChannelType::Bluetooth(adapter, device, characteristic_uuid) => {
                Box::new(BluetoothChannel::new().await?)
            }
        };

        // 生成唯一的通道ID
        let channel_id = Uuid::new_v4().to_string();
        
        // 存储通道和通道ID的映射关系
        self.channels.insert(channel_type.clone(), channel);
        self.channel_ids.insert(channel_type, channel_id.clone());
        
        // 返回通道ID
        Ok(channel_id)
    }

    pub async fn send(
        &self,
        channel_type: &ChannelType,
        message: &Message,
    ) -> Result<(), Box<dyn Error + Send + Sync>> {
        if let Some(channel) = self.channels.get(channel_type) {
            channel.send(message).await
        } else {
            Err("Channel not found".into())
        }
    }

    pub async fn receive(
        &self,
        channel_type: &ChannelType,
    ) -> Result<Message, Box<dyn Error + Send + Sync>> {
        if let Some(channel) = self.channels.get(channel_type) {
            channel.receive().await
        } else {
            Err("Channel not found".into())
        }
    }

    pub async fn send_and_wait(
        &self,
        channel_type: &ChannelType,
        message: &Message,
        timeout_secs: u64,
    ) -> Result<Message, Box<dyn Error + Send + Sync>> {
        if let Some(channel) = self.channels.get(channel_type) {
            channel.send_and_wait(message, timeout_secs).await
        } else {
            Err("Channel not found".into())
        }
    }

    pub async fn close(
        &self,
        channel_type: &ChannelType,
    ) -> Result<(), Box<dyn Error + Send + Sync>> {
        if let Some(channel) = self.channels.get(channel_type) {
            // 使用 `?` 运算符来传播错误
            channel.close().await?;
        } else {
            return Err("Channel not found".into());
        }

        Ok(()) // 确保返回 Ok(()) 作为成功的结果
    }

    pub async fn is_channel_connected(&self, channel_type: &ChannelType) -> Result<bool, String> {
        // 首先检查通道是否存在于管理器中
        if self.channels.contains_key(channel_type) {
            // 如果通道存在，则认为它是已连接的
            Ok(true)
        } else {
            // 通道不存在，返回 false 而不是错误
            Ok(false)
        }
    }
}
