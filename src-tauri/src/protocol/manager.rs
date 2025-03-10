use std::collections::HashMap;
use std::error::Error;
use std::sync::Arc;
use tokio::sync::RwLock;
use crate::protocol::traits::{ProtocolMessage, ProtocolParser};

/// 协议管理器，负责管理和注册不同的协议解析器
pub struct ProtocolManager {
    /// 协议解析器映射表，键为协议名称，值为协议解析器实例
    parsers: RwLock<HashMap<String, Arc<dyn ProtocolParser>>>,
}

impl ProtocolManager {
    /// 创建新的协议管理器实例
    pub fn new() -> Self {
        Self {
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

    /// 获取指定名称的协议解析器
    pub async fn get_parser(&self, protocol_name: &str) -> Option<Arc<dyn ProtocolParser>> {
        let parsers = self.parsers.read().await;
        parsers.get(protocol_name).cloned()
    }

    /// 解析数据，自动检测协议类型
    pub async fn parse_data(&self, data: &[u8]) -> Result<Option<ProtocolMessage>, Box<dyn Error + Send + Sync>> {
        let parsers = self.parsers.read().await;
        
        // 尝试使用每个注册的解析器解析数据
        for parser in parsers.values() {
            match parser.validate(data).await {
                Ok(true) => {
                    // 如果验证通过，使用该解析器解析数据
                    return Ok(Some(parser.parse(data).await?));
                }
                _ => continue, // 验证失败或出错，继续尝试下一个解析器
            }
        }
        
        // 没有找到匹配的解析器
        Ok(None)
    }

    /// 使用指定协议解析数据
    pub async fn parse_with_protocol(
        &self, 
        protocol_name: &str, 
        data: &[u8]
    ) -> Result<ProtocolMessage, Box<dyn Error + Send + Sync>> {
        let parsers = self.parsers.read().await;
        
        if let Some(parser) = parsers.get(protocol_name) {
            parser.parse(data).await
        } else {
            Err(format!("Protocol parser '{}' not found", protocol_name).into())
        }
    }

    /// 使用指定协议构建数据
    pub async fn build_with_protocol(
        &self, 
        protocol_name: &str, 
        message: &serde_json::Value
    ) -> Result<Vec<u8>, Box<dyn Error + Send + Sync>> {
        let parsers = self.parsers.read().await;
        
        if let Some(parser) = parsers.get(protocol_name) {
            parser.build(message).await
        } else {
            Err(format!("Protocol parser '{}' not found", protocol_name).into())
        }
    }

    /// 获取所有注册的协议名称
    pub async fn get_protocol_names(&self) -> Vec<String> {
        let parsers = self.parsers.read().await;
        parsers.keys().cloned().collect()
    }

    /// 检查指定的协议是否被支持
    pub async fn is_protocol_supported(&self, protocol_name: &str) -> bool {
        let parsers = self.parsers.read().await;
        parsers.contains_key(protocol_name)
    }
}
