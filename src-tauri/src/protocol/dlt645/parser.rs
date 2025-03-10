use crate::basefunc::frame_645::Frame645;
use crate::basefunc::protocol::FrameAnalisyic;
use crate::protocol::traits::{ProtocolMessage, ProtocolParser};
use async_trait::async_trait;
use serde_json::{json, Value};
use std::error::Error;
use std::sync::{Arc, Mutex};

/// DLT645 协议解析器
pub struct DLT645Parser {
    // 协议配置
    config: Mutex<Value>,
}

impl DLT645Parser {
    /// 创建新的 DLT645 解析器实例
    pub fn new() -> Self {
        Self {
            config: Mutex::new(json!({
                "name": "DLT645-2007",
                "description": "DLT/645-2007 电力数据采集与管理系统",
                "version": "1.0.0"
            })),
        }
    }

    /// 验证 DLT645 报文的有效性
    pub fn validate_frame(data: &[u8]) -> bool {
        Frame645::is_dlt645_frame(data)
    }

    /// 计算校验和
    pub fn calculate_checksum(data: &[u8]) -> u8 {
        let mut sum: u8 = 0;
        for &byte in data {
            sum = sum.wrapping_add(byte);
        }
        sum
    }

    /// 解析地址字段
    pub fn parse_address(data: &[u8], start_pos: usize) -> String {
        let mut address = String::new();
        for i in (0..6).rev() {
            let digit = data[start_pos + i];
            address.push_str(&format!("{:02X}", digit));
        }
        address
    }

    /// 解析数据标识
    pub fn parse_data_identifier(data: &[u8], start_pos: usize) -> String {
        let mut identifier = String::new();
        for i in (0..4).rev() {
            let digit = data[start_pos + i];
            identifier.push_str(&format!("{:02X}", digit));
        }
        identifier
    }

    /// 解析数据字段
    pub fn parse_data_field(data: &[u8], start_pos: usize, length: usize) -> Vec<u8> {
        let mut result = Vec::with_capacity(length);
        for i in 0..length {
            result.push(data[start_pos + i] - 0x33);
        }
        result
    }

    /// 解析地址字符串为字节数组
    fn parse_address_str(&self, address: &str) -> Result<Vec<u8>, Box<dyn Error + Send + Sync>> {
        let address = address.replace(" ", "");
        if address.len() != 12 {
            return Err(format!("Invalid address length: {}, expected 12 hex characters", address.len()).into());
        }
        
        let mut bytes = Vec::new();
        for i in (0..12).step_by(2) {
            if i + 2 <= address.len() {
                let byte = u8::from_str_radix(&address[i..i+2], 16)
                    .map_err(|_| format!("Invalid hex in address: {}", &address[i..i+2]))?;
                bytes.push(byte);
            }
        }
        
        // DLT645 地址是倒序的
        bytes.reverse();
        
        Ok(bytes)
    }

    /// 解析数据标识符字符串为字节数组
    fn parse_data_identifier_str(&self, data_id: &str) -> Result<Vec<u8>, Box<dyn Error + Send + Sync>> {
        let data_id = data_id.replace(" ", "");
        if data_id.len() != 8 {
            return Err(format!("Invalid data identifier length: {}, expected 8 hex characters", data_id.len()).into());
        }
        
        let mut bytes = Vec::new();
        for i in (0..8).step_by(2) {
            if i + 2 <= data_id.len() {
                let byte = u8::from_str_radix(&data_id[i..i+2], 16)
                    .map_err(|_| format!("Invalid hex in data identifier: {}", &data_id[i..i+2]))?;
                bytes.push(byte);
            }
        }
        
        // DLT645 数据标识符是倒序的
        bytes.reverse();
        
        Ok(bytes)
    }

    /// 解析数据字符串为字节数组
    fn parse_data_str(&self, data: &str) -> Result<Vec<u8>, Box<dyn Error + Send + Sync>> {
        if data.is_empty() {
            return Ok(Vec::new());
        }
        
        let data = data.replace(" ", "");
        if data.len() % 2 != 0 {
            return Err(format!("Invalid data length: {}, expected even number of hex characters", data.len()).into());
        }
        
        let mut bytes = Vec::new();
        for i in (0..data.len()).step_by(2) {
            if i + 2 <= data.len() {
                let byte = u8::from_str_radix(&data[i..i+2], 16)
                    .map_err(|_| format!("Invalid hex in data: {}", &data[i..i+2]))?;
                bytes.push(byte);
            }
        }
        
        Ok(bytes)
    }
}

#[async_trait]
impl ProtocolParser for DLT645Parser {
    /// 获取协议名称
    fn get_protocol_name(&self) -> String {
        "DLT645-2007".to_string()
    }

    /// 解析二进制数据为协议消息
    async fn parse(&self, data: &[u8]) -> Result<ProtocolMessage, Box<dyn Error + Send + Sync>> {
        let is_valid = Self::validate_frame(data);
        
        // 如果报文无效，返回错误消息
        if !is_valid {
            return Ok(ProtocolMessage {
                protocol_type: self.get_protocol_name(),
                raw_data: data.to_vec(),
                parsed_data: json!({}),
                is_valid: false,
                validation_message: Some("Invalid DLT645 frame".to_string()),
            });
        }

        // 使用 basefunc 中的 FrameAnalisyic 进行解析
        let parsed_data = FrameAnalisyic::process_frame(data, "default");
        
        // 创建协议消息
        let message = ProtocolMessage {
            protocol_type: self.get_protocol_name(),
            raw_data: data.to_vec(),
            parsed_data: json!({
                "items": parsed_data,
            }),
            is_valid: true,
            validation_message: None,
        };

        Ok(message)
    }

    /// 构建协议消息为二进制数据
    async fn build(&self, message: &Value) -> Result<Vec<u8>, Box<dyn Error + Send + Sync>> {
        // 检查消息是否包含必要的字段
        if !message.is_object() {
            return Err("Message must be an object".into());
        }

        let message_obj = message.as_object().unwrap();

        // 如果消息中包含原始数据，直接返回
        if let Some(raw) = message_obj.get("raw") {
            if let Some(raw_array) = raw.as_array() {
                let bytes: Result<Vec<u8>, _> = raw_array
                    .iter()
                    .map(|v| v.as_u64().map(|n| n as u8).ok_or("Invalid byte value"))
                    .collect();
                
                if let Ok(data) = bytes {
                    return Ok(data);
                }
            }
        }

        // 从消息中提取必要的字段
        let address = message_obj.get("address")
            .and_then(|v| v.as_str())
            .ok_or("Missing or invalid 'address' field")?;
        
        // 功能码可能是字符串或数字
        let function_code = if let Some(fc) = message_obj.get("functionCode") {
            if let Some(fc_num) = fc.as_u64() {
                fc_num as u8
            } else if let Some(fc_str) = fc.as_str() {
                // 尝试将十六进制字符串转换为数字
                u8::from_str_radix(fc_str, 16)
                    .map_err(|_| format!("Invalid function code format: {}", fc_str))?
            } else {
                return Err("Invalid 'functionCode' field type".into());
            }
        } else {
            return Err("Missing 'functionCode' field".into());
        };
        
        let data_identifier = message_obj.get("dataIdentifier")
            .and_then(|v| v.as_str())
            .ok_or("Missing or invalid 'dataIdentifier' field")?;
        
        // 数据字段是可选的
        let data = message_obj.get("data")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        // 构建 DLT645 报文
        let mut frame = Vec::new();
        
        // 添加起始符 0x68
        frame.push(0x68);
        
        // 添加地址字段 (6字节，从右到左)
        let address_bytes = self.parse_address_str(address)?;
        frame.extend_from_slice(&address_bytes);
        
        // 添加第二个起始符 0x68
        frame.push(0x68);
        
        // 添加控制码
        frame.push(function_code);
        
        // 添加数据长度 (数据标识符4字节 + 数据字节数)
        let data_bytes = self.parse_data_str(data)?;
        let data_identifier_bytes = self.parse_data_identifier_str(data_identifier)?;
        frame.push((data_identifier_bytes.len() + data_bytes.len()) as u8);
        
        // 添加数据标识符 (每个字节+0x33)
        for byte in &data_identifier_bytes {
            frame.push(byte + 0x33);
        }
        
        // 添加数据 (每个字节+0x33)
        for byte in &data_bytes {
            frame.push(byte + 0x33);
        }
        
        // 计算校验和
        let cs = DLT645Parser::calculate_checksum(&frame[1..]);
        frame.push(cs);
        
        // 添加结束符 0x16
        frame.push(0x16);
        
        Ok(frame)
    }

    /// 验证数据是否符合协议格式
    async fn validate(&self, data: &[u8]) -> Result<bool, Box<dyn Error + Send + Sync>> {
        Ok(Self::validate_frame(data))
    }

    /// 获取协议配置信息
    fn get_config(&self) -> Value {
        match self.config.lock() {
            Ok(config) => config.clone(),
            Err(_) => json!({
                "error": "Failed to get config"
            }),
        }
    }

    /// 设置协议配置信息
    fn set_config(&mut self, config: Value) -> Result<(), Box<dyn Error + Send + Sync>> {
        match self.config.lock() {
            Ok(mut current_config) => {
                *current_config = config;
                Ok(())
            },
            Err(_) => Err("Failed to set config".into()),
        }
    }
}

// 为了方便测试和使用，实现 Default trait
impl Default for DLT645Parser {
    fn default() -> Self {
        Self::new()
    }
}

// 创建共享实例
pub fn create_shared_instance() -> Arc<dyn ProtocolParser> {
    Arc::new(DLT645Parser::new())
}
