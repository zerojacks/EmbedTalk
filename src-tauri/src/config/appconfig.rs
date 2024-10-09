use crate::config::constants;
use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use dirs_next;

#[derive(Debug, Serialize, Deserialize)]
pub struct Config {
    file_path: String,
    content: Value,
}

impl Config {
    pub fn new<P: AsRef<Path>>(file_path: P) -> Result<Self, Box<dyn std::error::Error>> {
        let file_path = file_path.as_ref().to_str().unwrap().to_string();
        let contents = fs::read_to_string(&file_path)?;
        let content: Value = serde_json::from_str(&contents)?;
        Ok(Config { file_path, content })
    }

    // Save config to file
    pub fn save(&self, file_path: &str) -> Result<(), Box<dyn std::error::Error>> {
        if !Path::new(file_path).exists() {
            fs::create_dir_all(Path::new(file_path).parent().unwrap())?;
        }

        let json_string = serde_json::to_string_pretty(&self.content)?;
        fs::write(file_path, json_string)?;
        Ok(())
    }

    pub fn get_value(&self, path: &[&str]) -> Option<&Value> {
        let mut current = &self.content;
        for &key in path {
            current = current.get(key)?;
        }
        Some(current)
    }

    pub fn set_value(
        &mut self,
        path: &[&str],
        value: Value,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let mut current = &mut self.content;

        // Iterate over each key except the last one
        for &key in path.iter().take(path.len() - 1) {
            // Ensure current is an object and create it if it doesn't exist
            current = match current {
                Value::Object(map) => {
                    // If the key exists, get it, otherwise insert an empty object
                    map.entry(key.to_string())
                        .or_insert_with(|| Value::Object(serde_json::Map::new()))
                }
                _ => return Err("Invalid path structure".into()), // Return error if not an object
            };
        }

        // Set the value at the last key
        if let Some(last_key) = path.last() {
            if let Value::Object(map) = current {
                map.insert(last_key.to_string(), value);
                self.save(self.file_path.as_str())?;
            } else {
                return Err("Invalid path structure".into());
            }
        }

        Ok(())
    }
}

#[cfg(target_os = "windows")]
fn get_config_dir(app_name: &str) -> PathBuf {
    let base_dir = std::env::var("APPDATA")
        .unwrap_or_else(|_| "C:\\Users\\Default\\AppData\\Roaming".to_string());
    PathBuf::from(base_dir).join(app_name)
}

#[cfg(target_os = "macos")]
fn get_config_dir(app_name: &str) -> PathBuf {
    let base_dir = dirs_next::home_dir()
        .unwrap()
        .join("Library")
        .join("Application Support");
    base_dir.join(app_name)
}

#[cfg(target_os = "linux")]
fn get_config_dir(app_name: &str) -> PathBuf {
    let base_dir = std::env::var("XDG_CONFIG_HOME")
        .unwrap_or_else(|_| format!("{}/.config", dirs_next::home_dir().unwrap().display()));
    PathBuf::from(base_dir).join(app_name)
}

// remember to call `.manage(MyState::default())`
#[tauri::command]
pub async fn get_config_value_async(section: &str, key: &str) -> Result<Option<Value>, String> {
    // Build the path to the config file
    let path = get_config_dir(constants::APP_NAME).join(constants::APP_CONFIG);

    // Load the config
    let config = Config::new(path.to_str().unwrap()).map_err(|e| format!("{}", e))?;
    // 读取 MainWindow.theme 字段
    let mut sectionvalue: Option<Value> = None;
    if key.is_empty() {
        sectionvalue = config.get_value(&[section]).cloned();
    } else {
        sectionvalue = config.get_value(&[section, key]).cloned();
    }
    // Retrieve the value from the config
    Ok(sectionvalue)
}

pub fn load_config_value(section: &str, key: &str) -> Option<Value> {
    // Build the path to the config file
    let path = get_config_dir(constants::APP_NAME).join(constants::APP_CONFIG);

    // Load the config
    let config = Config::new(path.to_str().unwrap()).map_err(|e| format!("{}", e));
    if let Ok(config) = config {
        // 读取 MainWindow.theme 字段
        let theme = config.get_value(&[section, key]);
        // Retrieve the value from the config
        theme.cloned()
    } else {
        None
    }
}

#[tauri::command]
pub async fn set_config_value_async(section: &str, key: &str, value: &str) -> Result<(), String> {
    // Build the path to the config file
    let path = get_config_dir(constants::APP_NAME).join(constants::APP_CONFIG);
    let dir_path = path.parent().unwrap(); // Get the directory path
                                           // Create the directory if it doesn't exist
    if !dir_path.exists() {
        if let Err(e) = fs::create_dir_all(dir_path) {
            return Err(format!("Failed to create directory: {}", e));
        }
    }
    let value_json: serde_json::Value =
        serde_json::from_str(value).map_err(|e| format!("Failed to parse JSON: {}", e))?;
    // 读取 MainWindow.theme 字段
    let config = Config::new(path.to_str().unwrap()).map_err(|e| format!("{}", e));
    if let Ok(mut config) = config {
        if key.is_empty() {
            config
                .set_value(&[section], value_json)
                .map_err(|e| format!("{}", e))?;
        } else {
            config
                .set_value(&[section, key], value_json)
                .map_err(|e| format!("{}", e))?;
        }
    } else {
        let mut newconfig = Config {
            file_path: path.to_str().unwrap().to_string(),
            content: Value::Object(serde_json::Map::new()),
        };
        if key.is_empty() {
            newconfig
                .set_value(&[section], value_json)
                .map_err(|e| format!("{}", e))?;
        } else {
            newconfig
                .set_value(&[section, key], value_json)
                .map_err(|e| format!("{}", e))?;
        }
    }

    Ok(())
}

pub fn set_config_value(section: &str, key: &str, value: &str) -> Result<(), String> {
    // Build the path to the config file
    let path = get_config_dir(constants::APP_NAME).join(constants::APP_CONFIG);
    let dir_path = path.parent().unwrap(); // Get the directory path

    // Create the directory if it doesn't exist
    if !dir_path.exists() {
        if let Err(e) = fs::create_dir_all(dir_path) {
            return Err(format!("Failed to create directory: {}", e));
        }
    }
    let value_json: serde_json::Value =
        serde_json::from_str(value).map_err(|e| format!("Failed to parse JSON: {}", e))?;

    let mut config = Config::new(path.to_str().unwrap()).map_err(|e| format!("{}", e));
    if let Ok(mut config) = config {
        if key.is_empty() {
            config
                .set_value(&[section], value_json)
                .map_err(|e| format!("{}", e))?;
        } else {
            config
                .set_value(&[section, key], value_json)
                .map_err(|e| format!("{}", e))?;
        }
    } else {
        let mut newconfig = Config {
            file_path: path.to_str().unwrap().to_string(),
            content: Value::Object(serde_json::Map::new()),
        };
        if key.is_empty() {
            newconfig
                .set_value(&[section], value_json)
                .map_err(|e| format!("{}", e))?;
        } else {
            newconfig
                .set_value(&[section, key], value_json)
                .map_err(|e| format!("{}", e))?;
        }
    }
    Ok(())
}

// 配置项
pub struct ConfigItem {
    key: String,
    value: Mutex<String>,
}

impl ConfigItem {
    pub fn new(key: &str) -> Self {
        Self {
            key: key.to_string(),
            value: Mutex::new(GlobalConfigManager::load_config_value(key)),
        }
    }

    // 读取配置值
    pub fn get_value(&self) -> String {
        let value = self.value.lock().unwrap();
        value.clone()
    }

    // 修改配置值
    pub fn set_value(&self, new_value: &str) {
        let mut value = self.value.lock().unwrap();
        *value = new_value.to_string();
        println!("Set config value: {}", new_value);
        match GlobalConfigManager::set_config_value(&self.key, new_value.to_string()) {
            Ok(_) => {}
            Err(e) => {
                println!("Failed to set config value: {}", e);
            }
        }
    }
}

pub struct GlobalConfigManager {
    pub global_region: ConfigItem,
    // pub api_key: ConfigItem,
    // pub max_retries: ConfigItem,
}

// 使用 lazy_static 定义全局变量
lazy_static! {
    pub static ref GLOBAL_CONFIG_MANAGER: GlobalConfigManager = GlobalConfigManager::new();
}

// 配置管理器结构体
impl GlobalConfigManager {
    pub fn new() -> Self {
        Self {
            global_region: ConfigItem::new("region"),
        }
    }

    // 通用方法来加载配置
    pub fn load_config_value(key: &str) -> String {
        let value = load_config_value("ProtocolSetting", key);

        println!("key: {}, value: {:?}", key, value); // 打印调试信息

        match value {
            Some(v) => v.to_string(),
            _ => "默认值".to_string(), // 返回默认值
        }
    }

    pub fn set_config_value(key: &str, value: String) -> Result<(), String> {
        println!("key: {}, value: {:?}", key, value);
        set_config_value("ProtocolSetting", key, &value)
    }
}
