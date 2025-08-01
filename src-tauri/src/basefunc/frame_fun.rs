use std::collections::HashMap;
use std::error::Error;
extern crate regex;
use crate::config::xmlconfig::{ProtocolConfigManager, XmlElement};
use regex::Regex;
use serde_json::Value;
pub struct FrameFun;

impl FrameFun {
    // PPP FCS16 查找表
    const FCS_TABLE: [u16; 256] = [
        0x0000, 0x1189, 0x2312, 0x329b, 0x4624, 0x57ad, 0x6536, 0x74bf, 0x8c48, 0x9dc1, 0xaf5a,
        0xbed3, 0xca6c, 0xdbe5, 0xe97e, 0xf8f7, 0x1081, 0x0108, 0x3393, 0x221a, 0x56a5, 0x472c,
        0x75b7, 0x643e, 0x9cc9, 0x8d40, 0xbfdb, 0xae52, 0xdaed, 0xcb64, 0xf9ff, 0xe876, 0x2102,
        0x308b, 0x0210, 0x1399, 0x6726, 0x76af, 0x4434, 0x55bd, 0xad4a, 0xbcc3, 0x8e58, 0x9fd1,
        0xeb6e, 0xfae7, 0xc87c, 0xd9f5, 0x3183, 0x200a, 0x1291, 0x0318, 0x77a7, 0x662e, 0x54b5,
        0x453c, 0xbdcb, 0xac42, 0x9ed9, 0x8f50, 0xfbef, 0xea66, 0xd8fd, 0xc974, 0x4204, 0x538d,
        0x6116, 0x709f, 0x0420, 0x15a9, 0x2732, 0x36bb, 0xce4c, 0xdfc5, 0xed5e, 0xfcd7, 0x8868,
        0x99e1, 0xab7a, 0xbaf3, 0x5285, 0x430c, 0x7197, 0x601e, 0x14a1, 0x0528, 0x37b3, 0x263a,
        0xdecd, 0xcf44, 0xfddf, 0xec56, 0x98e9, 0x8960, 0xbbfb, 0xaa72, 0x6306, 0x728f, 0x4014,
        0x519d, 0x2522, 0x34ab, 0x0630, 0x17b9, 0xef4e, 0xfec7, 0xcc5c, 0xddd5, 0xa96a, 0xb8e3,
        0x8a78, 0x9bf1, 0x7387, 0x620e, 0x5095, 0x411c, 0x35a3, 0x242a, 0x16b1, 0x0738, 0xffcf,
        0xee46, 0xdcdd, 0xcd54, 0xb9eb, 0xa862, 0x9af9, 0x8b70, 0x8408, 0x9581, 0xa71a, 0xb693,
        0xc22c, 0xd3a5, 0xe13e, 0xf0b7, 0x0840, 0x19c9, 0x2b52, 0x3adb, 0x4e64, 0x5fed, 0x6d76,
        0x7cff, 0x9489, 0x8500, 0xb79b, 0xa612, 0xd2ad, 0xc324, 0xf1bf, 0xe036, 0x18c1, 0x0948,
        0x3bd3, 0x2a5a, 0x5ee5, 0x4f6c, 0x7df7, 0x6c7e, 0xa50a, 0xb483, 0x8618, 0x9791, 0xe32e,
        0xf2a7, 0xc03c, 0xd1b5, 0x2942, 0x38cb, 0x0a50, 0x1bd9, 0x6f66, 0x7eef, 0x4c74, 0x5dfd,
        0xb58b, 0xa402, 0x9699, 0x8710, 0xf3af, 0xe226, 0xd0bd, 0xc134, 0x39c3, 0x284a, 0x1ad1,
        0x0b58, 0x7fe7, 0x6e6e, 0x5cf5, 0x4d7c, 0xc60c, 0xd785, 0xe51e, 0xf497, 0x8028, 0x91a1,
        0xa33a, 0xb2b3, 0x4a44, 0x5bcd, 0x6956, 0x78df, 0x0c60, 0x1de9, 0x2f72, 0x3efb, 0xd68d,
        0xc704, 0xf59f, 0xe416, 0x90a9, 0x8120, 0xb3bb, 0xa232, 0x5ac5, 0x4b4c, 0x79d7, 0x685e,
        0x1ce1, 0x0d68, 0x3ff3, 0x2e7a, 0xe70e, 0xf687, 0xc41c, 0xd595, 0xa12a, 0xb0a3, 0x8238,
        0x93b1, 0x6b46, 0x7acf, 0x4854, 0x59dd, 0x2d62, 0x3ceb, 0x0e70, 0x1ff9, 0xf78f, 0xe606,
        0xd49d, 0xc514, 0xb1ab, 0xa022, 0x92b9, 0x8330, 0x7bc7, 0x6a4e, 0x58d5, 0x495c, 0x3de3,
        0x2c6a, 0x1ef1, 0x0f78,
    ];

    /// 计算PPP帧校验序列(FCS)
    ///
    /// # Arguments
    ///
    /// * `fcs` - 初始FCS值
    /// * `data` - 要计算校验的数据
    ///
    /// # Returns
    ///
    /// 返回计算后的FCS值
    pub fn ppp_fcs16(fcs: u16, data: &[u8]) -> u16 {
        let mut fcs = fcs;
        for &byte in data {
            fcs = (fcs >> 8) ^ Self::FCS_TABLE[((fcs ^ u16::from(byte)) & 0xff) as usize];
        }
        fcs
    }

    pub fn bytes_to_decimal_list(byte_data: &[u8]) -> Result<Vec<u8>, Box<dyn Error>> {
        Ok(byte_data.to_vec())
    }

    pub fn get_frame_from_bytes(data: &[u8]) -> Result<String, Box<dyn Error>> {
        Ok(hex::encode(data))
    }

    pub fn get_hex_frame(text: &str) -> Option<Vec<u8>> {
        let cleaned_string = text.replace(" ", "").replace("\n", "");
        let frame: Result<Vec<u8>, _> = (0..cleaned_string.len())
            .step_by(2)
            .map(|i| u8::from_str_radix(&cleaned_string[i..i + 2], 16))
            .collect();
        frame.ok()
    }

    pub fn add_data(
        data_list: &mut Vec<Value>,
        frame: String,
        data: String,
        description: String,
        location: Vec<usize>,
        child_items: Option<Vec<Value>>,
        color: Option<String>,
    ) {
        let mut new_data = serde_json::json!({
            "frameDomain": frame,
            "data": data,
            "description": description,
            "position": location,
            "color": color.unwrap_or_else(|| "null".to_string())  // Corrected this line
        });

        if let Some(items) = child_items {
            new_data["children"] = serde_json::json!(items);
        }

        data_list.push(new_data);
    }

    pub fn find_frame_in_data_list(
        data_list: &Vec<Value>, // Corrected to Vec<Value>
        target_item: &str,
    ) -> Option<Vec<Value>> {
        let mut result = Vec::new();

        for data in data_list {
            // Check the "frameDomain" field in the main entry
            if let Some(frame) = data.get("frameDomain") {
                if frame == target_item {
                    result.push(data.clone());
                }
            }

            // Check the "子项" field for nested frames
            if let Some(child_items) = data.get("子项") {
                if let Some(child_items_arr) = child_items.as_array() {
                    for child_item in child_items_arr {
                        if let Some(frame) = child_item.get("frameDomain") {
                            if frame == target_item {
                                result.push(child_item.clone());
                            }
                        }
                    }
                }
            }
        }

        if result.is_empty() {
            None
        } else {
            Some(result)
        }
    }

    pub fn get_bit_array(hexadecimal: u8) -> Vec<u8> {
        let mut bit_array = Vec::new();
        for i in (0..8).rev() {
            let bit = (hexadecimal >> i) & 1;
            bit_array.push(bit);
        }
        bit_array
    }

    pub fn decimal_to_bcd_byte(decimal_num: u8) -> Result<u8, Box<dyn Error>> {
        if decimal_num > 99 {
            return Err("Decimal number must be between 0 and 99".into());
        }
        let tens_digit = decimal_num / 10;
        let ones_digit = decimal_num % 10;
        Ok((tens_digit << 4) | ones_digit)
    }

    pub fn set_bit_value(bitstring: &mut [u8], bitpos: usize) {
        if bitpos >= 256 {
            return;
        }
        let byte_no = bitpos / 8;
        let bitpos = bitpos % 8;
        bitstring[byte_no] |= 1 << bitpos;
    }

    pub fn clr_bit_value(bitstring: &mut [u8], bitpos: usize) {
        if bitpos >= 256 {
            return;
        }
        let byte_no = bitpos / 8;
        let bitpos = bitpos % 8;
        bitstring[byte_no] &= !(1 << bitpos);
    }

    pub fn is_array_all_ffs(arr: &[u8]) -> bool {
        arr.iter().all(|&x| x == 0xff)
    }

    pub fn bin_to_decimal(
        bcd_array: &[u8],
        decimal_places: usize,
        need_delete: bool,
        sign: bool,
        judge_ff: bool,
    ) -> String {
        // Convert BCD array to integer
        let mut is_sign = false;
        let trans_array = bcd_array.to_vec().clone();
        let mut new_array = trans_array.clone();

        println!(
            "bcd_array: {:?}, decimal_places: {:?}, need_delete: {:?}, sign: {:?}, judge_ff: {:?}",
            bcd_array, decimal_places, need_delete, sign, judge_ff
        );
        if judge_ff {
            if Self::is_array_all_ffs(&bcd_array) {
                return String::from("无效数据");
            }
        }

        if need_delete {
            new_array = Self::frame_delete_33h(&trans_array);
        }

        if sign {
            let last_byte = new_array.last_mut().unwrap();
            if *last_byte & 0x80 != 0 {
                is_sign = true;
                *last_byte &= 0x7F;
            }
        }

        let int_value = Self::bintodecimal(&new_array);

        // Format integer value as a string with decimal places
        let decimal_string = format!(
            "{:.1$}",
            int_value as f64 / 10f64.powi(decimal_places as i32),
            decimal_places
        );

        println!("bcd_array {:?}", bcd_array);
        // Add decimal point to the string
        let decimal_string = if decimal_places > 0 {
            format!(
                "{}{}",
                &decimal_string[..decimal_string.len() - decimal_places],
                &decimal_string[decimal_string.len() - decimal_places..]
            )
        } else {
            decimal_string
        };

        // Add leading zeros to the string
        let decimal_string = if decimal_places != 0 {
            format!("{:0>1$}", decimal_string, bcd_array.len() * 2 + 1)
        } else {
            format!("{:0>1$}", decimal_string, bcd_array.len() * 2)
        };

        if is_sign {
            format!("-{}", decimal_string)
        } else {
            decimal_string
        }
    }

    pub fn prase_bin_be_deciml(
        bcd_array: &[u8],
        decimal_places: usize,
        need_delete: bool,
        sign: bool,
        judge_ff: bool,
    ) -> String {
        // 转换为大端序：反转字节顺序
        let mut array = bcd_array.to_vec();
        array.reverse();
        
        // 调用现有的 bin_to_decimal 函数处理转换后的数据
        Self::bin_to_decimal(&array, decimal_places, need_delete, sign, judge_ff)
    }
    // This code translates a Python function to Rust.
    pub fn bintodecimal(binary_data: &[u8]) -> u64 {
        // 将数组元素拼接成字符串
        let hex_string: String = binary_data
            .iter()
            .rev()
            .map(|&x| format!("{:02x}", x))
            .collect();

        // 将字符串转换为 10 进制
        let decimal_value = u64::from_str_radix(&hex_string, 16).unwrap();
        decimal_value
    }

    pub fn bcd_to_decimal(
        bcd_array: &[u8],
        decimal_places: usize,
        need_delete: bool,
        sign: bool,
    ) -> String {
        let mut int_value: u64 = 0;
        let mut is_sign = false;
        // 复制数组
        let trans_array = bcd_array.to_vec();
        let mut new_array = trans_array.clone();

        // 如果数组全是 0xFF，则返回无效数据
        if FrameFun::is_array_all_ffs(&bcd_array) {
            return "无效数据".to_string();
        }

        // 是否需要删除 0x33H
        if need_delete {
            new_array = FrameFun::frame_delete_33h(&trans_array);
        }

        // 先获取数组的长度，避免在修改时引发不可变借用冲突
        let array_len = new_array.len();

        // 处理符号位
        if sign && (new_array[array_len - 1] & 0x80 != 0) {
            is_sign = true;
            new_array[array_len - 1] &= 0x7F; // 清除符号位
        }

        // 在可变借用完成之后，先将 `new_array` 的内容存储到一个临时变量中，再进行遍历
        let array_copy = new_array.clone();

        // 将 BCD 转换为整数
        for &digit in array_copy.iter().rev() {
            int_value = int_value * 100 + ((digit >> 4) as u64) * 10 + (digit & 0x0F) as u64;
        }

        // 格式化为带小数位的字符串
        let formatted_value = format!(
            "{:.1$}",
            int_value as f64 / 10f64.powi(decimal_places as i32),
            decimal_places
        );

        println!("bcd_array {:?}", bcd_array);
        // 添加前导零
        let decimal_string = if decimal_places != 0 {
            format!(
                "{:0>width$}",
                formatted_value,
                width = bcd_array.len() * 2 + 1
            )
        } else {
            format!("{:0>width$}", formatted_value, width = bcd_array.len() * 2)
        };
        // 添加符号
        if is_sign {
            format!("-{}", decimal_string)
        } else {
            decimal_string
        }
    }

    pub fn prase_port(port_data: &[u8]) -> String {
        // 检查数据长度，如果长度小于 2，则返回空字符串
        if port_data.len() != 2 {
            return "".to_string();
        }

        // 调用等效的 `bintodecimal` 函数将二进制数据转换为十进制
        FrameFun::bintodecimal(port_data).to_string()
    }
    pub fn prase_ip_str(ipdata: &[u8]) -> String {
        if ipdata.len() != 4 {
            return String::new(); // Return an empty string if the data length is less than 4
        }

        // Format the byte slice into an IP address string
        format!("{}.{}.{}.{}", ipdata[3], ipdata[2], ipdata[1], ipdata[0])
    }

    pub fn bcd_array_to_decimal_array(data_array: &[u8]) -> Vec<u8> {
        let mut dec_array = Vec::new();
        for &bcd_digit in data_array {
            let high_nibble = (bcd_digit >> 4) & 0x0F;
            let low_nibble = bcd_digit & 0x0F;
            let dec_value = high_nibble * 10 + low_nibble;
            dec_array.push(dec_value);
        }
        dec_array
    }

    pub fn find_node_by_data_item<'a>(
        data: &'a serde_json::Value,
        data_item: &str,
    ) -> Option<&'a serde_json::Value> {
        if let serde_json::Value::Object(map) = data {
            if map.contains_key("数据项") && map["数据项"] == data_item {
                return Some(data);
            }
            for value in map.values() {
                if let Some(result) = Self::find_node_by_data_item(value, data_item) {
                    return Some(result);
                }
            }
        } else if let serde_json::Value::Array(arr) = data {
            for item in arr {
                if let Some(result) = Self::find_node_by_data_item(item, data_item) {
                    return Some(result);
                }
            }
        }
        None
    }

    pub fn calculate_cs(data: &[u8]) -> u8 {
        let mut cs: u64 = 0; // 使用较大的整数类型来存储累加结果
        for &value in data {
            cs += value as u64; // 将 u8 类型的值转换为 u64 后进行累加
        }
        // 在返回前将累加结果转换为 u8 类型
        (cs as u8) & 0xff // 确保结果在 u8 的范围内
    }

    pub fn frame_delete_33h(frame: &[u8]) -> Vec<u8> {
        frame
            .iter()
            .map(|&value| (value.wrapping_sub(0x33)) & 0xff)
            .collect()
    }

    pub fn frame_add_33h(frame: &[u8]) -> Vec<u8> {
        frame
            .iter()
            .map(|&value| (value.wrapping_add(0x33)) & 0xff)
            .collect()
    }

    pub fn get_data_str_delete_33h_reverse(data: &[u8]) -> String {
        Self::frame_delete_33h(data)
            .iter()
            .rev()
            .map(|&b| format!("{:02X}", b))
            .collect()
    }

    pub fn get_data_item_str_delete_33h_order(data: &[u8]) -> String {
        Self::frame_delete_33h(data)
            .iter()
            .map(|&b| format!("{:02X}", b))
            .collect()
    }

    pub fn get_data_str_with_space(data: &[u8]) -> String {
        data.iter()
            .map(|&byte| format!("{:02X}", byte))
            .collect::<Vec<_>>()
            .join(" ")
    }

    pub fn get_data_str_reverser_with_space(data: &[u8]) -> String {
        data.iter()
            .rev()
            .map(|&b| format!("{:02X}", b))
            .collect::<Vec<_>>()
            .join(" ")
    }

    pub fn get_data_str_reverser(data: &[u8]) -> String {
        data.iter().rev().map(|&b| format!("{:02X}", b)).collect()
    }

    pub fn get_data_str_order(data: &[u8]) -> String {
        data.iter().map(|&b| format!("{:02X}", b)).collect()
    }

    pub fn get_data_normal_reverser(data: &[u8], need_delete: bool, need_reverse: bool) -> String {
        if need_delete {
            Self::get_data_str_delete_33h_reverse(data)
        } else {
            Self::get_data_str_reverser(data)
        }
    }

    pub fn get_data_str(
        data: &[u8],
        need_delete: bool,
        need_reverse: bool,
        with_space: bool,
    ) -> String {
        let mut current_data: Vec<u8> = if need_delete {
            Self::frame_delete_33h(data) // 这里返回 Vec<u8>
        } else {
            data.to_vec() // 将 &[u8] 转换为 Vec<u8>
        };

        if need_reverse {
            current_data.reverse(); // reverse() 方法只适用于 Vec<u8>
        }

        if with_space {
            Self::get_data_str_with_space(&current_data) // 需要传入 &Vec<u8>
        } else {
            Self::get_data_str_order(&current_data) // 需要传入 &Vec<u8>
        }
    }

    pub fn get_format_str(input_text: &str) -> String {
        let hex_str = input_text.replace(' ', "").replace('\n', "");
        let mut formatted_frame = String::new();
        for i in (0..hex_str.len()).step_by(2) {
            formatted_frame.push_str(&hex_str[i..i + 2]);
            formatted_frame.push(' ');
        }
        formatted_frame.to_uppercase()
    }

    pub fn get_frame_list_from_str(input_text: &str) -> Vec<u8> {
        let hex_str = input_text.replace(' ', "").replace('\n', "");
        (0..hex_str.len())
            .step_by(2)
            .map(|i| u8::from_str_radix(&hex_str[i..i + 2], 16).unwrap())
            .collect()
    }

    pub fn extract_bits(start_bit: usize, end_bit: usize, value: u32) -> String {
        println!(
            "start_bit: {:?}, end_bit: {:?}, value: {:?}",
            start_bit, end_bit, value
        );
        let mask = ((1 << (end_bit - start_bit + 1)) - 1) << start_bit;
        let extracted_bits = (value & mask) >> start_bit;
        // 使用格式化字符串指定宽度，确保输出正确的位数
        format!(
            "{:0width$b}",
            extracted_bits,
            width = end_bit - start_bit + 1
        )
    }

    pub fn is_array_all_zeros(arr: &[u8]) -> bool {
        arr.iter().all(|&element| element == 0)
    }

    pub fn bcd_to_int(bcd_array: &[u8], need_delete: bool) -> u32 {
        let mut int_value: u32 = 0;
        for &digit in bcd_array.iter().rev() {
            let digit = if need_delete {
                (digit.wrapping_sub(0x33)) & 0xFF
            } else {
                digit
            };
            int_value = int_value * 100 + ((digit >> 4) as u32) * 10 + (digit & 0x0F) as u32;
        }
        int_value
    }

    pub fn bcd2int(bcd: u8) -> u32 {
        ((bcd >> 4) as u32) * 10 + (bcd & 0x0F) as u32
    }

    pub fn hex_array_to_int(hex_array: &[u8], need_delete: bool) -> u32 {
        let hex_array = if need_delete {
            Self::frame_delete_33h(hex_array)
        } else {
            hex_array.to_vec()
        };
        let hex_string = hex_array
            .iter()
            .rev()
            .map(|&x| format!("{:02x}", x))
            .collect::<String>();
        u32::from_str_radix(&hex_string, 16).unwrap()
    }

    pub fn parse_freeze_time(data_array: &[u8]) -> String {
        if data_array.len() == 4 {
            if data_array[0] == 0x99
                && data_array[1] == 0x99
                && data_array[2] == 0x99
                && data_array[3] == 0x99
            {
                return "瞬时冻结".to_string();
            } else if data_array[0] == 0x99 && data_array[1] == 0x99 && data_array[2] == 0x99 {
                return format!("每时{:02X}分", data_array[3]);
            } else if data_array[0] == 0x99 && data_array[1] == 0x99 {
                return format!("每日{:02X}时{:02X}分", data_array[2], data_array[3]);
            } else if data_array[0] == 0x99 {
                return format!(
                    "每月{:02X}日{:02X}时{:02X}分",
                    data_array[1], data_array[2], data_array[3]
                );
            }
        }
        "未知冻结类型".to_string()
    }

    pub fn is_only_one_bit_set(byte: u8) -> bool {
        byte & (byte - 1) == 0
    }

    pub fn is_all_elements_equal(arr: &[u8], value: u8) -> bool {
        arr.iter().all(|&element| element == value)
    }

    pub fn ascii_to_str(ascii_array: &[u8]) -> String {
        // 查找第一个零字节的位置
        let zero_pos = ascii_array.iter().position(|&byte| byte == 0);

        // 如果找到了零字节，则截取到该位置之前的部分
        let valid_part = if let Some(pos) = zero_pos {
            &ascii_array[..pos]
        } else {
            ascii_array
        };

        // 将有效部分转换为字符串
        String::from_utf8_lossy(valid_part).into_owned()
    }

    pub fn binary_to_bcd(binary_array: &[u8]) -> Vec<u8> {
        binary_array
            .iter()
            .map(|&binary_number| ((binary_number / 10) << 4) + (binary_number % 10))
            .collect()
    }

    pub fn int16_to_bcd(int16: u16) -> Vec<u8> {
        vec![(int16 & 0x00ff) as u8, (int16 >> 8) as u8]
    }

    pub fn binary2bcd(binary: u8) -> u8 {
        ((binary / 10) << 4) + (binary % 10)
    }

    pub fn get_frame_fe_count(frame: &[u8]) -> usize {
        frame.iter().take_while(|&&value| value == 0xFE).count()
    }

    pub fn get_sublength_caculate_base(
        splitlength: &HashMap<String, (String, String, u32, Vec<usize>)>,
        target_subitem_name: &str,
    ) -> Option<(u32, usize, (String, String, u32, Vec<usize>))> {
        let matching_subitems: Vec<(usize, (String, String, u32, Vec<usize>))> = splitlength
            .iter()
            .enumerate()
            .filter_map(
                |(
                    idx,
                    (subitem, (subitem_content, subitem_content2, subitem_value, subitem_indices)),
                )| {
                    if subitem == target_subitem_name {
                        Some((
                            idx,
                            (
                                subitem.clone(),
                                subitem_content.clone(),
                                *subitem_value,
                                subitem_indices.clone(),
                            ),
                        ))
                    } else {
                        None
                    }
                },
            )
            .collect();

        matching_subitems.into_iter().next().map(
            |(idx, (subitem, subitem_content, subitem_value, subitem_indices))| {
                (
                    subitem_value,
                    idx,
                    (subitem, subitem_content, subitem_value, subitem_indices),
                )
            },
        )
    }

    pub fn get_subitem_length(
        data_subitem_elem: &Value,
        splitlength: &HashMap<String, (String, String, u32, Vec<usize>)>,
        key: &str,
        data_segment: &[u8],
        protocol: &str,
    ) -> (u32, u32) {
        let relues = data_subitem_elem.get("lengthrule").and_then(|v| v.as_str());
        let operator_mapping = HashMap::from([('+', '+'), ('-', '-'), ('*', '*'), ('/', '/')]);
        let pattern = Regex::new(r"^RANGE\(([^)]+)\)$").unwrap();

        if let Some(relues) = relues {
            if let Some(match_string) = pattern
                .captures(relues)
                .and_then(|caps| caps.get(1).map(|m| m.as_str()))
            {
                if let Some((value, index, subitem)) =
                    Self::get_sublength_caculate_base(splitlength, match_string)
                {
                    // Get the previous key if it exists
                    let prev_key = splitlength.keys().nth(index - 1).map(|s| s.clone());
                    let pos = if let Some(prev_key) = prev_key {
                        splitlength
                            .get(&prev_key)
                            .map_or(0, |(_, _, _, indices)| indices.get(0).copied().unwrap_or(0))
                    } else {
                        0
                    };

                    let cur_pos = subitem.3.get(0).copied().unwrap_or(0);
                    let target_data = subitem.1.parse::<u8>().unwrap_or(0);
                    let sub_length = if cur_pos > pos { cur_pos - pos } else { 1 };

                    for (i, &data) in data_segment[sub_length as usize..].iter().enumerate() {
                        if data == target_data {
                            return (i as u32, i as u32);
                        }
                    }
                }

                let components: Vec<&str> = relues
                    .split(r"\s*([*])\s*")
                    .filter(|&c| !c.is_empty())
                    .collect();
                let number_part = components[0];
                let operator_part = components[1];
                let text_part = components[2];
                let operator = operator_mapping
                    .get(&operator_part.chars().next().unwrap())
                    .unwrap();
                let value = if text_part.parse::<u32>().is_ok() {
                    text_part.parse::<u32>().unwrap()
                } else if let Some((value, _, _)) =
                    Self::get_sublength_caculate_base(splitlength, text_part)
                {
                    value
                } else {
                    0
                };
                let decimal_number = number_part.parse::<u32>().unwrap_or(0);

                let sub_length = match operator {
                    '+' => decimal_number + value,
                    '-' => decimal_number - value,
                    '*' => decimal_number * value,
                    '/' => decimal_number / value,
                    _ => 0,
                };

                return (sub_length, sub_length);
            }
        }

        // Placeholder for the rest of the function
        (0, 0)
    }

    pub fn calculate_measurement_points(da: &[u8]) -> (usize, Vec<u16>) {
        let da1 = da[0];
        let da2 = da[1];

        pub fn find_set_bits(value: u8) -> Vec<usize> {
            (0..8).filter(|&i| (value >> i) & 1 == 1).collect()
        }

        if da1 == 0xFF && da2 == 0xFF {
            (1, vec![0xFFFF])
        } else if da1 == 0x00 && da2 == 0x00 {
            (1, vec![0])
        } else {
            let set_bits_da1 = find_set_bits(da1);
            let info_point_group = da2 as usize;
            let info_point_start = (info_point_group - 1) * 8;

            // Collect values as u16, ensuring they fit within u16 bounds
            let measurement_points = set_bits_da1
                .iter()
                .map(|&bit| {
                    let value = info_point_start + bit + 1;
                    // Check if value fits within u16 range
                    if value <= u16::MAX as usize {
                        value as u16
                    } else {
                        panic!("Value out of bounds for u16");
                    }
                })
                .collect::<Vec<u16>>();

            (measurement_points.len(), measurement_points)
        }
    }

    pub fn parse_da_data(da: &[u8]) -> String {
        let (total_measurement_points, measurement_points_array) =
            Self::calculate_measurement_points(da);
        if total_measurement_points == 0 {
            return "Pn解析失败".to_string();
        }
        if measurement_points_array[0] == 0 && total_measurement_points == 1 {
            return "Pn=测量点：0(终端)".to_string();
        } else if measurement_points_array[0] == 0xFFFF && total_measurement_points == 1 {
            return "Pn=测量点：FFFF(除了终端信息点以外的所有测量点)".to_string();
        } else {
            let formatted_string = measurement_points_array
                .iter()
                .map(|&mp| mp.to_string())
                .collect::<Vec<_>>()
                .join(", ");
            format!("Pn=第{}测量点", formatted_string)
        }
    }

    pub fn calculate_item_box_length(
        item_ele: &XmlElement,
        protocol: &str,
        region: &str,
        dir: Option<u8>,
    ) -> usize {
        let mut total_length = 0;
        let all_items = item_ele.get_items("item");

        for item_elem in all_items {
            if let Some(item_id) = item_elem.get_value() {
                let id: &str = &item_id.trim();
                if let Some(item) = ProtocolConfigManager::get_config_xml(id, protocol, region, dir)
                {
                    let item_length = item
                        .get_child_text("length")
                        .and_then(|v| v.parse::<u64>().ok()) // 将 String 转换为 u64
                        .unwrap_or(0) as usize; // 如果转换失败则使用 0
                    total_length += item_length;
                }
            }
        }

        total_length
    }

    pub fn parse_time_data(data_array: &[u8], format_str: &str, need_delete: bool) -> String {
        // Define the correct sequence with milliseconds
        let correct = "CCYYMMDDWWhhmmssxxxx";

        // Define format mapping
        let mut format_mapping = HashMap::new();
        format_mapping.insert("CC", "{:02X}");
        format_mapping.insert("YY", "{:02X}年");
        format_mapping.insert("MM", "{:02X}月");
        format_mapping.insert("DD", "{:02X}日");
        format_mapping.insert("hh", "{:02X}时");
        format_mapping.insert("mm", "{:02X}分");
        format_mapping.insert("ss", "{:02X}秒");
        format_mapping.insert("WW", "星期:");
        format_mapping.insert("xxxx", "{:04X}毫秒");

        let mut new_array = data_array.to_vec();

        // Simulate the frame_delete_33H function (if required, replace with actual logic)
        if need_delete {
            new_array = Self::frame_delete_33h(&new_array);
        }

        let mut formatted_data = String::new();
        let mut pos = 0;

        // Weekday mapping
        let weekday_mapping = vec![
            ("天".to_string()),
            ("一".to_string()),
            ("二".to_string()),
            ("三".to_string()),
            ("四".to_string()),
            ("五".to_string()),
            ("六".to_string()),
        ];

        // Iterate through the format string
        while pos < correct.len() {
            // Check if we're at the millisecond position (xxxx)
            if pos <= correct.len() - 4 && &correct[pos..pos + 4] == "xxxx" {
                if let Some(index) = format_str.find("xxxx") {
                    let array_index = index / 2;
                    // For milliseconds, we need to combine two bytes
                    if array_index + 1 < new_array.len() {
                        let msb = new_array[array_index] as u16;
                        let lsb = new_array[array_index + 1] as u16;
                        let value = (msb << 8) | lsb;

                        // Use the format string for milliseconds
                        if let Some(fmt) = format_mapping.get("xxxx") {
                            let fmt_string = fmt.replace("{:04X}", &format!("{:04X}", value));
                            formatted_data.push_str(&fmt_string);
                        }
                    }
                }
                pos += 4; // Move past the 'xxxx'
            } else if pos <= correct.len() - 2 {
                // Handle standard 2-character formats (YY, MM, DD, etc.)
                let corr = &correct[pos..pos + 2];
                if let Some(index) = format_str.find(corr) {
                    let array_index = index / 2;
                    if array_index < new_array.len() {
                        let value = new_array[array_index];
                        if let Some(fmt) = format_mapping.get(&format_str[index..index + 2]) {
                            if corr == "WW" {
                                // Handle the special case for weekdays
                                let weekday_index = value as usize;
                                if weekday_index < weekday_mapping.len() {
                                    formatted_data.push_str(&weekday_mapping[weekday_index]);
                                } else {
                                    formatted_data.push_str("未知");
                                }
                            } else {
                                // Use the format string directly from format_mapping
                                let fmt_string = fmt.replace("{:02X}", &format!("{:02X}", value));
                                formatted_data.push_str(&fmt_string);
                            }
                        }
                    }
                }
                pos += 2; // Move past the 2-character format
            } else {
                // Handle any remaining characters
                pos += 1;
            }
        }

        formatted_data
    }

    pub fn parse_ip_str(ipdata: &[u8]) -> String {
        if ipdata.len() < 4 {
            return String::new();
        }
        format!("{}.{}.{}.{}", ipdata[3], ipdata[2], ipdata[1], ipdata[0])
    }

    pub fn parse_port(port_data: &[u8]) -> String {
        if port_data.len() < 2 {
            return String::new();
        }
        Self::bintodecimal(port_data).to_string() // Convert u64 to String
    }

    pub fn str_reverse_with_space(s: &str) -> String {
        s.as_bytes()
            .chunks(2)
            .rev()
            .map(|chunk| std::str::from_utf8(chunk).unwrap().to_uppercase())
            .collect::<Vec<_>>()
            .join(" ")
    }

    pub fn str_order_with_space(s: &str) -> String {
        s.as_bytes()
            .chunks(2)
            .map(|chunk| std::str::from_utf8(chunk).unwrap().to_uppercase())
            .collect::<Vec<_>>()
            .join(" ")
    }

    pub fn item_to_di(item: u32, frame: &mut Vec<u8>) -> usize {
        let mut item = item; // Make item mutable
        for _ in 0..4 {
            let byte = (item & 0xFF) as u8; // Get the lowest 8 bits
            frame.push(byte); // Add the byte to the vector
            item >>= 8; // Right shift the item by 8 bits
        }
        4 // Return the size (4 bytes)
    }

    pub fn prase_text_to_frame(text: &str, frame: &mut Vec<u8>) -> usize {
        // Remove spaces and newlines
        let cleaned_string = text.replace(' ', "").replace('\n', "");

        // Convert every two characters to a hexadecimal number
        let hex_array: Vec<u8> = cleaned_string
            .as_bytes()
            .chunks(2)
            .filter_map(|chunk| {
                if let Ok(hex_str) = std::str::from_utf8(chunk) {
                    u8::from_str_radix(hex_str, 16).ok()
                } else {
                    None
                }
            })
            .collect();

        // Extend the frame vector with the hexadecimal values
        frame.extend(hex_array.iter());

        // Return the number of bytes added
        cleaned_string.len() / 2
    }

    pub fn cosem_bin2_int32u(bin: &[u8]) -> u32 {
        let mut val: u32 = 0;
        for &byte in bin {
            val <<= 8;
            val += byte as u32;
        }
        val
    }
}
