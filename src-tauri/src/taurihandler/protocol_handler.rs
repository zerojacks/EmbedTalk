use crate::combridage::{CommunicationChannel, Message};
use crate::protocol::{get_channel_protocol_handler, get_protocol_manager, ChannelProtocolConfig};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::error::Error;
use std::sync::Arc;
use tauri::{command, State};
use crate::taurihandler::ChannelHandler;
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProtocolInfo {
    /// 协议名称
    pub name: String,
    /// 协议配置模板
    pub config_template: Value,
}

/// 获取所有支持的协议
#[command]
pub async fn get_supported_protocols() -> Result<Vec<ProtocolInfo>, String> {
    let protocol_manager = get_protocol_manager();
    let channel_handler = get_channel_protocol_handler();
    
    let protocol_names = protocol_manager.get_protocol_names().await;
    
    let mut protocols = Vec::new();
    for name in protocol_names {
        match channel_handler.get_protocol_config_template(&name).await {
            Ok(config) => {
                protocols.push(ProtocolInfo {
                    name,
                    config_template: config,
                });
            }
            Err(e) => return Err(format!("Failed to get config template for {}: {}", name, e)),
        }
    }
    
    Ok(protocols)
}

/// 配置通道使用的协议
#[command]
pub async fn configure_channel_protocol(
    channel_id: String,
    protocol_type: String,
    protocol_config: Value,
    auto_parse: bool,
) -> Result<(), String> {
    let channel_handler = get_channel_protocol_handler();
    
    channel_handler
        .configure_channel(&channel_id, &protocol_type, protocol_config, auto_parse)
        .await
        .map_err(|e| format!("Failed to configure channel: {}", e))
}

/// 获取通道协议配置
#[command]
pub async fn get_channel_protocol_config(channel_id: String) -> Result<Option<ChannelProtocolConfig>, String> {
    let channel_handler = get_channel_protocol_handler();
    
    Ok(channel_handler.get_channel_config(&channel_id).await)
}

/// 使用协议解析数据
#[command]
pub async fn parse_protocol_data(
    channel_id: String,
    data: Vec<u8>,
) -> Result<Value, String> {
    let channel_handler = get_channel_protocol_handler();
    
    match channel_handler.parse_data(&channel_id, &data).await {
        Ok(Some(message)) => Ok(json!({
            "protocol": message.protocol_type,
            "parsed_data": message.parsed_data,
            "is_valid": message.is_valid,
            "validation_message": message.validation_message
        })),
        Ok(None) => Err("No protocol configured for this channel or data does not match protocol".to_string()),
        Err(e) => Err(format!("Failed to parse data: {}", e)),
    }
}

/// 使用协议构建消息
#[command]
pub async fn build_protocol_message(
    channel_id: String,
    message_data: Value,
) -> Result<Vec<u8>, String> {
    let channel_handler = get_channel_protocol_handler();
    
    channel_handler
        .build_message(&channel_id, &message_data)
        .await
        .map_err(|e| format!("Failed to build message: {}", e))
}

/// 使用协议发送消息到指定通道
#[command]
pub async fn send_protocol_message(
    channel_id: String,
    message_data: Value,
    protocol_type: Option<String>,
) -> Result<(), String> {
    // 如果指定了协议类型，先配置通道
    if let Some(protocol) = protocol_type {
        let channel_handler = get_channel_protocol_handler();
        
        if let Err(e) = channel_handler
            .configure_channel(&channel_id, &protocol, json!({}), true)
            .await
        {
            return Err(format!("Failed to configure channel: {}", e));
        }
    }
    
    // 构建消息
    let channel_handler = get_channel_protocol_handler();
    let data = channel_handler
        .build_message(&channel_id, &message_data)
        .await
        .map_err(|e| format!("Failed to build message: {}", e))?;
    
    // 获取通道并发送消息
    // 注意：这里需要根据您的通道管理系统进行适配
    // 这里假设有一个函数可以获取通道实例
    // let channel = get_channel(&channel_id).await?;
    // channel.send(&Message::new(json!({"data": data}))).await
    //     .map_err(|e| format!("Failed to send message: {}", e))
    
    // 由于无法直接获取通道实例，返回构建好的数据
    Ok(())
}

/// 统一处理协议消息（解析、构建、发送）
#[command]
pub async fn handle_protocol_message(
    action: String,
    protocol: String,
    channelid: Option<String>,
    message: String,
    params: Option<Value>,
) -> Result<Value, String> {
    // 根据协议类型获取对应的处理器
    let channel_handler = get_channel_protocol_handler();
    let protocol_manager = get_protocol_manager();
    
    // 检查协议类型是否支持
    if !protocol_manager.is_protocol_supported(&protocol).await {
        return Err(format!("不支持的协议类型: {}", protocol));
    }
    println!("Protocol: {}, Action: {}, Channel ID: {:?}, Message: {:?}, Params: {:?}", protocol, action, channelid, message, params);
    // 根据动作类型分发到不同的处理函数
    match action.as_str() {
        "parse" => {
            // 解析报文
            let bytes = match hex_to_bytes(&message) {
                Ok(bytes) => bytes,
                Err(e) => return Err(format!("无效的十六进制字符串: {}", e)),
            };
            
            // 使用协议解析器解析数据
            let parser = protocol_manager.get_parser(&protocol).await
                .ok_or_else(|| format!("找不到协议解析器: {}", protocol))?;
            
            let result = parser.parse(&bytes).await
                .map_err(|e| format!("解析失败: {}", e))?;
            
            Ok(json!({
                "protocol": protocol,
                "parsed_data": result.parsed_data,
                "is_valid": result.is_valid,
                "validation_message": result.validation_message
            }))
        },
        "build" => {
            // 构建报文
            let params = params.unwrap_or(json!({}));
            
            // 使用协议构建器构建数据
            let bytes = protocol_manager.build_with_protocol(&protocol, &params).await
                .map_err(|e| format!("构建失败: {}", e))?;
            
            // 将字节数组转换为十六进制字符串
            Ok(json!({
                "hex": bytes_to_hex(&bytes),
                "bytes": bytes,
            }))
        },
        "send" => {
            // 发送报文
            let channel_id = channelid.ok_or("发送报文需要指定通道ID")?;
            let bytes = match hex_to_bytes(&message) {
                Ok(bytes) => bytes,
                Err(e) => return Err(format!("无效的十六进制字符串: {}", e)),
            };
            
            // 检查通道是否配置了协议
            let config = channel_handler.get_channel_config(&channel_id).await;
            
            if config.is_none() {
                // 如果通道未配置协议，则临时配置
                channel_handler.configure_channel(
                    &channel_id,
                    &protocol,
                    params.unwrap_or(json!({})),
                    false,
                ).await.map_err(|e| format!("配置通道协议失败: {}", e))?;
            } else if let Some(cfg) = &config {
                // 如果通道已配置协议，但类型不匹配，则返回错误
                if cfg.protocol_type != protocol {
                    return Err(format!(
                        "通道已配置了不同的协议: {}, 请先移除现有配置或使用匹配的协议类型",
                        cfg.protocol_type
                    ));
                }
            }
            
            ChannelHandler::send_message(channel_id, bytes).await
                .map_err(|e| format!("发送失败: {}", e))?;
            
            Ok(json!({ "success": true }))
        },
        _ => Err(format!("不支持的操作: {}", action)),
    }
}

/// 辅助函数：将十六进制字符串转换为字节数组
fn hex_to_bytes(hex: &str) -> Result<Vec<u8>, String> {
    // 移除所有空格
    let hex = hex.replace(" ", "");
    
    // 验证十六进制格式
    if !hex.chars().all(|c| c.is_digit(16)) {
        return Err("无效的十六进制字符".to_string());
    }
    
    // 确保长度是偶数
    if hex.len() % 2 != 0 {
        return Err("十六进制字符串长度必须是偶数".to_string());
    }
    
    // 转换为字节数组
    let mut bytes = Vec::with_capacity(hex.len() / 2);
    for i in (0..hex.len()).step_by(2) {
        let byte = u8::from_str_radix(&hex[i..i+2], 16)
            .map_err(|e| format!("无效的十六进制字符: {}", e))?;
        bytes.push(byte);
    }
    
    Ok(bytes)
}

/// 辅助函数：将字节数组转换为十六进制字符串
fn bytes_to_hex(bytes: &[u8]) -> String {
    bytes.iter()
        .map(|b| format!("{:02X}", b))
        .collect::<Vec<String>>()
        .join(" ")
}

/// 注册协议相关的 Tauri 命令
pub fn register_protocol_commands(app: &mut tauri::App) -> Result<(), Box<dyn Error + Send + Sync>> {
    // Tauri 2.0 不再使用 register_command 方法
    // 在 main.rs 的 invoke_handler 中注册这些命令
    // 这个函数保留为空，以便将来可能需要的其他设置
    
    Ok(())
}
