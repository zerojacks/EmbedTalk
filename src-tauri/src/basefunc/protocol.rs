use crate::basefunc::frame_645::Frame645;
use crate::basefunc::frame_cco::FrameCCO;
use crate::basefunc::frame_csg::FrameCsg;
use crate::basefunc::frame_fun::FrameFun;
use crate::basefunc::frame_moudle::FrameMoudle;
use crate::basefunc::frame_speecial::SpcialFrame;
use crate::basefunc::frame_tctask::TCMeterTask;
use crate::config::xmlconfig::{ProtocolConfigManager, XmlElement};
use regex::Regex;
use serde_json::{json, Value};

#[derive(Debug)]
pub enum AnalysicErr {
    ErrOk = 0,
    ErrLength = 1,
    ErrFcs = 2,
    ErrItem = 3,
}

#[derive(Debug)]
pub enum ProtocolInfo {
    ProtocolCSG13,
    ProtocolCSG16,
    ProtocolDLT64507,
    ProtocolMoudle,
    ProtocolMS,
    ProtocolHis,
}

impl ProtocolInfo {
    pub fn name(&self) -> &str {
        match self {
            ProtocolInfo::ProtocolCSG13 => "CSG13",
            ProtocolInfo::ProtocolCSG16 => "CSG16",
            ProtocolInfo::ProtocolDLT64507 => "DLT/645-2007",
            ProtocolInfo::ProtocolMoudle => "moudle",
            ProtocolInfo::ProtocolMS => "MS",
            ProtocolInfo::ProtocolHis => "His"
        }
    }
}

pub struct FrameAnalisyic;

impl FrameAnalisyic {
    pub fn process_frame(frame: &[u8], region: &str) -> (String, Vec<Value>) {
        let mut parsed_data: Vec<Value> = Vec::new();
        let mut protocol = String::from("Unknown");
        if FrameCsg::is_csg_frame(frame) {
            let result = FrameCsg::analysic_csg_frame_by_afn(frame, &mut parsed_data, 0, region);
            protocol = ProtocolInfo::ProtocolCSG13.name().to_string();
            match result {
                Ok(_) => {}
                Err(_) => {}
            }
        } else if Frame645::is_dlt645_frame(frame) {
            protocol = ProtocolInfo::ProtocolDLT64507.name().to_string();
            let result = Frame645::analysic_645_frame_by_afn(frame, &mut parsed_data, 0, region);
        } else if FrameCCO::is_cco_frame(frame) {
            protocol = ProtocolInfo::ProtocolCSG16.name().to_string();
            FrameCCO::analysic_cco_frame_by_afn(frame, &mut parsed_data, 0, region);
        } else if FrameMoudle::is_moudle_frame(frame) {
            protocol = ProtocolInfo::ProtocolMoudle.name().to_string();
            FrameMoudle::analysic_moudle_frame(frame, &mut parsed_data, 0, region);
        } else if TCMeterTask::is_meter_task(frame) {
            protocol = ProtocolInfo::ProtocolMS.name().to_string();
            let result = TCMeterTask::analysic_meter_task(frame, &mut parsed_data, 0, region);
            match result {
                Ok(_) => {}
                Err(_) => {}
            }
        } else if SpcialFrame::is_special_frame(frame, region) {
            protocol = ProtocolInfo::ProtocolHis.name().to_string();
            let result = SpcialFrame::analysic_special_frame(frame, &mut parsed_data, 0, region);
            match result {
                Ok(_) => {}
                Err(_) => {}
            }
        }

        (protocol, parsed_data)
    }
    pub fn prase_data(
        data_item_elem: &mut XmlElement,
        protocol: &str,
        region: &str,
        data_segment: &[u8],
        index: usize,
        dir: Option<u8>,
    ) -> Vec<Value> {
        // 根据xml配置解析数据
        let parsed_data: Vec<Value>;

        // 假设 ConfigManager 是你自己的结构体，并且 get_config_xml 是其方法
        println!(
            "prase_data data_item_elem: {:?} data_segment{:?}",
            data_item_elem, data_segment
        );
        let need_delete = protocol == ProtocolInfo::ProtocolDLT64507.name();
        println!("need_delete: {:?}", need_delete);
        parsed_data = Self::prase_data_item(
            data_item_elem,
            data_segment,
            index,
            need_delete,
            protocol,
            region,
            dir,
        );
        parsed_data
    }
    pub fn prase_data_item(
        data_item_elem: &mut XmlElement,
        data_segment: &[u8],
        index: usize,
        need_delete: bool,
        protocol: &str,
        region: &str,
        dir: Option<u8>,
    ) -> Vec<Value> {
        let mut result: Vec<Value> = Vec::new();

        if data_segment.is_empty() {
            return result;
        }

        let data_item_id = data_item_elem.get_attribute("id");
        let data_item_name = data_item_elem.get_child_text("name");

        let sub_data_item = data_item_elem.get_items("dataItem");
        let sub_data_segment = data_segment;
        let mut pos: usize;
        let sub_item_result: Option<Vec<Value>>;
        let mut cur_length = data_segment.len();
        let mut color: Option<String> = None;
        let item_name = Self::get_item_name_str(data_item_id, data_item_name.clone());

        let data_str = FrameFun::get_data_str(&data_segment, need_delete, true, false);
        let mut result_str = if let Some(item_name_text) = data_item_name.as_ref() {
            format!("[{}]: {}", item_name_text, data_str)
        } else {
            data_str
        };

        println!(
            "prase_data_item data_segment{:?} {:?}",
            data_segment, data_item_elem
        );

        if !sub_data_item.is_empty() {
            let (sub_result, length) = Self::process_all_item(
                data_item_elem,
                sub_data_segment,
                index,
                need_delete,
                protocol,
                region,
                dir,
            );
            sub_item_result = Some(sub_result);
            cur_length = length;
            println!(
                "sub_item_result {:?} cur_length: {:?}",
                sub_item_result, cur_length
            );
        } else if data_item_elem.get_child("unit").is_some()
            && data_item_elem.get_child("value").is_some()
        {
            let (cur_result, sub_result, length, cur_color) = Self::prase_value_item(
                data_item_elem,
                sub_data_segment,
                index,
                need_delete,
                protocol,
                region,
                dir,
            );
            result_str = format!("{}", cur_result);
            sub_item_result = sub_result;
            cur_length = length;
            color = cur_color;
        } else if data_item_elem.get_child("unit").is_some() {
            let (cur_result, sub_result, length) = Self::prase_singal_item(
                data_item_elem,
                sub_data_segment,
                index,
                need_delete,
                protocol,
                region,
                dir,
            );
            result_str = format!("[{}]: {}", item_name, cur_result);
            sub_item_result = sub_result;
            cur_length = length;
        } else if data_item_elem.get_child("value").is_some() {
            let (cur_result, sub_result, length, cur_color) = Self::prase_value_item(
                data_item_elem,
                sub_data_segment,
                index,
                need_delete,
                protocol,
                region,
                dir,
            );
            result_str = format!("{}", cur_result);
            sub_item_result = sub_result;
            cur_length = length;
            color = cur_color;
        } else if data_item_elem.get_child("time").is_some() {
            let (cur_result, sub_result, length) = Self::prase_time_item(
                data_item_elem,
                sub_data_segment,
                index,
                need_delete,
                protocol,
                region,
                dir,
            );
            result_str = format!("[{}]: {}", item_name, cur_result);
            sub_item_result = sub_result;
            cur_length = length;
        } else if data_item_elem.get_child("splitbit").is_some() {
            let (sub_result, length) = Self::parse_bitwise_data(
                data_item_elem,
                sub_data_segment,
                index,
                need_delete,
                protocol,
                region,
                dir,
            );
            sub_item_result = Some(sub_result);
            cur_length = length;
        } else if data_item_elem.get_child("splitByLength").is_some() {
            let (sub_result, length) = Self::prase_split_by_length_item(
                &data_item_elem,
                sub_data_segment,
                index,
                need_delete,
                protocol,
                region,
                dir,
            );
            sub_item_result = Some(sub_result);
            cur_length = length;
        } else if data_item_elem.get_child("itembox").is_some() {
            let (sub_result, length) = Self::prase_item_box(
                data_item_elem,
                sub_data_segment,
                index,
                need_delete,
                protocol,
                region,
                dir,
            );
            sub_item_result = Some(sub_result);
            cur_length = length;
        } else if data_item_elem.get_child("indelength").is_some() {
            let length = data_segment.len();
            let length_vaue = format!("{}", length);
            let length_elem = data_item_elem.find_child_by_attribute("len", &length_vaue);
            if let Some(length_elem) = length_elem {
                let sub_result = Self::prase_data_item(
                    &mut length_elem.clone(),
                    data_segment,
                    index,
                    need_delete,
                    protocol,
                    region,
                    dir,
                );
                sub_item_result = Some(sub_result);
            } else {
                sub_item_result = None;
            }
        } else if data_item_elem.get_child("type").is_some() {
            let mut subitem_length = 0;
            if data_item_elem.get_child("length").is_some() {
                let sub_length_txt = data_item_elem.get_child_text("length");
                match sub_length_txt {
                    Some(sub_length_txt) => match sub_length_txt.to_uppercase().as_str() {
                        "UNKNOWN" => {
                            subitem_length = FrameCsg::calculate_item_length(
                                data_item_elem,
                                &sub_data_segment,
                                protocol,
                                region,
                                dir,
                                None,
                            );
                        }
                        _ => {
                            subitem_length = sub_length_txt.parse::<usize>().unwrap();
                        }
                    },
                    _ => {
                        let item_box = data_item_elem.get_items("item");
                        if item_box.len() > 0 {
                            subitem_length =
                                Self::caculate_item_box_length(item_box, protocol, region, dir);
                        }
                    }
                }
            } else {
                subitem_length = sub_data_segment.len();
            }
            println!(
                "sub_data_segment:{:?} subitem_length:{} data_item_elem{:?}",
                sub_data_segment, subitem_length, data_item_elem
            );

            let (cur_result, sub_result, length) = Self::prase_type_item(
                &data_item_elem,
                sub_data_segment,
                index,
                need_delete,
                subitem_length,
                protocol,
                region,
                dir,
            );
            result_str = format!("[{}]: {}", item_name, cur_result);
            sub_item_result = sub_result;
            cur_length = length;
        } else {
            let (cur_result, sub_result, length) = Self::prase_singal_item(
                data_item_elem,
                sub_data_segment,
                index,
                need_delete,
                protocol,
                region,
                dir,
            );
            result_str = format!("[{}]: {}", item_name, cur_result);
            sub_item_result = sub_result;
            cur_length = length;
        }
        FrameFun::add_data(
            &mut result,
            item_name,
            FrameFun::get_data_str(&data_segment, false, false, false),
            result_str,
            vec![index, index + cur_length],
            sub_item_result,
            color,
        );

        result
    }

    pub fn process_all_item(
        data_item_elem: &XmlElement,
        data_segment: &[u8],
        index: usize,
        need_delete: bool,
        protocol: &str,
        region: &str,
        dir: Option<u8>,
    ) -> (Vec<Value>, usize) {
        let mut sub_item_result: Vec<Value> = Vec::new();
        let mut total_length: usize = 0;

        if data_segment.is_empty() {
            return (sub_item_result, total_length);
        }
        let data_item_id = data_item_elem.get_attribute("id");
        let data_item_name = data_item_elem.get_child_text("name");

        let color: Option<String> = None;

        let sub_data_item = data_item_elem.get_items("dataItem");
        let mut sub_data_segment = data_segment;
        let mut pos = 0;
        for data_item in sub_data_item {
            let sub_data_item_id = data_item.get_attribute("id");
            let sub_data_item_name = data_item.get_child_text("name");
            let sub_item_length = data_item.get_child_text("length");
            let mut description = String::new();

            if let Some(sub_item_length_str) = sub_item_length {
                let sub_item_length = match sub_item_length_str.parse::<usize>() {
                    Ok(len) => len,
                    Err(_) => continue, // 解析失败时跳过当前项
                };

                if sub_item_length > sub_data_segment.len() {
                    break;
                }

                let mut sub_item_data = sub_data_segment[..sub_item_length].to_vec();
                if data_item.get_child_text("name") == Some("splitByLength".to_string()) {
                    sub_item_data.truncate(sub_item_length);
                }

                let cur_result = Self::prase_data_item(
                    &mut data_item.clone(),
                    &sub_item_data,
                    index + pos,
                    need_delete,
                    protocol,
                    region,
                    dir,
                );

                if let Some(name) = sub_data_item_name {
                    description.push_str(&name);
                }
                if let Some(id) = sub_data_item_id {
                    if !description.is_empty() {
                        description.push_str("-");
                    }
                    description.push_str(&id);
                }

                // FrameFun::add_data(
                //     &mut sub_item_result, // Pass mutable reference
                //     FrameFun::get_data_str(&sub_item_data, false, false, true),
                //     FrameFun::get_data_str(&sub_item_data, false, false, false),
                //     description, // Pass ownership of String
                //     vec![index + pos, index + pos + sub_item_length],
                //     Some(cur_result), // Wrap Vec<Value> in Some
                //     color.clone() // Clone the color option
                // );
                sub_item_result.extend(cur_result);

                total_length += sub_item_length; // Update total_length

                sub_data_segment = &sub_data_segment[sub_item_length..];
                pos += sub_item_length; // Ensure pos is updated
            }
        }
        (sub_item_result, total_length) // Return both results
    }

    pub fn prase_value_item(
        data_item_elem: &mut XmlElement,
        data_segment: &[u8],
        index: usize,
        need_delete: bool,
        protocol: &str,
        region: &str,
        dir: Option<u8>,
    ) -> (
        String,
        Option<Vec<serde_json::Value>>,
        usize,
        Option<String>,
    ) {
        // 使用 prase_singal_item 函数获取值
        let item_length: usize;
        let item_length_content = data_item_elem.get_child_text("length");
        if let Some(item_length_content) = item_length_content {
            if item_length_content.to_uppercase() == "UNKNOWN" {
                item_length = FrameCsg::calculate_item_length(
                    data_item_elem,
                    data_segment,
                    protocol,
                    region,
                    dir,
                    None,
                );
            } else {
                item_length = item_length_content.parse::<usize>().unwrap();
            }
        } else {
            item_length = data_segment.len();
        }
        let (parse_value, sub_item_result, _len) = Self::prase_singal_item(
            data_item_elem,
            data_segment,
            index,
            need_delete,
            protocol,
            region,
            dir,
        );
        println!("parse_value: {:?}", parse_value);
        let re = Regex::new(r"^([^\s]+)\s").unwrap();
        let value = if let Some(cap) = re.captures(&parse_value) {
            cap.get(1)
                .map_or_else(|| parse_value.clone(), |m| m.as_str().to_string())
        } else {
            parse_value
        };

        // 查找对应的 value 元素
        let mut value_name: String;
        let item_name = data_item_elem.get_child("name");
        if let Some(item_name) = item_name {
            let item_name = item_name.get_value().unwrap();
            value_name = item_name
        } else {
            value_name = value.clone();
        }

        let color: Option<String>;

        // 获取所有 `value` 子元素
        let value_elements = data_item_elem.get_items("value");
        let (value_str, element) = Self::find_value_from_elements(&value_elements, &value);

        value_name = if value_str.is_empty() {
            format!("[{}]: {}", value_name, value)
        } else {
            format!("[{}]: {}", value_name, value_str)
        };
        // 获取 color 属性并使用 `.cloned()` 将 Option<&String> 转换为 Option<String>
        color = data_item_elem.get_attribute("color").cloned();

        // Return a tuple matching the expected return type
        (value_name, sub_item_result, item_length, color)
    }

    pub fn find_value_from_elements(
        value_elements: &[XmlElement],
        search_value: &str,
    ) -> (String, Option<XmlElement>) {
        let mut found_value = search_value.to_string();

        println!("value_elements: {:?}", found_value);
        // First pass: Look for a key that matches `search_value`
        for value_elem in value_elements.iter() {
            if let Some(key) = value_elem.get_attribute("key") {
                if key == search_value {
                    // If a matching key is found, get the associated value
                    found_value = value_elem
                        .get_value()
                        .unwrap_or_else(|| search_value.to_string());
                    return (found_value, Some(value_elem.clone())); // Return immediately upon finding a match
                }
            }
        }

        // Second pass: If no matching key was found, check for "other"
        for value_elem in value_elements.iter() {
            if let Some(key) = value_elem.get_attribute("key") {
                if key == "other" {
                    // If key is "other", use its associated value
                    found_value = value_elem
                        .get_value()
                        .unwrap_or_else(|| search_value.to_string());
                    return (found_value, Some(value_elem.clone())); // Return immediately upon finding a match
                }
            }
        }

        (found_value, None)
    }

    pub fn prase_singal_item(
        data_item_elem: &XmlElement,
        data_segment: &[u8],
        index: usize,
        need_delete: bool,
        protocol: &str,
        region: &str,
        dir: Option<u8>,
    ) -> (String, Option<Vec<Value>>, usize) {
        let sub_item_result: Option<Vec<Value>>;

        let subitem_name = data_item_elem.get_child_text("name").unwrap_or_default();
        let splitbit_elem = data_item_elem.get_child("splitbit");

        let mut subitem_value = String::new();
        let mut pos = data_segment.len();
        if data_item_elem.get_child("unit").is_some() {
            // 解析有单位的数据
            let subitem_unit = data_item_elem.get_child_text("unit").unwrap_or_default();
            let subitem_value_option = Self::prase_simple_type_data(
                data_item_elem,
                data_segment,
                index,
                need_delete,
                protocol,
                region,
                dir,
            );
            println!("subitem_value_option: {:?}", subitem_value_option);
            if let Some(value) = subitem_value_option {
                subitem_value = format!("{} {}", value, subitem_unit);
                println!("subitem_value : {:?}", subitem_value);
            } else {
                println!("normal change: {:?}", subitem_value);
                let subitem_decimal = data_item_elem.get_child_text("decimal");
                let is_sign = data_item_elem.get_child_text("sign");

                let decimal = subitem_decimal
                    .as_deref()
                    .unwrap_or("0")
                    .parse::<usize>()
                    .unwrap_or(0);
                let sign = is_sign.as_deref().unwrap_or("no") == "yes";

                subitem_value = FrameFun::bcd_to_decimal(data_segment, decimal, need_delete, sign);

                if subitem_value != "无效数据" {
                    subitem_value = format!("{} {}", subitem_value, subitem_unit);
                }
            }
            sub_item_result = None;
        } else if data_item_elem.get_child("time").is_some() {
            // 解析时间数据
            let subitem_time_format = data_item_elem.get_child_text("time").unwrap_or_default();
            let subitem_type = data_item_elem.get_child_text("type").unwrap_or_default();

            let time_data: &[u8];
            let bcd_data: Vec<u8>;
            if ["BIN", "Bin", "bin"].contains(&subitem_type.as_str()) {
                // Store the result in a variable
                bcd_data = FrameFun::binary_to_bcd(&data_segment[..6]);
                // Create a slice from the stored vector
                time_data = &bcd_data;
            } else {
                // Directly create a slice from data_segment
                time_data = &data_segment[..6];
            }

            subitem_value = FrameFun::parse_time_data(time_data, &subitem_time_format, need_delete);
            sub_item_result = None;
        } else if let Some(splitbit_elem) = splitbit_elem {
            // 解析按位数据
            let (result, length) = Self::parse_bitwise_data(
                &splitbit_elem,
                data_segment,
                index,
                need_delete,
                protocol,
                region,
                dir,
            );
            sub_item_result = Some(result);
            pos = length;
        } else {
            // 简单数据，直接转为十进制数
            let subitem_decimal = data_item_elem.get_child_text("decimal");
            let is_sign = data_item_elem.get_child_text("sign");

            let decimal = subitem_decimal
                .as_deref()
                .unwrap_or("0")
                .parse::<usize>()
                .unwrap_or(0);
            let sign = is_sign.as_deref().unwrap_or("no") == "yes";

            let ret = Self::prase_simple_type_data(
                data_item_elem,
                data_segment,
                index,
                need_delete,
                protocol,
                region,
                dir,
            );
            println!(
                "ret: {:?}, data_segment: {:?}, data_item_elem: {:?}",
                ret, data_segment, data_item_elem
            );
            if let Some(value) = ret {
                subitem_value = value;
            } else {
                subitem_value = FrameFun::bcd_to_decimal(data_segment, decimal, need_delete, sign);
            }
            sub_item_result = None;
        }
        (subitem_value, sub_item_result, pos)
    }

    pub fn prase_simple_type_data(
        data_item_elem: &XmlElement,
        data_segment: &[u8],
        index: usize,
        need_delete: bool,
        protocol: &str,
        region: &str,
        dir: Option<u8>,
    ) -> Option<String> {
        let subitem_decimal = data_item_elem.get_child_text("decimal");
        let is_sign = data_item_elem.get_child_text("sign");

        let decimal = subitem_decimal
            .as_deref()
            .unwrap_or("0")
            .parse::<usize>()
            .unwrap_or(0);
        let sign = is_sign.as_deref().unwrap_or("no") == "yes";

        let subitem_type = data_item_elem
            .get_child_text("type")
            .unwrap_or_else(|| "BCD".to_string());
        println!("subitem_type: {:?}", subitem_type);
        let subitem_value = match subitem_type.to_uppercase().as_str() {
            "BCD" => FrameFun::bcd_to_decimal(data_segment, decimal, need_delete, sign),
            "BIN" => FrameFun::bin_to_decimal(data_segment, decimal, need_delete, sign, true),
            "BIN_FF" => FrameFun::bin_to_decimal(data_segment, decimal, need_delete, sign, false),
            "ASCII" => FrameFun::ascii_to_str(data_segment),
            "PORT" => FrameFun::prase_port(data_segment),
            "IP" => FrameFun::prase_ip_str(data_segment),
            "BIN_BE" => FrameFun::prase_bin_be_deciml(data_segment, decimal, need_delete, sign, true),
            "NORMAL" => FrameFun::get_data_str(&data_segment, need_delete, true, false),
            _ => return None, // 不支持的类型返回 None
        };
        println!("subitem_value: {:?}", subitem_value);
        Some(subitem_value)
    }

    pub fn parse_bitwise_data(
        splitbit_elem: &XmlElement,
        data_segment: &[u8],
        index: usize,
        need_delete: bool,
        protocol: &str,
        region: &str,
        dir: Option<u8>,
    ) -> (Vec<Value>, usize) {
        let mut sub_item_result: Vec<Value> = Vec::new();
        let pos = data_segment.len();

        let all_bits = splitbit_elem.get_items("bit");
        for bit_elem in all_bits.iter() {
            let bit_id_attr = bit_elem.get_attribute("id").unwrap();
            let bit_name_elem = bit_elem.get_child_text("name");

            let (start_bit, end_bit) = if bit_id_attr.contains('-') {
                let parts: Vec<&str> = bit_id_attr.split('-').collect();
                (
                    parts[0].parse::<usize>().unwrap(),
                    parts[1].parse::<usize>().unwrap(),
                )
            } else {
                let bit = bit_id_attr.parse::<usize>().unwrap();
                (bit, bit)
            };

            let start_pos = start_bit / 8;
            let end_pos = end_bit / 8 + 1;
            let check_start_bit = start_bit % 8;
            let check_end_bit = end_bit % 8;
            let bit_value = FrameFun::extract_bits(
                check_start_bit,
                check_end_bit,
                FrameFun::hex_array_to_int(&data_segment[start_pos..end_pos], need_delete),
            );
            let value_elements = bit_elem.get_items("value");
            let (mut value_name, element) =
                Self::find_value_from_elements(&value_elements, &bit_value);

            let bit_id_attr = format!("bit{}", bit_id_attr);
            let name_str = if let Some(name_elem) = bit_name_elem {
                name_elem
            } else {
                bit_id_attr.clone()
            };
            let coclor = if element.is_some() {
                element.as_ref().unwrap().get_attribute("color").cloned()
            } else {
                None
            };

            value_name = format!("[{}]: {}", name_str, value_name);

            FrameFun::add_data(
                &mut sub_item_result, // Pass mutable reference here
                bit_id_attr,
                bit_value,
                value_name,
                vec![index + start_pos, index + end_pos],
                None,
                coclor, // Assuming you want `None` here
            );
        }

        (sub_item_result, pos)
    }

    pub fn prase_time_item(
        data_item_elem: &XmlElement,
        data_segment: &[u8],
        index: usize,
        need_delete: bool,
        protocol: &str,
        region: &str,
        dir: Option<u8>,
    ) -> (String, Option<Vec<Value>>, usize) {
        // 获取 time 格式和 type
        let subitem_time_format = data_item_elem.get_child_text("time");
        let subitem_type = data_item_elem.get_child_text("type");

        let time_format = match subitem_time_format {
            Some(ref subitem_time_format) => subitem_time_format.as_str(),
            None => "ssmmhhWWDDMMYYCC",
        };
        // 默认为 "BCD" 类型
        let data_type = match subitem_type {
            Some(ref subitem_type) => subitem_type.as_str(),
            None => "BCD",
        };

        // 确保 data_segment 长度足够处理时间数据
        let time_data: &[u8] = if data_segment.len() >= 6 {
            &data_segment[..6]
        } else {
            data_segment
        };

        // 判断 data_type 并根据类型转换数据
        let processed_time_data = match data_type {
            "BIN" | "Bin" | "bin" => FrameFun::binary_to_bcd(time_data),
            _ => time_data.to_vec(), // 默认返回原始数据
        };

        // 解析时间数据
        let result_str = FrameFun::parse_time_data(&processed_time_data, time_format, need_delete);

        // 返回结果
        let cur_length = data_segment.len(); // 假设时间数据占用6字节

        (result_str, None, cur_length)
    }

    pub fn get_item_name_str(item_id: Option<&String>, item_name: Option<String>) -> String {
        // name_str 为item_id_item_name的字符串
        let mut name_str = String::new();
        if let Some(id) = item_id {
            name_str.push_str(id);
        }
        if let Some(name) = item_name {
            if !name_str.is_empty() {
                name_str.push_str("_");
            }
            name_str.push_str(&name);
        }
        name_str
    }
    pub fn prase_split_by_length_item(
        data_item_elem: &XmlElement,
        data_segment: &[u8],
        index: usize,
        need_delete: bool,
        protocol: &str,
        region: &str,
        dir: Option<u8>,
    ) -> (Vec<Value>, usize) {
        let mut result: Vec<Value> = Vec::new();

        if data_segment.is_empty() {
            return (result, 0);
        }

        let data_item_id = data_item_elem.get_attribute("id");
        let data_item_name = data_item_elem.get_child_text("name");

        let item_name = Self::get_item_name_str(data_item_id, data_item_name);
        let mut color: Option<String> = None;

        let all_splitlength_items = data_item_elem.get_items("splitByLength");
        let mut sub_data_segment = data_segment;
        let mut pos = 0;
        let mut sub_item_result: Option<Vec<Value>>;
        let mut cur_length: usize;
        let mut result_str: String;

        let mut subitem_length: usize;
        if data_item_elem.get_child("splitbit").is_some() {
            let (sub_result, length) = Self::parse_bitwise_data(
                data_item_elem,
                sub_data_segment,
                index,
                need_delete,
                protocol,
                region,
                dir,
            );
            sub_item_result = Some(sub_result);

            FrameFun::add_data(
                &mut result, // Pass mutable reference here
                item_name,
                FrameFun::get_data_str(&data_segment, false, false, true),
                FrameFun::get_data_str(&data_segment, false, false, false),
                vec![index, index + data_segment.len()],
                sub_item_result.clone(),
                color.clone(), // Assuming you want `None` here
            );
        }

        for mut splitlength_item in all_splitlength_items {
            let sub_item_id = splitlength_item.get_attribute("id");
            let sub_item_name = splitlength_item.get_child_text("name");
            let sub_neme = Self::get_item_name_str(sub_item_id, sub_item_name);
            let sub_item_length = splitlength_item.get_child_text("length");
            subitem_length = sub_data_segment.len();
            println!(
                "sub_data_segment:{:?} subitem_length:{} data_segment:{:?} sub_item_length{:?}",
                sub_data_segment, subitem_length, data_segment, sub_item_length
            );
            match sub_item_length {
                Some(sub_item_length) => match sub_item_length.to_uppercase().as_str() {
                    "UNKNOWN" => {
                        subitem_length = FrameCsg::calculate_item_length(
                            &mut splitlength_item,
                            &sub_data_segment,
                            protocol,
                            region,
                            dir,
                            None,
                        );
                    }
                    _ => {
                        subitem_length = sub_item_length.parse::<usize>().unwrap();
                    }
                },
                _ => {
                    let item_box = splitlength_item.get_items("item");
                    if item_box.len() > 0 {
                        subitem_length =
                            Self::caculate_item_box_length(item_box, protocol, region, dir);
                    }
                }
            }
            println!(
                "sub_data_segment:{:?} subitem_length:{}",
                sub_data_segment, subitem_length
            );
            splitlength_item.update_value("length", subitem_length.to_string());

            if subitem_length > sub_data_segment.len() {
                println!(
                    "subitem_length > sub_data_segment.len() {:?}",
                    sub_data_segment.len()
                );
                break;
            }

            let subitem_content = &sub_data_segment[..subitem_length];

            if splitlength_item.get_child("unit").is_some()
                && splitlength_item.get_child("value").is_some()
            {
                let (cur_result, sub_result, length, cur_color) = Self::prase_value_item(
                    &mut splitlength_item.clone(),
                    subitem_content,
                    index + pos,
                    need_delete,
                    protocol,
                    region,
                    dir,
                );

                result_str = cur_result;
                sub_item_result = sub_result;
                cur_length = length;
                color = cur_color;
            } else if splitlength_item.get_child("unit").is_some() {
                let (mut cur_result, sub_result, length) = Self::prase_singal_item(
                    &splitlength_item,
                    subitem_content,
                    index + pos,
                    need_delete,
                    protocol,
                    region,
                    dir,
                );
                if cur_result.is_empty() {
                    cur_result = FrameFun::get_data_str(&subitem_content, false, false, false);
                }
                result_str = format!("[{}]: {}", sub_neme, cur_result);
                sub_item_result = sub_result;
                cur_length = length;
                println!(
                    "cur_result:{:?} sub_result:{:?} length:{:?}",
                    result_str, sub_item_result, length
                );
            } else if splitlength_item.get_child("value").is_some() {
                let (cur_result, sub_result, length, cur_color) = Self::prase_value_item(
                    &mut splitlength_item.clone(),
                    subitem_content,
                    index + pos,
                    need_delete,
                    protocol,
                    region,
                    dir,
                );
                result_str = cur_result;
                sub_item_result = sub_result;
                cur_length = length;
                color = cur_color;
            } else if splitlength_item.get_child("time").is_some() {
                let (mut cur_result, sub_result, length) = Self::prase_time_item(
                    &splitlength_item,
                    subitem_content,
                    index + pos,
                    need_delete,
                    protocol,
                    region,
                    dir,
                );
                if cur_result.is_empty() {
                    cur_result = FrameFun::get_data_str(&subitem_content, false, false, false);
                }
                result_str = format!("[{}]: {}", sub_neme, cur_result);
                sub_item_result = sub_result;
                cur_length = length;
            } else if splitlength_item.get_child("splitbit").is_some() {
                let split_elem = splitlength_item.get_child("splitbit").unwrap();
                let (sub_result, length) = Self::parse_bitwise_data(
                    &split_elem,
                    subitem_content,
                    index + pos,
                    need_delete,
                    protocol,
                    region,
                    dir,
                );
                sub_item_result = Some(sub_result);
                cur_length = length;
                result_str = "".to_string();
            } else if splitlength_item.get_child("splitByLength").is_some() {
                let (sub_result, length) = Self::prase_split_by_length_item(
                    &splitlength_item,
                    subitem_content,
                    index + pos,
                    need_delete,
                    protocol,
                    region,
                    dir,
                );
                sub_item_result = Some(sub_result);
                cur_length = length;
                result_str = "".to_string();
            } else if splitlength_item.get_child("type").is_some() {
                let (mut cur_result, sub_result, length) = Self::prase_type_item(
                    &mut splitlength_item.clone(),
                    subitem_content,
                    index + pos,
                    need_delete,
                    subitem_length,
                    protocol,
                    region,
                    dir,
                );
                if cur_result.is_empty() {
                    cur_result = FrameFun::get_data_str(&subitem_content, false, false, false);
                }
                result_str = format!("[{}]: {}", sub_neme, cur_result);
                sub_item_result = sub_result;
                cur_length = length;
            } else if splitlength_item.get_child("item").is_some() {
                let (sub_result, length) = Self::prase_item_box(
                    &splitlength_item,
                    subitem_content,
                    index + pos,
                    need_delete,
                    protocol,
                    region,
                    dir,
                );
                sub_item_result = Some(sub_result);
                cur_length = length;
                result_str = "".to_string();
            } else {
                let (mut cur_result, sub_result, length) = Self::prase_singal_item(
                    &splitlength_item,
                    subitem_content,
                    index + pos,
                    need_delete,
                    protocol,
                    region,
                    dir,
                );
                if cur_result.is_empty() {
                    cur_result = FrameFun::get_data_str(&subitem_content, false, false, false);
                }
                result_str = format!("[{}]: {}", sub_neme, cur_result);
                sub_item_result = sub_result;
                cur_length = length;
            }

            if sub_item_result.is_none() {
                let result_str = format!("{}", result_str);
                // 说明是单一的结果
                FrameFun::add_data(
                    &mut result,
                    sub_neme,
                    FrameFun::get_data_str(&subitem_content, false, false, true),
                    result_str,
                    vec![index + pos, index + pos + subitem_length],
                    sub_item_result.clone(),
                    color.clone(),
                );
            } else {
                // 存在子项
                let description = if result_str.is_empty() {
                    format!(
                        "[{}]: {}",
                        sub_neme,
                        FrameFun::get_data_str(&subitem_content, false, false, false)
                    )
                } else {
                    result_str.clone()
                };
                FrameFun::add_data(
                    &mut result,
                    sub_neme,
                    FrameFun::get_data_str(&subitem_content, false, false, true),
                    description,
                    vec![index + pos, index + pos + subitem_length],
                    sub_item_result,
                    color.clone(),
                );
            }
            pos += subitem_length;
            sub_data_segment = &sub_data_segment[subitem_length..];
            println!("cur_length:{:?}", cur_length);
        }
        (result, pos)
    }

    pub fn prase_item_box(
        data_item_elem: &XmlElement,
        data_segment: &[u8],
        index: usize,
        need_delete: bool,
        protocol: &str,
        region: &str,
        dir: Option<u8>,
    ) -> (Vec<Value>, usize) {
        let mut item_result: Vec<Value> = Vec::new();
        let mut pos = 0;
        let sub_data_segment = data_segment;
        let mut cur_length: usize;
        let mut result_str: String;

        let mut subitem_length: usize;
        let mut subitem_content = sub_data_segment;

        let all_items = data_item_elem.get_items("item");
        for item in all_items {
            let item_id = item.get_value();
            let mut item_result_name: String;
            let mut result: Vec<Value> = Vec::new();
            if let Some(item_id) = item_id {
                item_result_name = item_id.clone();
                println!("prase_item_box item_id: {:?}", item_id);
                let item_element =
                    ProtocolConfigManager::get_config_xml(&item_id, protocol, region, dir);
                let mut cur_length = 0;
                if let Some(mut item_element) = item_element {
                    let item_length = item_element.get_child_text("length");
                    if let Some(item_length) = item_length {
                        if item_length.to_uppercase().as_str() == "UNKNOWN" {
                            cur_length = FrameCsg::calculate_item_length(
                                &mut item_element,
                                &subitem_content,
                                protocol,
                                region,
                                dir,
                                None,
                            );
                        } else {
                            cur_length = item_length.parse::<usize>().unwrap();
                        }
                    }
                    let item_data = &subitem_content[..cur_length];
                    result = Self::prase_data_item(
                        &mut item_element,
                        item_data,
                        index + pos,
                        need_delete,
                        protocol,
                        region,
                        dir,
                    );
                } else {
                    cur_length = subitem_content.len();
                }
                let item_name = item.get_child_text("name");
                if let Some(item_name) = item_name {
                    item_result_name.push_str("_");
                    item_result_name.push_str(&item_name);
                }
                // FrameFun::add_data(
                //     &mut item_result,
                //     item_result_name,
                //     FrameFun::get_data_str(&subitem_content, false, false, true),
                //     FrameFun::get_data_str(&subitem_content, false, false, false),
                //     vec![index + pos , index + pos + cur_length],
                //     Some(result),
                //     None
                // );
                item_result.extend(result);
                pos += cur_length;
                subitem_content = &subitem_content[cur_length..];
            }
        }
        (item_result, pos)
    }

    pub fn caculate_item_box_length(
        all_items: Vec<XmlElement>,
        protocol: &str,
        region: &str,
        dir: Option<u8>,
    ) -> usize {
        let mut pos: usize = 0;

        // 遍历所有 `item` 子元素
        for item_elem in all_items {
            if let Some(item_id) = item_elem.get_value() {
                // 调用 `ConfigManager` 获取与 item_id 相关的 XML 元素
                println!("caculate_item_box_length item_id: {:?}", item_id);
                if let Some(item) =
                    ProtocolConfigManager::get_config_xml(&item_id, protocol, region, dir)
                {
                    // 获取 `length` 子元素
                    if let Some(item_length) = item.get_child_text("length") {
                        if let Ok(item_length) = item_length.parse::<usize>() {
                            pos += item_length;
                        }
                    }
                }
            }
        }
        pos
    }

    pub fn prase_type_item(
        item_element: &XmlElement,
        data_segment: &[u8],
        index: usize,
        need_delete: bool,
        singal_length: usize,
        protocol: &str,
        region: &str,
        dir: Option<u8>,
    ) -> (String, Option<Vec<Value>>, usize) {
        let mut item_length = data_segment.len();
        let mut result_str = String::new();
        let mut sub_item_result: Option<Vec<Value>> = Some(Vec::new());
        let is_singal: bool;
        let item_element_clone = item_element.clone();
        let singal_content = item_element_clone.get_child_text("single");
        if let Some(singal_content) = singal_content {
            if singal_content.to_lowercase() == "yes" {
                is_singal = true;
            } else {
                is_singal = false;
            }
        } else {
            is_singal = false;
        }

        let sub_type = item_element_clone.get_child_text("type").unwrap();

        let mut data_content = data_segment.to_vec();
        if need_delete {
            data_content = FrameFun::frame_delete_33h(data_segment);
        }

        let need_delete = false;
        println!(
            "prase_type_item data_content: {:?} type: {:?}",
            data_content, sub_type
        );
        if let Some(parsed_value) = Self::prase_simple_type_data(
            &item_element,
            &data_segment,
            index,
            need_delete,
            protocol,
            region,
            dir,
        ) {
            result_str = parsed_value;
        } else {
            match sub_type.as_str() {
                "PN" => {
                    let result_vec = Self::prase_pn_type(
                        &data_content,
                        index,
                        singal_length as usize,
                        protocol,
                        region,
                        dir,
                    );
                    sub_item_result = Some(result_vec);
                }
                "ITEM" => {
                    let result_vec = Self::prase_item_type(
                        &data_content,
                        index,
                        singal_length as usize,
                        protocol,
                        region,
                        dir,
                    );
                    sub_item_result = Some(result_vec);
                }
                "FRAME645" => {
                    let mut result_vec: Vec<Value> = Vec::new();
                    Frame645::analysic_645_frame_by_afn(
                        &data_content,
                        &mut result_vec,
                        index,
                        region,
                    );
                    sub_item_result = Some(result_vec);
                }
                "FRAMECSG13" => {
                    let mut result_vec: Vec<Value> = Vec::new();
                    match FrameCsg::analysic_csg_frame_by_afn(
                        &data_content,
                        &mut result_vec,
                        index,
                        region,
                    ) {
                        Ok(_) => {}
                        Err(e) => {
                            println!("FrameCsg::analysic_csg_frame_by_afn error: {}", e);
                        }
                    }
                    sub_item_result = Some(result_vec);
                }
                "IPWITHPORT" => {
                    let result_vec = Self::prase_ip_and_port(
                        &data_content,
                        index,
                        singal_length as usize,
                        protocol,
                        region,
                        dir,
                    );
                    sub_item_result = Some(result_vec);
                }
                _ => {
                    let template_element = ProtocolConfigManager::get_template_element(
                        &sub_type, protocol, region, dir,
                    );
                    println!(
                        "template_element: {:?}, protocol: {:?}, region: {:?}, dir: {:?}",
                        template_element, protocol, region, dir
                    );
                    if let Some(template_element) = template_element {
                        let (cur_result, result_vec, length) = Self::prase_template_type(
                            &template_element,
                            &data_content,
                            singal_length as usize,
                            need_delete,
                            index,
                            protocol,
                            region,
                            dir,
                            is_singal,
                        );
                        result_str = cur_result;
                        sub_item_result = Some(result_vec);
                        item_length = length;
                    } else {
                        let (cur_result, sub_result, length) = Self::prase_singal_item(
                            &item_element,
                            &data_content,
                            index,
                            need_delete,
                            protocol,
                            region,
                            dir,
                        );
                        result_str = cur_result;
                        sub_item_result = sub_result;
                        item_length = length;
                    }
                }
            }
        }
        (result_str, sub_item_result, item_length)
    }

    pub fn prase_pn_type(
        data_segment: &[u8],
        index: usize,
        item_len: usize,
        _protocol: &str,
        _region: &str,
        _dir: Option<u8>,
    ) -> Vec<Value> {
        let mut result_vec: Vec<Value> = Vec::new();
        let mut i = 0;
        let mut pos = 0;
        let length = 2;
        if data_segment.len() % length == 0 {
            while pos < data_segment.len() {
                let sub_data = &data_segment[pos..pos + length];
                let item_name = format!("第{}组信息点", i + 1);
                let item_value = Self::prase_da_data(sub_data);
                FrameFun::add_data(
                    &mut result_vec,
                    item_name,
                    FrameFun::get_data_str(&sub_data, false, false, true),
                    item_value,
                    vec![index + pos, index + pos + length],
                    None,
                    None,
                );

                i += 1;
                pos += length;
            }
        } else {
            let item_name = "PN".to_string();
            FrameFun::add_data(
                &mut result_vec,
                item_name,
                FrameFun::get_data_str(&data_segment, false, false, true),
                FrameFun::get_data_str(&data_segment, false, false, false),
                vec![index + pos, index + pos + item_len],
                None,
                None,
            );
        }
        result_vec
    }

    pub fn prase_da_data(da: &[u8]) -> String {
        let point_str: String;

        // 尝试计算测量点
        let (total_measurement_points, measurement_points_array) =
            FrameFun::calculate_measurement_points(da);
        if total_measurement_points == 0 {
            return "Pn解析失败".to_string();
        }

        // 判断测量点数组的第一个值
        if total_measurement_points == 1 && measurement_points_array[0] == 0 {
            point_str = "Pn=测量点:0(终端)".to_string();
        } else if total_measurement_points == 1 && measurement_points_array[0] == 0xffff {
            point_str = "Pn=测量点:FFFF(除了终端信息点以外的所有测量点)".to_string();
        } else {
            // 生成格式化字符串，将测量点数组转为字符串
            let formatted_string = measurement_points_array
                .iter()
                .map(|&x| x.to_string())
                .collect::<Vec<_>>()
                .join(", ");
            point_str = format!("Pn=测量点{}", formatted_string);
        }

        point_str
    }

    pub fn prase_item_type(
        data_segment: &[u8],
        index: usize,
        item_len: usize,
        protocol: &str,
        region: &str,
        dir: Option<u8>,
    ) -> Vec<Value> {
        let mut result_vec: Vec<Value> = Vec::new();
        let mut i = 0;
        let mut pos = 0;
        let length = 4;
        if data_segment.len() % length == 0 {
            while pos < data_segment.len() {
                let sub_data = &data_segment[pos..pos + length];
                let item_name = format!("第{}组数据标识", i + 1);
                let item_id = FrameFun::get_data_str(sub_data, false, true, false);
                let mut item_description: String = item_id.clone();
                println!("prase_item_type item_id: {:?}", item_id);
                if let Some(item_element) =
                    ProtocolConfigManager::get_config_xml(&item_id, protocol, region, dir)
                {
                    if let Some(element_name) = item_element.get_child_text("name") {
                        item_description =
                            format!("{} {}", item_description, element_name).to_string();
                    }
                }
                FrameFun::add_data(
                    &mut result_vec,
                    item_name,
                    FrameFun::get_data_str(&sub_data, false, false, true),
                    item_description,
                    vec![index + pos, index + pos + length],
                    None,
                    None,
                );
                i += 1;
                pos += length;
            }
        } else {
            let item_name = "ITEM".to_string();
            FrameFun::add_data(
                &mut result_vec,
                item_name,
                FrameFun::get_data_str(&data_segment, false, false, true),
                FrameFun::get_data_str(&data_segment, false, false, false),
                vec![index + pos, index + pos + item_len],
                None,
                None,
            );
        }

        result_vec
    }

    pub fn prase_ip_and_port(
        data_segment: &[u8],
        index: usize,
        _item_len: usize,
        _protocol: &str,
        _region: &str,
        _dir: Option<u8>,
    ) -> Vec<Value> {
        let mut result_vec: Vec<Value> = Vec::new();

        let port = data_segment[..2].to_vec();
        let port_str = FrameFun::prase_port(&port);
        let ip_str = FrameFun::prase_ip_str(&data_segment[2..]);

        FrameFun::add_data(
            &mut result_vec,
            "IP地址".to_string(),
            FrameFun::get_data_str(&data_segment[2..], false, false, true),
            ip_str,
            vec![index + 2, index + 2 + 8],
            None,
            None,
        );
        FrameFun::add_data(
            &mut result_vec,
            "端口号".to_string(),
            FrameFun::get_data_str(&port, false, false, true),
            port_str,
            vec![index, index + 2],
            None,
            None,
        );

        result_vec
    }

    pub fn prase_template_type(
        item_element: &XmlElement,
        data_segment: &[u8],
        item_len: usize,
        need_delete: bool,
        index: usize,
        protocol: &str,
        region: &str,
        dir: Option<u8>,
        is_singal: bool,
    ) -> (String, Vec<Value>, usize) {
        let mut result_vec: Vec<Value> = Vec::new();
        let mut i = 0;
        let mut pos = 0;
        let mut item_singal: bool;
        let mut item_element_clone = item_element.clone();
        let singal_content = item_element_clone.get_child_text("single");
        if let Some(singal_content) = singal_content {
            if singal_content.to_lowercase() == "yes" {
                item_singal = true;
            } else {
                item_singal = false;
            }
        } else {
            item_singal = false;
        }
        let length_ele = item_element_clone.get_child_text("length");
        let subitem_length = if let Some(length) = length_ele {
            if length.to_uppercase() == "UNKNOWN" {
                FrameCsg::calculate_item_length(
                    &mut item_element_clone,
                    &data_segment,
                    protocol,
                    region,
                    dir,
                    None,
                )
            } else {
                length.parse::<usize>().unwrap()
            }
        } else {
            FrameCsg::calculate_item_length(
                &mut item_element_clone,
                &data_segment,
                protocol,
                region,
                dir,
                None,
            )
        };
        if is_singal && ((data_segment.len() / subitem_length) == 1) {
            item_singal = true;
        }

        let element_name = item_element_clone.get_child_text("name");
        let template_name = element_name
            .as_ref()
            .map(|s| {
                // Check if the string contains format specifiers like %d
                if s.contains('%') {
                    // Try to format the string with the current index
                    match format!("{}", s).replace("%d", &(i + 1).to_string()) {
                        formatted if formatted != *s => formatted,
                        _ => format!("第{}组{}", i + 1, s), // Fall back to the original format if formatting failed
                    }
                } else {
                    // Use the original format if no format specifiers are found
                    format!("第{}组{}", i + 1, s)
                }
            })
            .unwrap_or_else(|| format!("第{}组数据内容", i + 1));

        println!(
            "prase_template_type item_singal: {:?} {:?} {:?}",
            data_segment, item_len, subitem_length
        );
        let all_data_str = FrameFun::get_data_str(&data_segment, false, false, false);
        let attri_id = item_element.get_attribute("id");
        if data_segment.len() % subitem_length == 0 {
            while pos < data_segment.len() {
                let sub_data = &data_segment[pos..pos + subitem_length];

                let item_name = element_name
                    .as_ref()
                    .map(|s| {
                        // Check if the string contains format specifiers like %d
                        if s.contains('%') {
                            // Try to format the string with the current index
                            match format!("{}", s).replace("%d", &(i + 1).to_string()) {
                                formatted if formatted != *s => formatted,
                                _ => format!("第{}组{}", i + 1, s), // Fall back to the original format if formatting failed
                            }
                        } else {
                            // Use the original format if no format specifiers are found
                            format!("第{}组{}", i + 1, s)
                        }
                    })
                    .unwrap_or_else(|| format!("第{}组数据内容", i + 1));

                let item_value = Self::prase_data_item(
                    &mut item_element_clone,
                    sub_data,
                    index + pos,
                    need_delete,
                    protocol,
                    region,
                    dir,
                );
                let item_id = FrameFun::get_data_str(sub_data, false, true, false);
                let item_description: String = format!("[{}]: {}", item_name, item_id);
                println!(
                    "prase_template_type item_id: {:?} {:?} {:?} {:?}",
                    item_id, item_value, item_description, item_singal
                );
                // if let Some(item_element) = ProtocolConfigManager::get_config_xml(&item_id, protocol, region, dir) {
                //     if let Some(element_name) = item_element.get_child_text("name") {
                //         item_description = format!("{} {}", item_description, element_name);
                //     }
                // }

                if item_singal {
                    result_vec.extend(item_value);
                } else {
                    if !item_value.is_empty() && item_value.iter().any(|v| {
                        if let Some(frame_domain) = v.get("frameDomain") {
                            if frame_domain.is_string() {
                                return true;
                            }
                        }
                        false
                    }) {
                        // 将 frameDomain 修改为 item_name
                        let mut modified_value = item_value;
                        for v in modified_value.iter_mut() {
                            if let Some(frame_domain) = v.as_object_mut() {
                                if frame_domain.contains_key("frameDomain") {
                                    frame_domain.insert("frameDomain".to_string(), json!(item_name.clone()));
                                }
                                if frame_domain.contains_key("description") {
                                    if let Some(description) = frame_domain.get("description") {
                                        if description.is_string() {
                                            let desc_str = description.as_str().unwrap_or("");
                                            if let Some(attri_id) = attri_id.as_ref() {
                                                let pattern = format!("{}_", attri_id);
                                                let new_desc = desc_str.replace(&pattern, "");
                                                frame_domain.insert("description".to_string(), json!(new_desc));
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        result_vec.extend(modified_value);
                    } else {
                        FrameFun::add_data(
                            &mut result_vec,
                            item_name,
                            FrameFun::get_data_str(&sub_data, false, false, true),
                            item_description,
                            vec![index + pos, index + pos + subitem_length],
                            Some(item_value),
                            None,
                        );
                    }
                }
                i += 1;
                pos += subitem_length;
            }
        } else {
            FrameFun::add_data(
                &mut result_vec,
                template_name,
                FrameFun::get_data_str(&data_segment, false, false, true),
                all_data_str.clone(),
                vec![index, index + item_len],
                None,
                None,
            );
        }
        (all_data_str, result_vec, pos)
    }
}
