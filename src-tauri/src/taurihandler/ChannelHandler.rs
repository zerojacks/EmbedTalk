use crate::combridage::ChannelType;
use crate::combridage::CommunicationManager;
use lazy_static::lazy_static;
use serde_json::{json, Value};
use tokio::sync::Mutex;
use tokio_serial::{available_ports, SerialPortBuilderExt};

lazy_static! {
    pub static ref CHANNEL_MANAGER: Mutex<CommunicationManager> =
        Mutex::new(CommunicationManager::new());
}

#[tauri::command]
pub async fn connect_channel(channel: &str, values: &str) -> Result<(), String> {
    let params: serde_json::Value =
        serde_json::from_str(values).map_err(|e| format!("Failed to parse JSON: {}", e))?;

    // Lock the mutex and handle errors properly
    let mut manager = CHANNEL_MANAGER.lock().await;
    println!("Connecting channel: {} {}", channel, values);
    match channel.to_uppercase().as_str() {
        "TCPCLIENT" => {
            let ipaddr = params["ip"].as_str().ok_or("Missing 'ip' in parameters")?;
            let port = params["port"]
                .as_u64()
                .ok_or("Missing 'port' in parameters")? as u16;
            let channel_type = ChannelType::TcpClient(ipaddr.to_string(), port);
            manager
                .add_channel(channel_type)
                .await
                .map_err(|e| format!("{}", e).into())
        }
        "TCPSERVER" => {
            let ipaddr = params["ip"].as_str().ok_or("Missing 'ip' in parameters")?;
            let port = params["port"]
                .as_u64()
                .ok_or("Missing 'port' in parameters")? as u16;
            let channel_type = ChannelType::TcpServer(ipaddr.to_string(), port);
            println!("TCPSERVER: {} {}", ipaddr, port);
            manager
                .add_channel(channel_type)
                .await
                .map_err(|e| format!("{}", e).into())
        }
        "SERIAL" => {
            let commname = params["commname"]
                .as_str()
                .ok_or("Missing 'commname' in parameters")?;
            let baudrate = params["baudrate"]
                .as_u64()
                .ok_or("Missing 'baudrate' in parameters")? as u32;
            let databit = params["databit"]
                .as_u64()
                .ok_or("Missing 'databit' in parameters")? as u8;
            let flowctrl = params["flowctrl"]
                .as_u64()
                .ok_or("Missing 'flowctrl' in parameters")? as u8;
            let parity = params["parity"]
                .as_str()
                .ok_or("Missing 'parity' in parameters")?;
            let stopbit = params["stopbit"]
                .as_u64()
                .ok_or("Missing 'stopbit' in parameters")? as u8;
            let channel_type = ChannelType::SerialPort(
                commname.to_string(),
                baudrate,
                flowctrl,
                databit,
                parity.to_string(),
                stopbit,
            );
            manager
                .add_channel(channel_type)
                .await
                .map_err(|e| format!("{}", e).into())
        }
        "MQTT" => {
            let ipaddr = params["ip"].as_str().ok_or("Missing 'ip' in parameters")?;
            let port = params["port"]
                .as_u64()
                .ok_or("Missing 'port' in parameters")? as u16;
            let username = params["username"]
                .as_str()
                .ok_or("Missing 'username' in parameters")?;
            let password = params["password"]
                .as_str()
                .ok_or("Missing 'password' in parameters")?;
            let client_id = params["client_id"]
                .as_str()
                .ok_or("Missing 'client_id' in parameters")?;
            let qos = params["QoS"]
                .as_u64()
                .ok_or("Missing 'QoS' in parameters")? as u8;
            let topic = params["topic"]
                .as_str()
                .ok_or("Missing 'topic' in parameters")?;
            let channel_type = ChannelType::Mqtt(
                ipaddr.to_string(),
                port,
                username.to_string(),
                password.to_string(),
                client_id.to_string(),
                qos,
                topic.to_string(),
            );
            manager
                .add_channel(channel_type)
                .await
                .map_err(|e| format!("{}", e).into())
        }
        _ => Err("Invalid channel type".into()),
    }
}

#[tauri::command]
pub async fn disconnect_channel(channel: &str, values: &str) -> Result<(), String> {
    let params: serde_json::Value =
        serde_json::from_str(values).map_err(|e| format!("Failed to parse JSON: {}", e))?;

    // Lock the mutex and handle errors properly
    let manager = CHANNEL_MANAGER.lock().await;
    println!("Disconnecting channel: {} {}", channel, values);
    match channel.to_uppercase().as_str() {
        "TCPCLIENT" => {
            let ipaddr = params["ip"].as_str().ok_or("Missing 'ip' in parameters")?;
            let port = params["port"]
                .as_u64()
                .ok_or("Missing 'port' in parameters")? as u16;
            let channel_type = ChannelType::TcpClient(ipaddr.to_string(), port);
            manager
                .close(&channel_type)
                .await
                .map_err(|e| format!("Failed to add channel: {}", e).into())
        }
        "TCPSERVER" => {
            let ipaddr = params["ip"].as_str().ok_or("Missing 'ip' in parameters")?;
            let port = params["port"]
                .as_u64()
                .ok_or("Missing 'port' in parameters")? as u16;
            let channel_type = ChannelType::TcpServer(ipaddr.to_string(), port);
            manager
                .close(&channel_type)
                .await
                .map_err(|e| format!("Failed to add channel: {}", e).into())
        }
        "SERIAL" => {
            let commname = params["commname"]
                .as_str()
                .ok_or("Missing 'commname' in parameters")?;
            let baudrate = params["baudrate"]
                .as_u64()
                .ok_or("Missing 'baudrate' in parameters")? as u32;
            let databit = params["databit"]
                .as_u64()
                .ok_or("Missing 'databit' in parameters")? as u8;
            let flowctrl = params["flowctrl"]
                .as_u64()
                .ok_or("Missing 'flowctrl' in parameters")? as u8;
            let parity = params["parity"]
                .as_str()
                .ok_or("Missing 'parity' in parameters")?;
            let stopbit = params["stopbit"]
                .as_u64()
                .ok_or("Missing 'stopbit' in parameters")? as u8;
            let channel_type = ChannelType::SerialPort(
                commname.to_string(),
                baudrate,
                flowctrl,
                databit,
                parity.to_string(),
                stopbit,
            );
            manager
                .close(&channel_type)
                .await
                .map_err(|e| format!("Failed to add channel: {}", e).into())
        }
        "MQTT" => {
            let ipaddr = params["ip"].as_str().ok_or("Missing 'ip' in parameters")?;
            let port = params["port"]
                .as_u64()
                .ok_or("Missing 'port' in parameters")? as u16;
            let username = params["username"]
                .as_str()
                .ok_or("Missing 'username' in parameters")?;
            let password = params["password"]
                .as_str()
                .ok_or("Missing 'password' in parameters")?;
            let client_id = params["client_id"]
                .as_str()
                .ok_or("Missing 'client_id' in parameters")?;
            let qos = params["QoS"]
                .as_u64()
                .ok_or("Missing 'QoS' in parameters")? as u8;
            let topic = params["topic"]
                .as_str()
                .ok_or("Missing 'topic' in parameters")?;
            let channel_type = ChannelType::Mqtt(
                ipaddr.to_string(),
                port,
                username.to_string(),
                password.to_string(),
                client_id.to_string(),
                qos,
                topic.to_string(),
            );
            manager
                .close(&channel_type)
                .await
                .map_err(|e| format!("Failed to add channel: {}", e).into())
        }
        _ => Err("Invalid channel type".into()),
    }
}

#[tauri::command]
pub async fn list_serial_ports() -> Result<Vec<String>, String> {
    let mut serial_ports = Vec::new();
    for port in available_ports().map_err(|e| e.to_string())? {
        serial_ports.push(port.port_name);
    }
    Ok(serial_ports)
}
