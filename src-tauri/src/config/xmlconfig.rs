use lazy_static::lazy_static;
use quick_xml::events::{BytesEnd, BytesStart, BytesText, Event};
use quick_xml::{Reader, Writer};
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::error::Error;
use std::fs::File;
use std::io::{BufReader, BufWriter};
use std::path::{Path, PathBuf};
use std::sync::{Arc, RwLock, RwLockReadGuard};
use tracing::info; // Add rayon for parallel iterators

#[derive(Clone, Debug, Serialize, Deserialize)]
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
    config_path: RwLock<Option<PathBuf>>,
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

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ItemConfigList {
    item: String,
    name: Option<String>,
    protocol: Option<String>,
    region: Option<String>,
    dir: Option<String>,
}

impl QframeConfig {
    pub fn new() -> Self {
        QframeConfig {
            config: RwLock::new(None),
            config_cache: RwLock::new(Cache::new()),
            config_path: RwLock::new(None),
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
            let mut path = self.config_path.write().unwrap();
            *path = Some(file_path.to_path_buf());
        }
        Ok(())
    }

    pub fn update_element(
        &self,
        target_id: &str,
        new_element: XmlElement,
    ) -> Result<(), Arc<dyn Error + Send + Sync>> {
        let mut config = self.config.write().unwrap();
        println!("update element:{:?}", target_id);

        if let Some(ref mut xml_config) = *config {
            // 清除缓存，因为内容已更新
            let mut cache = self.config_cache.write().unwrap();
            cache.results.clear();
            // 更新或添加元素
            let result =
                self.update_element_recursive(&mut xml_config.root, target_id, new_element, true);
            println!("update element:{:?} {:?} success", target_id, result);

            // 保存更新后的配置到文件
            self.save_to_file(xml_config)?;
            println!("save element:{:?} success", target_id);
        }
        println!("save element:{:?} err", config);
        Ok(())
    }

    fn update_element_recursive(
        &self,
        current: &mut XmlElement,
        target_id: &str,
        new_element: XmlElement,
        isroot: bool,
    ) -> Result<bool, Arc<dyn Error + Send + Sync>> {
        // 检查当前节点是否是目标节点
        if let Some(id) = current.attributes.get("id") {
            if id == target_id {
                *current = new_element;
                return Ok(true);
            }
        }

        // 递归检查子节点
        for child in current.children.iter_mut() {
            if self.update_element_recursive(child, target_id, new_element.clone(), false)? {
                return Ok(true);
            }
        }

        if !isroot {
            return Ok(false);
        }
        // 如果没找到目标节点，将新元素添加为子节点
        if !current.children.iter().any(|child| {
            child
                .attributes
                .get("id")
                .map_or(false, |id| id == target_id)
        }) {
            current.children.push(new_element);
            return Ok(true);
        }

        Ok(false)
    }

    pub fn save_to_file(&self, config: &mut XmlConfig) -> Result<(), Arc<dyn Error + Send + Sync>> {
        println!("save to file");
        let path = self.config_path.read().unwrap();
        println!("{:?} {:?} ", path, config.root);
        if let (Some(path)) = (path.as_ref()) {
            let file =
                File::create(path).map_err(|e| Arc::new(e) as Arc<dyn Error + Send + Sync>)?;
            let writer = BufWriter::new(file);
            let mut xml_writer = Writer::new(writer);

            self.write_element(&mut xml_writer, &config.root, 0)?;
        }

        Ok(())
    }

    fn write_element(
        &self,
        writer: &mut Writer<BufWriter<File>>,
        element: &XmlElement,
        indent_level: usize,
    ) -> Result<(), Arc<dyn Error + Send + Sync>> {
        // 写入初始缩进
        let indent = "    ".repeat(indent_level);
        writer
            .write_event(Event::Text(BytesText::from_escaped(indent.as_bytes())))
            .map_err(|e| Arc::new(e) as Arc<dyn Error + Send + Sync>)?;

        // 创建开始标签
        let mut elem_start = BytesStart::borrowed_name(element.name.as_bytes());

        // 添加属性
        for (key, value) in &element.attributes {
            elem_start.push_attribute((key.as_str(), value.as_str()));
        }

        // 写入开始标签
        writer
            .write_event(Event::Start(elem_start.clone()))
            .map_err(|e| Arc::new(e) as Arc<dyn Error + Send + Sync>)?;

        // 检查元素内容是否复杂
        let has_complex_content = !element.children.is_empty();

        if has_complex_content {
            // 如果是复杂元素，添加换行
            writer
                .write_event(Event::Text(BytesText::from_escaped(b"\n")))
                .map_err(|e| Arc::new(e) as Arc<dyn Error + Send + Sync>)?;
        }

        // 写入值（如果有）
        if let Some(ref value) = element.value {
            if has_complex_content {
                // 如果是复杂元素，缩进并换行
                writer
                    .write_event(Event::Text(BytesText::from_escaped(
                        format!("{}{}", "    ".repeat(indent_level + 1), value).as_bytes(),
                    )))
                    .map_err(|e| Arc::new(e) as Arc<dyn Error + Send + Sync>)?;
                writer
                    .write_event(Event::Text(BytesText::from_escaped(b"\n")))
                    .map_err(|e| Arc::new(e) as Arc<dyn Error + Send + Sync>)?;
            } else {
                // 如果是简单元素，直接写入值
                writer
                    .write_event(Event::Text(BytesText::from_escaped(value.as_bytes())))
                    .map_err(|e| Arc::new(e) as Arc<dyn Error + Send + Sync>)?;
            }
        }

        // 递归写入子元素
        for child in &element.children {
            self.write_element(writer, child, indent_level + 1)?;
        }

        if has_complex_content {
            // 如果是复杂元素，在结束标签前添加缩进
            writer
                .write_event(Event::Text(BytesText::from_escaped(indent.as_bytes())))
                .map_err(|e| Arc::new(e) as Arc<dyn Error + Send + Sync>)?;
        }

        // 写入结束标签
        writer
            .write_event(Event::End(BytesEnd::borrowed(element.name.as_bytes())))
            .map_err(|e| Arc::new(e) as Arc<dyn Error + Send + Sync>)?;

        // 在元素后添加换行（除非是简单元素）
        if has_complex_content || indent_level > 0 {
            writer
                .write_event(Event::Text(BytesText::from_escaped(b"\n")))
                .map_err(|e| Arc::new(e) as Arc<dyn Error + Send + Sync>)?;
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

    pub async fn get_all_item(&self) -> Vec<ItemConfigList> {
        let mut result = Vec::new();

        let config_read = self.config.read().unwrap(); // 在这个作用域中获取读锁
        if let Some(xml_config) = config_read.as_ref() {
            // 传递 xml_config 的引用到异步函数
            self.traverse_element(&xml_config.root, &mut result, true, None, None, None);
        }
        result
    }

    fn traverse_element(
        &self,
        element: &XmlElement,
        result: &mut Vec<ItemConfigList>,
        skip_id_check: bool,
        parent_protocol: Option<&String>,
        parent_region: Option<&String>,
        parent_dir: Option<&String>,
    ) {
        // 如果 skip_id_check 为 true，则跳过 id 检查
        if !skip_id_check && element.get_attribute("id").is_none() {
            return; // 如果不是 root 节点且没有 id 属性，则返回
        }

        // 处理当前元素
        if let Some(id_str) = element.get_attribute("id") {
            // 如果有 id 属性，将其解析并添加到结果中
            let protocol = element.get_attribute("protocol").or(parent_protocol);
            let region = element.get_attribute("region").or(parent_region);
            let name = element.get_child_text("name");
            let dir = element.get_attribute("dir").or(parent_dir);

            let item = ItemConfigList {
                item: id_str.clone(),
                name: name.clone(),
                protocol: protocol.cloned(),
                region: region.cloned(),
                dir: dir.cloned(),
            };
            result.push(item);
        }

        // 遍历子元素
        for child in element.get_children() {
            // 对子元素进行递归调用，并设置 skip_id_check 为 false
            self.traverse_element(
                &child,
                result,
                false,
                element.get_attribute("protocol"),
                element.get_attribute("region"),
                element.get_attribute("dir"),
            );
        }
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

    pub fn update_element(
        target_id: &str,
        protocol: &str,
        element: XmlElement,
    ) -> Result<(), String> {
        let find_protocol = protocol.to_uppercase();

        match find_protocol.as_str() {
            protocol if protocol.contains("CSG13") => {
                println!("更新 CSG13 配置");
                match GLOBAL_CSG13.as_ref() {
                    Ok(config) => config
                        .update_element(target_id, element)
                        .map_err(|e| format!("更新失败: {}", e)),
                    Err(_) => Err("CSG13 配置错误".to_string()),
                }
            }
            protocol if protocol.contains("DLT/645") => match GLOBAL_645.as_ref() {
                Ok(config) => config
                    .update_element(target_id, element)
                    .map_err(|e| format!("更新失败: {}", e)),
                Err(_) => Err("DLT/645 配置错误".to_string()),
            },
            protocol if protocol.contains("CSG16") => match GLOBAL_CSG16.as_ref() {
                Ok(config) => config
                    .update_element(target_id, element)
                    .map_err(|e| format!("更新失败: {}", e)),
                Err(_) => Err("CSG16 配置错误".to_string()),
            },
            _ => Err("不支持的协议类型".to_string()),
        }
    }
}
