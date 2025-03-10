use std::collections::HashMap;
use std::error::Error;
use std::sync::Arc;
use tokio::sync::RwLock;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use crate::protocol::{ProtocolMessage, ProtocolParser};
use crate::combridage::Message;
use once_cell::sync::Lazy;

/// 通道协议处理器配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelProtocolConfig {
    /// 通道ID
    pub channel_id: String,
    /// 协议类型
    pub protocol_type: String,
    /// 协议特定配置
    pub protocol_config: Value,
    /// 是否启用自动解析
    pub auto_parse: bool,
}

// 全局单例实例
static CHANNEL_PROTOCOL_HANDLER: Lazy<ChannelProtocolHandler> = Lazy::new(|| {
    ChannelProtocolHandler::new()
});

/// 获取通道协议处理器全局实例
pub fn get_channel_protocol_handler() -> &'static ChannelProtocolHandler {
    &CHANNEL_PROTOCOL_HANDLER
}

/// 通道协议处理器
pub struct ChannelProtocolHandler {
    /// 通道协议配置映射表，键为通道ID
    configs: RwLock<HashMap<String, ChannelProtocolConfig>>,
    /// 协议解析器映射表，键为协议类型
    parsers: RwLock<HashMap<String, Arc<dyn ProtocolParser>>>,
}

impl ChannelProtocolHandler {
    /// 创建新的通道协议处理器
    pub fn new() -> Self {
        Self {
            configs: RwLock::new(HashMap::new()),
            parsers: RwLock::new(HashMap::new()),
        }
    }

    /// 注册协议解析器
    pub async fn register_parser(&self, parser: Arc<dyn ProtocolParser>) -> Result<(), Box<dyn Error + Send + Sync>> {
        let protocol_name = parser.get_protocol_name();
        let mut parsers = self.parsers.write().await;
        parsers.insert(protocol_name, parser);
        Ok(())
    }

    /// 配置通道使用的协议
    pub async fn configure_channel(
        &self,
        channel_id: &str,
        protocol_type: &str,
        protocol_config: Value,
        auto_parse: bool,
    ) -> Result<(), Box<dyn Error + Send + Sync>> {
        // 检查协议类型是否已注册
        let parsers = self.parsers.read().await;
        if !parsers.contains_key(protocol_type) {
            return Err(format!("Protocol '{}' not registered", protocol_type).into());
        }
        drop(parsers);

        // 更新通道配置
        let config = ChannelProtocolConfig {
            channel_id: channel_id.to_string(),
            protocol_type: protocol_type.to_string(),
            protocol_config,
            auto_parse,
        };

        let mut configs = self.configs.write().await;
        configs.insert(channel_id.to_string(), config);

        Ok(())
    }

    /// 获取通道协议配置
    pub async fn get_channel_config(&self, channel_id: &str) -> Option<ChannelProtocolConfig> {
        let configs = self.configs.read().await;
        configs.get(channel_id).cloned()
    }

    /// 使用指定协议解析原始数据
    pub async fn parse_data(
        &self,
        channel_id: &str,
        data: &[u8],
    ) -> Result<Option<ProtocolMessage>, Box<dyn Error + Send + Sync>> {
        // 获取通道配置
        let configs = self.configs.read().await;
        let config = match configs.get(channel_id) {
            Some(config) => config.clone(),
            None => return Ok(None), // 通道未配置协议
        };
        drop(configs);

        // 获取协议解析器
        let parsers = self.parsers.read().await;
        let parser = match parsers.get(&config.protocol_type) {
            Some(parser) => parser.clone(),
            None => return Err(format!("Protocol '{}' not found", config.protocol_type).into()),
        };
        drop(parsers);

        // 解析数据
        match parser.parse(data).await {
            Ok(message) => Ok(Some(message)),
            Err(e) => Err(format!("Failed to parse data: {}", e).into()),
        }
    }

    /// 使用指定协议构建消息
    pub async fn build_message(
        &self,
        channel_id: &str,
        message_data: &Value,
    ) -> Result<Vec<u8>, Box<dyn Error + Send + Sync>> {
        // 获取通道配置
        let configs = self.configs.read().await;
        let config = match configs.get(channel_id) {
            Some(config) => config.clone(),
            None => return Err(format!("Channel '{}' not configured for any protocol", channel_id).into()),
        };
        drop(configs);

        // 获取协议解析器
        let parsers = self.parsers.read().await;
        let parser = match parsers.get(&config.protocol_type) {
            Some(parser) => parser.clone(),
            None => return Err(format!("Protocol '{}' not found", config.protocol_type).into()),
        };
        drop(parsers);

        // 构建消息
        parser.build(message_data).await
    }

    /// 处理接收到的消息
    pub async fn process_received_message(
        &self,
        channel_id: &str,
        data: &[u8],
    ) -> Result<Message, Box<dyn Error + Send + Sync>> {
        // 尝试解析协议数据
        let protocol_message = match self.parse_data(channel_id, data).await? {
            Some(message) => message,
            None => {
                // 未配置协议或解析失败，返回原始数据
                return Ok(Message::new(json!({
                    "data": data,
                    "raw": true
                })));
            }
        };

        // 构建包含协议信息的消息
        let payload = json!({
            "protocol": protocol_message.protocol_type,
            "data": protocol_message.parsed_data,
            "raw_data": protocol_message.raw_data,
            "is_valid": protocol_message.is_valid,
            "validation_message": protocol_message.validation_message
        });

        Ok(Message::new(payload))
    }

    /// 处理要发送的消息
    pub async fn process_message_to_send(
        &self,
        channel_id: &str,
        message: &Message,
    ) -> Result<Vec<u8>, Box<dyn Error + Send + Sync>> {
        let payload = message.get_payload();
        
        // 检查消息是否包含协议信息
        if let Some(protocol) = payload.get("protocol").and_then(|v| v.as_str()) {
            // 包含协议信息，使用协议构建器生成数据
            if let Some(data) = payload.get("data") {
                return self.build_message(channel_id, data).await;
            }
        }
        
        // 不包含协议信息或数据，尝试从原始消息内容构建数据
        let content = message.get_content();
        match content {
            Value::String(s) => Ok(s.as_bytes().to_vec()),
            Value::Array(arr) => {
                // 尝试将数组解析为字节数组
                let bytes: Result<Vec<u8>, _> = arr
                    .iter()
                    .map(|v| v.as_u64().map(|n| n as u8).ok_or("Invalid byte value"))
                    .collect();
                
                match bytes {
                    Ok(data) => Ok(data),
                    Err(_) => Err("Failed to convert message content to bytes".into()),
                }
            }
            Value::Object(_) => {
                // 尝试使用通道配置的协议构建消息
                self.build_message(channel_id, &message.get_payload()).await
            }
            _ => Err("Unsupported message content type".into()),
        }
    }

    /// 获取所有支持的协议类型
    pub async fn get_supported_protocols(&self) -> Vec<String> {
        let parsers = self.parsers.read().await;
        parsers.keys().cloned().collect()
    }

    /// 获取指定协议的配置模板
    pub async fn get_protocol_config_template(&self, protocol_type: &str) -> Result<Value, Box<dyn Error + Send + Sync>> {
        let parsers = self.parsers.read().await;
        
        if let Some(parser) = parsers.get(protocol_type) {
            Ok(parser.get_config())
        } else {
            Err(format!("Protocol '{}' not found", protocol_type).into())
        }
    }
}
