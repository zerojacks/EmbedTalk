// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
#![allow(dead_code)] // 在文件顶部使用
#![allow(unused_variables)] // 可以允许多个
use chrono::Local;
use std::panic;
use tauri::Manager;
// use tauri::{CustomMenuItem, SystemTray, SystemTrayEvent, SystemTrayMenu, SystemTrayMenuItem};
use tauri::Emitter;
use tracing::{debug, error, info, warn};
use tracing_appender::rolling::{RollingFileAppender, Rotation};
use tracing_subscriber::fmt::format::Writer;
use tracing_subscriber::FmtSubscriber;
use tracing_subscriber::{self, fmt::time::FormatTime};

pub mod basefunc;
pub mod combridage;
pub mod config;
pub mod global;
pub mod taurihandler;
// use once_cell::sync::OnceCell;
use crate::config::appconfig::{get_config_value_async, set_config_value_async};
use crate::taurihandler::handler::{
    app_close, check_update, get_all_config_item_lists, get_app_info, get_com_list,
    get_protocol_config_item, get_region_value, get_system_theme, on_text_change, save_file,
    save_protocol_config_item, set_region_value,
};
use crate::taurihandler::ChannelHandler::{connect_channel, disconnect_channel, list_serial_ports};
// 用来格式化日志的输出时间格式
struct LocalTimer;

impl FormatTime for LocalTimer {
    fn format_time(&self, w: &mut Writer<'_>) -> std::fmt::Result {
        write!(w, "{}", Local::now().format("%FT%T%.3f"))
    }
}

fn main() {
    std::env::set_var("RUST_BACKTRACE", "1");

    panic::set_hook(Box::new(|info| {
        let backtrace = std::backtrace::Backtrace::capture();
        eprintln!("Panic occurred: {:?}", info);
        eprintln!("Backtrace: {:?}", backtrace);
    }));

    // 配置日志输出到文件
    let file_appender = RollingFileAppender::new(Rotation::DAILY, "logs", "app.log");
    let (non_blocking, _guard) = tracing_appender::non_blocking(file_appender);

    // 初始化 tracing 日志系统
    let subscriber = FmtSubscriber::builder()
        .with_max_level(tracing::Level::DEBUG) // 设置最大日志级别
        .with_writer(non_blocking) // 将日志写入文件
        .finish();

    // 设置全局 tracing subscriber
    tracing::subscriber::set_global_default(subscriber).expect("setting default subscriber failed");

    // let quit = CustomMenuItem::new("quit".to_string(), "退出");
    // let hide = CustomMenuItem::new("hide".to_string(), "隐藏窗口");
    // let tray_menu = SystemTrayMenu::new()
    //     .add_item(quit)
    //     .add_native_item(SystemTrayMenuItem::Separator)
    //     .add_item(hide);
    let mut ctx = tauri::generate_context!();
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_theme::init(ctx.config_mut()))
        .setup(|app| {
            let handle = app.app_handle();
            global::set_app_handle(handle.clone()); // Set the global app handle
            Ok(())
        })
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                window.hide().unwrap();
                window.emit("clear-local-storage", ()).unwrap();
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
            get_system_theme,
            save_protocol_config_item,
            list_serial_ports,
        ])
        .build(ctx)
        .expect("error while running tauri application")
        .run(|_app_handle, event| match event {
            tauri::RunEvent::ExitRequested { api, .. } => {
                api.prevent_exit();
            }
            _ => {}
        });
}
