// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
#![allow(dead_code)] // 在文件顶部使用
#![allow(unused_variables)] // 可以允许多个
use std::panic;
// use tauri::{CustomMenuItem, SystemTray, SystemTrayEvent, SystemTrayMenu, SystemTrayMenuItem};
use tracing::{error, info};
pub mod basefunc;
pub mod config;
#[cfg(feature = "desktop")]
pub mod combridage;
#[cfg(feature = "desktop")]
pub mod taurihandler;
#[cfg(feature = "desktop")]
use tauri::Manager;
#[cfg(feature = "desktop")]
pub mod protocol;
#[cfg(feature = "desktop")]
pub mod global;
// use once_cell::sync::OnceCell;
#[cfg(feature = "desktop")]
use crate::config::appconfig::{get_config_value_async, set_config_value_async};
#[cfg(feature = "desktop")]
use crate::taurihandler::channel_handler::{
    connect_channel, disconnect_channel, get_timer_status, list_serial_ports, send_message,
    start_timer_send, stop_timer_send,
};
#[cfg(feature = "desktop")]
use crate::taurihandler::dlt645_handler::list_channels;
#[cfg(feature = "desktop")]
use crate::taurihandler::handler::{
    app_close, check_update, get_all_config_item_lists, get_app_info, get_com_list,
    get_protocol_config_item, get_region_value, get_window_position, prase_frame, open_window,
    parse_item_data, save_file, save_protocol_config_item, set_region_value,
    update_window_position, WindowState,
};
#[cfg(feature = "desktop")]
use tauri_plugin_log::{Target, TargetKind};

#[cfg(feature = "web")]
pub mod web;

#[cfg(feature = "desktop")]
fn main() {
    // Desktop application entry point
    std::env::set_var("RUST_BACKTRACE", "1");
    
    panic::set_hook(Box::new(|info| {
        let backtrace = std::backtrace::Backtrace::capture();
        error!("Panic occurred: {:?}", info);
        error!("Backtrace: {:?}", backtrace);
    }));

    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
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
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets([
                    Target::new(TargetKind::Stdout),
                    Target::new(TargetKind::LogDir { file_name: None }),
                    Target::new(TargetKind::Webview),
                ])
                .build(),
        )
        .manage(WindowState::default()) // 添加窗口位置状态管理
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
                // 只对主窗口进行特殊处理，其他窗口允许正常关闭
                if window.label() == "main" {
                    println!("主窗口关闭请求被拦截");

                    let state_flags = tauri_plugin_window_state::StateFlags::all();
                    let app = window.app_handle();
                    let _ =
                        tauri_plugin_window_state::AppHandleExt::save_window_state(app, state_flags);

                    // // 阻止默认关闭行为，让前端处理
                    // api.prevent_close();

                    // // 发送关闭请求事件到前端窗口
                    // match app.emit("window-close-requested", ()) {
                    //     Ok(_) => println!("成功发送window-close-requested事件"),
                    //     Err(e) => println!("发送window-close-requested事件失败: {}", e),
                    // }
                } else {
                    // 对于其他窗口（如解析窗口），明确允许关闭
                    println!("允许窗口 {} 关闭", window.label());
                    // 不调用 prevent_close()，让窗口正常关闭
                }
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            prase_frame,
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
            taurihandler::channel_handler::subscribe_mqtt_topic,
            taurihandler::channel_handler::unsubscribe_mqtt_topic,
            taurihandler::handler::export_frames,
            parse_item_data,
            taurihandler::handler::export_logs,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(feature = "web")]
#[tokio::main]
async fn main() {
    std::env::set_var("RUST_BACKTRACE", "1");

    panic::set_hook(Box::new(|info| {
        let backtrace = std::backtrace::Backtrace::capture();
        error!("Panic occurred: {:?}", info);
        error!("Backtrace: {:?}", backtrace);
    }));

    // Start web server
    web::start_web_server().await;
}
