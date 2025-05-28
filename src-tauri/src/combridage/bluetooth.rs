use crate::combridage::{ChannelState, CommunicationChannel, Message};
use crate::global::get_app_handle;
use async_trait::async_trait;
use btleplug::api::{
    Central, Characteristic, Manager as _, Peripheral as _, ScanFilter, WriteType,
};
use btleplug::platform::{Adapter, Manager, Peripheral};
use serde_json;
use std::collections::HashMap;
use std::error::Error;
use std::sync::Arc;
use std::time::Duration;
use tauri::Emitter;
use tokio::sync::Mutex;
use tokio::time::timeout;
use uuid::Uuid;
pub struct BluetoothChannel {
    channeltype: String,
    channelid: String,
    adapters: Arc<Mutex<Vec<Adapter>>>,
    peripherals: HashMap<String, Vec<Characteristic>>, // Stores peripherals and their characteristic values
    connected_peripheral: Arc<Mutex<Option<Peripheral>>>,
    characteristic: Option<Characteristic>, // Assuming you want to store the characteristic here
}

impl BluetoothChannel {
    pub async fn new() -> Result<Self, Box<dyn Error + Send + Sync>> {
        // Step 1: Find the adapter
        let manager: Manager = Manager::new().await?;
        let adapters = manager.adapters().await?;

        // Step 2: Start scanning with a default ScanFilter
        let mut peripheral_characteristics: HashMap<String, Vec<Characteristic>> = HashMap::new();
        for adapter in adapters.iter() {
            adapter.start_scan(ScanFilter::default()).await?;
            tokio::time::sleep(Duration::from_secs(5)).await;

            let peripherals = adapter.peripherals().await?;

            for peripheral in peripherals.iter() {
                if !peripheral.is_connected().await? {
                    peripheral.connect().await?;
                }
                let characteristics = peripheral.characteristics();
                let characteristics_vec: Vec<Characteristic> =
                    characteristics.into_iter().collect();
                peripheral_characteristics
                    .insert(peripheral.address().to_string(), characteristics_vec);
                peripheral.disconnect().await?; // Disconnect after getting characteristics
            }
        }

        Ok(Self {
            channeltype: "bluetooth".to_string(),
            channelid: "bluetooth".to_string() + &Uuid::new_v4().to_string(),
            adapters: Arc::new(Mutex::new(adapters)),
            peripherals: peripheral_characteristics,
            connected_peripheral: Arc::new(Mutex::new(None)),
            characteristic: None, // Set a default characteristic here
        })
    }

    // pub async fn connect(&self, adapter_name: &str, device_id: &str) -> Result<(), Box<dyn Error + Send + Sync>> {
    //     let mut connected_peripheral = self.connected_peripheral.lock().await;

    //     // 锁定适配器以进行访问
    //     let adapters = self.adapters.lock().await;

    //     // 获取适配器信息并存储
    //     let adapter_infos: Vec<(String, &Adapter)> = futures::future::join_all(
    //         adapters.iter().map(async |adapt| {
    //             match adapt.adapter_info().await {
    //                 Ok(info_str) => (info_str, adapt),
    //                 Err(_) => (String::new(), adapt), // 如果出错，则返回空字符串
    //             }
    //         })
    //     ).await;

    //     // 查找名称匹配的适配器
    //     let adapter = adapter_infos.iter().find(|(info_str, _)| info_str.contains(adapter_name)).map(|(_, adapt)| adapt);

    //     // 如果找到适配器
    //     if let Some(adapter) = adapter {
    //         // 获取选定适配器的外设
    //         let peripherals = adapter.peripherals().await?;

    //         // 找到匹配的外设
    //         if let Some(peripheral) = peripherals.into_iter().find(|p| p.address().to_string() == device_id) {
    //             // 连接到找到的外设
    //             peripheral.connect().await?;
    //             *connected_peripheral = Some(peripheral);

    //             // 假设您要设置找到的第一个特征
    //             if let Some(characteristic) = self.peripherals.get(&peripheral.address().to_string()).and_then(|c| c.first()) {
    //                 self.characteristic = Some(characteristic.clone()); // 存储特征
    //             }
    //         } else {
    //             return Err("Device not found".into());
    //         }
    //     } else {
    //         return Err(format!("Adapter '{}' not found", adapter_name).into());
    //     }

    //     Ok(())
    // }

    pub async fn get_peripheral_characteristics(
        &self,
        device_id: &str,
    ) -> Option<&Vec<Characteristic>> {
        self.peripherals.get(device_id)
    }

    pub async fn get_adapters(&self) -> Result<Vec<Adapter>, Box<dyn Error + Send + Sync>> {
        let adapters = self.adapters.lock().await.clone();
        Ok(adapters)
    }

    pub async fn scanf(&self, timeout_secs: u64) -> Result<Message, Box<dyn Error + Send + Sync>> {
        if let Some(peripheral) = self.connected_peripheral.lock().await.as_ref() {
            // 先检查 characteristic 是否存在
            if let Some(characteristic) = &self.characteristic {
                let result = timeout(
                    Duration::from_secs(timeout_secs),
                    peripheral.read(characteristic),
                )
                .await;

                match result {
                    Ok(Ok(read_data)) => {
                        let message: Message = bincode::deserialize(&read_data)?;
                        Ok(message)
                    }
                    Ok(Err(e)) => Err(e.into()),
                    Err(_) => Err("Read operation timed out".into()),
                }
            } else {
                Err("No characteristic available".into()) // 如果没有可用的特征，则返回错误
            }
        } else {
            Err("No connected peripheral".into())
        }
    }

    pub async fn close(&self) -> Result<(), Box<dyn Error + Send + Sync>> {
        if let Some(peripheral) = self.connected_peripheral.lock().await.as_ref() {
            peripheral.disconnect().await?;
        }
        Ok(())
    }
}

#[async_trait]
impl CommunicationChannel for BluetoothChannel {
    async fn send(
        &self,
        message: &Message,
        clientid: Option<String>,
    ) -> Result<(), Box<dyn Error + Send + Sync>> {
        if let Some(peripheral) = self.connected_peripheral.lock().await.as_ref() {
            let send_data: serde_json::Value = message.content.clone();

            // 将 uuid 字符串解析为 Uuid 类型
            let uuid_str = send_data["uuid"].as_str().ok_or("UUID not found")?;
            let uuid =
                Uuid::parse_str(uuid_str).map_err(|e| format!("Failed to parse UUID: {}", e))?;

            let data = send_data["data"].as_str().ok_or("Data not found")?;
            if let Some(characteristic) = self
                .peripherals
                .get(&peripheral.address().to_string())
                .and_then(|c| c.iter().find(|x| x.uuid == uuid))
            {
                peripheral
                    .write(characteristic, data.as_bytes(), WriteType::WithResponse)
                    .await?;
            } else {
                return Err("No connected peripheral".into());
            }
        } else {
            return Err("No connected peripheral".into());
        }
        Ok(())
    }

    async fn receive(&self) -> Result<Message, Box<dyn Error + Send + Sync>> {
        if let Some(peripheral) = self.connected_peripheral.lock().await.as_ref() {
            if let Some(characteristic) = &self.characteristic {
                let buffer = peripheral.read(characteristic).await?;
                let message: serde_json::Value = serde_json::from_slice(&buffer)?;
                let message = Message::new(message);
                Ok(message)
            } else {
                return Err("No characteristic available".into());
            }
        } else {
            Err("No connected peripheral".into())
        }
    }

    async fn send_and_wait(
        &self,
        message: &Message,
        timeout_secs: u64,
    ) -> Result<Message, Box<dyn Error + Send + Sync>> {
        self.send(message, None).await?;
        let response = timeout(Duration::from_secs(timeout_secs), self.receive()).await?;
        response.map_err(|e| e.into())
    }

    async fn close(&self) -> Result<(), Box<dyn Error + Send + Sync>> {
        self.close().await?;
        Ok(())
    }

    async fn on_statechange(
        &self,
        state: ChannelState,
    ) -> Result<(), Box<dyn Error + Send + Sync>> {
        let app_handle = get_app_handle();
        // 构造断开连接事件的 payload
        let payload = serde_json::json!({
            "channel": "bluetooth",
            "reason": "The bluetooth channel has been disconnected",
        });

        println!("Bluetooth channel disconnected. Sending 'channel-state' event...");
        // 发送断开连接事件
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
        Err("Bluetooth does not support topic subscription".into())
    }

    async fn unsubscribe_topic(&self, _topic: &str) -> Result<(), Box<dyn Error + Send + Sync>> {
        Err("Bluetooth does not support topic unsubscription".into())
    }
}
