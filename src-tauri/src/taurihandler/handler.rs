use crate::basefunc::frame_fun::FrameFun;
use crate::basefunc::protocol::{FrameAnalisyic, ProtocolInfo};
use crate::config::appconfig::GLOBAL_CONFIG_MANAGER;
use crate::config::xmlconfig::{
    ItemConfigList, ProtocolConfigManager, XmlElement, GLOBAL_645, GLOBAL_CSG13, GLOBAL_CSG16,
};
use serde_json::Value;
use std::sync::{Arc, Mutex, atomic::{AtomicBool, Ordering}};
use std::thread;
use std::time::Instant;
use tracing::{error, info};
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder, Window, Monitor, LogicalPosition, PhysicalPosition, State};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Default, Clone)]
pub struct WindowPosition {
    pub x: f64,
    pub y: f64,
    pub monitor_id: Option<String>,
}

pub struct WindowState(pub Mutex<WindowPosition>);

impl Default for WindowState {
    fn default() -> Self {
        WindowState(Mutex::new(WindowPosition { 
            x: 100.0, 
            y: 100.0,
            monitor_id: None
        }))
    }
}

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

    Ok(all_items)
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
    println!("get_protocol_config_item: {:?}", element);
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
    if value_json.protocol.is_some() && value_json.xmlElement.is_some() {
        let protocol = value_json.protocol.clone().unwrap();
        let element = value_json.xmlElement.clone().unwrap();
        println!("save_protocol_config_item: {:?}", protocol);
        ProtocolConfigManager::update_element(&value_json.item, &protocol, &element)
            .map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Protocol or xmlElement is missing".to_string())
    }
}

#[tauri::command]
pub async fn update_window_position(x: f64, y: f64, monitor_id: Option<String>, state: State<'_, WindowState>) -> Result<(), String> {
    let mut position = state.0.lock().map_err(|e| e.to_string())?;
    position.x = x;
    position.y = y;
    position.monitor_id = monitor_id;
    Ok(())
}

#[tauri::command]
pub fn get_window_position(state: State<'_, WindowState>) -> Result<WindowPosition, String> {
    let position = state.0.lock().map_err(|e| e.to_string())?;
    Ok(position.clone())
}

#[tauri::command]
pub async fn open_window(app_handle: tauri::AppHandle, state: State<'_, WindowState>) -> Result<(), String> {
    // 如果窗口不存在，创建新窗口
    let monitor = match app_handle.primary_monitor().map_err(|e| e.to_string())? {
        Some(m) => m,
        None => {
            // 获取所有显示器，如果出错则返回错误
            let monitors = app_handle.available_monitors()
                .map_err(|e| e.to_string())?;
            // 如果有显示器，使用第一个；否则返回错误
            monitors.get(0)
                .ok_or_else(|| "No monitors available".to_string())?
                .clone()
        }
    };
    
    // 获取显示器信息
    let size = monitor.size();
    let scale_factor = monitor.scale_factor();
    let monitor_id = monitor.name();

    // 计算窗口位置
    let mut x = ((size.width as f64 * 0.3)) / scale_factor;
    let mut y = ((size.height as f64 * 0.2) - (52.0 / 2.0)) / scale_factor;

    // 检查是否有保存的位置
    if let Ok(position) = state.0.lock() {
        if let Some(saved_id) = &position.monitor_id {
            if let Some(current_id) = &monitor_id {
                if saved_id.as_str() == current_id.as_str() {
                    x = position.x;
                    y = position.y;
                }
            }
        }
    }

    // 保存新的位置
    if let Ok(mut position) = state.0.lock() {
        position.x = x;
        position.y = y;
        position.monitor_id = monitor_id.map(|s| s.to_string());
    }

        // 检查窗口是否已存在
        if let Some(window) = app_handle.get_webview_window("quickparse") {
            // 如果窗口存在，切换显示状态
            let is_visible = window.is_visible().map_err(|e| e.to_string())?;
            if is_visible {
                window.hide().map_err(|e| e.to_string())?;
            } else {
                window.show().map_err(|e| e.to_string())?;
                window.set_focus().map_err(|e| e.to_string())?;
                // 重置窗口大小为初始状态
                let _ = window.set_position(LogicalPosition::new(x, y));
                let _ = window.set_resizable(false);
                let _ = window.set_size(tauri::LogicalSize::new(500.0, 52.0));
            }
            return Ok(());
        }
    
    let url = "http://localhost:1420/quick-parse".parse().unwrap();
    let window = WebviewWindowBuilder::new(&app_handle, "quickparse", WebviewUrl::External(url))
        .title("快速解析")
        .decorations(false)
        .transparent(true)
        .inner_size(500.0, 52.0)
        .min_inner_size(500.0, 52.0)
        .position(x, y)
        .skip_taskbar(true)
        .always_on_top(true)
        .focused(true)
        .resizable(false)
        .drag_and_drop(true)
        .build()
        .map_err(|e| e.to_string())?;

    // 监听窗口事件
    let window_clone = window.clone();
    let is_moving = Arc::new(AtomicBool::new(false));
    let is_moving_clone = is_moving.clone();
    
    window.on_window_event(move |event| {
        match event {
            tauri::WindowEvent::Focused(false) => {
                // 只有在不是移动状态时才处理失焦
                let window = window_clone.clone();
                let is_moving = is_moving_clone.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_millis(500));
                    if !is_moving.load(Ordering::Relaxed) {
                        let _ = window.hide();
                    }
                });
            }
            tauri::WindowEvent::Moved(_) | tauri::WindowEvent::Resized(_) => {
                // 设置移动状态为true
                is_moving_clone.store(true, Ordering::Relaxed);
                
                // 创建一个延时，在移动结束后重置状态
                let is_moving = is_moving_clone.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_millis(500));
                    is_moving.store(false, Ordering::Relaxed);
                });
            }
            _ => {}
        }
    });

    Ok(())
}