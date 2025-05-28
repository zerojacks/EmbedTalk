use super::ModbusFunctionCode;
use serde_json::Value;
use std::error::Error;

/// Modbus 协议消息构建器
pub struct ModbusBuilder {
    /// 设备地址 (Unit ID)
    unit_id: u8,
    /// Modbus 模式 (RTU 或 TCP)
    mode: String,
    /// 事务 ID (仅用于 TCP 模式)
    transaction_id: u16,
}

impl ModbusBuilder {
    /// 创建新的 Modbus 消息构建器
    pub fn new(unit_id: u8, mode: &str) -> Self {
        Self {
            unit_id,
            mode: mode.to_string(),
            transaction_id: 1,
        }
    }

    /// 设置事务 ID (仅用于 TCP 模式)
    pub fn with_transaction_id(mut self, transaction_id: u16) -> Self {
        self.transaction_id = transaction_id;
        self
    }

    /// 构建读取线圈状态请求 (功能码 0x01)
    pub fn build_read_coils(
        &self,
        start_address: u16,
        quantity: u16,
    ) -> Result<Vec<u8>, Box<dyn Error + Send + Sync>> {
        self.build_read_request(ModbusFunctionCode::ReadCoils as u8, start_address, quantity)
    }

    /// 构建读取离散输入状态请求 (功能码 0x02)
    pub fn build_read_discrete_inputs(
        &self,
        start_address: u16,
        quantity: u16,
    ) -> Result<Vec<u8>, Box<dyn Error + Send + Sync>> {
        self.build_read_request(
            ModbusFunctionCode::ReadDiscreteInputs as u8,
            start_address,
            quantity,
        )
    }

    /// 构建读取保持寄存器请求 (功能码 0x03)
    pub fn build_read_holding_registers(
        &self,
        start_address: u16,
        quantity: u16,
    ) -> Result<Vec<u8>, Box<dyn Error + Send + Sync>> {
        self.build_read_request(
            ModbusFunctionCode::ReadHoldingRegisters as u8,
            start_address,
            quantity,
        )
    }

    /// 构建读取输入寄存器请求 (功能码 0x04)
    pub fn build_read_input_registers(
        &self,
        start_address: u16,
        quantity: u16,
    ) -> Result<Vec<u8>, Box<dyn Error + Send + Sync>> {
        self.build_read_request(
            ModbusFunctionCode::ReadInputRegisters as u8,
            start_address,
            quantity,
        )
    }

    /// 构建写入单个线圈请求 (功能码 0x05)
    pub fn build_write_single_coil(
        &self,
        address: u16,
        value: bool,
    ) -> Result<Vec<u8>, Box<dyn Error + Send + Sync>> {
        let value_u16 = if value { 0xFF00 } else { 0x0000 };
        self.build_write_single_request(
            ModbusFunctionCode::WriteSingleCoil as u8,
            address,
            value_u16,
        )
    }

    /// 构建写入单个寄存器请求 (功能码 0x06)
    pub fn build_write_single_register(
        &self,
        address: u16,
        value: u16,
    ) -> Result<Vec<u8>, Box<dyn Error + Send + Sync>> {
        self.build_write_single_request(
            ModbusFunctionCode::WriteSingleRegister as u8,
            address,
            value,
        )
    }

    /// 构建写入多个线圈请求 (功能码 0x0F)
    pub fn build_write_multiple_coils(
        &self,
        start_address: u16,
        values: &[bool],
    ) -> Result<Vec<u8>, Box<dyn Error + Send + Sync>> {
        if values.is_empty() || values.len() > 1968 {
            return Err("Invalid number of coils (must be 1-1968)".into());
        }

        // 计算字节数
        let byte_count = (values.len() + 7) / 8;
        let mut coil_bytes = vec![0u8; byte_count];

        // 将布尔值打包成字节
        for (i, &value) in values.iter().enumerate() {
            if value {
                coil_bytes[i / 8] |= 1 << (i % 8);
            }
        }

        self.build_write_multiple_request(
            ModbusFunctionCode::WriteMultipleCoils as u8,
            start_address,
            values.len() as u16,
            &coil_bytes,
        )
    }

    /// 构建写入多个寄存器请求 (功能码 0x10)
    pub fn build_write_multiple_registers(
        &self,
        start_address: u16,
        values: &[u16],
    ) -> Result<Vec<u8>, Box<dyn Error + Send + Sync>> {
        if values.is_empty() || values.len() > 123 {
            return Err("Invalid number of registers (must be 1-123)".into());
        }

        // 将 u16 值转换为字节
        let mut register_bytes = Vec::with_capacity(values.len() * 2);
        for &value in values {
            register_bytes.push((value >> 8) as u8);
            register_bytes.push(value as u8);
        }

        self.build_write_multiple_request(
            ModbusFunctionCode::WriteMultipleRegisters as u8,
            start_address,
            values.len() as u16,
            &register_bytes,
        )
    }

    /// 构建读取请求 (功能码 0x01, 0x02, 0x03, 0x04)
    fn build_read_request(
        &self,
        function_code: u8,
        start_address: u16,
        quantity: u16,
    ) -> Result<Vec<u8>, Box<dyn Error + Send + Sync>> {
        // 验证数量
        match function_code {
            0x01 | 0x02 => {
                if quantity == 0 || quantity > 2000 {
                    return Err("Invalid quantity for read bits (must be 1-2000)".into());
                }
            }
            0x03 | 0x04 => {
                if quantity == 0 || quantity > 125 {
                    return Err("Invalid quantity for read registers (must be 1-125)".into());
                }
            }
            _ => return Err(format!("Unsupported function code: {:02X}", function_code).into()),
        }

        // 构建 PDU
        let mut pdu = vec![function_code];
        pdu.push((start_address >> 8) as u8);
        pdu.push(start_address as u8);
        pdu.push((quantity >> 8) as u8);
        pdu.push(quantity as u8);

        self.finalize_request(pdu)
    }

    /// 构建写入单个值请求 (功能码 0x05, 0x06)
    fn build_write_single_request(
        &self,
        function_code: u8,
        address: u16,
        value: u16,
    ) -> Result<Vec<u8>, Box<dyn Error + Send + Sync>> {
        // 构建 PDU
        let mut pdu = vec![function_code];
        pdu.push((address >> 8) as u8);
        pdu.push(address as u8);
        pdu.push((value >> 8) as u8);
        pdu.push(value as u8);

        self.finalize_request(pdu)
    }

    /// 构建写入多个值请求 (功能码 0x0F, 0x10)
    fn build_write_multiple_request(
        &self,
        function_code: u8,
        start_address: u16,
        quantity: u16,
        values: &[u8],
    ) -> Result<Vec<u8>, Box<dyn Error + Send + Sync>> {
        // 构建 PDU
        let mut pdu = vec![function_code];
        pdu.push((start_address >> 8) as u8);
        pdu.push(start_address as u8);
        pdu.push((quantity >> 8) as u8);
        pdu.push(quantity as u8);
        pdu.push(values.len() as u8);
        pdu.extend_from_slice(values);

        self.finalize_request(pdu)
    }

    /// 根据模式完成请求构建
    fn finalize_request(&self, pdu: Vec<u8>) -> Result<Vec<u8>, Box<dyn Error + Send + Sync>> {
        match self.mode.as_str() {
            "rtu" => {
                // 添加设备地址和 CRC
                let mut request = vec![self.unit_id];
                request.extend_from_slice(&pdu);

                // 计算 CRC
                let crc = Self::calculate_crc(&request);
                request.push(crc as u8);
                request.push((crc >> 8) as u8);

                Ok(request)
            }
            "tcp" => {
                // 构建 MBAP 头
                let length = (pdu.len() + 1) as u16; // +1 for unit_id
                let mut request = vec![
                    (self.transaction_id >> 8) as u8,
                    self.transaction_id as u8,
                    0x00,
                    0x00, // Protocol ID (always 0)
                    (length >> 8) as u8,
                    length as u8,
                    self.unit_id,
                ];
                request.extend_from_slice(&pdu);

                Ok(request)
            }
            _ => Err(format!("Unsupported Modbus mode: {}", self.mode).into()),
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

    /// 从 JSON 数据构建 Modbus 请求
    pub fn build_from_json(
        &self,
        json_data: &Value,
    ) -> Result<Vec<u8>, Box<dyn Error + Send + Sync>> {
        let function_code = json_data
            .get("function_code")
            .and_then(|v| v.as_u64())
            .ok_or("Missing function_code")?;

        match function_code {
            0x01 => {
                // 读取线圈
                let start_address = json_data
                    .get("address")
                    .and_then(|v| v.as_u64())
                    .ok_or("Missing address")? as u16;
                let quantity = json_data
                    .get("quantity")
                    .and_then(|v| v.as_u64())
                    .ok_or("Missing quantity")? as u16;

                self.build_read_coils(start_address, quantity)
            }
            0x02 => {
                // 读取离散输入
                let start_address = json_data
                    .get("address")
                    .and_then(|v| v.as_u64())
                    .ok_or("Missing address")? as u16;
                let quantity = json_data
                    .get("quantity")
                    .and_then(|v| v.as_u64())
                    .ok_or("Missing quantity")? as u16;

                self.build_read_discrete_inputs(start_address, quantity)
            }
            0x03 => {
                // 读取保持寄存器
                let start_address = json_data
                    .get("address")
                    .and_then(|v| v.as_u64())
                    .ok_or("Missing address")? as u16;
                let quantity = json_data
                    .get("quantity")
                    .and_then(|v| v.as_u64())
                    .ok_or("Missing quantity")? as u16;

                self.build_read_holding_registers(start_address, quantity)
            }
            0x04 => {
                // 读取输入寄存器
                let start_address = json_data
                    .get("address")
                    .and_then(|v| v.as_u64())
                    .ok_or("Missing address")? as u16;
                let quantity = json_data
                    .get("quantity")
                    .and_then(|v| v.as_u64())
                    .ok_or("Missing quantity")? as u16;

                self.build_read_input_registers(start_address, quantity)
            }
            0x05 => {
                // 写入单个线圈
                let address = json_data
                    .get("address")
                    .and_then(|v| v.as_u64())
                    .ok_or("Missing address")? as u16;
                let value = json_data
                    .get("value")
                    .and_then(|v| v.as_bool())
                    .ok_or("Missing value or not a boolean")?;

                self.build_write_single_coil(address, value)
            }
            0x06 => {
                // 写入单个寄存器
                let address = json_data
                    .get("address")
                    .and_then(|v| v.as_u64())
                    .ok_or("Missing address")? as u16;
                let value = json_data
                    .get("value")
                    .and_then(|v| v.as_u64())
                    .ok_or("Missing value")? as u16;

                self.build_write_single_register(address, value)
            }
            0x0F => {
                // 写入多个线圈
                let start_address = json_data
                    .get("address")
                    .and_then(|v| v.as_u64())
                    .ok_or("Missing address")? as u16;

                let values = json_data
                    .get("values")
                    .and_then(|v| v.as_array())
                    .ok_or("Missing values array")?;

                let bool_values: Result<Vec<bool>, _> = values
                    .iter()
                    .map(|v| v.as_bool().ok_or("Value is not a boolean"))
                    .collect();

                self.build_write_multiple_coils(start_address, &bool_values?)
            }
            0x10 => {
                // 写入多个寄存器
                let start_address = json_data
                    .get("address")
                    .and_then(|v| v.as_u64())
                    .ok_or("Missing address")? as u16;

                let values = json_data
                    .get("values")
                    .and_then(|v| v.as_array())
                    .ok_or("Missing values array")?;

                let u16_values: Result<Vec<u16>, _> = values
                    .iter()
                    .map(|v| v.as_u64().map(|n| n as u16).ok_or("Value is not a number"))
                    .collect();

                self.build_write_multiple_registers(start_address, &u16_values?)
            }
            _ => Err(format!("Unsupported function code: {}", function_code).into()),
        }
    }
}
