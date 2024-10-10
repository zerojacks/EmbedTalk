// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
#![allow(dead_code)]        // 在文件顶部使用
#![allow(unused_variables)] // 可以允许多个
use chrono::Local;
use std::panic;
use tauri::Manager;
// use tauri::{CustomMenuItem, SystemTray, SystemTrayEvent, SystemTrayMenu, SystemTrayMenuItem};
use tracing::{debug, error, info, warn};
use tracing_appender::rolling::{RollingFileAppender, Rotation};
use tracing_subscriber::fmt::format::Writer;
use tracing_subscriber::FmtSubscriber;
use tracing_subscriber::{self, fmt::time::FormatTime};
use tauri::Emitter;

pub mod basefunc;
pub mod combridage;
pub mod config;
pub mod global;
pub mod taurihandler;
// use once_cell::sync::OnceCell;
use crate::config::appconfig::{get_config_value_async, set_config_value_async};
use crate::taurihandler::handler::{
    app_close, check_update, get_app_info, get_com_list,
    get_region_value, on_text_change, save_file, set_region_value,
    get_all_config_item_lists,get_protocol_config_item
};
use crate::taurihandler::ChannelHandler::{connect_channel, disconnect_channel};
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

    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_os::init())
        .setup(|app| {
            let handle = app.app_handle();
            global::set_app_handle(handle.clone()); // Set the global app handle
            Ok(())
        })
        // .system_tray(SystemTray::new().with_menu(tray_menu))
        // .on_system_tray_event(|app, event| match event {
        //     SystemTrayEvent::LeftClick {
        //         position: _,
        //         size: _,
        //         ..
        //     } => {
        //         println!("system tray received a left click");
        //         let window = app.get_window("EmbedTalk").unwrap();
        //         window.show().unwrap();
        //         window.set_focus().unwrap();
        //         let id = String::from("hide");
        //         let item_handle = app.tray_handle().get_item(&id);
        //         item_handle.set_title("Hide").unwrap();
        //     }
        //     SystemTrayEvent::RightClick {
        //         position: _,
        //         size: _,
        //         ..
        //     } => {
        //         println!("system tray received a right click");
        //     }
        //     SystemTrayEvent::DoubleClick {
        //         position: _,
        //         size: _,
        //         ..
        //     } => {
        //         println!("system tray received a double click");
        //         // let window = app.get_window("EmbedTalk").unwrap();
        //         // window.show().unwrap();
        //     }
        //     SystemTrayEvent::MenuItemClick { id, .. } => {
        //         let item_handle = app.tray_handle().get_item(&id);
        //         let window = app.get_window("EmbedTalk").unwrap();

        //         match id.as_str() {
        //             "quit" => {
        //                 window.emit("clear-local-storage", ()).unwrap();
        //                 std::process::exit(0);
        //             }
        //             "hide" => {
        //                 if window.is_visible().unwrap() {
        //                     window.hide().unwrap();
        //                     item_handle.set_title("显示窗口").unwrap();
        //                 } else {
        //                     window.show().unwrap();
        //                     window.set_focus().unwrap();
        //                     item_handle.set_title("隐藏窗口").unwrap();
        //                 }
        //             }
        //             _ => {}
        //         }
        //     }
        //     _ => {}
        // })
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
        ])
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|_app_handle, event| match event {
            tauri::RunEvent::ExitRequested { api, .. } => {
                api.prevent_exit();
            }
            _ => {}
        });
}
