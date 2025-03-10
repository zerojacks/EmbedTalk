use crate::protocol::dlt645::{FRAME_START, FRAME_END, FunctionCode};
use serde_json::{json, Value};
use std::error::Error;

/// DLT645 协议构建器
pub struct DLT645Builder;

impl DLT645Builder {
    /// 创建新的 DLT645 构建器实例
    pub fn new() -> Self {
        Self {}
    }

    /// 计算校验和
    pub fn calculate_checksum(data: &[u8]) -> u8 {
        let mut sum: u8 = 0;
        for &byte in data {
            sum = sum.wrapping_add(byte);
        }
        sum
    }

    /// 构建读取数据报文
    pub fn build_read_data_frame(&self, address: &str, data_id: &str) -> Result<Vec<u8>, Box<dyn Error + Send + Sync>> {
        // 解析地址
        let address_bytes = self.parse_address(address)?;
        
        // 解析数据标识
        let data_id_bytes = self.parse_data_id(data_id)?;
        
        // 构建报文
        let mut frame = Vec::new();
        
        // 起始符
        frame.push(FRAME_START);
        
        // 地址域
        frame.extend_from_slice(&address_bytes);
        
        // 起始符
        frame.push(FRAME_START);
        
        // 控制码 (读数据)
        frame.push(FunctionCode::ReadData as u8);
        
        // 数据长度
        frame.push(4); // 数据标识长度为4字节
        
        // 数据域 (数据标识)
        // 数据标识需要加上 0x33
        for &byte in &data_id_bytes {
            frame.push(byte.wrapping_add(0x33));
        }
        
        // 校验和
        let checksum = Self::calculate_checksum(&frame[1..frame.len()]);
        frame.push(checksum);
        
        // 结束符
        frame.push(FRAME_END);
        
        Ok(frame)
    }

    /// 构建写数据报文
    pub fn build_write_data_frame(
        &self,
        address: &str,
        data_id: &str,
        data: &[u8],
    ) -> Result<Vec<u8>, Box<dyn Error + Send + Sync>> {
        // 解析地址
        let address_bytes = self.parse_address(address)?;
        
        // 解析数据标识
        let data_id_bytes = self.parse_data_id(data_id)?;
        
        // 构建报文
        let mut frame = Vec::new();
        
        // 起始符
        frame.push(FRAME_START);
        
        // 地址域
        frame.extend_from_slice(&address_bytes);
        
        // 起始符
        frame.push(FRAME_START);
        
        // 控制码 (写数据)
        frame.push(FunctionCode::WriteData as u8);
        
        // 数据长度
        frame.push((4 + data.len()) as u8); // 数据标识长度 + 数据长度
        
        // 数据域 (数据标识 + 数据)
        // 数据标识和数据都需要加上 0x33
        for &byte in &data_id_bytes {
            frame.push(byte.wrapping_add(0x33));
        }
        
        for &byte in data {
            frame.push(byte.wrapping_add(0x33));
        }
        
        // 校验和
        let checksum = Self::calculate_checksum(&frame[1..frame.len()]);
        frame.push(checksum);
        
        // 结束符
        frame.push(FRAME_END);
        
        Ok(frame)
    }

    /// 构建读取地址报文
    pub fn build_read_address_frame(&self) -> Result<Vec<u8>, Box<dyn Error + Send + Sync>> {
        // 构建报文
        let mut frame = Vec::new();
        
        // 起始符
        frame.push(FRAME_START);
        
        // 广播地址 (全 AA)
        for _ in 0..6 {
            frame.push(0xAA);
        }
        
        // 起始符
        frame.push(FRAME_START);
        
        // 控制码 (读地址)
        frame.push(FunctionCode::ReadAddress as u8);
        
        // 数据长度
        frame.push(0); // 无数据
        
        // 校验和
        let checksum = Self::calculate_checksum(&frame[1..frame.len()]);
        frame.push(checksum);
        
        // 结束符
        frame.push(FRAME_END);
        
        Ok(frame)
    }

    /// 解析地址字符串为字节数组
    fn parse_address(&self, address: &str) -> Result<Vec<u8>, Box<dyn Error + Send + Sync>> {
        // 地址格式应为 12 位十六进制数字
        if address.len() != 12 {
            return Err(format!("Invalid address length: {}", address.len()).into());
        }
        
        let mut bytes = Vec::with_capacity(6);
        
        // 每两个字符转换为一个字节，倒序排列
        for i in (0..12).step_by(2).rev() {
            let hex_str = &address[i..i+2];
            let byte = u8::from_str_radix(hex_str, 16)
                .map_err(|_| format!("Invalid hex digit: {}", hex_str))?;
            bytes.push(byte);
        }
        
        Ok(bytes)
    }

    /// 解析数据标识字符串为字节数组
    fn parse_data_id(&self, data_id: &str) -> Result<Vec<u8>, Box<dyn Error + Send + Sync>> {
        // 数据标识格式应为 8 位十六进制数字
        if data_id.len() != 8 {
            return Err(format!("Invalid data ID length: {}", data_id.len()).into());
        }
        
        let mut bytes = Vec::with_capacity(4);
        
        // 每两个字符转换为一个字节，倒序排列
        for i in (0..8).step_by(2).rev() {
            let hex_str = &data_id[i..i+2];
            let byte = u8::from_str_radix(hex_str, 16)
                .map_err(|_| format!("Invalid hex digit: {}", hex_str))?;
            bytes.push(byte);
        }
        
        Ok(bytes)
    }

    /// 从 JSON 对象构建 DLT645 报文
    pub fn build_from_json(&self, json_data: &Value) -> Result<Vec<u8>, Box<dyn Error + Send + Sync>> {
        if !json_data.is_object() {
            return Err("JSON data must be an object".into());
        }
        
        let data_obj = json_data.as_object().unwrap();
        
        // 获取操作类型
        let operation = data_obj.get("operation")
            .and_then(|v| v.as_str())
            .ok_or("Missing or invalid 'operation' field")?;
        
        match operation {
            "read_data" => {
                // 获取地址
                let address = data_obj.get("address")
                    .and_then(|v| v.as_str())
                    .ok_or("Missing or invalid 'address' field")?;
                
                // 获取数据标识
                let data_id = data_obj.get("data_id")
                    .and_then(|v| v.as_str())
                    .ok_or("Missing or invalid 'data_id' field")?;
                
                self.build_read_data_frame(address, data_id)
            },
            "write_data" => {
                // 获取地址
                let address = data_obj.get("address")
                    .and_then(|v| v.as_str())
                    .ok_or("Missing or invalid 'address' field")?;
                
                // 获取数据标识
                let data_id = data_obj.get("data_id")
                    .and_then(|v| v.as_str())
                    .ok_or("Missing or invalid 'data_id' field")?;
                
                // 获取数据
                let data = data_obj.get("data")
                    .and_then(|v| v.as_array())
                    .ok_or("Missing or invalid 'data' field")?;
                
                // 将 JSON 数组转换为字节数组
                let bytes: Result<Vec<u8>, _> = data
                    .iter()
                    .map(|v| v.as_u64().map(|n| n as u8).ok_or("Invalid byte value"))
                    .collect();
                
                let data_bytes = bytes.map_err(|e| format!("Invalid data array: {}", e))?;
                
                self.build_write_data_frame(address, data_id, &data_bytes)
            },
            "read_address" => {
                self.build_read_address_frame()
            },
            _ => Err(format!("Unsupported operation: {}", operation).into()),
        }
    }
}

// 为了方便测试和使用，实现 Default trait
impl Default for DLT645Builder {
    fn default() -> Self {
        Self::new()
    }
}
