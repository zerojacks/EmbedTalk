use crate::basefunc::frame_fun::FrameFun;
use crate::basefunc::protocol::{FrameAnalisyic, ProtocolInfo};
use crate::config::appconfig::GLOBAL_CONFIG_MANAGER;
use crate::config::xmlconfig::{
    ItemConfigList, ProtocolConfigManager, XmlElement, GLOBAL_645, GLOBAL_CSG13, GLOBAL_CSG16,
};
use serde_json::Value;
use std::thread;
use std::time::Instant;
use tracing::{error, info};

#[tauri::command]
pub async fn get_region_value() -> String {
    GLOBAL_CONFIG_MANAGER.global_region.get_value()
}

#[tauri::command]
pub async fn set_region_value(region: String) {
    GLOBAL_CONFIG_MANAGER.global_region.set_value(&region);
}

#[tauri::command]
pub fn app_close() {
    println!("app_close");
    std::process::exit(0);
}

#[derive(serde::Serialize)]
pub struct Response {
    pub data: Vec<Value>,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn on_text_change(message: String, region: String) -> Response {
    use std::panic;
    if message.is_empty() {
        return Response {
            data: Vec::new(),
            error: Some("Invalid hex message".to_string()),
        };
    }

    let start_time = Instant::now();
    info!("Received message: {} {}", message, region);

    let result = panic::catch_unwind(|| {
        let message_cleaned = message.replace(' ', "").replace('\n', "");
        if !message_cleaned.chars().all(|c| c.is_digit(16)) || message_cleaned.len() % 2 != 0 {
            info!("Invalid hex message: {}", message);
            return Response {
                data: Vec::new(),
                error: Some("Invalid hex message".to_string()),
            };
        }

        let frame = FrameFun::get_frame_list_from_str(&message_cleaned);
        info!(
            "Frame: {:?} duration: {:?}",
            frame,
            start_time.elapsed().as_millis()
        );
        let processed_result = FrameAnalisyic::process_frame(&frame, &region);
        info!("Result: {:?}", processed_result);

        Response {
            data: processed_result,
            error: None,
        }
    });

    match result {
        Ok(response) => {
            let duration = start_time.elapsed();
            info!("on_text_change duration: {:?}", duration.as_millis());
            response // 返回正常结果
        }
        Err(e) => {
            error!("on_text_change panic: {:?}", e);
            Response {
                data: Vec::new(),
                error: Some("An error occurred".to_string()),
            }
        }
    }
}

#[tauri::command]
pub async fn save_file(file_path: String, buffer: Vec<u8>) -> Result<(), String> {
    let file_path = file_path.clone();
    let buffer = buffer.clone();
    println!("save_file: {:?} len: {:?}", file_path, buffer.len());
    // 创建新的线程
    thread::spawn(move || {
        std::fs::write(file_path, buffer)
            .map_err(|e| e.to_string())
            .unwrap();
    });

    Ok(())
}

#[tauri::command]
pub async fn get_app_info() -> Value {
    let app_info = serde_json::json!({
        "name": env!("CARGO_PKG_NAME").to_string(),
        "version": env!("CARGO_PKG_VERSION").to_string()
    });
    app_info
}

#[tauri::command]
pub async fn check_update() -> Result<Value, String> {
    println!("check_update");
    // TODO: 添加检查更新的代码
    // 模拟检查更新耗时
    thread::sleep(std::time::Duration::from_secs(5)); // 检查更新成功
    let app_info = serde_json::json!({
        "name": env!("CARGO_PKG_NAME").to_string(),
        "version": "1.0.1".to_string()
    });
    Ok(app_info)
}

#[tauri::command]
pub async fn get_com_list() -> Vec<String> {
    let mut com_list = Vec::new();
    for i in 0..10 {
        com_list.push(format!("COM{}", i));
    }
    com_list
}

#[tauri::command]
pub async fn get_all_config_item_lists() -> Result<Vec<ItemConfigList>, String> {
    // 获取配置项并提取数据
    let csg13 = GLOBAL_CSG13
        .as_ref()
        .map_err(|e| format!("Failed to get GLOBAL_CSG13: {}", e))?;
    let csg645 = GLOBAL_645
        .as_ref()
        .map_err(|e| format!("Failed to get GLOBAL_645: {}", e))?;
    let csg16 = GLOBAL_CSG16
        .as_ref()
        .map_err(|e| format!("Failed to get GLOBAL_CSG16: {}", e))?;

    // 在异步之前提取数据
    let (csg13_items, csg645_items, csg16_items) = tokio::join!(
        csg13.get_all_item(),
        csg645.get_all_item(),
        csg16.get_all_item()
    );

    // 收集结果
    let mut all_items = csg13_items;
    all_items.extend(csg645_items);
    all_items.extend(csg16_items);

    if all_items.is_empty() {
        Err(format!("Failed to get any items."))
    } else {
        Ok(all_items)
    }
}

#[derive(serde::Serialize, Debug, Clone, serde::Deserialize)]
struct ProtoConfigParams {
    item: String,
    name: Option<String>,
    protocol: Option<String>,
    region: Option<String>,
    dir: Option<String>,
    xmlElement: Option<XmlElement>,
}

#[tauri::command]
pub async fn get_protocol_config_item(value: &str) -> Result<XmlElement, String> {
    // 将传入的 JSON 字符串解析为 ProtoConfigParams
    let value_json: ProtoConfigParams =
        serde_json::from_str(value).map_err(|e| format!("Failed to parse value: {}", e))?;

    // 提取参数
    let item_id = value_json.item;
    let protocol = if let Some(protocol) = value_json.protocol {
        protocol
    } else {
        ProtocolInfo::ProtocolCSG13.name().to_string()
    };

    let region = if let Some(region) = value_json.region {
        region
            .split(',')
            .next()
            .unwrap_or(&GLOBAL_CONFIG_MANAGER.global_region.get_value())
            .to_string()
    } else {
        GLOBAL_CONFIG_MANAGER.global_region.get_value().to_string()
    };
    println!(
        "item: {:?} protocol: {:?} region: {:?}",
        item_id, protocol, region
    );
    let dir = if let Some(dir) = value_json.dir {
        // 转换为 u8
        Some(
            dir.parse::<u8>()
                .map_err(|e| format!("Failed to parse dir: {}", e))?,
        )
    } else {
        None
    };

    // 调用 ProtocolConfigManager 的方法
    let element = ProtocolConfigManager::get_config_xml(&item_id, &protocol, &region, dir);
    match element {
        Some(element) => Ok(element),
        _ => Err(format!("Failed to get protocol config item")),
    }
}

#[tauri::command]
pub async fn save_protocol_config_item(value: &str) -> Result<(), String> {
    let value_json: ProtoConfigParams =
        serde_json::from_str(value).map_err(|e| format!("Failed to parse value: {}", e))?;
    println!("save_protocol_config_item: {:?}", value_json.protocol);
    if (value_json.protocol.is_some() && value_json.xmlElement.is_some()) {
        let protocol = value_json.protocol.clone().unwrap();
        let element = value_json.xmlElement.clone().unwrap();
        println!("save_protocol_config_item: {:?}", protocol);
        ProtocolConfigManager::update_element(&value_json.item, &protocol, element)?
    }
    Err(format!("Failed to save protocol config item"))
}

#[cfg(target_os = "windows")]
use windows::UI::ViewManagement::{UIColorType, UISettings};

#[cfg(target_os = "macos")]
use std::process::Command;

#[tauri::command]
pub async fn get_system_theme() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let ui_settings = UISettings::new().map_err(|e| e.to_string())?;
        let is_light_theme = unsafe {
            ui_settings
                .GetColorValue(UIColorType::Background)
                .map_err(|e| e.to_string())?
        };
        Ok(if is_light_theme.R == 0 {
            "dark".to_string()
        } else {
            "light".to_string()
        })
    }

    #[cfg(target_os = "macos")]
    {
        let output = Command::new("defaults")
            .args(&["read", "-g", "AppleInterfaceStyle"])
            .output()
            .expect("Failed to execute command");

        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        let theme = if stdout.is_empty() {
            "light".to_string()
        } else {
            "dark".to_string()
        };
        Ok(theme)
    }

    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        let output = Command::new("gsettings")
            .args(["get", "org.gnome.desktop.interface", "gtk-theme"])
            .output()
            .map_err(|e| e.to_string())?;
        let theme = String::from_utf8(output.stdout).map_err(|e| e.to_string())?;
        Ok(if theme.to_lowercase().contains("dark") {
            "dark".to_string()
        } else {
            "light".to_string()
        })
    }
}
