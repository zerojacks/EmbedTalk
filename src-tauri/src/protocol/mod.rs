pub mod channel_adapter;
pub mod channel_handler;
pub mod dlt645;
pub mod manager;
pub mod modbus;
pub mod traits;

// 导出主要类型，方便使用
pub use channel_adapter::ProtocolChannelAdapter;
pub use channel_handler::{
    get_channel_protocol_handler, ChannelProtocolConfig, ChannelProtocolHandler,
};
pub use manager::ProtocolManager;
pub use traits::{ProtocolMessage, ProtocolParser};

// 创建全局协议管理器实例
use std::sync::OnceLock;

static PROTOCOL_MANAGER: OnceLock<ProtocolManager> = OnceLock::new();

/// 获取全局协议管理器实例
pub fn get_protocol_manager() -> &'static ProtocolManager {
    PROTOCOL_MANAGER.get_or_init(|| ProtocolManager::new())
}

/// 初始化协议栈，注册所有支持的协议解析器
pub async fn initialize_protocol_stack() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let protocol_manager = get_protocol_manager();
    let channel_handler = get_channel_protocol_handler();

    // 注册 Modbus 协议解析器
    let modbus_parser = modbus::parser::create_shared_instance();
    protocol_manager
        .register_parser(modbus_parser.clone())
        .await?;
    channel_handler.register_parser(modbus_parser).await?;

    // 注册 DLT645 协议解析器
    let dlt645_parser = dlt645::parser::create_shared_instance();
    protocol_manager
        .register_parser(dlt645_parser.clone())
        .await?;
    channel_handler.register_parser(dlt645_parser).await?;

    println!("Protocol stack initialized with Modbus and DLT645 parsers");
    Ok(())
}
