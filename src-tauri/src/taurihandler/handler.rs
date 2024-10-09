use rumqttc::tokio_rustls::rustls::internal::msgs::message::Message;
use serde_json::{Number, Value};
use std::time::Instant;
use crate::config::appconfig::{GLOBAL_CONFIG_MANAGER,get_config_value_async, set_config_value_async};
use crate::basefunc::protocol::FrameAnalisyic;
use crate::basefunc::frame_fun::FrameFun;
use crate::config::xmlconfig::{GLOBAL_CSG13, GLOBAL_645, GLOBAL_CSG16, XmlElement};
use tracing::{debug, error, info, warn};
use std::thread;
use crate::config::oadmapconfig::TaskOadConfigManager;

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
        info!("Frame: {:?} duration: {:?}", frame, start_time.elapsed().as_millis());
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
        std::fs::write(file_path, buffer).map_err(|e| e.to_string()).unwrap();
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


#[derive(Clone, Debug)]
struct ItemConfigList {
    id: Number,
    item: String,
    protocol: String,
    region: String,
};

pub async fn traverse_element(element: &XmlElement, result: &mut Vec<ItemConfigList>) {
    // 检查当前元素是否有 id 属性
    if let Some(id_str) = element.get_attribute("id") {
        // 如果有 id 属性，将其解析并添加到结果中
        if let Ok(id) = id_str.parse::<usize>() {
            let item = DataItem {
                id,
                name: element.name.clone(),
            };
            result.push(item);
        }
        // 只有当前元素有 id，才继续遍历其子元素
        let childrean = element.get_children();
        for child in  childrean {
            traverse_element(child, result);
        }
    }
}

#[tauri::command]
pub async fn get_all_config_item_lists() -> Vec<ItemConfigList> {
    let mut result = Vec::new();
    let config = GLOBAL_CSG13.as_ref().ok()?.get_config();

    result
}