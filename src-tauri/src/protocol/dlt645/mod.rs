pub mod parser;
pub mod builder;

// 导出主要类型，方便使用
pub use parser::DLT645Parser;
pub use builder::DLT645Builder;

// DLT645 协议常量
pub const FRAME_START: u8 = 0x68;
pub const FRAME_END: u8 = 0x16;

// DLT645 功能码
#[derive(Debug)]
pub enum FunctionCode {
    ReadData = 0x11,
    ReadDataResponse = 0x91,
    ReadDataResponseError = 0xD1,
    WriteData = 0x14,
    WriteDataResponse = 0x94,
    ReadAddress = 0x13,
    ReadAddressResponse = 0x93,
    WriteAddress = 0x15,
    WriteAddressResponse = 0x95,
    BroadcastTime = 0x08,
    WriteFrozenTime = 0x16,
    WriteFrozenTimeResponse = 0x96,
    WriteBaudRate = 0x17,
    WriteBaudRateResponse = 0x97,
    WritePassword = 0x18,
    WritePasswordResponse = 0x98,
    MaximumDemandReset = 0x19,
    MaximumDemandResetResponse = 0x99,
    MeterReset = 0x1A,
    MeterResetResponse = 0x9A,
    EventReset = 0x1B,
    EventResetResponse = 0x9B,
}

// 将 u8 转换为 FunctionCode
pub fn u8_to_function_code(value: u8) -> Option<FunctionCode> {
    match value {
        0x11 => Some(FunctionCode::ReadData),
        0x91 => Some(FunctionCode::ReadDataResponse),
        0xD1 => Some(FunctionCode::ReadDataResponseError),
        0x14 => Some(FunctionCode::WriteData),
        0x94 => Some(FunctionCode::WriteDataResponse),
        0x13 => Some(FunctionCode::ReadAddress),
        0x93 => Some(FunctionCode::ReadAddressResponse),
        0x15 => Some(FunctionCode::WriteAddress),
        0x95 => Some(FunctionCode::WriteAddressResponse),
        0x08 => Some(FunctionCode::BroadcastTime),
        0x16 => Some(FunctionCode::WriteFrozenTime),
        0x96 => Some(FunctionCode::WriteFrozenTimeResponse),
        0x17 => Some(FunctionCode::WriteBaudRate),
        0x97 => Some(FunctionCode::WriteBaudRateResponse),
        0x18 => Some(FunctionCode::WritePassword),
        0x98 => Some(FunctionCode::WritePasswordResponse),
        0x19 => Some(FunctionCode::MaximumDemandReset),
        0x99 => Some(FunctionCode::MaximumDemandResetResponse),
        0x1A => Some(FunctionCode::MeterReset),
        0x9A => Some(FunctionCode::MeterResetResponse),
        0x1B => Some(FunctionCode::EventReset),
        0x9B => Some(FunctionCode::EventResetResponse),
        _ => None,
    }
}
