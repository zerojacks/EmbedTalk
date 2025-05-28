use crate::basefunc::frame_645::Frame645;
use crate::basefunc::protocol::FrameAnalisyic;
use crate::protocol::dlt645::builder::DLT645Builder;
use crate::taurihandler::channel_handler;
use serde_json::Value;
use tracing::{debug, error};

#[derive(serde::Serialize)]
pub struct Response {
    pub data: Vec<Value>,
    pub error: Option<String>,
}

/// 解析 DLT645 报文
#[tauri::command]
pub async fn parse_dlt645_frame(message: String) -> Response {
    debug!("Parsing DLT645 frame: {}", message);

    // 将十六进制字符串转换为字节数组
    let bytes = match hex_to_bytes(&message) {
        Ok(bytes) => bytes,
        Err(e) => {
            error!("Failed to convert hex to bytes: {}", e);
            return Response {
                data: Vec::new(),
                error: Some(format!("无效的十六进制字符串: {}", e)),
            };
        }
    };

    // 验证是否为有效的 DLT645 帧
    if !Frame645::is_dlt645_frame(&bytes) {
        return Response {
            data: Vec::new(),
            error: Some("无效的 DLT645 报文格式".to_string()),
        };
    }

    // 使用 FrameAnalisyic 解析帧
    let parsed_data = FrameAnalisyic::process_frame(&bytes, "default");

    Response {
        data: parsed_data,
        error: None,
    }
}

/// 构建 DLT645 报文
#[tauri::command]
pub async fn build_dlt645_frame(
    address: String,
    function_code: String,
    data_identifier: String,
    data: Option<String>,
) -> Result<String, String> {
    debug!(
        "Building DLT645 frame: address={}, function_code={}, data_identifier={}, data={:?}",
        address, function_code, data_identifier, data
    );

    let builder = DLT645Builder::new();
    let frame_result = match function_code.as_str() {
        "01" => {
            // 读数据
            builder.build_read_data_frame(&address, &data_identifier)
        }
        "04" => {
            // 写数据
            if let Some(data_str) = data {
                let data_bytes = match hex_to_bytes(&data_str) {
                    Ok(bytes) => bytes,
                    Err(e) => return Err(format!("无效的数据: {}", e)),
                };
                builder.build_write_data_frame(&address, &data_identifier, &data_bytes)
            } else {
                return Err("写数据命令需要提供数据".to_string());
            }
        }
        "08" => {
            // 广播校时 - 使用读地址帧作为示例
            builder.build_read_address_frame()
        }
        "10" => {
            // 冻结命令 - 使用读数据帧作为示例
            builder.build_read_data_frame(&address, &data_identifier)
        }
        _ => return Err("不支持的功能码".to_string()),
    };

    match frame_result {
        Ok(frame) => {
            // 将字节数组转换为十六进制字符串
            let hex_str = bytes_to_hex(&frame);
            Ok(hex_str)
        }
        Err(e) => Err(format!("构建报文失败: {}", e)),
    }
}

/// 发送 DLT645 报文并等待响应
#[tauri::command]
pub async fn send_dlt645_frame(channel_id: String, message: String) -> Result<Response, String> {
    debug!(
        "Sending DLT645 frame: {} to channel: {}",
        message, channel_id
    );

    // 将十六进制字符串转换为字节数组
    let bytes = match hex_to_bytes(&message) {
        Ok(bytes) => bytes,
        Err(e) => {
            error!("Failed to convert hex to bytes: {}", e);
            return Err(format!("无效的十六进制字符串: {}", e));
        }
    };

    // 发送消息
    match channel_handler::send_message(channel_id, bytes, None).await {
        Ok(_) => {
            // 发送成功，返回空响应
            // 注意：在实际应用中，这里应该等待并解析响应
            Ok(Response {
                data: Vec::new(),
                error: None,
            })
        }
        Err(e) => Err(format!("发送消息失败: {}", e)),
    }
}

/// 列出可用的通道
#[tauri::command]
pub async fn list_channels() -> Vec<String> {
    // 从实际的通道管理器中获取通道列表
    // 这里应该调用实际的通道管理器，但为了简化示例，返回一些示例通道
    vec![
        "COM1".to_string(),
        "COM2".to_string(),
        "TCP://192.168.1.100:502".to_string(),
    ]
}

// 辅助函数：将十六进制字符串转换为字节数组
fn hex_to_bytes(hex: &str) -> Result<Vec<u8>, String> {
    let hex = hex.replace(" ", "").replace("\n", "").replace("\r", "");

    if hex.len() % 2 != 0 {
        return Err("十六进制字符串长度必须为偶数".to_string());
    }

    let mut bytes = Vec::with_capacity(hex.len() / 2);
    for i in (0..hex.len()).step_by(2) {
        if let Ok(byte) = u8::from_str_radix(&hex[i..i + 2], 16) {
            bytes.push(byte);
        } else {
            return Err(format!("无效的十六进制字符: {}", &hex[i..i + 2]));
        }
    }

    Ok(bytes)
}

// 辅助函数：将字节数组转换为十六进制字符串
fn bytes_to_hex(bytes: &[u8]) -> String {
    let mut hex = String::with_capacity(bytes.len() * 3);
    for byte in bytes {
        hex.push_str(&format!("{:02X} ", byte));
    }
    hex.trim_end().to_string()
}
