use crate::combridage::Message;
use crate::global::get_app_handle;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::error::Error;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::Emitter;
use tauri::Manager;
use tokio::fs::{self, OpenOptions};
use tokio::io::AsyncWriteExt;
use tokio::sync::{broadcast, Mutex, RwLock};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageRecord {
    channeltype: String,
    channel_id: String,
    channel_name: String,
    #[serde(with = "chrono::serde::ts_milliseconds")]
    timestamp: DateTime<Utc>,
    direction: MessageDirection,
    content: Message,
    metadata: Option<HashMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MessageDirection {
    Sent,
    Received,
}

#[derive(Clone)]
pub struct MessageManager {
    app_handle: tauri::AppHandle,
    base_path: PathBuf,
    message_sender: broadcast::Sender<MessageRecord>,
    active_channels: Arc<RwLock<HashMap<String, bool>>>,
    write_queues: Arc<RwLock<HashMap<String, Arc<Mutex<Vec<MessageRecord>>>>>>,
    message_history: Arc<Mutex<Vec<MessageRecord>>>,
}

impl std::fmt::Debug for MessageManager {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("MessageManager")
            .field("base_path", &self.base_path)
            .finish()
    }
}

impl MessageManager {
    pub fn new(app_handle: tauri::AppHandle) -> Result<Self, Box<dyn Error + Send + Sync>> {
        let (message_sender, _) = broadcast::channel(100);

        // 获取应用数据目录
        let base_path = app_handle
            .path()
            .app_data_dir()
            .map_err(|_| "Failed to get app data directory")?;
        println!("App data directory: {:?}", base_path);
        let manager = Self {
            app_handle,
            base_path,
            message_sender,
            active_channels: Arc::new(RwLock::new(HashMap::new())),
            write_queues: Arc::new(RwLock::new(HashMap::new())),
            message_history: Arc::new(Mutex::new(Vec::new())),
        };

        Ok(manager)
    }

    fn get_storage_path(&self, channel_name: &str) -> PathBuf {
        let now = Utc::now();
        let date_folder = now.format("%Y-%m-%d").to_string();
        // 替换文件名中的非法字符
        let safe_channel_name = channel_name.replace(&['\\', '/', ':', '*', '?', '"', '<', '>', '|'][..], "_");
        self.base_path
            .join(date_folder)
            .join(format!("{}.log", safe_channel_name))
    }

    async fn ensure_storage_path(
        &self,
        channel_name: &str,
    ) -> Result<PathBuf, Box<dyn Error + Send + Sync>> {
        let path = self.get_storage_path(channel_name);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).await?;
        }
        Ok(path)
    }

    async fn start_storage_worker(&self, channel_id: String) {
        let write_queues = self.write_queues.clone();
        let base_path = self.base_path.clone();

        tokio::spawn(async move {
            loop {
                tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;

                // 获取当前通道的队列
                let queues = write_queues.read().await;
                let queue = match queues.get(&channel_id) {
                    Some(q) => q.clone(),
                    None => continue,
                };
                drop(queues); // 释放读锁

                let mut queue_lock = queue.lock().await;
                if queue_lock.is_empty() {
                    continue;
                }

                // 获取消息并按照 channel_name 分组
                let messages_by_channel = queue_lock.drain(..).fold(
                    HashMap::new(),
                    |mut acc, msg| {
                        acc.entry(msg.channel_name.clone())
                            .or_insert_with(Vec::new)
                            .push(msg);
                        acc
                    },
                );

                // 对每个 channel_name 分别写入文件
                for (channel_name, messages) in messages_by_channel {
                    let today = Utc::now().format("%Y-%m-%d").to_string();
                    let safe_channel_name = channel_name.replace(&['\\', '/', ':', '*', '?', '"', '<', '>', '|'][..], "_");
                    let path = base_path
                        .join(today)
                        .join(format!("{}.log", safe_channel_name));

                    if let Err(e) = Self::batch_write_messages(&path, &messages).await {
                        eprintln!("Error writing messages to storage for channel {}: {:?}", channel_name, e);
                        // 写入失败时，将消息放回队列
                        queue_lock.extend(messages);
                    }
                }
            }
        });
    }

    async fn batch_write_messages(
        path: &PathBuf,
        messages: &[MessageRecord],
    ) -> Result<(), Box<dyn Error + Send + Sync>> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).await?;
        }

        let mut file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(path)
            .await?;

        for message in messages {
            let content = message.content.get_content();
            
            println!("content {:?}", content);
            // 提取data字段并根据类型进行处理
            let data = if let Some(data_value) = content.get("data") {
                match data_value {
                    // 如果是数组，转换为十六进制字符串
                    serde_json::Value::Array(arr) => {
                        arr.iter()
                            .filter_map(|num| num.as_u64())
                            .map(|num| format!("{:02X}", num))
                            .collect::<Vec<String>>()
                            .join(" ")
                    },
                    // 如果是字符串，直接使用
                    serde_json::Value::String(s) => s.clone(),
                    // 如果是对象或其他类型，转换为格式化的JSON字符串
                    _ => serde_json::to_string_pretty(data_value).unwrap_or_else(|_| data_value.to_string())
                }
            } else {
                "".to_string()
            };

            // 格式化时间
            let datetime = DateTime::<Utc>::from_timestamp_millis(message.content.timestamp).unwrap_or(Utc::now());
            let timestamp = datetime.format("%Y-%m-%d %H:%M:%S:%3f").to_string();
            
            // 格式化方向
            let direction = match message.direction {
                MessageDirection::Sent => ">>>",
                MessageDirection::Received => "<<<"
            };
            
            // 构建日志行
            let log_line = format!(
                "{} [{}] {} {}: {}\n",
                timestamp,
                message.channel_name, // TODO: 从metadata中获取地址信息
                direction,
                if direction == ">>>" { "发送" } else { "接收" },
                data
            );
            
            file.write_all(log_line.as_bytes()).await?;
        }

        file.flush().await?;
        Ok(())
    }

    pub fn subscribe_to_messages(&self) -> broadcast::Receiver<MessageRecord> {
        self.message_sender.subscribe()
    }

    pub async fn register_channel(
        &self,
        channel_id: &str,
    ) -> Result<(), Box<dyn Error + Send + Sync>> {
        let mut active_channels = self.active_channels.write().await;
        let mut write_queues = self.write_queues.write().await;

        if !active_channels.contains_key(channel_id) {
            active_channels.insert(channel_id.to_string(), true);
            write_queues.insert(channel_id.to_string(), Arc::new(Mutex::new(Vec::new())));

            // 确保存储路径存在
            self.ensure_storage_path(channel_id).await?;

            // 启动该通道的存储工作器
            self.start_storage_worker(channel_id.to_string()).await;
        }

        Ok(())
    }

    pub async fn unregister_channel(&self, channel_id: &str) {
        let mut active_channels = self.active_channels.write().await;
        active_channels.remove(channel_id);

        // 等待队列处理完成后再移除
        let write_queues = self.write_queues.write().await;
        if let Some(queue) = write_queues.get(channel_id) {
            let queue = queue.clone(); // 克隆队列的Arc指针
            drop(write_queues); // 释放对write_queues的不可变借用

            let queue_lock = queue.lock().await;
            if queue_lock.is_empty() {
                let mut write_queues = self.write_queues.write().await; // 重新获取可变借用
                write_queues.remove(channel_id);
            }
        }
    }

    pub async fn record_message(
        &self,
        channeltype: &str,
        channel_id: &str,
        channel_name: &str,
        message: &Message,
        direction: MessageDirection,
        metadata: Option<HashMap<String, String>>,
    ) -> Result<(), Box<dyn Error + Send + Sync>> {
        // 创建消息记录
        let message_record = MessageRecord {
            channeltype: channeltype.to_string(),
            channel_id: channel_id.to_string(),
            channel_name: channel_name.to_string(),
            timestamp: DateTime::from_timestamp_millis(message.timestamp).unwrap_or(Utc::now()),
            direction: direction.clone(),
            content: message.clone(),
            metadata: metadata.clone(),
        };

        // 添加到历史记录
        let mut history = self.message_history.lock().await;
        history.push(message_record.clone());
        
        // 限制历史记录大小
        if history.len() > 1000 {
            let split_at = history.len() - 1000;
            let new_messages = history.split_off(split_at);
            *history = new_messages;
        }

        // 将消息添加到写入队列
        let write_queues = self.write_queues.read().await;
        if let Some(queue) = write_queues.get(channel_id) {
            let mut queue = queue.lock().await;
            queue.push(message_record.clone());
        } else {
            // 如果通道未注册，先注册通道
            drop(write_queues); // 释放读锁
            self.register_channel(channel_id).await?;
            
            // 重新获取队列并添加消息
            let write_queues = self.write_queues.read().await;
            if let Some(queue) = write_queues.get(channel_id) {
                let mut queue = queue.lock().await;
                queue.push(message_record.clone());
            }
        }

        // 发送消息事件通知前端
        let app_handle = get_app_handle();
        
        // 创建一个前端可用的消息对象
        let frontend_message = serde_json::json!({
            "messageId": Uuid::new_v4().to_string(),
            "channelId": channel_id,
            "channeltype": channeltype,
            "direction": direction.clone(),
            "content": message.get_content(),
            "timestamp": message_record.timestamp.timestamp_millis(),
            "metadata": metadata.clone()
        });
        
        println!("MessageManager::record_message - 发送消息事件: {:?}", frontend_message);
        // 发送消息事件
        match app_handle.emit("message-event", serde_json::to_string(&frontend_message)?) {
            Ok(_) => println!("消息事件已发送"),
            Err(e) => eprintln!("发送消息事件失败: {:?}", e),
        }

        Ok(())
    }

    async fn notify_ui(&self, record: &MessageRecord) -> Result<(), Box<dyn Error + Send + Sync>> {
        let payload = serde_json::json!({
            "channeltype": record.channeltype,
            "channelId": record.channel_id,
            "timestamp": record.timestamp.timestamp_millis(), // 使用毫秒级数字时间戳
            "direction": record.direction,
            "content": record.content,
            "metadata": record.metadata,
        });
        println!("Notifying UI: {:?}", payload);
        self.app_handle
            .emit("message-event", serde_json::to_string(&payload)?)
            .map_err(|e| Box::new(e) as Box<dyn Error + Send + Sync>)?;
        Ok(())
    }
}

// 消息处理trait
#[async_trait::async_trait]
pub trait MessageHandler {
    async fn handle_message(
        &self,
        message_manager: &MessageManager,
        channel_id: &str,
        message: &Message,
        direction: MessageDirection,
    ) -> Result<(), Box<dyn Error + Send + Sync>>;
}
