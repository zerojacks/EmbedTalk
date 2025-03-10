use async_trait::async_trait;
use serde_json::{json, Value};
use std::error::Error;
use crate::protocol::traits::{ProtocolMessage, ProtocolParser};
use super::{ModbusFunctionCode, MODBUS_PROTOCOL_NAME};

/// Modbus 协议解析器
pub struct ModbusParser {
    /// 协议配置
    config: Value,
}

impl ModbusParser {
    /// 创建新的 Modbus 协议解析器
    pub fn new() -> Self {
        Self {
            config: json!({
                "mode": "rtu",  // 可选: "rtu" 或 "tcp"
                "timeout_ms": 1000,
                "unit_id": 1,
            }),
        }
    }

    /// 计算 Modbus RTU CRC16 校验和
    fn calculate_crc(data: &[u8]) -> u16 {
        let mut crc = 0xFFFF;
        for byte in data {
            crc ^= *byte as u16;
            for _ in 0..8 {
                if (crc & 0x0001) != 0 {
                    crc >>= 1;
                    crc ^= 0xA001;
                } else {
                    crc >>= 1;
                }
            }
        }
        crc
    }

    /// 解析 Modbus RTU 消息
    fn parse_rtu(&self, data: &[u8]) -> Result<Value, Box<dyn Error + Send + Sync>> {
        if data.len() < 4 {
            return Err("Modbus RTU frame too short".into());
        }

        let unit_id = data[0];
        let function_code = data[1];
        let payload = &data[2..data.len() - 2];
        let crc = ((data[data.len() - 1] as u16) << 8) | (data[data.len() - 2] as u16);
        let calculated_crc = Self::calculate_crc(&data[0..data.len() - 2]);

        // 验证 CRC
        if crc != calculated_crc {
            return Err(format!("CRC check failed: expected {:04X}, got {:04X}", calculated_crc, crc).into());
        }

        // 根据功能码解析有效载荷
        let parsed_payload = match function_code {
            0x01 | 0x02 => self.parse_read_bits_response(payload)?,
            0x03 | 0x04 => self.parse_read_registers_response(payload)?,
            0x05 => self.parse_write_single_coil_response(payload)?,
            0x06 => self.parse_write_single_register_response(payload)?,
            0x0F => self.parse_write_multiple_coils_response(payload)?,
            0x10 => self.parse_write_multiple_registers_response(payload)?,
            _ if function_code & 0x80 != 0 => {
                // 异常响应
                if payload.len() < 1 {
                    return Err("Invalid exception response".into());
                }
                json!({
                    "exception": true,
                    "function_code": function_code & 0x7F,
                    "exception_code": payload[0],
                })
            }
            _ => return Err(format!("Unsupported function code: {:02X}", function_code).into()),
        };

        Ok(json!({
            "unit_id": unit_id,
            "function_code": function_code,
            "payload": parsed_payload,
        }))
    }

    /// 解析 Modbus TCP 消息
    fn parse_tcp(&self, data: &[u8]) -> Result<Value, Box<dyn Error + Send + Sync>> {
        if data.len() < 8 {
            return Err("Modbus TCP frame too short".into());
        }

        let transaction_id = ((data[0] as u16) << 8) | (data[1] as u16);
        let protocol_id = ((data[2] as u16) << 8) | (data[3] as u16);
        let length = ((data[4] as u16) << 8) | (data[5] as u16);
        let unit_id = data[6];
        let function_code = data[7];
        let payload = &data[8..];

        // 验证协议 ID（应为 0）
        if protocol_id != 0 {
            return Err(format!("Invalid protocol ID: {:04X}", protocol_id).into());
        }

        // 验证长度
        if (payload.len() + 2) as u16 != length {
            return Err(format!("Length mismatch: expected {}, got {}", length, payload.len() + 2).into());
        }

        // 根据功能码解析有效载荷
        let parsed_payload = match function_code {
            0x01 | 0x02 => self.parse_read_bits_response(&payload)?,
            0x03 | 0x04 => self.parse_read_registers_response(&payload)?,
            0x05 => self.parse_write_single_coil_response(&payload)?,
            0x06 => self.parse_write_single_register_response(&payload)?,
            0x0F => self.parse_write_multiple_coils_response(&payload)?,
            0x10 => self.parse_write_multiple_registers_response(&payload)?,
            _ if function_code & 0x80 != 0 => {
                // 异常响应
                if payload.len() < 1 {
                    return Err("Invalid exception response".into());
                }
                json!({
                    "exception": true,
                    "function_code": function_code & 0x7F,
                    "exception_code": payload[0],
                })
            }
            _ => return Err(format!("Unsupported function code: {:02X}", function_code).into()),
        };

        Ok(json!({
            "transaction_id": transaction_id,
            "protocol_id": protocol_id,
            "length": length,
            "unit_id": unit_id,
            "function_code": function_code,
            "payload": parsed_payload,
        }))
    }

    // 解析读取位状态响应
    fn parse_read_bits_response(&self, payload: &[u8]) -> Result<Value, Box<dyn Error + Send + Sync>> {
        if payload.is_empty() {
            return Err("Empty payload".into());
        }

        let byte_count = payload[0] as usize;
        if payload.len() < byte_count + 1 {
            return Err("Payload too short".into());
        }

        let mut bits = Vec::new();
        for i in 0..byte_count {
            let byte = payload[i + 1];
            for bit in 0..8 {
                if i * 8 + bit < byte_count * 8 {
                    bits.push((byte >> bit) & 1 == 1);
                }
            }
        }

        Ok(json!({
            "byte_count": byte_count,
            "bits": bits,
        }))
    }

    // 解析读取寄存器响应
    fn parse_read_registers_response(&self, payload: &[u8]) -> Result<Value, Box<dyn Error + Send + Sync>> {
        if payload.is_empty() {
            return Err("Empty payload".into());
        }

        let byte_count = payload[0] as usize;
        if payload.len() < byte_count + 1 {
            return Err("Payload too short".into());
        }

        let mut registers = Vec::new();
        for i in 0..byte_count / 2 {
            let high = payload[i * 2 + 1] as u16;
            let low = payload[i * 2 + 2] as u16;
            registers.push((high << 8) | low);
        }

        Ok(json!({
            "byte_count": byte_count,
            "registers": registers,
        }))
    }

    // 解析写入单个线圈响应
    fn parse_write_single_coil_response(&self, payload: &[u8]) -> Result<Value, Box<dyn Error + Send + Sync>> {
        if payload.len() < 4 {
            return Err("Payload too short".into());
        }

        let address = ((payload[0] as u16) << 8) | (payload[1] as u16);
        let value = ((payload[2] as u16) << 8) | (payload[3] as u16);
        let state = value == 0xFF00;

        Ok(json!({
            "address": address,
            "state": state,
        }))
    }

    // 解析写入单个寄存器响应
    fn parse_write_single_register_response(&self, payload: &[u8]) -> Result<Value, Box<dyn Error + Send + Sync>> {
        if payload.len() < 4 {
            return Err("Payload too short".into());
        }

        let address = ((payload[0] as u16) << 8) | (payload[1] as u16);
        let value = ((payload[2] as u16) << 8) | (payload[3] as u16);

        Ok(json!({
            "address": address,
            "value": value,
        }))
    }

    // 解析写入多个线圈响应
    fn parse_write_multiple_coils_response(&self, payload: &[u8]) -> Result<Value, Box<dyn Error + Send + Sync>> {
        if payload.len() < 4 {
            return Err("Payload too short".into());
        }

        let address = ((payload[0] as u16) << 8) | (payload[1] as u16);
        let quantity = ((payload[2] as u16) << 8) | (payload[3] as u16);

        Ok(json!({
            "address": address,
            "quantity": quantity,
        }))
    }

    // 解析写入多个寄存器响应
    fn parse_write_multiple_registers_response(&self, payload: &[u8]) -> Result<Value, Box<dyn Error + Send + Sync>> {
        if payload.len() < 4 {
            return Err("Payload too short".into());
        }

        let address = ((payload[0] as u16) << 8) | (payload[1] as u16);
        let quantity = ((payload[2] as u16) << 8) | (payload[3] as u16);

        Ok(json!({
            "address": address,
            "quantity": quantity,
        }))
    }
}

#[async_trait]
impl ProtocolParser for ModbusParser {
    fn get_protocol_name(&self) -> String {
        MODBUS_PROTOCOL_NAME.to_string()
    }

    async fn parse(&self, data: &[u8]) -> Result<ProtocolMessage, Box<dyn Error + Send + Sync>> {
        let mode = self.config["mode"].as_str().unwrap_or("rtu");
        
        let parsed_data = match mode {
            "rtu" => self.parse_rtu(data)?,
            "tcp" => self.parse_tcp(data)?,
            _ => return Err(format!("Unsupported Modbus mode: {}", mode).into()),
        };

        Ok(ProtocolMessage {
            protocol_type: MODBUS_PROTOCOL_NAME.to_string(),
            raw_data: data.to_vec(),
            parsed_data,
            is_valid: true,
            validation_message: None,
        })
    }

    async fn build(&self, message: &Value) -> Result<Vec<u8>, Box<dyn Error + Send + Sync>> {
        // 这里实现 Modbus 消息构建逻辑
        // 为简化示例，这里只实现一个基本框架
        let mode = self.config["mode"].as_str().unwrap_or("rtu");
        let unit_id = message.get("unit_id").and_then(|v| v.as_u64()).unwrap_or(1) as u8;
        let function_code = message.get("function_code").and_then(|v| v.as_u64()).unwrap_or(0) as u8;
        
        // 这里应该根据功能码构建不同的消息
        // 简化实现，仅作示例
        let mut data = vec![unit_id, function_code];
        
        if let Some(payload) = message.get("payload") {
            if let Some(address) = payload.get("address") {
                let address_value = address.as_u64().unwrap_or(0) as u16;
                data.push((address_value >> 8) as u8);
                data.push(address_value as u8);
                
                match function_code {
                    0x01 | 0x02 | 0x03 | 0x04 => {
                        // 读取操作
                        let quantity = payload.get("quantity").and_then(|v| v.as_u64()).unwrap_or(1) as u16;
                        data.push((quantity >> 8) as u8);
                        data.push(quantity as u8);
                    },
                    0x05 => {
                        // 写单个线圈
                        let state = payload.get("state").and_then(|v| v.as_bool()).unwrap_or(false);
                        data.push(if state { 0xFF } else { 0x00 });
                        data.push(0x00);
                    },
                    0x06 => {
                        // 写单个寄存器
                        let value = payload.get("value").and_then(|v| v.as_u64()).unwrap_or(0) as u16;
                        data.push((value >> 8) as u8);
                        data.push(value as u8);
                    },
                    0x0F | 0x10 => {
                        // 写多个线圈/寄存器
                        // 这里需要更复杂的实现，简化处理
                        return Err("Building multi-write messages not implemented in this example".into());
                    },
                    _ => return Err(format!("Unsupported function code: {:02X}", function_code).into()),
                }
            }
        }
        
        // 根据模式添加适当的帧头/尾
        match mode {
            "rtu" => {
                // 添加 CRC
                let crc = Self::calculate_crc(&data);
                data.push(crc as u8);
                data.push((crc >> 8) as u8);
            },
            "tcp" => {
                // 添加 Modbus TCP 头
                let transaction_id = message.get("transaction_id").and_then(|v| v.as_u64()).unwrap_or(1) as u16;
                let length = (data.len() as u16) + 1; // +1 for unit_id which is already in data
                
                let mut tcp_header = vec![
                    (transaction_id >> 8) as u8,
                    transaction_id as u8,
                    0x00, 0x00, // Protocol ID (always 0)
                    (length >> 8) as u8,
                    length as u8,
                ];
                
                // 移除 unit_id，因为它会被添加到 TCP 头后面
                let unit_id = data.remove(0);
                
                // 组合最终数据
                let mut final_data = tcp_header;
                final_data.push(unit_id);
                final_data.extend_from_slice(&data);
                
                return Ok(final_data);
            },
            _ => return Err(format!("Unsupported Modbus mode: {}", mode).into()),
        }
        
        Ok(data)
    }

    async fn validate(&self, data: &[u8]) -> Result<bool, Box<dyn Error + Send + Sync>> {
        let mode = self.config["mode"].as_str().unwrap_or("rtu");
        
        match mode {
            "rtu" => {
                // 验证 Modbus RTU 帧
                if data.len() < 4 {
                    return Ok(false);
                }
                
                // 检查 CRC
                let crc = ((data[data.len() - 1] as u16) << 8) | (data[data.len() - 2] as u16);
                let calculated_crc = Self::calculate_crc(&data[0..data.len() - 2]);
                
                Ok(crc == calculated_crc)
            },
            "tcp" => {
                // 验证 Modbus TCP 帧
                if data.len() < 8 {
                    return Ok(false);
                }
                
                let protocol_id = ((data[2] as u16) << 8) | (data[3] as u16);
                let length = ((data[4] as u16) << 8) | (data[5] as u16);
                
                // 协议 ID 必须为 0
                if protocol_id != 0 {
                    return Ok(false);
                }
                
                // 验证长度
                Ok((data.len() - 6) as u16 == length)
            },
            _ => Err(format!("Unsupported Modbus mode: {}", mode).into()),
        }
    }

    fn get_config(&self) -> Value {
        self.config.clone()
    }

    fn set_config(&mut self, config: Value) -> Result<(), Box<dyn Error + Send + Sync>> {
        self.config = config;
        Ok(())
    }
}

// 为了方便测试和使用，实现 Default trait
impl Default for ModbusParser {
    fn default() -> Self {
        Self::new()
    }
}

/// 创建共享实例
pub fn create_shared_instance() -> std::sync::Arc<dyn ProtocolParser> {
    std::sync::Arc::new(ModbusParser::new())
}
