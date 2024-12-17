use crate::combridage::Message;
use chrono::{DateTime, Utc, TimeZone};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::error::Error;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::Manager;
use tauri::Emitter;
use tokio::fs::{self, File, OpenOptions};
use tokio::io::AsyncWriteExt;
use tokio::sync::{broadcast, Mutex, RwLock};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageRecord {
    channeltype: String,
    channel_id: String,
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
        };

        Ok(manager)
    }

    fn get_storage_path(&self, channel_id: &str) -> PathBuf {
        let now = Utc::now();
        let date_folder = now.format("%Y-%m-%d").to_string();
        self.base_path
            .join(date_folder)
            .join(format!("{}.log", channel_id))
    }

    async fn ensure_storage_path(&self, channel_id: &str) -> Result<PathBuf, Box<dyn Error + Send + Sync>> {
        let path = self.get_storage_path(channel_id);
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
    
                // 获取当天的文件路径
                let today = Utc::now().format("%Y-%m-%d").to_string();
                let path = base_path
                    .join(today)
                    .join(format!("{}.log", channel_id.replace(":", "-")));
    
                let messages_to_write = queue_lock.drain(..).collect::<Vec<_>>();
                
                if let Err(e) = Self::batch_write_messages(&path, &messages_to_write).await {
                    eprintln!("Error writing messages to storage: {:?}", e);
                    // 写入失败时，将消息放回队列
                    queue_lock.extend(messages_to_write);
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
            println!("Writing message to storage: {:?}", message);
            let record = serde_json::to_string(&message)? + "\n";
            println!("Writing message to storage: {:?} {:?}", record, path);
            file.write_all(record.as_bytes()).await?;
        }
        
        file.flush().await?;
        Ok(())
    }

    pub fn subscribe_to_messages(&self) -> broadcast::Receiver<MessageRecord> {
        self.message_sender.subscribe()
    }

    pub async fn register_channel(&self, channel_id: &str) -> Result<(), Box<dyn Error + Send + Sync>> {
        let mut active_channels = self.active_channels.write().await;
        let mut write_queues = self.write_queues.write().await;
        
        if !active_channels.contains_key(channel_id) {
            active_channels.insert(channel_id.to_string(), true);
            write_queues.insert(
                channel_id.to_string(),
                Arc::new(Mutex::new(Vec::new())),
            );
            
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
        let mut write_queues = self.write_queues.write().await;
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
        message: &Message,
        direction: MessageDirection,
        metadata: Option<HashMap<String, String>>,
    ) -> Result<(), Box<dyn Error + Send + Sync>> {
        let record = MessageRecord {
            channeltype: channeltype.to_string(),
            channel_id: channel_id.to_string(),
            timestamp: Utc::now(),
            direction,
            content: message.clone(),
            metadata,
        };

        // 添加到写入队列
        let write_queues = self.write_queues.read().await;
        if let Some(queue) = write_queues.get(channel_id) {
            queue.lock().await.push(record.clone());
        } else {
            return Err("Channel not registered".into());
        }

        // 广播消息给订阅者
        let _ = self.message_sender.send(record.clone());

        // 通知UI
        self.notify_ui(&record).await?;

        Ok(())
    }

    async fn notify_ui(&self, record: &MessageRecord) -> Result<(), Box<dyn Error + Send + Sync>> {
        let payload = serde_json::json!({
            "channeltype": record.channeltype,
            "channelId": record.channel_id,
            "timestamp": record.timestamp.to_rfc3339(),
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