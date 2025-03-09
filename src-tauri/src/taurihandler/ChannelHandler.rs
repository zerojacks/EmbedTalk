use crate::combridage::{ChannelType, CommunicationManager, Message};
use hex;
use once_cell::sync::Lazy;
use serde_json::{json, Value};
use tokio_serial::available_ports;
use tauri::Window;
use tokio::sync::Mutex;
use chrono;

// 使用 Lazy 静态变量存储通道管理器
static CHANNEL_MANAGER: Lazy<Mutex<CommunicationManager>> = Lazy::new(|| {
    Mutex::new(CommunicationManager::new())
});

// 存储通道ID和ChannelType的映射关系
static CHANNEL_ID_MAP: Lazy<Mutex<std::collections::HashMap<String, ChannelType>>> = Lazy::new(|| {
    Mutex::new(std::collections::HashMap::new())
});

/// 连接通道
#[tauri::command]
pub async fn connect_channel(
    channel: &str,
    values: &str,
) -> Result<String, String> {
    let values: Value = serde_json::from_str(values).map_err(|e| e.to_string())?;

    // 根据通道类型和参数创建 ChannelType
    let channel_type = match channel.to_uppercase().as_str() {
        "TCPCLIENT" => {
            let ip = values["ip"].as_str().ok_or("Missing ip")?;
            let port = values["port"].as_u64().ok_or("Missing port")? as u16;
            ChannelType::TcpClient(ip.to_string(), port)
        }
        "TCPSERVER" => {
            let ip = values["ip"].as_str().ok_or("Missing ip")?;
            let port = values["port"].as_u64().ok_or("Missing port")? as u16;
            ChannelType::TcpServer(ip.to_string(), port)
        }
        "SERIAL" => {
            let port = values["port"].as_str().ok_or("Missing port")?;
            let baud_rate = values["baudRate"].as_u64().ok_or("Missing baud rate")? as u32;
            let data_bits = values["dataBits"].as_u64().ok_or("Missing data bits")? as u8;
            let flow_control = values["flowControl"].as_u64().ok_or("Missing flow control")? as u8;
            let parity = values["parity"].as_str().ok_or("Missing parity")?;
            let stop_bits = values["stopBits"].as_u64().ok_or("Missing stop bits")? as u8;
            ChannelType::SerialPort(
                port.to_string(),
                baud_rate,
                flow_control,
                data_bits,
                parity.to_string(),
                stop_bits,
            )
        }
        "MQTT" => {
            let ip = values["ip"].as_str().ok_or("Missing ip")?;
            let port = values["port"].as_u64().ok_or("Missing port")? as u16;
            let username = values["username"].as_str().unwrap_or("");
            let password = values["password"].as_str().unwrap_or("");
            let client_id = values["clientId"].as_str().ok_or("Missing client ID")?;
            let qos = values["qos"].as_u64().unwrap_or(0) as u8;
            let topic = values["topic"].as_str().ok_or("Missing topic")?;
            ChannelType::Mqtt(
                ip.to_string(),
                port,
                username.to_string(),
                password.to_string(),
                client_id.to_string(),
                qos,
                topic.to_string(),
            )
        }
        _ => return Err(format!("Unsupported channel type: {}", channel)),
    };

    // 获取通道管理器的可变引用
    let mut manager = CHANNEL_MANAGER.lock().await;

    // 添加通道并获取通道ID
    let channel_id = manager.add_channel(channel_type.clone()).await
        .map_err(|e| format!("Failed to add channel: {}", e))?;
    
    // 存储通道ID和ChannelType的映射关系
    let mut id_map = CHANNEL_ID_MAP.lock().await;
    id_map.insert(channel_id.clone(), channel_type);
    
    // 返回通道ID
    Ok(channel_id)
}

/// 断开通道
#[tauri::command]
pub async fn disconnect_channel(
    channel_id: &str,
) -> Result<(), String> {
    // 获取通道ID对应的ChannelType
    let channel_type = {
        let id_map = CHANNEL_ID_MAP.lock().await;
        id_map.get(channel_id).cloned().ok_or(format!("Channel ID not found: {}", channel_id))?
    };

    // 获取通道管理器
    let manager = CHANNEL_MANAGER.lock().await;

    // 关闭通道
    manager.close(&channel_type).await
        .map_err(|e| format!("Failed to close channel: {}", e))?;
    
    // 从映射中移除通道ID
    {
        let mut id_map = CHANNEL_ID_MAP.lock().await;
        id_map.remove(channel_id);
    }

    Ok(())
}

#[tauri::command]
pub async fn send_message(
    channelId: &str,
    message: Vec<u8>,
) -> Result<(), String> {
    // 获取通道管理器
    let manager = CHANNEL_MANAGER.lock().await;
    
    // 获取通道ID对应的ChannelType
    let channel_type = {
        let id_map = CHANNEL_ID_MAP.lock().await;
        id_map.get(channelId).cloned().ok_or(format!("Channel ID not found: {}", channelId))?
    };
    
    // 创建消息对象
    let content = serde_json::json!({
        "data": message
    });
    
    let msg = Message::new(content);
    
    // 发送消息
    manager.send(&channel_type, &msg).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn list_serial_ports() -> Result<Vec<String>, String> {
    let mut serial_ports = Vec::new();
    for port in available_ports().map_err(|e| e.to_string())? {
        serial_ports.push(port.port_name);
    }
    Ok(serial_ports)
}
