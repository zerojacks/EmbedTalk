use once_cell::sync::Lazy;
use std::sync::Mutex;
use tauri::AppHandle;

static APP_HANDLE: Lazy<Mutex<Option<AppHandle>>> = Lazy::new(|| Mutex::new(None));

pub fn set_app_handle(app_handle: AppHandle) {
    let mut handle = APP_HANDLE.lock().unwrap();
    *handle = Some(app_handle);
}

pub fn get_app_handle() -> AppHandle {
    let handle = APP_HANDLE.lock().unwrap();
    handle.clone().expect("App handle not set")
}