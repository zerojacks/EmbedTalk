// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
#![allow(dead_code)] // 在文件顶部使用
#![allow(unused_variables)] // 可以允许多个
use chrono::Local;
use std::panic;
use tauri::Manager;
// use tauri::{CustomMenuItem, SystemTray, SystemTrayEvent, SystemTrayMenu, SystemTrayMenuItem};
use tauri::Emitter;
use tracing::{error, info};
use tracing_subscriber::fmt::format::Writer;
use tracing_subscriber::{self, fmt::time::FormatTime};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

pub mod basefunc;
pub mod combridage;
pub mod config;
pub mod global;
pub mod taurihandler;
pub mod protocol;
// use once_cell::sync::OnceCell;
use crate::config::appconfig::{get_config_value_async, set_config_value_async};
use crate::taurihandler::channel_handler::{
    connect_channel, disconnect_channel, list_serial_ports, send_message,
    start_timer_send, stop_timer_send, get_timer_status
};
use crate::taurihandler::handler::{
    app_close, check_update, get_all_config_item_lists, get_app_info, get_com_list,
    get_protocol_config_item, get_region_value, on_text_change, save_file,
    save_protocol_config_item, set_region_value, open_window, update_window_position, 
    get_window_position, WindowState, parse_item_data
};
use crate::taurihandler::dlt645_handler::{
    parse_dlt645_frame, build_dlt645_frame, list_channels
};
use tauri_plugin_log::{Target, TargetKind};
// 用来格式化日志的输出时间格式
struct LocalTimer;

impl FormatTime for LocalTimer {
    fn format_time(&self, w: &mut Writer<'_>) -> std::fmt::Result {
        write!(w, "{}", Local::now().format("%FT%T%.3f"))
    }
}
// 在窗口的状态中添加一个记录最后保存时间的字段
#[derive(Clone)]
struct WindowStateManager {
    last_save: Option<Instant>,
    save_scheduled: bool,
}

impl WindowStateManager {
    fn new() -> Self {
        Self {
            last_save: None,
            save_scheduled: false,
        }
    }
}
// 在窗口事件处理中使用

fn main() {
    std::env::set_var("RUST_BACKTRACE", "1");

    panic::set_hook(Box::new(|info| {
        let backtrace = std::backtrace::Backtrace::capture();
        eprintln!("Panic occurred: {:?}", info);
        eprintln!("Backtrace: {:?}", backtrace);
    }));

    // 在初始化应用程序前创建状态管理器
    let state_manager = Arc::new(Mutex::new(WindowStateManager::new()));
    let state_manager_clone = state_manager.clone();

    // let quit = CustomMenuItem::new("quit".to_string(), "退出");
    // let hide = CustomMenuItem::new("hide".to_string(), "隐藏窗口");
    // let tray_menu = SystemTrayMenu::new()
    //     .add_item(quit)
    //     .add_native_item(SystemTrayMenuItem::Separator)
    //     .add_item(hide);
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_log::Builder::new()
        .targets([
            Target::new(TargetKind::Stdout),
            Target::new(TargetKind::LogDir { file_name: None }),
            Target::new(TargetKind::Webview),
        ])
        .build()
        )
        .manage(WindowState::default()) // 添加窗口位置状态管理
        .manage(state_manager) // 添加窗口状态管理器到 Tauri 状态中
        .setup(|app| {
            let handle = app.app_handle();
            global::set_app_handle(handle.clone()); // Set the global app handle
            
            // 初始化协议栈
            let app_handle = handle.clone();
            tauri::async_runtime::spawn(async move {
                match protocol::initialize_protocol_stack().await {
                    Ok(_) => info!("Protocol stack initialized successfully"),
                    Err(e) => error!("Failed to initialize protocol stack: {}", e),
                }
            });
            
            Ok(())
        })
        .on_window_event(move |window, event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                window.hide().unwrap();
                window.emit("clear-local-storage", ()).unwrap();
                api.prevent_close();
                std::process::exit(0);
            }
            tauri::WindowEvent::Resized(_) | tauri::WindowEvent::Moved(_) => {
                let window_clone = window.clone();
                let manager_clone = state_manager_clone.clone();
                
                // 获取当前的状态
                let mut manager = manager_clone.lock().unwrap();
                let now = Instant::now();
                
                // 如果已经有计划的保存任务，或者距离上次保存不到500毫秒，则不再创建新任务
                if manager.save_scheduled || manager.last_save.map_or(false, |last| now.duration_since(last) < Duration::from_millis(500)) {
                    return;
                }
                
                // 标记为已计划保存
                manager.save_scheduled = true;
                
                // 释放锁
                drop(manager);
                
                // 创建一个延迟执行的任务
                tauri::async_runtime::spawn(async move {
                    // 等待500毫秒
                    tokio::time::sleep(Duration::from_millis(500)).await;
                    
                    // 执行保存
                    let state_flags = tauri_plugin_window_state::StateFlags::all();
                    let app = window_clone.app_handle();
                    let _ = tauri_plugin_window_state::AppHandleExt::save_window_state(app, state_flags);
                    
                    // 更新状态
                    let mut manager = manager_clone.lock().unwrap();
                    manager.last_save = Some(Instant::now());
                    manager.save_scheduled = false;
                });
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            on_text_change,
            app_close,
            set_config_value_async,
            get_config_value_async,
            get_region_value,
            set_region_value,
            save_file,
            get_app_info,
            check_update,
            get_com_list,
            connect_channel,
            disconnect_channel,
            get_all_config_item_lists,
            get_protocol_config_item,
            save_protocol_config_item,
            list_serial_ports,
            send_message,
            start_timer_send,
            stop_timer_send,
            get_timer_status,
            open_window,
            update_window_position,
            get_window_position,
            // DLT645 相关命令
            parse_dlt645_frame,
            build_dlt645_frame,
            list_channels,
            // 协议相关命令
            taurihandler::protocol_handler::get_supported_protocols,
            taurihandler::protocol_handler::configure_channel_protocol,
            taurihandler::protocol_handler::get_channel_protocol_config,
            taurihandler::protocol_handler::parse_protocol_data,
            taurihandler::protocol_handler::build_protocol_message,
            taurihandler::protocol_handler::send_protocol_message,
            taurihandler::protocol_handler::handle_protocol_message,
            taurihandler::handler::caculate_pppfcs16,
            taurihandler::handler::da_and_measure_point_exchange,
            taurihandler::handler::open_devtools,
            parse_item_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}