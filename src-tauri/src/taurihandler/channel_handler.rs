use crate::combridage::{ChannelType, CommunicationManager, Message};
use lazy_static::lazy_static;
use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::task::JoinHandle;
use tokio::time::{interval, Duration};

// 使用 Lazy 静态变量存储通道管理器
static CHANNEL_MANAGER: Lazy<Mutex<CommunicationManager>> =
    Lazy::new(|| Mutex::new(CommunicationManager::new()));

// 存储通道ID和ChannelType的映射关系
static CHANNEL_ID_MAP: Lazy<Mutex<std::collections::HashMap<String, ChannelType>>> =
    Lazy::new(|| Mutex::new(std::collections::HashMap::new()));

// 定时发送任务信息
struct TimerTask {
    interval: u64,          // 发送间隔（毫秒）
    message: Vec<u8>,       // 要发送的消息
    handle: JoinHandle<()>, // 任务句柄
}

// 定时发送任务管理器
lazy_static! {
    static ref TIMER_TASKS: Arc<std::sync::Mutex<HashMap<String, TimerTask>>> =
        Arc::new(std::sync::Mutex::new(HashMap::new()));
}

/// 连接通道
#[tauri::command]
pub async fn connect_channel(channel: &str, params: &str) -> Result<String, String> {
    let values: serde_json::Value = serde_json::from_str(params).map_err(|e| e.to_string())?;

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
            let port = values["comname"].as_str().ok_or("Missing comname")?;
            let baud_rate = values["baurdate"].as_u64().ok_or("Missing baud rate")? as u32;
            let data_bits = values["databit"].as_u64().ok_or("Missing data bits")? as u8;
            let flow_control = values["flowctrl"].as_u64().ok_or("Missing flow control")? as u8;
            let parity = values["parity"].as_str().ok_or("Missing parity")?;
            let stop_bits = values["stopbit"].as_u64().ok_or("Missing stop bits")? as u8;
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
            let client_id = values["clientid"].as_str().ok_or("Missing client ID")?;
            let qos = values["qos"].as_u64().unwrap_or(0) as u8;
            let topic = values["topic"].as_str().unwrap_or("#");
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
    let channel_id = manager
        .add_channel(channel_type.clone())
        .await
        .map_err(|e| format!("Failed to add channel: {}", e))?;

    // 存储通道ID和ChannelType的映射关系
    let mut id_map = CHANNEL_ID_MAP.lock().await;
    id_map.insert(channel_id.clone(), channel_type);

    // 返回通道ID
    Ok(channel_id)
}

/// 断开通道
#[tauri::command]
pub async fn disconnect_channel(channelid: &str) -> Result<(), String> {
    // 获取通道ID对应的ChannelType
    let channel_type = {
        let id_map = CHANNEL_ID_MAP.lock().await;
        id_map
            .get(channelid)
            .cloned()
            .ok_or(format!("Channel ID not found: {}", channelid))?
    };

    // 获取通道管理器
    let manager = CHANNEL_MANAGER.lock().await;

    // 关闭通道
    manager
        .close(&channel_type)
        .await
        .map_err(|e| format!("Failed to close channel: {}", e))?;

    // 从映射中移除通道ID
    {
        let mut id_map = CHANNEL_ID_MAP.lock().await;
        id_map.remove(channelid);
    }

    Ok(())
}

#[tauri::command]
pub async fn send_message(
    channelid: String,
    message: Vec<u8>,
    clientid: Option<String>,
) -> Result<(), String> {
    println!(
        "send_message: channelid: {}, message: {:?}",
        channelid, message
    );

    // 获取通道ID对应的ChannelType
    let channel_type = {
        let id_map = CHANNEL_ID_MAP.lock().await;
        id_map
            .get(&channelid)
            .cloned()
            .ok_or(format!("Channel ID not found: {}", channelid))?
    };
    println!("send_message: 已获取channel_type: {:?}", channel_type);

    // 获取通道管理器
    let manager = CHANNEL_MANAGER.lock().await;
    println!("send_message: 已获取manager");

    // 解析消息内容
    let content = parse_message_content(&message)?;
    println!("send_message: 已解析消息内容: {:?}", content);

    // 创建消息对象
    let msg = Message::new(content);
    println!("send_message: 已创建Message对象: {:?}", msg.get_content());

    // 发送消息
    match manager.send(&channel_type, &msg, clientid).await {
        Ok(_) => {
            println!("send_message: 消息发送成功");
            Ok(())
        }
        Err(e) => {
            println!("send_message: 消息发送失败: {:?}", e);
            Err(format!("发送消息失败: {}", e))
        }
    }
}

#[tauri::command]
pub async fn list_serial_ports() -> Result<Vec<String>, String> {
    let mut serial_ports = Vec::new();
    for port in tokio_serial::available_ports().map_err(|e| e.to_string())? {
        serial_ports.push(port.port_name);
    }
    Ok(serial_ports)
}

/// 启动定时发送任务
#[tauri::command]
pub async fn start_timer_send(
    app_handle: tauri::AppHandle,
    channel_id: String,
    message: Vec<u8>,
    interval_ms: u64,
    clientid: Option<String>,
) -> Result<(), String> {
    // 检查通道是否存在
    let channel_type = {
        let id_map = CHANNEL_ID_MAP.lock().await;
        id_map
            .get(&channel_id)
            .cloned()
            .ok_or(format!("Channel ID not found: {}", channel_id))?
    };

    // 获取通道管理器
    let manager = CHANNEL_MANAGER.lock().await;

    // 如果已存在相同通道的定时任务，先停止它
    stop_timer_send(channel_id.clone()).await?;

    // 解析消息内容
    let content = parse_message_content(&message)?;

    // 创建消息对象
    let msg = Message::new(content);

    // 创建定时任务
    let app_handle_clone = app_handle.clone();
    let channel_id_clone = channel_id.clone();
    let message_clone = message.clone();
    let channel_type_clone = channel_type.clone();

    // 启动定时发送任务
    let task_handle = tokio::spawn(async move {
        let mut interval_timer = interval(Duration::from_millis(interval_ms));

        loop {
            interval_timer.tick().await;

            // 解析消息内容
            let content = match parse_message_content(&message_clone) {
                Ok(c) => c,
                Err(e) => {
                    println!("定时发送任务错误: 解析消息失败 {}", e);
                    continue;
                }
            };

            // 创建消息对象
            let msg = Message::new(content);

            // 发送消息
            if let Err(e) = manager
                .send(&channel_type_clone, &msg, clientid.clone())
                .await
            {
                println!("定时发送任务错误: 发送消息失败 {}", e);
            } else {
                println!("定时发送成功: 通道 {}", channel_id_clone);
            }
        }
    });

    // 保存任务信息
    let mut tasks = TIMER_TASKS.lock().unwrap();
    tasks.insert(
        channel_id.clone(),
        TimerTask {
            interval: interval_ms,
            message,
            handle: task_handle,
        },
    );

    Ok(())
}

/// 停止定时发送任务
#[tauri::command]
pub async fn stop_timer_send(channel_id: String) -> Result<(), String> {
    let mut tasks = TIMER_TASKS.lock().unwrap();

    if let Some(task) = tasks.remove(&channel_id) {
        // 中止任务
        task.handle.abort();
        println!("已停止通道 {} 的定时发送任务", channel_id);
        Ok(())
    } else {
        // 如果没有找到任务，也返回成功
        Ok(())
    }
}

/// 获取定时发送任务状态
#[tauri::command]
pub fn get_timer_status(channelid: String) -> Result<Option<(u64, Vec<u8>)>, String> {
    let tasks = TIMER_TASKS.lock().unwrap();

    if let Some(task) = tasks.get(&channelid) {
        Ok(Some((task.interval, task.message.clone())))
    } else {
        Ok(None)
    }
}

/// 订阅MQTT主题
#[tauri::command]
pub async fn subscribe_mqtt_topic(channelid: String, topic: String, qos: u8) -> Result<(), String> {
    println!(
        "订阅MQTT主题: channelid: {}, topic: {}, qos: {}",
        channelid, topic, qos
    );

    // 获取通道ID对应的ChannelType
    let channel_type = {
        let id_map = CHANNEL_ID_MAP.lock().await;
        id_map
            .get(&channelid)
            .cloned()
            .ok_or(format!("Channel ID not found: {}", channelid))?
    };
    println!("send_message: 已获取channel_type: {:?}", channel_type);

    // 获取通道管理器
    let manager = CHANNEL_MANAGER.lock().await;
    println!("send_message: 已获取manager");

    // 发送消息
    match manager
        .subscribe_mqtt_topic(&channel_type, &topic, qos)
        .await
    {
        Ok(_) => {
            println!("send_message: 消息发送成功");
            Ok(())
        }
        Err(e) => {
            println!("send_message: 消息发送失败: {:?}", e);
            Err(format!("发送消息失败: {}", e))
        }
    }
}

#[tauri::command]
pub async fn unsubscribe_mqtt_topic(channelid: String, topic: String) -> Result<(), String> {
    println!(
        "取消订阅MQTT主题: channelid: {}, topic: {}",
        channelid, topic
    );

    // 获取通道ID对应的ChannelType
    let channel_type = {
        let id_map = CHANNEL_ID_MAP.lock().await;
        id_map
            .get(&channelid)
            .cloned()
            .ok_or(format!("Channel ID not found: {}", channelid))?
    };
    println!("send_message: 已获取channel_type: {:?}", channel_type);

    // 获取通道管理器
    let manager = CHANNEL_MANAGER.lock().await;
    println!("send_message: 已获取manager");

    // 发送消息
    match manager.unsubscribe_mqtt_topic(&channel_type, &topic).await {
        Ok(_) => {
            println!("send_message: 消息发送成功");
            Ok(())
        }
        Err(e) => {
            println!("send_message: 消息发送失败: {:?}", e);
            Err(format!("发送消息失败: {}", e))
        }
    }
}

/// 获取通道管理器实例
pub fn get_channel_manager() -> &'static Mutex<CommunicationManager> {
    &CHANNEL_MANAGER
}

// 解析消息内容
fn parse_message_content(message: &[u8]) -> Result<serde_json::Value, String> {
    // 尝试将消息解析为 JSON
    if let Ok(s) = std::str::from_utf8(message) {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(s) {
            return Ok(json);
        }
    }

    // 如果不是有效的 JSON，则将其作为二进制数据处理
    let bytes = message.to_vec();
    Ok(serde_json::json!({ "data": bytes }))
}
