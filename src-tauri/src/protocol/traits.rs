use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::error::Error;

/// 协议消息类型，用于表示解析后的协议消息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProtocolMessage {
    /// 协议类型标识
    pub protocol_type: String,
    /// 原始二进制数据
    pub raw_data: Vec<u8>,
    /// 解析后的结构化数据
    pub parsed_data: serde_json::Value,
    /// 消息是否有效（通过校验）
    pub is_valid: bool,
    /// 校验结果信息
    pub validation_message: Option<String>,
}

/// 协议解析器接口，定义了协议解析和构建的基本方法
#[async_trait]
pub trait ProtocolParser: Send + Sync {
    /// 获取协议类型名称
    fn get_protocol_name(&self) -> String;
    
    /// 解析二进制数据为协议消息
    async fn parse(&self, data: &[u8]) -> Result<ProtocolMessage, Box<dyn Error + Send + Sync>>;
    
    /// 构建协议消息为二进制数据
    async fn build(&self, message: &serde_json::Value) -> Result<Vec<u8>, Box<dyn Error + Send + Sync>>;
    
    /// 验证消息是否符合协议规范
    async fn validate(&self, data: &[u8]) -> Result<bool, Box<dyn Error + Send + Sync>>;
    
    /// 获取协议配置信息
    fn get_config(&self) -> serde_json::Value;
    
    /// 设置协议配置信息
    fn set_config(&mut self, config: serde_json::Value) -> Result<(), Box<dyn Error + Send + Sync>>;
}
