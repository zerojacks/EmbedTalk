// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
#![allow(dead_code)] // 在文件顶部使用
#![allow(unused_variables)] // 可以允许多个
use std::panic;
use tauri::Manager;
// use tauri::{CustomMenuItem, SystemTray, SystemTrayEvent, SystemTrayMenu, SystemTrayMenuItem};
use tracing::{error, info};
pub mod basefunc;
pub mod combridage;
pub mod config;
pub mod global;
pub mod protocol;
pub mod taurihandler;
// use once_cell::sync::OnceCell;
use crate::config::appconfig::{get_config_value_async, set_config_value_async};
use crate::taurihandler::channel_handler::{
    connect_channel, disconnect_channel, get_timer_status, list_serial_ports, send_message,
    start_timer_send, stop_timer_send,
};
use crate::taurihandler::dlt645_handler::{build_dlt645_frame, list_channels, parse_dlt645_frame};
use crate::taurihandler::handler::{
    app_close, check_update, get_all_config_item_lists, get_app_info, get_com_list,
    get_protocol_config_item, get_region_value, get_window_position, on_text_change, open_window,
    parse_item_data, save_file, save_protocol_config_item, set_region_value,
    update_window_position, WindowState,
};
use tauri_plugin_log::{Target, TargetKind};

fn main() {
    std::env::set_var("RUST_BACKTRACE", "1");

    panic::set_hook(Box::new(|info| {
        let backtrace = std::backtrace::Backtrace::capture();
        eprintln!("Panic occurred: {:?}", info);
        eprintln!("Backtrace: {:?}", backtrace);
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
                let state_flags = tauri_plugin_window_state::StateFlags::all();
                let app = window.app_handle();
                let _ =
                    tauri_plugin_window_state::AppHandleExt::save_window_state(app, state_flags);
                api.prevent_close();
                std::process::exit(0);
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
            taurihandler::channel_handler::subscribe_mqtt_topic,
            taurihandler::channel_handler::unsubscribe_mqtt_topic,
            parse_item_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
