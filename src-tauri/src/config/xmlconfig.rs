use std::collections::{HashMap, HashSet};
use std::error::Error;
use std::fs::File;
use std::io::BufReader;
use std::path::{Path, PathBuf};
use std::sync::{Arc, RwLock, RwLockReadGuard};

use lazy_static::lazy_static;
use quick_xml::events::Event;
use quick_xml::Reader;
use serde::{Deserialize, Serialize};
use tracing::info;

use crate::config::appconfig::load_config_value;

// 定义树节点结构
#[derive(Clone, Debug)]
pub struct XmlNode {
    // 基本数据
    id: Option<String>,
    id_name: Option<String>,
    name: String,
    value: Option<String>,
    attributes: HashMap<String, String>,

    // 树结构
    parent: Option<usize>, // 父节点的索引
    children: Vec<usize>,  // 子节点的索引列表

    // 用于快速查找的索引
    depth: u32,   // 节点深度
    path: String, // 从根节点到当前节点的路径
}

// 定义树结构
#[derive(Debug)]
pub struct XmlTree {
    nodes: Vec<XmlNode>,                             // 所有节点的存储
    root: usize,                                     // 根节点索引
    id_index: HashMap<String, HashSet<usize>>,       // id -> 节点索引的映射
    protocol_index: HashMap<String, HashSet<usize>>, // protocol -> 节点索引的映射
    region_index: HashMap<String, HashSet<usize>>,   // region -> 节点索引的映射
}

impl XmlTree {
    pub fn new() -> Self {
        XmlTree {
            nodes: Vec::new(),
            root: 0,
            id_index: HashMap::new(),
            protocol_index: HashMap::new(),
            region_index: HashMap::new(),
        }
    }

    // 添加节点
    pub fn add_node(&mut self, node: XmlNode) -> usize {
        let index = self.nodes.len();

        // 更新索引
        if let Some(id) = &node.id {
            self.id_index
                .entry(id.clone())
                .or_insert_with(HashSet::new)
                .insert(index);
        }

        // 使用节点自身的属性或继承自父节点的属性
        let protocol = node.attributes.get("protocol").cloned();
        if let Some(protocol) = protocol {
            self.protocol_index
                .entry(protocol)
                .or_insert_with(HashSet::new)
                .insert(index);
        }

        let region = node.attributes.get("region").cloned();
        if let Some(region) = region {
            self.region_index
                .entry(region)
                .or_insert_with(HashSet::new)
                .insert(index);
        }

        self.nodes.push(node);
        index
    }

    // 快速查找指定ID的节点
    pub fn find_by_id(&self, id: &str, protocol: &str, region: &str, dir: Option<u8>) -> Option<&XmlNode> {
        // 直接从索引中查找
        if let Some(node_indices) = self.id_index.get(id) {
            for &index in node_indices {
                let node = &self.nodes[index];
                if self.matches_criteria(
                    node,
                    protocol,
                    region,
                    dir,
                    self.protocol_index.get(protocol),
                    self.region_index.get(region),
                    if region != "南网" { self.region_index.get("南网") } else { None }
                ) {
                    return Some(node);
                }
            }
        }
        None
    }

    // 检查节点是否满足查询条件
    fn matches_criteria(
        &self,
        node: &XmlNode,
        protocol: &str,
        region: &str,
        dir: Option<u8>,
        protocol_nodes: Option<&HashSet<usize>>,
        region_nodes: Option<&HashSet<usize>>,
        south_grid_nodes: Option<&HashSet<usize>>,
    ) -> bool {
        let node_protocol = node.attributes.get("protocol");
        let node_region = node.attributes.get("region");
        let node_dir = node.attributes.get("dir").and_then(|d| d.parse::<u8>().ok());

        // 检查协议匹配
        let protocol_match = node_protocol.map_or(false, |p| p.eq_ignore_ascii_case(protocol));

        // 检查区域匹配
        let region_match = node_region.map_or(false, |r| {
            r.eq_ignore_ascii_case(region) || (region != "南网" && r.eq_ignore_ascii_case("南网"))
        });

        // 检查方向匹配，如果节点没有dir属性或者传入的dir为None，则认为匹配
        let dir_match = if dir.is_none() {
            // 如果没有指定dir，则不检查
            true
        } else if node_dir.is_none() {
            // 如果节点没有dir属性，则不检查
            true
        } else {
            // 如果都有，则必须匹配
            dir.unwrap() == node_dir.unwrap()
        };

        protocol_match && region_match && dir_match
    }

    // 获取节点的完整路径
    pub fn get_node_path(&self, index: usize) -> Vec<usize> {
        let mut path = Vec::new();
        let mut current = Some(index);

        while let Some(idx) = current {
            path.push(idx);
            current = self.nodes[idx].parent;
        }

        path.reverse();
        path
    }

    // 获取节点的所有子节点
    pub fn get_children(&self, index: usize) -> &[usize] {
        &self.nodes[index].children
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct XmlElement {
    pub name: String,
    pub attributes: HashMap<String, String>,
    pub value: Option<String>,
    pub children: Vec<XmlElement>,
}

impl XmlElement {
    // Helper method to trim value string
    fn trim_value(value: Option<String>) -> Option<String> {
        value
            .map(|v| {
                let trimmed = v.trim();
                if trimmed.is_empty() {
                    None
                } else {
                    Some(trimmed.to_string())
                }
            })
            .flatten()
    }

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
        self.get_child(name).and_then(|child| child.value.clone())
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

    fn get_name_node_value(&self) -> Option<&String> {
        self.children
            .iter()
            .find(|child| child.name == "name")
            .and_then(|name_node| name_node.value.as_ref())
    }

    fn is_matching_structure(&self, other: &XmlElement) -> bool {
        if self.name != other.name {
            return false;
        }

        match (self.get_name_node_value(), other.get_name_node_value()) {
            (Some(self_name_value), Some(other_name_value)) => self_name_value == other_name_value,
            _ => false,
        }
    }

    pub fn update_child(&mut self, new_child: &XmlElement) -> bool {
        for child in &mut self.children {
            if child.is_matching_structure(new_child) {
                let original_attrs = child.attributes.clone();
                *child = new_child.clone();
                child.attributes = original_attrs;
                return true;
            }
        }

        for child in &mut self.children {
            if child.update_child(new_child) {
                return true;
            }
        }

        false
    }
}

#[derive(Debug)]
pub struct XmlConfig {
    root: XmlElement,
}

pub struct QframeConfig {
    config: RwLock<Option<XmlTree>>,
    config_cache: RwLock<Cache>,
    config_path: RwLock<Option<PathBuf>>,
}

impl QframeConfig {
    pub fn new() -> Self {
        QframeConfig {
            config: RwLock::new(None),
            config_cache: RwLock::new(Cache::new()),
            config_path: RwLock::new(None),
        }
    }

    fn generate_cache_key(item_id: &str, protocol: &str, region: &str, dir: Option<u8>) -> String {
        match dir {
            Some(d) => format!("{}:{}:{}:{}", item_id, protocol, region, d),
            None => format!("{}:{}:{}", item_id, protocol, region),
        }
    }

    fn build_tree(&self, element: &XmlElement) -> XmlTree {
        let mut tree = XmlTree::new();

        fn build_recursive(
            tree: &mut XmlTree,
            element: &XmlElement,
            parent: Option<usize>,
            depth: u32,
            path: String,
            inherited_protocol: Option<String>,
            inherited_region: Option<String>,
        ) -> usize {
            // 合并当前节点和继承的属性
            let mut attributes = element.attributes.clone();
            let protocol = attributes.get("protocol").cloned().or(inherited_protocol.clone());
            let region = attributes.get("region").cloned().or(inherited_region.clone());
            
            // 更新属性
            if let Some(p) = &protocol {
                attributes.insert("protocol".to_string(), p.clone());
            }
            if let Some(r) = &region {
                attributes.insert("region".to_string(), r.clone());
            }

            let node = XmlNode {
                id: element.attributes.get("id").cloned(),
                id_name: element.get_child_text("name"),
                name: element.name.clone(),
                value: element.value.clone(),
                attributes,
                parent,
                children: Vec::new(),
                depth,
                path: path.clone(),
            };

            let node_index = tree.add_node(node);

            // 递归处理子节点，传递当前节点的属性
            for (i, child) in element.children.iter().enumerate() {
                let child_path = if path.is_empty() {
                    i.to_string()
                } else {
                    format!("{}.{}", path, i)
                };

                let child_index = build_recursive(
                    tree, 
                    child, 
                    Some(node_index), 
                    depth + 1, 
                    child_path,
                    protocol.clone(),
                    region.clone(),
                );

                tree.nodes[node_index].children.push(child_index);
            }

            node_index
        }

        tree.root = build_recursive(&mut tree, element, None, 0, String::new(), None, None);
        tree
    }

    pub fn load(&self, file_path: &Path) -> Result<(), Arc<dyn Error + Send + Sync>> {
        let file =
            File::open(file_path).map_err(|e| Arc::new(e) as Arc<dyn Error + Send + Sync>)?;
        let reader = BufReader::new(file);
        let mut xml_reader = Reader::from_reader(reader);
        let mut buf = Vec::new();
        let mut root = XmlElement {
            name: String::new(),
            attributes: HashMap::new(),
            value: None,
            children: Vec::new(),
        };
        let mut stack: Vec<XmlElement> = Vec::new();

        loop {
            match xml_reader.read_event(&mut buf) {
                Ok(Event::Start(ref e)) => {
                    let name = String::from_utf8_lossy(e.name()).to_string();
                    let mut attributes = HashMap::new();
                    for attr in e.attributes() {
                        if let Ok(attr) = attr {
                            let key = String::from_utf8_lossy(attr.key).to_string();
                            let value = String::from_utf8_lossy(&attr.value).to_string();
                            attributes.insert(key, value);
                        }
                    }
                    let element = XmlElement {
                        name,
                        attributes,
                        value: None,
                        children: Vec::new(),
                    };
                    if stack.is_empty() {
                        root = element.clone();
                    } else if let Some(parent) = stack.last_mut() {
                        let parent: &mut XmlElement = parent;
                        parent.children.push(element.clone());
                    }
                    stack.push(element);
                }
                Ok(Event::Text(e)) => {
                    if let Some(element) = stack.last_mut() {
                        element.value = Some(
                            e.unescape_and_decode(&xml_reader)
                                .map_err(|e| Arc::new(e) as Arc<dyn Error + Send + Sync>)?,
                        );
                    }
                }
                Ok(Event::End(_)) => {
                    if let Some(element) = stack.pop() {
                        if let Some(parent) = stack.last_mut() {
                            if let Some(last) = parent.children.last_mut() {
                                *last = element;
                            }
                        } else {
                            root = element;
                        }
                    }
                }
                Ok(Event::Eof) => break,
                Err(e) => return Err(Arc::new(e)),
                _ => (),
            }
            buf.clear();
        }

        let tree = self.build_tree(&root);
        *self.config.write().unwrap() = Some(tree);
        *self.config_path.write().unwrap() = Some(file_path.to_path_buf());

        Ok(())
    }

    pub fn get_item(
        &self,
        item_id: &str,
        protocol: &str,
        region: &str,
        dir: Option<u8>,
    ) -> Option<XmlElement> {
        println!("item_id: {}, protocol: {}, region: {}, dir: {:?}", item_id, protocol, region, dir);
        let cache_key = Self::generate_cache_key(item_id, protocol, region, dir);
        {
            let cache = self.config_cache.read().unwrap();
            if let Some(cached_result) = cache.get(&cache_key) {
                return cached_result.clone();
            }
        }

        let config = self.config.read().unwrap();
        if let Some(tree) = config.as_ref() {
            if let Some(node) = tree.find_by_id(item_id, protocol, region, dir) {
                let result = Some(self.node_to_element(tree, node));
                let mut cache = self.config_cache.write().unwrap();
                cache.insert(cache_key, result.clone());
                return result;
            }
            if let Some(node) = tree.find_by_id(item_id, protocol, "南网", dir) {
                let result = Some(self.node_to_element(tree, node));
                let mut cache = self.config_cache.write().unwrap();
                cache.insert(cache_key, result.clone());
                return result;
            }
        }
        None
    }

    fn node_to_element(&self, tree: &XmlTree, node: &XmlNode) -> XmlElement {
        let mut element = XmlElement {
            name: node.name.clone(),
            attributes: node.attributes.clone(),
            value: XmlElement::trim_value(node.value.clone()),
            children: Vec::new(),
        };

        for &child_index in &node.children {
            let child_node = &tree.nodes[child_index];
            element
                .children
                .push(self.node_to_element(tree, child_node));
        }

        element
    }

    pub fn get_config(&self) -> RwLockReadGuard<Option<XmlTree>> {
        self.config.read().unwrap()
    }

    pub async fn get_all_item(&self) -> Vec<ItemConfigList> {
        let mut result = Vec::new();
        let config_read = self.config.read().unwrap();
        if let Some(xml_config) = config_read.as_ref() {
            // Pre-allocate vector with a reasonable capacity
            result.reserve(xml_config.nodes.len());
            self.traverse_element_optimized(xml_config, &mut result);
        }
        result
    }

    fn traverse_element_optimized(&self, xml_tree: &XmlTree, result: &mut Vec<ItemConfigList>) {
        let mut stack = vec![(
            xml_tree.root,
            None::<String>,
            None::<String>,
            None::<String>,
        )];

        while let Some((node_index, parent_protocol, parent_region, parent_dir)) = stack.pop() {
            let node = &xml_tree.nodes[node_index];

            if node_index != xml_tree.root && node.id.is_none() {
                continue;
            }

            if let Some(id_str) = &node.id {
                let protocol = node
                    .attributes
                    .get("protocol")
                    .map(String::as_str)
                    .map(String::from)
                    .or(parent_protocol);

                let region = node
                    .attributes
                    .get("region")
                    .map(String::as_str)
                    .map(String::from)
                    .or(parent_region);

                let dir = node
                    .attributes
                    .get("dir")
                    .map(String::as_str)
                    .map(String::from)
                    .or(parent_dir);

                let name = node.id_name.clone();

                result.push(ItemConfigList {
                    item: id_str.clone(),
                    name,
                    protocol,
                    region,
                    dir,
                });
            }

            // Push children to stack in reverse order to maintain original traversal order
            for &child_index in node.children.iter().rev() {
                stack.push((
                    child_index,
                    node.attributes.get("protocol").map(String::from),
                    node.attributes.get("region").map(String::from),
                    node.attributes.get("dir").map(String::from),
                ));
            }
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
    pub item: String,
    pub name: Option<String>,
    pub protocol: Option<String>,
    pub region: Option<String>,
    pub dir: Option<String>,
}

lazy_static! {
    pub static ref GLOBAL_CSG13: Result<QframeConfig, Arc<dyn std::error::Error + Send + Sync>> = {
        let config = QframeConfig::new();
        let default_path = "./resources/protocolconfig/CSG13.xml".to_string();

        let setpath = load_config_value("ProtocolSetting", "protocolfile")
            .and_then(|protocol_config| {
                protocol_config
                    .get("nanwang13")
                    .and_then(|protocol| protocol.get("path"))
                    .and_then(|path| path.as_str())
                    .map(String::from)
            })
            .unwrap_or(default_path);

        match config.load(Path::new(&setpath)) {
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
        let default_path = "./resources/protocolconfig/DLT645.xml".to_string();

        let setpath = load_config_value("ProtocolSetting", "protocolfile")
            .and_then(|protocol_config| {
                protocol_config
                    .get("dlt645")
                    .and_then(|protocol| protocol.get("path"))
                    .and_then(|path| path.as_str())
                    .map(String::from)
            })
            .unwrap_or(default_path);

        match config.load(Path::new(&setpath)) {
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
        let default_path = "./resources/protocolconfig/CSG16.xml".to_string();

        let setpath = load_config_value("ProtocolSetting", "protocolfile")
            .and_then(|protocol_config| {
                protocol_config
                    .get("nanwang16")
                    .and_then(|protocol| protocol.get("path"))
                    .and_then(|path| path.as_str())
                    .map(String::from)
            })
            .unwrap_or(default_path);

        match config.load(Path::new(&setpath)) {
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
    pub static ref GLOBAL_Moudle: Result<QframeConfig, Arc<dyn std::error::Error + Send + Sync>> = {
        let config = QframeConfig::new();
        let default_path = "./resources/protocolconfig/MOUDLE.xml".to_string();

        let setpath = load_config_value("ProtocolSetting", "protocolfile")
            .and_then(|protocol_config| {
                protocol_config
                    .get("moudle")
                    .and_then(|protocol| protocol.get("path"))
                    .and_then(|path| path.as_str())
                    .map(String::from)
            })
            .unwrap_or(default_path);
        println!("moudle XML 路径: {}", setpath);
        match config.load(Path::new(&setpath)) {
            Ok(_) => {
                println!("moudle XML 加载成功");
                Ok(config)
            }
            Err(e) => {
                println!("moudle XML 加载失败: {}", e);
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
                GLOBAL_CSG13
                    .as_ref()
                    .ok()?
                    .get_item(data_item_id, protocol, region, dir)
            }
            protocol if protocol.contains("DLT/645") => {
                GLOBAL_645
                    .as_ref()
                    .ok()?
                    .get_item(data_item_id, protocol, region, dir)
            }
            protocol if protocol.contains("CSG16") => {
                GLOBAL_CSG16
                    .as_ref()
                    .ok()?
                    .get_item(data_item_id, protocol, region, dir)
            }
            protocol if protocol.contains("MOUDLE") => {
                GLOBAL_Moudle
                    .as_ref()
                    .ok()?
                    .get_item(data_item_id, protocol, region, dir)
            }
            _ => None,
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
            protocol if protocol.contains("CSG13") => GLOBAL_CSG13
                .as_ref()
                .ok()?
                .get_item(template, protocol, region, dir),
            protocol if protocol.contains("DLT/645") => GLOBAL_645
                .as_ref()
                .ok()?
                .get_item(template, protocol, region, dir),
            protocol if protocol.contains("CSG16") => GLOBAL_CSG16
                .as_ref()
                .ok()?
                .get_item(template, protocol, region, dir),
            protocol if protocol.contains("MOUDLE") => GLOBAL_Moudle
                .as_ref()
                .ok()?
                .get_item(template, protocol, region, dir),
            _ => None,
        }
    }

    pub fn update_element(
        item: &String,
        protocol: &str,
        element: &XmlElement,
    ) -> Result<(), std::io::Error> {
        let region = element.get_attribute("region");
        let dir = element.get_attribute("dir");

        let region = if let Some(region) = region {
            region
        } else {
            "南网"
        };
        let dir = if let Some(dir) = dir {
            Some(dir.parse::<u8>().unwrap())
        } else {
            None
        };
        if let Some(mut current_element) =
            ProtocolConfigManager::get_config_xml(item, protocol, &region, dir)
        {
            current_element.update_child(element);
            Ok(())
        } else {
            Err(std::io::Error::new(
                std::io::ErrorKind::NotFound,
                "Element not found",
            ))
        }
    }
}
