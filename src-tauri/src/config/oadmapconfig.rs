use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::env;
use std::fs::File;
use std::io::Read;
use std::path::Path;
// 主配置文件的结构
#[derive(Debug, Deserialize, Serialize)]
struct MainConfig {
    oad_list: Vec<OadItem>,
}

#[derive(Debug, Deserialize, Serialize)]
struct OadItem {
    master_oad: String,
    name: String,
    #[serde(rename = "file")]
    file_path: String,
}

// 子文件的列表项结构
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ListItem {
    pub v_oad: String,
    pub item_07: String,
    pub start_pos: u32,
    pub len_07: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub comment: Option<String>,
}

// 子配置文件的结构
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct SubConfig {
    #[serde(flatten)]
    lists: HashMap<String, Vec<ListItem>>,
}

// 完整的配置结构
#[derive(Debug)]
struct CompleteConfig {
    main_config: MainConfig,
    sub_configs: HashMap<String, SubConfig>,
}

impl CompleteConfig {
    fn new(config_path: &Path) -> Result<Self, Box<dyn std::error::Error>> {
        let main_config = Self::load_main_config(config_path)?;
        let mut sub_configs = HashMap::new();

        let base_path = config_path.parent().unwrap_or_else(|| Path::new(""));

        for oad_item in &main_config.oad_list {
            let file_path = oad_item.file_path.trim_start_matches("!inc ");
            let full_path = base_path.join(file_path);

            let sub_config = Self::load_sub_config(&full_path, &oad_item.name)?;
            sub_configs.insert(oad_item.master_oad.clone(), sub_config);
        }

        Ok(CompleteConfig {
            main_config,
            sub_configs,
        })
    }

    fn load_main_config(path: &Path) -> Result<MainConfig, Box<dyn std::error::Error>> {
        let mut file = File::open(path)?; // 使用 File::open
        let mut content = String::new();

        file.read_to_string(&mut content)?; // 读取文件内容
        let config: MainConfig = serde_yaml::from_str(&content)?; // 解析 YAML
        Ok(config)
    }

    fn load_sub_config(
        path: &Path,
        list_name: &str,
    ) -> Result<SubConfig, Box<dyn std::error::Error>> {
        let mut file = File::open(path)?; // 使用 File::open
        let mut content = String::new();

        file.read_to_string(&mut content)?; // 读取文件内容
        let config: SubConfig = serde_yaml::from_str(&content)?;
        Ok(config)
    }

    // 根据master_oad获取对应的配置列表
    fn get_config_by_master_oad(&self, master_oad: &str) -> Option<&SubConfig> {
        // 将传入的 master_oad 转换为小写
        let master_oad_lower = master_oad.to_lowercase();
        // 遍历所有 sub_configs，查找匹配的小写键
        self.sub_configs.iter().find_map(|(key, config)| {
            if key.to_lowercase() == master_oad_lower {
                Some(config)
            } else {
                None
            }
        })
    }
}

lazy_static! {
    static ref TASK_OAD_CONFIG: CompleteConfig = {
        match CompleteConfig::new(Path::new("./resources/taskoadconfig/oad_list.yml")) {
            Ok(config) => config,
            Err(e) => {
                eprintln!("{}", e);
                panic!("读取配置文件失败")
            }
        }
    };
}

pub struct TaskOadConfigManager;

impl TaskOadConfigManager {
    pub fn get_voad(master_oad: &str, v_oad: &str) -> Option<ListItem> {
        let config = TASK_OAD_CONFIG.get_config_by_master_oad(master_oad);
        if config.is_none() {
            eprintln!("找不到对应的配置列表: {}", master_oad);
            return None;
        }
        let config = config.unwrap();
        for (list_name, items) in &config.lists {
            for item in items {
                if item.v_oad.to_lowercase() == v_oad.to_lowercase() {
                    return Some(item.clone());
                }
            }
        }
        None
    }
}
