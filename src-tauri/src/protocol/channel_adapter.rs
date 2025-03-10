use crate::combridage::{ChannelState, CommunicationChannel, Message};
use crate::protocol::{get_channel_protocol_handler, ChannelProtocolHandler};
use async_trait::async_trait;
use std::error::Error;
use std::sync::Arc;
use tokio::sync::Mutex;

/// 协议通道适配器，用于将协议处理功能与现有的通道系统集成
pub struct ProtocolChannelAdapter<T: CommunicationChannel> {
    /// 通道ID
    channel_id: String,
    /// 内部通道
    inner_channel: Arc<T>,
    /// 协议处理器
    protocol_handler: &'static ChannelProtocolHandler,
    /// 是否启用自动协议解析
    auto_parse: Arc<Mutex<bool>>,
}

impl<T: CommunicationChannel> ProtocolChannelAdapter<T> {
    /// 创建新的协议通道适配器
    pub fn new(channel_id: String, inner_channel: T) -> Self {
        Self {
            channel_id,
            inner_channel: Arc::new(inner_channel),
            protocol_handler: get_channel_protocol_handler(),
            auto_parse: Arc::new(Mutex::new(true)), // 默认启用自动解析
        }
    }

    /// 设置是否启用自动协议解析
    pub async fn set_auto_parse(&self, auto_parse: bool) {
        let mut auto_parse_lock = self.auto_parse.lock().await;
        *auto_parse_lock = auto_parse;
    }

    /// 获取是否启用自动协议解析
    pub async fn get_auto_parse(&self) -> bool {
        let auto_parse_lock = self.auto_parse.lock().await;
        *auto_parse_lock
    }

    /// 获取内部通道的引用
    pub fn get_inner_channel(&self) -> Arc<T> {
        self.inner_channel.clone()
    }

    /// 获取通道ID
    pub fn get_channel_id(&self) -> &str {
        &self.channel_id
    }
}

#[async_trait]
impl<T: CommunicationChannel> CommunicationChannel for ProtocolChannelAdapter<T> {
    async fn send(&self, message: &Message) -> Result<(), Box<dyn Error + Send + Sync>> {
        // 检查是否启用自动解析
        let auto_parse = *self.auto_parse.lock().await;
        
        if auto_parse {
            // 使用协议处理器处理消息
            match self.protocol_handler.process_message_to_send(&self.channel_id, message).await {
                Ok(data) => {
                    // 创建包含处理后数据的新消息
                    let processed_message = Message::new(serde_json::json!({
                        "data": data,
                        "raw": true
                    }));
                    
                    // 使用内部通道发送处理后的消息
                    self.inner_channel.send(&processed_message).await
                }
                Err(e) => {
                    eprintln!("Failed to process message with protocol: {}", e);
                    // 如果协议处理失败，直接发送原始消息
                    self.inner_channel.send(message).await
                }
            }
        } else {
            // 不启用自动解析，直接发送原始消息
            self.inner_channel.send(message).await
        }
    }

    async fn receive(&self) -> Result<Message, Box<dyn Error + Send + Sync>> {
        // 从内部通道接收消息
        let message = self.inner_channel.receive().await?;
        
        // 检查是否启用自动解析
        let auto_parse = *self.auto_parse.lock().await;
        
        if auto_parse {
            // 获取消息内容
            if let Some(content) = message.get_content().as_object() {
                // 检查是否为原始数据
                if let Some(data) = content.get("data") {
                    if let Some(data_array) = data.as_array() {
                        // 将JSON数组转换为字节数组
                        let bytes: Result<Vec<u8>, _> = data_array
                            .iter()
                            .map(|v| v.as_u64().map(|n| n as u8).ok_or("Invalid byte value"))
                            .collect();
                        
                        if let Ok(bytes) = bytes {
                            // 使用协议处理器处理接收到的数据
                            match self.protocol_handler.process_received_message(&self.channel_id, &bytes).await {
                                Ok(processed_message) => return Ok(processed_message),
                                Err(e) => {
                                    eprintln!("Failed to process received data with protocol: {}", e);
                                    // 如果处理失败，返回原始消息
                                    return Ok(message);
                                }
                            }
                        }
                    } else if let Some(data_string) = data.as_str() {
                        // 处理字符串数据
                        let bytes = data_string.as_bytes();
                        
                        // 使用协议处理器处理接收到的数据
                        match self.protocol_handler.process_received_message(&self.channel_id, bytes).await {
                            Ok(processed_message) => return Ok(processed_message),
                            Err(e) => {
                                eprintln!("Failed to process received data with protocol: {}", e);
                                // 如果处理失败，返回原始消息
                                return Ok(message);
                            }
                        }
                    }
                }
            }
        }
        
        // 如果不启用自动解析或解析失败，返回原始消息
        Ok(message)
    }

    async fn send_and_wait(
        &self,
        message: &Message,
        timeout_secs: u64,
    ) -> Result<Message, Box<dyn Error + Send + Sync>> {
        // 检查是否启用自动解析
        let auto_parse = *self.auto_parse.lock().await;
        
        if auto_parse {
            // 使用协议处理器处理消息
            match self.protocol_handler.process_message_to_send(&self.channel_id, message).await {
                Ok(data) => {
                    // 创建包含处理后数据的新消息
                    let processed_message = Message::new(serde_json::json!({
                        "data": data,
                        "raw": true
                    }));
                    
                    // 使用内部通道发送处理后的消息并等待响应
                    let response = self.inner_channel.send_and_wait(&processed_message, timeout_secs).await?;
                    
                    // 处理响应
                    if let Some(content) = response.get_content().as_object() {
                        if let Some(data) = content.get("data") {
                            if let Some(data_array) = data.as_array() {
                                // 将JSON数组转换为字节数组
                                let bytes: Result<Vec<u8>, _> = data_array
                                    .iter()
                                    .map(|v| v.as_u64().map(|n| n as u8).ok_or("Invalid byte value"))
                                    .collect();
                                
                                if let Ok(bytes) = bytes {
                                    // 使用协议处理器处理接收到的数据
                                    match self.protocol_handler.process_received_message(&self.channel_id, &bytes).await {
                                        Ok(processed_response) => return Ok(processed_response),
                                        Err(e) => {
                                            eprintln!("Failed to process response with protocol: {}", e);
                                            // 如果处理失败，返回原始响应
                                            return Ok(response);
                                        }
                                    }
                                }
                            } else if let Some(data_string) = data.as_str() {
                                // 处理字符串数据
                                let bytes = data_string.as_bytes();
                                
                                // 使用协议处理器处理接收到的数据
                                match self.protocol_handler.process_received_message(&self.channel_id, bytes).await {
                                    Ok(processed_response) => return Ok(processed_response),
                                    Err(e) => {
                                        eprintln!("Failed to process response with protocol: {}", e);
                                        // 如果处理失败，返回原始响应
                                        return Ok(response);
                                    }
                                }
                            }
                        }
                    }
                    
                    // 如果无法处理响应，返回原始响应
                    Ok(response)
                }
                Err(e) => {
                    eprintln!("Failed to process message with protocol: {}", e);
                    // 如果协议处理失败，直接发送原始消息
                    self.inner_channel.send_and_wait(message, timeout_secs).await
                }
            }
        } else {
            // 不启用自动解析，直接发送原始消息
            self.inner_channel.send_and_wait(message, timeout_secs).await
        }
    }

    async fn close(&self) -> Result<(), Box<dyn Error + Send + Sync>> {
        // 直接调用内部通道的关闭方法
        self.inner_channel.close().await
    }

    async fn on_statechange(&self, state: ChannelState) -> Result<(), Box<dyn Error + Send + Sync>> {
        // 直接调用内部通道的状态变更方法
        self.inner_channel.on_statechange(state).await
    }
}
