use crate::basefunc::frame_fun::FrameFun;
use crate::basefunc::protocol::{FrameAnalisyic, ProtocolInfo};
use crate::basefunc::frame_csg::FrameCsg;
use crate::config::appconfig::GLOBAL_CONFIG_MANAGER;
use crate::config::xmlconfig::{
    ItemConfigList, ProtocolConfigManager, XmlElement, GLOBAL_645, GLOBAL_CSG13, GLOBAL_CSG16,
};
use serde_json::Value;
use std::sync::{Arc, Mutex, atomic::{AtomicBool, Ordering}};
use std::thread;
use std::time::Instant;
use tracing::{error, info};
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder, LogicalPosition, State};
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
    xmlelement: Option<XmlElement>,
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
    if value_json.protocol.is_some() && value_json.xmlelement.is_some() {
        let protocol = value_json.protocol.clone().unwrap();
        let element = value_json.xmlelement.clone().unwrap();
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

#[tauri::command]
pub fn caculate_pppfcs16(frame: String) -> Result<u16, String> {
    // 清理输入字符串，移除空格和换行符
    let cleaned_frame = frame.replace(' ', "").replace('\n', "");
    
    // 验证输入是否为有效的16进制字符串
    if !cleaned_frame.chars().all(|c| c.is_digit(16)) || cleaned_frame.len() % 2 != 0 {
        return Err("Invalid hex string".to_string());
    }
    
    // 将16进制字符串转换为字节数组
    let frame_bytes = FrameFun::get_frame_list_from_str(&cleaned_frame);
    
    // 使用0xFFFF作为初始FCS值计算校验和
    let fcs = FrameFun::ppp_fcs16(0xFFFF, &frame_bytes);
    
    Ok(fcs)
}

#[tauri::command]
pub fn da_and_measure_point_exchange(input: String, convert_type: String, continuous: bool) -> Result<String, String> {
    // 清理输入字符串，移除空格和换行符
    let cleaned_input = input.trim().to_string();
    
    match convert_type.as_str() {
        "point_to_da" => {
            let result = try_convert_point_to_da(&cleaned_input, continuous)?;
            Ok(result)
        },
        "da_to_point" => {
            let result = try_convert_da_to_point(&cleaned_input)?;
            Ok(result)
        },
        _ => Err("Invalid convert type. Expected: point_to_da or da_to_point".to_string()),
    }
}

fn try_convert_point_to_da(input: &str, continuous: bool) -> Result<String, String> {
    // 处理逗号分隔的多个范围
    let ranges: Vec<&str> = input.split(',').collect();
    let mut all_points = Vec::new();
    
    for range in ranges {
        if range.is_empty() {
            continue;
        }

        if range.contains('-') {
            // 处理范围格式 (如: 1-20)
            let parts: Vec<&str> = range.split('-').collect();
            if parts.len() != 2 {
                return Err(format!("无效的范围格式: {}", range));
            }
            
            let start = parts[0].parse::<u16>()
                .map_err(|_| format!("无效的起始数字: {}", parts[0]))?;
            let end = parts[1].parse::<u16>()
                .map_err(|_| format!("无效的结束数字: {}", parts[1]))?;
            
            if start > end {
                return Err(format!("起始数字必须小于或等于结束数字: {}", range));
            }
            
            all_points.extend(start..=end);
        } else {
            // 处理单个数字
            let point = range.parse::<u16>()
                .map_err(|_| format!("无效的数字: {}", range))?;
            all_points.push(point);
        }
    }
    
    if all_points.is_empty() {
        return Err("请输入有效的测量点".to_string());
    }
    
    // 对点进行排序和去重
    all_points.sort();
    all_points.dedup();
    
    // 根据continuous参数选择转换方式
    let da_pairs = if continuous {
        FrameCsg::to_da_with_continuous(&all_points)
    } else {
        FrameCsg::to_da_with_single(&all_points)
    };
    
    // 格式化输出
    let result = da_pairs.iter()
        .map(|&(da1, da2)| format!("{:02X}{:02X}", da1, da2))
        .collect::<Vec<String>>()
        .join(",");
    
    Ok(result)
}

fn try_convert_da_to_point(input: &str) -> Result<String, String> {
    // 处理逗号分隔的多个DA值
    let da_values: Vec<&str> = input.split(',').collect();
    let mut all_results = Vec::new();
    
    if da_values.is_empty() || (da_values.len() == 1 && da_values[0].trim().is_empty()) {
        return Err("请输入有效的DA值".to_string());
    }
    
    for da_value in da_values {
        let da_value = da_value.trim();
        if da_value.is_empty() {
            continue;
        }

        // 移除可能的0x前缀
        let da_value = da_value.trim_start_matches("0x");
        
        // 验证16进制格式
        if !da_value.chars().all(|c| c.is_ascii_hexdigit()) {
            return Err(format!("无效的16进制DA值: {}", da_value));
        }
        
        // 将16进制字符串转换为字节数组
        let da = FrameFun::get_frame_list_from_str(da_value);
        let (size, points) = FrameFun::calculate_measurement_points(&da);
        
        if size == 1 && points[0] == 0xFFFF {
            all_results.push("0xFFFF".to_string());
        } else {
            let points_str = points.iter()
                .map(|&x| x.to_string())
                .collect::<Vec<String>>()
                .join(",");
            all_results.push(points_str);
        }
    }
    
    if all_results.is_empty() {
        return Err("转换结果为空".to_string());
    }
    
    Ok(all_results.join(","))
}

#[tauri::command]
pub fn parse_item_data(item: String, input: String, protocol: String, region: String) -> Result<Vec<Value>, String> {
    // 检查输入参数
    if item.is_empty() {
        return Err("数据标识不能为空".to_string());
    }
    if input.is_empty() {
        return Err("数据内容不能为空".to_string());
    }
    if protocol.is_empty() {
        return Err("协议类型不能为空".to_string());
    }
    if region.is_empty() {
        return Err("区域不能为空".to_string());
    }

    // 清理输入数据
    let item = item.trim().to_uppercase();
    let input = input.trim();
    let protocol = protocol.trim();
    let region = region.trim();

    // 验证数据标识格式
    if !item.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err("数据标识必须是有效的16进制字符串".to_string());
    }

    // 验证数据内容格式
    if !input.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err("数据内容必须是有效的16进制字符串".to_string());
    }

    let dir = Some(1);
    let mut sub_result = Vec::new();

    // 将数据标识和数据内容转换为字节数组
    let itemdata = FrameFun::get_frame_list_from_str(&item);
    let data_segment = FrameFun::get_frame_list_from_str(&input);

    // 获取数据项配置
    let mut data_item_elem = match ProtocolConfigManager::get_config_xml(&item, &protocol, &region, dir) {
        Some(elem) => elem,
        None => return Err(format!("未找到数据标识[{}]的配置信息", item)),
    };

    // 处理数据项配置
    let sub_length = match data_item_elem.get_child_text("length") {
        Some(length_str) => match length_str.parse::<usize>() {
            Ok(length) => length,
            Err(_) => data_segment.len(),
        },
        None => data_segment.len(),
    };

    // 检查数据长度
    if sub_length > data_segment.len() {
        return Err(format!("数据长度({})超过实际数据长度({})", sub_length, data_segment.len()));
    }

    let sub_datament = &data_segment[..sub_length];

    // 更新数据项配置
    data_item_elem.update_value("length", sub_length.to_string());

    // 解析数据
    let item_data = FrameAnalisyic::prase_data(
        &mut data_item_elem,
        &protocol,
        &region,
        &data_segment,
        0,
        dir,
    );

    // 获取数据项名称
    let name = data_item_elem.get_child_text("name").unwrap_or_default();
    let dis_data_identifier = format!("数据标识编码：[{}]-{}", item, name);

    // 构建结果字符串
    let result_str = format!("数据标识[{}]数据内容：", item);
    let description = format!(
        "{}{}",
        result_str,
        FrameFun::get_data_str(&data_segment, false, true, false)
    );

    // 添加数据标识信息
    FrameFun::add_data(
        &mut sub_result,
        "数据标识编码DI".to_string(),
        FrameFun::get_data_str_reverser_with_space(&itemdata),
        dis_data_identifier,
        vec![0, 0],
        None,
        None,
    );

    // 添加数据内容信息
    FrameFun::add_data(
        &mut sub_result,
        "数据标识内容".to_string(),
        FrameFun::get_data_str_with_space(sub_datament),
        description,
        vec![0, 0],
        Some(item_data),
        None,
    );

    Ok(sub_result)
}
