use backtrace::Backtrace;
use lazy_static::lazy_static;
use quick_xml::events::Event;
use quick_xml::Reader;
use rayon::prelude::*;
use std::collections::HashMap;
use std::error::Error;
use std::fs::File;
use std::io::BufReader;
use std::path::Path;
use std::sync::{Arc, RwLock, RwLockReadGuard};
use std::time::Instant;
use tracing::{debug, error, info, warn}; // Add rayon for parallel iterators

#[derive(Clone, Debug)]
pub struct XmlElement {
    pub name: String,
    attributes: HashMap<String, String>,
    value: Option<String>,
    children: Vec<XmlElement>,
}

#[derive(Debug)]
pub struct XmlConfig {
    root: XmlElement,
}

pub struct QframeConfig {
    config: RwLock<Option<XmlConfig>>,
    config_cache: RwLock<Cache>, // Wrap Cache in RwLock
}

impl XmlElement {
    pub fn get_children(&self) -> Vec<XmlElement> {
        self.children.clone()
    }
    pub fn get_child(&self, name: &str) -> Option<&XmlElement> {
        self.children.iter().find(|child| child.name == name)
    }

    pub fn get_attribute(&self, name: &str) -> Option<&String> {
        self.attributes.get(name)
    }

    pub fn get_child_text(&self, name: &str) -> Option<String> {
        self.children
            .iter()
            .find(|child| child.name == name)
            .and_then(|child| child.value.clone())
    }

    pub fn get_items(&self, name: &str) -> Vec<XmlElement> {
        let mut items = Vec::new();
        for child in &self.children {
            if child.name == name {
                items.push(child.clone());
            } else {
                items.extend(
                    child
                        .children
                        .iter()
                        .filter(|grandchild| grandchild.name == name)
                        .cloned(),
                );
            }
        }
        items
    }

    pub fn get_value(&self) -> Option<String> {
        self.value.clone()
    }

    pub fn update_value(&mut self, name: &str, new_value: String) {
        if let Some(child) = self.children.iter_mut().find(|child| child.name == name) {
            child.value = Some(new_value);
        } else {
            let new_child = XmlElement {
                name: name.to_string(),
                attributes: HashMap::new(),
                value: Some(new_value),
                children: Vec::new(),
            };
            self.children.push(new_child);
        }
    }
}

pub struct Cache {
    results: HashMap<String, Option<XmlElement>>,
}

impl Cache {
    pub fn new() -> Self {
        Cache {
            results: HashMap::new(),
        }
    }

    pub fn get(&self, key: &str) -> Option<Option<XmlElement>> {
        self.results.get(key).cloned()
    }

    pub fn insert(&mut self, key: String, value: Option<XmlElement>) {
        self.results.insert(key, value);
    }
}

impl QframeConfig {
    pub fn new() -> Self {
        QframeConfig {
            config: RwLock::new(None),
            config_cache: RwLock::new(Cache::new()),
        }
    }

    pub fn load(&self, file_path: &Path) -> Result<(), Arc<dyn Error + Send + Sync>> {
        let file =
            File::open(file_path).map_err(|e| Arc::new(e) as Arc<dyn Error + Send + Sync>)?;
        let file = BufReader::new(file);
        let mut reader = Reader::from_reader(file);
        reader.trim_text(true);

        let mut stack = Vec::new();
        let mut root = None;
        let mut buf = Vec::new();

        loop {
            match reader.read_event(&mut buf) {
                Ok(Event::Start(ref e)) => {
                    let name = String::from_utf8_lossy(e.name()).to_string();
                    let mut attrs = HashMap::new();
                    for attr in e.attributes() {
                        let attr = attr.map_err(|e| Arc::new(e) as Arc<dyn Error + Send + Sync>)?;
                        let key = String::from_utf8_lossy(attr.key).to_string();
                        let value = attr
                            .unescape_and_decode_value(&reader)
                            .map_err(|e| Arc::new(e) as Arc<dyn Error + Send + Sync>)?;
                        attrs.insert(key, value);
                    }
                    let element = XmlElement {
                        name,
                        attributes: attrs,
                        value: None,
                        children: Vec::new(),
                    };
                    stack.push(element);
                }
                Ok(Event::Text(e)) => {
                    if let Some(parent) = stack.last_mut() {
                        let text = e
                            .unescape_and_decode(&reader)
                            .map_err(|e| Arc::new(e) as Arc<dyn Error + Send + Sync>)?;
                        parent.value = Some(text);
                    }
                }
                Ok(Event::End(_)) => {
                    if let Some(element) = stack.pop() {
                        if let Some(parent) = stack.last_mut() {
                            parent.children.push(element);
                        } else {
                            root = Some(element);
                        }
                    }
                }
                Ok(Event::Eof) => break,
                Err(e) => return Err(Arc::new(e) as Arc<dyn Error + Send + Sync>),
                _ => {}
            }
            buf.clear();
        }

        if let Some(root) = root {
            let mut config = self.config.write().unwrap();
            *config = Some(XmlConfig { root });
        }

        Ok(())
    }

    fn merge_attributes(
        &self,
        element: &XmlElement,
        inherited_attributes: &HashMap<String, String>,
    ) -> HashMap<String, String> {
        let mut merged =
            HashMap::with_capacity(inherited_attributes.len() + element.attributes.len());
        for (k, v) in inherited_attributes.iter().filter(|&(k, _)| k != "id") {
            merged.insert(k.clone(), v.clone());
        }
        for (k, v) in element.attributes.iter() {
            merged.insert(k.clone(), v.clone());
        }
        merged
    }

    fn generate_cache_key(target_id: &str, protocol: &str, region: &str) -> String {
        format!("{}:{}:{}", target_id, protocol, region)
    }

    pub fn get_template_item(
        &self,
        template: &str,
        protocol: &str,
        region: &str,
        dir: Option<u8>,
    ) -> Option<XmlElement> {
        let config = self.config.read().unwrap();
        config.as_ref().and_then(|config| {
            self.find_target_dataitem(&config.root, template, protocol, region, dir)
        })
    }

    fn clean_target_region(target_region: &str) -> String {
        let mut cleaned = String::from(target_region);
        cleaned.retain(|c| c != '"');
        cleaned.to_uppercase()
    }

    fn is_valid_data_item_with_attributes(
        &self,
        attributes: &HashMap<String, String>,
        target_protocol: &str,
        target_region: &str,
        dir: Option<u8>,
    ) -> bool {
        if let Some(attri_protocol) = attributes.get("protocol") {
            let protocols: Vec<String> = attri_protocol
                .split(',')
                .map(|s| s.trim().to_uppercase())
                .collect();
            if protocols.contains(&target_protocol.to_uppercase()) {
                if let Some(attri_region) = attributes.get("region") {
                    let regions: Vec<String> = attri_region
                        .split(',')
                        .map(|s| s.trim().to_uppercase())
                        .collect();
                    let cleaned_target_region = Self::clean_target_region(target_region);
                    if regions.contains(&cleaned_target_region) {
                        if let Some(dir) = dir {
                            if let Some(attri_dir) = attributes.get("dir") {
                                return attri_dir.parse::<u8>().unwrap_or(0) == dir;
                            }
                        }
                        return true;
                    }
                }
            }
        }
        false
    }

    pub fn get_item(
        &self,
        item_id: &str,
        protocol: &str,
        region: &str,
        dir: Option<u8>,
    ) -> Option<XmlElement> {
        let config = self.config.read().unwrap();
        config.as_ref().and_then(|config| {
            self.find_target_dataitem(&config.root, item_id, protocol, region, dir)
        })
    }

    pub fn find_target_dataitem(
        &self,
        root: &XmlElement,
        target_id: &str,
        target_protocol: &str,
        region: &str,
        dir: Option<u8>,
    ) -> Option<XmlElement> {
        let mut cache = self.config_cache.write().unwrap();

        let cache_key = Self::generate_cache_key(target_id, target_protocol, region);
        if let Some(cached_result) = cache.get(&cache_key) {
            return cached_result.clone();
        }

        fn find_recursive<'a>(
            element: &'a XmlElement,
            inherited_attributes: &'a HashMap<String, String>,
            target_id: &str,
            target_protocol: &str,
            region: &str,
            dir: Option<u8>,
            config: &'a QframeConfig,
        ) -> Option<XmlElement> {
            let merged_attributes = config.merge_attributes(element, inherited_attributes);

            if let Some(id) = merged_attributes.get("id") {
                if id.eq_ignore_ascii_case(target_id)
                    && config.is_valid_data_item_with_attributes(
                        &merged_attributes,
                        target_protocol,
                        region,
                        dir,
                    )
                {
                    return Some(element.clone());
                }
            }

            element.children.par_iter().find_map_any(|child| {
                find_recursive(
                    child,
                    &merged_attributes,
                    target_id,
                    target_protocol,
                    region,
                    dir,
                    config,
                )
            })
        }

        let mut result = find_recursive(
            root,
            &root.attributes,
            target_id,
            target_protocol,
            region,
            dir,
            self,
        );

        // 如果第一次查找没有找到结果，且区域不是“南网”，则进行第二次查找
        if result.is_none() && !region.eq_ignore_ascii_case("南网") {
            result = find_recursive(
                root,
                &root.attributes,
                target_id,
                target_protocol,
                "南网",
                dir,
                self,
            );
        }

        // 将查找结果插入缓存
        cache.insert(cache_key, result.clone());

        // 返回结果
        result
    }

    pub fn get_config(&self) -> RwLockReadGuard<Option<XmlConfig>> {
        self.config.read().unwrap() // 返回 RwLock 的读锁
    }
    
}

lazy_static! {
    pub static ref GLOBAL_CSG13: Result<QframeConfig, Arc<dyn std::error::Error + Send + Sync>> = {
        let config = QframeConfig::new();
        match config.load(Path::new("./resources/protocolconfig/CSG13.xml")) {
            Ok(_) => {
                info!("CSG13 XML 加载成功");
                Ok(config)
            }
            Err(e) => {
                info!("CSG13 XML 加载失败: {}", e);
                Err(e)
            }
        }
    };
    pub static ref GLOBAL_645: Result<QframeConfig, Arc<dyn std::error::Error + Send + Sync>> = {
        let config = QframeConfig::new();
        match config.load(Path::new("./resources/protocolconfig/DLT645.xml")) {
            Ok(_) => {
                info!("645 XML 加载成功");
                Ok(config)
            }
            Err(e) => {
                info!("645 XML 加载失败: {}", e);
                Err(e)
            }
        }
    };
    pub static ref GLOBAL_CSG16: Result<QframeConfig, Arc<dyn std::error::Error + Send + Sync>> = {
        let config = QframeConfig::new();
        match config.load(Path::new("./resources/protocolconfig/CSG16.xml")) {
            Ok(_) => {
                info!("CSG16 XML 加载成功");
                Ok(config)
            }
            Err(e) => {
                info!("CSG16 XML 加载失败: {}", e);
                Err(e)
            }
        }
    };
}

pub struct ProtocolConfigManager;

impl ProtocolConfigManager {
    pub fn get_config_xml(
        data_item_id: &str,
        protocol: &str,
        region: &str,
        dir: Option<u8>,
    ) -> Option<XmlElement> {
        let find_protocol = protocol.to_uppercase();

        match find_protocol.as_str() {
            protocol if protocol.contains("CSG13") => {
                // 匹配 CSG13 协议，使用 GLOBAL_CSG13
                let item =
                    GLOBAL_CSG13
                        .as_ref()
                        .ok()?
                        .get_item(data_item_id, protocol, region, dir);
                item
            }
            protocol if protocol.contains("DLT/645") => {
                // 匹配 DLT/645 协议，使用 GLOBAL_645
                let item = GLOBAL_645
                    .as_ref()
                    .ok()?
                    .get_item(data_item_id, protocol, region, dir);
                item
            }
            protocol if protocol.contains("CSG16") => {
                // 匹配 CSG16 协议，使用 GLOBAL_CSG16
                let item =
                    GLOBAL_CSG16
                        .as_ref()
                        .ok()?
                        .get_item(data_item_id, protocol, region, dir);
                item
            }
            _ => None, // 不匹配任何已知协议时返回 None
        }
    }

    pub fn get_template_element(
        template: &str,
        protocol: &str,
        region: &str,
        dir: Option<u8>,
    ) -> Option<XmlElement> {
        let find_protocol = protocol.to_uppercase();

        match find_protocol.as_str() {
            protocol if protocol.contains("CSG13") => {
                // 匹配 CSG13 协议，使用 GLOBAL_CSG13
                GLOBAL_CSG13
                    .as_ref()
                    .ok()?
                    .get_template_item(template, protocol, region, dir)
            }
            protocol if protocol.contains("DLT/645") => {
                // 匹配 DLT/645 协议，使用 GLOBAL_645
                GLOBAL_645
                    .as_ref()
                    .ok()?
                    .get_template_item(template, protocol, region, dir)
            }
            protocol if protocol.contains("CSG16") => {
                // 匹配 CSG16 协议，使用 GLOBAL_CSG16
                GLOBAL_CSG16
                    .as_ref()
                    .ok()?
                    .get_template_item(template, protocol, region, dir)
            }
            _ => None, // 不匹配任何已知协议时返回 None
        }
    }
}
