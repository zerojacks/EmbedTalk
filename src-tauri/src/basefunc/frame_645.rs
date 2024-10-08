use std::collections::VecDeque;
use crate::basefunc::frame_fun::FrameFun;
pub struct Frame645;

impl Frame645 {
    pub fn is_dlt645_frame(data: &[u8]) -> bool {
        // 判断报文长度是否符合最小要求
        if data.len() < 12 {
            return false;
        }

        // 判断起始符和结束符
        let position = FrameFun::get_frame_fe_count(data);
        if data[position] != 0x68 || data[data.len() - 1] != 0x16 || data[7 + position] != 0x68 {
            return false;
        }

        // 判断数据长度是否合法
        let data_length = data[position + 9];
        if data.len() != (data_length as usize) + 12 + position {
            return false;
        }

        // 计算校验位
        return true;
    }

    pub fn analysis_645_frame_by_afn(frame: &[u8], result_list: &mut Vec<String>, index: usize, region: &str) -> usize {
        let mut updated_index = index + analysis_head_frame(frame, result_list, index);
        let afn = frame[8];

        if afn == 0x11 { // 下行读取报文
            analysis_read_frame(frame, result_list, updated_index);
        } else if afn == 0x91 || afn == 0xB1 { // 读取回复正常
            analyze_read_response_frame(frame, result_list, updated_index);
        } else if matches!(afn, 0xD1 | 0xD2 | 0xD4 | 0xD6 | 0xD7 | 0xD9 | 0xDA | 0xDB) { // 异常应答
            analyze_read_err_frame(frame, result_list, updated_index);
        } else if afn == 0x12 { // 读取后续帧下行报文
            analysis_read_subsequent_frame(frame, result_list, updated_index);
        } else if afn == 0x92 || afn == 0xB2 { // 读取后续帧回复报文
            analyze_read_subsequent_response_frame(frame, result_list, updated_index);
        } else if afn == 0x14 { // 写数据
            analysis_write_frame(frame, result_list, updated_index);
        } else if afn == 0x93 { // 读通信地址正常应答
            analysis_read_address_frame(frame, result_list, updated_index);
        } else if afn == 0x15 { // 写数据
            analysis_write_address_frame(frame, result_list, updated_index);
        } else if afn == 0x08 {
            analysis_broadcast_time_frame(frame, result_list, updated_index);
        } else if afn == 0x16 { // 冻结命令
            analysis_write_frozen_time_frame(frame, result_list, updated_index);
        } else if afn == 0x17 || afn == 0x97 { // 更改通信速率
            analysis_write_baud_rate_frame(frame, result_list, updated_index);
        } else if afn == 0x18 { // 更改密码
            analysis_write_password_frame(frame, result_list, updated_index);
        } else if afn == 0x98 { // 修改密码应答
            analysis_write_password_response_frame(frame, result_list, updated_index);
        } else if afn == 0x19 { // 最大需量清零
            analysis_maximum_demand_reset_frame(frame, result_list, updated_index);
        } else if afn == 0x1A { // 电表清零
            analysis_meter_reset_frame(frame, result_list, updated_index);
        } else if afn == 0x1B { // 事件清零
            analysis_event_reset_frame(frame, result_list, updated_index);
        } else {
            analysis_invalid_frame(frame, result_list, updated_index);
        }
        analysis_end_frame(frame, result_list, updated_index);
        updated_index
    }

    pub fn analysis_head_frame(frame: &[u8], result_list: &mut Vec<String>, mut indx: usize) -> usize {
        // 拷贝原始数据到一个新的Vec
        let mut origin_array = frame.to_vec();
        let pos = FrameFun::get_frame_fe_count(&frame);
        
        // 清空frame（实际是对Vec操作）
        let mut frame_vec = Vec::from(&origin_array[pos..]);
    
        let data_length = frame_vec[9];  // 数据长度
        let control_code = frame_vec[8];  // 控制码
        let address = &frame_vec[1..7];  // 地址域
        let address_with_spaces = FrameFun::get_data_str_with_space(address);
        let address_str = FrameFun::get_data_str_reverser(address);
    
        if pos != 0 {
            FrameFun::add_data(result_list, "唤醒符", &FrameFun::get_data_str_with_space(&origin_array[..pos]), "电表规约：电能表唤醒符", vec![indx, indx + pos]);
            indx += pos;
        }
    
        FrameFun::add_data(result_list, "帧起始符", &format!("{:02X}", frame_vec[0]), "电表规约：标识一帧信息的开始", vec![indx + 0, indx + 1]);
        FrameFun::add_data(result_list, "地址域", &address_with_spaces, &("电表通信地址：".to_string() + &address_str), vec![indx + 1, indx + 7]);
    
        FrameFun::add_data(result_list, "帧起始符", &format!("{:02X}", frame_vec[7]), "电表规约：标识一帧信息的开始", vec![indx + 7, indx + 8]);
    
        let mut afn_data = Vec::new();
        let binary_array = FrameFun::get_bit_array(control_code);
        let func_code: String = binary_array.iter().rev().take(5).map(|&bit| bit.to_string()).collect();
    
        let func_code_str = match func_code.as_str() {
            "00000" => "保留",
            "01000" => "广播校时",
            "10001" => "读数据",
            "10010" => "读后续数据",
            "10011" => "读通信地址",
            "10100" => "写数据",
            "10101" => "写通信地址",
            "10110" => "冻结命令",
            "10111" => "更改通信速率",
            "11000" => "修改密码",
            "11001" => "最大需量清零",
            "11010" => "电表清零",
            "11011" => "事件清零",
            _ => "未知",
        };
    
        let binary_decimal = usize::from_str_radix(&func_code, 2).unwrap_or(0);
        let hexadecimal = format!("{:X}", binary_decimal);
    
        let d7_str = if binary_array[0] == 1 { "主站发出的命令帧" } else { "从站发出的应答帧" };
        let d6_str = if binary_array[1] == 0 { "从站正常应答" } else { "从站异常应答" };
        let d5_str = if binary_array[2] == 0 { "无后续数据帧" } else { "有后续数据帧" };
    
        FrameFun::add_data(&mut afn_data, "D7传送反向", &binary_array[0].to_string(), d7_str, vec![indx + 8, indx + 9]);
        FrameFun::add_data(&mut afn_data, "D6传送反向", &binary_array[1].to_string(), d6_str, vec![indx + 8, indx + 9]);
        FrameFun::add_data(&mut afn_data, "D5传送反向", &binary_array[2].to_string(), d5_str, vec![indx + 8, indx + 9]);
        FrameFun::add_data(&mut afn_data, "D0~D4功能码", &hexadecimal, func_code_str, vec![indx + 8, indx + 9]);
    
        let afn_str = if binary_array[0] == 1 { "主站请求：" } else { "电表返回：" };
        FrameFun::add_data(result_list, "控制码", &format!("{:02X}", control_code), &(afn_str.to_string() + func_code_str), vec![indx + 8, indx + 9], Some(afn_data));
        FrameFun::add_data(result_list, "数据长度", &format!("{:02X}", data_length), &format!("长度={}, 总长度={}(总长度=长度+12)", data_length, data_length + 12), vec![indx + 9, indx + 10]);
    
        pos
    }    
    pub fn funanalysis_end_frame(frame: &[u8], result_list: &mut Vec<String>, indx: usize) {
        let length = frame.len();
        let cs = FrameFun::caculate_cs(&frame[..length - 2]);
        let cs_str = if cs == frame[length - 2] {
            "电表规约报文校验码正确".to_string()
        } else {
            format!("电表规约校验码错误，应为：{:02X}", cs)
        };
        FrameFun::add_data(result_list, "校验码", &format!("{:02X}", frame[length - 2]), &cs_str, &[indx + length - 2, indx + length - 1]);
        FrameFun::add_data(result_list, "结束符", &format!("{:02X}", frame[length - 1]), "电表规约报文结束符", &[indx + length - 1, indx + length]);
    }
    
    pub fn funanalysis_read_frame(frame: &[u8], result_list: &mut Vec<String>, indx: usize) {
        let length = frame.len();
        let data_identifier = &frame[10..14];
        let data_length = frame[9] as isize;
        let read_type = data_length - 4;
    
        let data_identifier_str = FrameFun::get_data_str_delete_33h_reverse(data_identifier);
    
        let mut data_list = Vec::new();
        if let Some(data_item) = ProtocolConfigManager::get_config_xml(&data_identifier_str, ProtocolInfo::PROTOCOL_DLT64507.name(), &GLOBAL_CONFIG_MANAGER.global_region.get_value()) {
            let data_identifier_str = format!("数据标识编码：[{}] - {}", data_identifier_str, data_item.find("name").unwrap().text().unwrap());
            FrameFun::add_data(&mut data_list, "数据标识编码", &FrameFun::get_data_str_with_space(data_identifier), &data_identifier_str, &[indx + 10, indx + 14]);
    
            if read_type == 1 {
                let block_num = frame[14] - 0x33;
                FrameFun::add_data(&mut data_list, "负荷记录块数", &format!("{:02X}", frame[14]), &format!("负荷记录块数={}", block_num), &[indx + 14, indx + 15]);
            } else if read_type == 6 {
                let block_num = frame[14] - 0x33;
                FrameFun::add_data(&mut data_list, "负荷记录块数", &format!("{:02X}", frame[14]), &format!("负荷记录块数={}", block_num), &[indx + 14, indx + 15]);
                FrameFun::add_data(&mut data_list, "给定时间", &FrameFun::get_data_str_with_space(&frame[15..length - 2]), &FrameFun::parse_time_data(&frame[15..length - 2], "mmhhDDMMYY", true), &[indx + 15, indx + length - 2]);
            } else if read_type > 0 {
                FrameFun::add_data(&mut data_list, "液晶查看命令", &frame[14..length - 2].iter().map(|b| format!("{:02X}", b)).collect::<Vec<String>>().join(" "), "", &[indx + 14, indx + length - 2]);
            }
        } else {
            let data_identifier_str = format!("数据标识编码：[{}]", data_identifier_str);
            FrameFun::add_data(&mut data_list, "数据标识编码", &FrameFun::get_data_str_with_space(data_identifier), &data_identifier_str, &[indx + 10, indx + 14]);
        }
    
        FrameFun::add_data(result_list, "数据域", "", "数据域传输时按字节进行加33H处理，接收后应按字节减33H处理", &[indx + 10, length + indx - 2], &data_list);
    }
    
    pub fn funanalyze_read_response_frame(frame: &[u8], result_list: &mut Vec<String>, indx: usize) {
        let mut data_list = Vec::new();
        let data_identifier = &frame[10..14];
        let data_content = &frame[14..frame.len() - 2];
        let length = frame.len();
        let prase_data = PraseFrameData::new();
        let data_identifier_str = FrameFun::get_data_str_delete_33h_reverse(data_identifier);
    
        if let Some(data_item_elem) = ProtocolConfigManager::get_config_xml(&data_identifier_str, ProtocolInfo::PROTOCOL_DLT64507.name(), &GLOBAL_CONFIG_MANAGER.global_region.get_value()) {
            let mut sub_result = Vec::new();
            let sublength_ele = data_item_elem.find("length");
    
            let sublength = if let Some(sublength_ele) = sublength_ele {
                if sublength_ele.text().unwrap().to_uppercase() == "UNKNOWN" {
                    prase_data.caculate_item_length(&data_item_elem, data_content, ProtocolInfo::PROTOCOL_DLT64507.name())
                } else {
                    sublength_ele.text().unwrap().parse::<usize>().unwrap()
                }
            } else {
                data_content.len()
            };
    
            let mut all_length = data_content.len();
            if all_length % sublength != 0 && all_length > sublength {
                let time = &data_content[..5];
                let time_str = FrameFun::parse_time_data(time, "YYMMDDhhmm", true);
                FrameFun::add_data(&mut sub_result, "数据起始时间", &FrameFun::get_data_str_with_space(time), &time_str, &[indx + 14, indx + 19]);
                all_length -= 5;
                indx += 5;
            }
    
            let mut pos = 0;
            while pos < all_length {
                let alalysic_result = FrameAnalisyic::prase_data(&data_identifier_str, ProtocolInfo::PROTOCOL_DLT64507.name(), &GLOBAL_CONFIG_MANAGER.global_region.get_value(), &data_content[pos..pos + sublength], 14 + pos + indx);
                FrameFun::prase_data_with_config(alalysic_result, true, &mut sub_result);
                pos += sublength;
            }
    
            let dis_data_identifier = format!("数据标识编码：[{}] - {}", data_identifier_str, data_item_elem.find("name").unwrap().text().unwrap());
            FrameFun::add_data(&mut data_list, "数据标识编码", &FrameFun::get_data_str_with_space(data_identifier), &dis_data_identifier, &[indx + 10, indx + 14]);
            FrameFun::add_data(&mut data_list, "数据标识内容", &FrameFun::get_data_str_with_space(data_content), &format!("数据标识[{}]内容数据{}", data_identifier_str, FrameFun::get_data_str_delete_33h_reverse(data_content)), &[indx + 14, indx + length - 2], &sub_result);
        } else {
            let dis_data_identifier = format!("数据标识编码：[{}]", data_identifier_str);
            FrameFun::add_data(&mut data_list, "数据标识编码", &FrameFun::get_data_str_with_space(data_identifier), &dis_data_identifier, &[indx + 10, indx + 14]);
            FrameFun::add_data(&mut data_list, "数据标识内容", &FrameFun::get_data_str_with_space(data_content), &format!("数据标识[{}]内容数据{}", data_identifier_str, FrameFun::get_data_str_delete_33h_reverse(data_content)), &[indx + 14, indx + length - 2]);
        }
    
        FrameFun::add_data(result_list, "数据域", "", "数据域传输时按字节进行加33H处理，接收后应按字节减33H处理", &[indx + 10, indx + length - 2], &data_list);
    }
    
    pub fn funanalyze_read_err_frame(frame: &[u8], result_list: &mut Vec<String>, indx: usize) {
        let length = frame.len();
        let err_code = frame[10];
        let mut binary_array = Vec::new();
        FrameFun::get_bit_array((err_code - 0x33) & 0xFF, &mut binary_array);
        let reversed_array: Vec<_> = binary_array[..8].iter().rev().collect();
    
        let err_str = if reversed_array[1] == &1 {
            "无请求数据"
        } else if reversed_array[2] == &1 {
            "密码错误/未授权"
        } else if reversed_array[3] == &1 {
            "通信速率不能更改"
        } else if reversed_array[4] == &1 {
            "年时区数超"
        } else if reversed_array[5] == &1 {
            "时段数超"
        } else if reversed_array[6] == &1 {
            "费率数超"
        } else if (err_code - 0x33) & 0xFF != 0 {
            "其他错误"
        } else {
            ""
        };
    
        FrameFun::add_data(result_list, "错误信息字", &format!("{:02X}", err_code), &format!("错误类型: {}", err_str), &[indx + 10, indx + length - 2]);
    }
    
    pub fn funanalysis_read_subsequent_frame(frame: &[u8], result_list: &mut Vec<String>, indx: usize) {
        let data_identifier = &frame[10..14];
        let data_length = frame[9];
        let seq = frame[frame.len() - 3];
        let length = frame.len();
        let data_identifier_str = FrameFun::get_data_str_delete_33h_reverse(data_identifier);
    
        let mut data_list = Vec::new();
        if let Some(data_item) = ProtocolConfigManager::get_config_xml(&data_identifier_str, ProtocolInfo::PROTOCOL_DLT64507.name(), &GLOBAL_CONFIG_MANAGER.global_region.get_value()) {
            let data_identifier_str = format!("数据标识编码：[{}] - {}", data_identifier_str, data_item.find("name").unwrap().text().unwrap());
            FrameFun::add_data(&mut data_list, "数据标识编码", &FrameFun::get_data_str_with_space(data_identifier), &data_identifier_str, &[indx + 10, indx + 14]);
        } else {
            let data_identifier_str = format!("数据标识编码：[{}]", data_identifier_str);
            FrameFun::add_data(&mut data_list, "数据标识编码", &FrameFun::get_data_str_with_space(data_identifier), &data_identifier_str, &[indx + 10, indx + 14]);
        }
    
        FrameFun::add_data(&mut data_list, "帧序号", &format!("{:02X}", seq), &format!("请求帧序号: {:02X}", (seq - 0x33) & 0xFF), &[indx + length - 3, indx + length - 2]);
        FrameFun::add_data(result_list, "数据域", "", "数据域传输时按字节进行加33H处理，接收后应按字节减33H处理", &[indx + 10, indx + length - 2], &data_list);
    }
    
    pub fn funanalyze_read_subsequent_response_frame(frame: &[u8], result_list: &mut Vec<String>, indx: usize) {
        let mut data_list = Vec::new();
        let data_identifier = &frame[10..14];
        let data_content = &frame[14..frame.len() - 2];
        let seq = frame[frame.len() - 3];
        let length = frame.len();
        let prase_data = PraseFrameData::new();
        let data_identifier_str = FrameFun::get_data_str_delete_33h_reverse(data_identifier);
    
        FrameFun::add_data(&mut data_list, "数据标识编码", &FrameFun::get_data_str_with_space(data_identifier), &format!("数据标识编码：{}", data_identifier_str), &[indx + 10, indx + 14]);
    
        if let Some(data_item_elem) = ProtocolConfigManager::get_config_xml(&data_identifier_str, ProtocolInfo::PROTOCOL_DLT64507.name(), &GLOBAL_CONFIG_MANAGER.global_region.get_value()) {
            let mut sub_result = Vec::new();
            let alalysic_result = FrameAnalisyic::prase_data(&data_identifier_str, ProtocolInfo::PROTOCOL_DLT64507.name(), &GLOBAL_CONFIG_MANAGER.global_region.get_value(), data_content, indx + 14);
            FrameFun::prase_data_with_config(alalysic_result, true, &mut sub_result);
    
            FrameFun::add_data(&mut data_list, "数据标识内容", &FrameFun::get_data_str_with_space(data_content), &format!("数据标识[{}]内容数据{}", data_identifier_str, FrameFun::get_data_str_delete_33h_reverse(data_content)), &[indx + 14, indx + length - 2], &sub_result);
        } else {
            FrameFun::add_data(&mut data_list, "数据标识内容", &FrameFun::get_data_str_with_space(data_content), &format!("数据标识[{}]内容数据{}", data_identifier_str, FrameFun::get_data_str_delete_33h_reverse(data_content)), &[indx + 14, indx + length - 2]);
        }
    
        FrameFun::add_data(&mut data_list, "帧序号", &format!("{:02X}", seq), &format!("请求帧序号: {:02X}", (seq - 0x33) & 0xFF), &[indx + length - 3, indx + length - 2]);
        FrameFun::add_data(result_list, "数据域", "", "数据域传输时按字节进行加33H处理，接收后应按字节减33H处理", &[indx + 10, indx + length - 2], &data_list);
    }
    
    pub fn funanalysis_write_frame(frame: &[u8], result_list: &mut Vec<String>, indx: usize) {
        let data_identifier = &frame[10..14];
        let data_length = frame[9];
        let password = &frame[14..18];
        let operator = &frame[18..22];
        let length = frame.len();
        let write_data = &frame[22..length - 2];
    
        let item_str = FrameFun::get_data_str_delete_33h_reverse(data_identifier);
        let mut data_list = Vec::new();
        let prase_data = PraseFrameData::new();
    
        if let Some(data_item) = ProtocolConfigManager::get_config_xml(&item_str, ProtocolInfo::PROTOCOL_DLT64507.name(), &GLOBAL_CONFIG_MANAGER.global_region.get_value()) {
            let data_identifier_str = format!("数据标识编码：[{}] - {}", item_str, data_item.find("name").unwrap().text().unwrap());
            FrameFun::add_data(&mut data_list, "数据标识编码", &FrameFun::get_data_str_with_space(data_identifier), &data_identifier_str, &[indx + 10, indx + 14]);
    
            FrameFun::add_data(&mut data_list, "密码权限", &format!("{:02X}", password[0]), &format!("权限：{:02X}", (password[0] - 0x33) & 0xFF), &[indx + 14, indx + 15]);
            FrameFun::add_data(&mut data_list, "密码", &FrameFun::get_data_str_with_space(&password[1..]), &format!("密码：{}", FrameFun::get_data_str_delete_33h_reverse(&password[1..])), &[indx + 15, indx + 18]);
            FrameFun::add_data(&mut data_list, "操作者代码", &FrameFun::get_data_str_with_space(operator), &format!("操作者代码：{}", FrameFun::get_data_str_delete_33h_reverse(operator)), &[indx + 18, indx + 22]);
    
            let mut write_result = Vec::new();
            let alalysic_result = FrameAnalisyic::prase_data(&item_str, ProtocolInfo::PROTOCOL_DLT64507.name(), &GLOBAL_CONFIG_MANAGER.global_region.get_value(), write_data, 22 + indx);
            FrameFun::prase_data_with_config(alalysic_result, true, &mut write_result);
    
            FrameFun::add_data(&mut data_list, "数据内容", &FrameFun::get_data_str_with_space(write_data), &format!("写数据内容：{}", FrameFun::get_data_str_delete_33h_reverse(write_data)), &[indx + 22, indx + write_data.len() + 22], &write_result);
        } else {
            FrameFun::add_data(&mut data_list, "数据内容", &FrameFun::get_data_str_with_space(write_data), &format!("写数据内容：{}", FrameFun::get_data_str_delete_33h_reverse(write_data)), &[indx + 22, indx + write_data.len() + 22]);
        }
    
        FrameFun::add_data(result_list, "数据域", "", "数据域传输时按字节进行加33H处理，接收后应按字节减33H处理", &[indx + 10, indx + write_data.len() + 22], &data_list);
    }
    
    pub fn funanalyze_write_replay_frame(frame: &[u8], result_list: &mut Vec<String>, indx: usize) {
        let err_code = frame[frame.len() - 3];
        let err_str = if err_code != 0 {
            "写数据错误"
        } else {
            "正常应答"
        };
        let length = frame.len();
        FrameFun::add_data(result_list, "写数据应答", &format!("{:02X}", err_code), err_str, &[indx + length - 3, indx + length - 2]);
    }
    
    pub fn funanalysis_read_address_frame(frame: &[u8], result_list: &mut Vec<String>, indx: usize) {
        let address = &frame[10..16];
        let mut data_list = Vec::new();
        let length = frame.len();
        FrameFun::add_data(&mut data_list, "数据内容", &FrameFun::get_data_str_with_space(address), &format!("通信地址：{}", FrameFun::get_data_str_delete_33h_reverse(address)), &[indx + 10, indx + 16]);
        FrameFun::add_data(result_list, "数据域", "", "数据域传输时按字节进行加33H处理，接收后应按字节减33H处理", &[indx + 10, indx + 16], &data_list);
    }
    
    pub fn funanalysis_write_address_frame(frame: &[u8], result_list: &mut Vec<String>, indx: usize) {
        let address = &frame[10..16];
        let mut data_list = Vec::new();
        FrameFun::add_data(&mut data_list, "数据内容", &FrameFun::get_data_str_with_space(address), &format!("写通信地址：{}", FrameFun::get_data_str_delete_33h_reverse(address)), &[indx + 10, indx + 16]);
        FrameFun::add_data(result_list, "数据域", "", "数据域传输时按字节进行加33H处理，接收后应按字节减33H处理", &[indx + 10, indx + 16], &data_list);
    }
    
    pub fn funanalysis_broadcast_time_frame(frame: &[u8], result_list: &mut Vec<String>, indx: usize) {
        let time = &frame[10..16];
        let mut data_list = Vec::new();
        let form_time = &time[..6];
        FrameFun::add_data(&mut data_list, "数据内容", &FrameFun::get_data_str_with_space(time), &format!("校时时间：{}", FrameFun::parse_time_data(form_time, "ssmmhhDDMMYY", true)), &[indx + 10, indx + 16]);
        FrameFun::add_data(result_list, "数据域", "", "数据域传输时按字节进行加33H处理，接收后应按字节减33H处理", &[indx + 10, indx + 16], &data_list);
    }
    
    pub fn funanalysis_write_frozen_time_frame(frame: &[u8], result_list: &mut Vec<String>, indx: usize) {
        let time = &frame[10..14];
        let mut form_time = FrameFun::frame_delete_33h(time);
        form_time.reverse();
        let mut data_list = Vec::new();
        let frozen_type = FrameFun::parse_freeze_time(&form_time);
        FrameFun::add_data(&mut data_list, "数据内容", &FrameFun::get_data_str_with_space(time), &format!("冻结命令：{} 表示冻结时间为：{}", FrameFun::get_data_str_delete_33h_reverse(time), frozen_type), &[indx + 10, indx + frame.len() - 2]);
        FrameFun::add_data(result_list, "数据域", "", "数据域传输时按字节进行加33H处理，接收后应按字节减33H处理", &[indx + 10, indx + frame.len() - 2], &data_list);
    }
    
    pub fn funanalysis_write_baud_rate_frame(frame: &[u8], result_list: &mut Vec<String>, indx: usize) {
        let communication_rate = frame[10];
        let mut data_list = Vec::new();
        let mut binary_array = Vec::new();
        FrameFun::get_bit_array((communication_rate - 0x33) & 0xFF, &mut binary_array);
        let reversed_array: Vec<_> = binary_array[..8].iter().rev().collect();
    
        let rate = if !FrameFun::is_only_one_bit_set((communication_rate - 0x33) & 0xFF) {
            "特征字错误(多个bit位为1)".to_string()
        } else if reversed_array[0] == &1 || reversed_array[7] == &1 {
            "保留".to_string()
        } else if reversed_array[1] == &1 {
            "600bps".to_string()
        } else if reversed_array[2] == &1 {
            "1200bps".to_string()
        } else if reversed_array[3] == &1 {
            "2400bps".to_string()
        } else if reversed_array[4] == &1 {
            "4800bps".to_string()
        } else if reversed_array[5] == &1 {
            "9600bps".to_string()
        } else if reversed_array[6] == &1 {
            "19200bps".to_string()
        } else {
            "".to_string()
        };
    
        FrameFun::add_data(&mut data_list, "数据内容", &format!("{:02X}", (communication_rate - 0x33) & 0xFF), &format!("通信速率特征字：{:02X} 通信速率：{}", (communication_rate - 0x33) & 0xFF, rate), &[indx + 10, indx + 11]);
        FrameFun::add_data(result_list, "数据域", "", "数据域传输时按字节进行加33H处理，接收后应按字节减33H处理", &[indx + 10, indx + frame.len() - 2], &data_list);
    }
    
    pub fn funanalysis_write_password_frame(frame: &[u8], result_list: &mut Vec<String>, indx: usize) {
        let item = &frame[10..14];
        let original_password = &frame[14..18];
        let new_password = &frame[18..22];
        let mut sub_result = Vec::new();
        let mut data_list = Vec::new();
    
        FrameFun::add_data(&mut sub_result, "数据标识编码", &FrameFun::get_data_str_with_space(item), &format!("数据标识[{}]", FrameFun::get_data_str_delete_33h_reverse(item)), &[indx + 10, indx + 14]);
        FrameFun::add_data(&mut sub_result, "原密码及权限", &FrameFun::get_data_str_with_space(original_password), &format!("原密码权限：{:02X} 原密码：{}", (original_password[0] - 0x33) & 0xFF, FrameFun::get_data_str_delete_33h_reverse(&original_password[1..])), &[indx + 14, indx + 18]);
        FrameFun::add_data(&mut sub_result, "新密码及权限", &FrameFun::get_data_str_with_space(new_password), &format!("新密码权限：{:02X} 新密码：{}", (new_password[0] - 0x33) & 0xFF, FrameFun::get_data_str_delete_33h_reverse(&new_password[1..])), &[indx + 18, indx + 22]);
        FrameFun::add_data(&mut data_list, "数据内容", &FrameFun::get_data_str_with_space(&frame[10..frame.len() - 2]), "密码设置", &[indx + 14, indx + 22], &sub_result);
        FrameFun::add_data(result_list, "数据域", "", "数据域传输时按字节进行加33H处理，接收后应按字节减33H处理", &[indx + 10, indx + frame.len() - 2], &data_list);
    }
    
    pub fn funanalysis_write_password_response_frame(frame: &[u8], result_list: &mut Vec<String>, indx: usize) {
        let new_password = &frame[10..14];
        let mut sub_result = Vec::new();
        let mut data_list = Vec::new();
    
        FrameFun::add_data(&mut sub_result, "新密码及权限", &FrameFun::get_data_str_with_space(new_password), &format!("新密码权限：{:02X} 新密码：{}", (new_password[0] - 0x33) & 0xFF, FrameFun::get_data_str_delete_33h_reverse(&new_password[1..])), &[indx + 10, indx + 14]);
        FrameFun::add_data(&mut data_list, "数据内容", &FrameFun::get_data_str_with_space(&frame[10..frame.len() - 2]), "密码设置", &[indx + 10, indx + 14], &sub_result);
        FrameFun::add_data(result_list, "数据域", "", "数据域传输时按字节进行加33H处理，接收后应按字节减33H处理", &[indx + 10, indx + frame.len() - 2], &data_list);
    }
    
    pub fn funanalysis_maximum_demand_reset_frame(frame: &[u8], result_list: &mut Vec<String>, indx: usize) {
        let password = &frame[10..14];
        let operator = &frame[14..18];
        let mut sub_result = Vec::new();
        let mut data_list = Vec::new();
    
        FrameFun::add_data(&mut sub_result, "密码权限", &FrameFun::get_data_str_with_space(password), &format!("权限：{:02X} 密码：{}", (password[0] - 0x33) & 0xFF, FrameFun::get_data_str_delete_33h_reverse(&password[1..])), &[indx + 10, indx + 14]);
        FrameFun::add_data(&mut sub_result, "操作者代码", &FrameFun::get_data_str_with_space(operator), &format!("操作者代码：{}", FrameFun::get_data_str_delete_33h_reverse(operator)), &[indx + 14, indx + 18]);
        FrameFun::add_data(&mut data_list, "数据内容", &FrameFun::get_data_str_with_space(&frame[10..frame.len() - 2]), "最大需量清零", &[indx + 10, indx + frame.len() - 2], &sub_result);
        FrameFun::add_data(result_list, "数据域", "", "数据域传输时按字节进行加33H处理，接收后应按字节减33H处理", &[indx + 10, indx + frame.len() - 2], &data_list);
    }
    
    pub fn funanalysis_meter_reset_frame(frame: &[u8], result_list: &mut Vec<String>, indx: usize) {
        let password = &frame[10..14];
        let operator = &frame[14..18];
        let mut sub_result = Vec::new();
        let mut data_list = Vec::new();
    
        FrameFun::add_data(&mut sub_result, "密码权限", &FrameFun::get_data_str_with_space(password), &format!("权限：{:02X} 密码：{}", (password[0] - 0x33) & 0xFF, FrameFun::get_data_str_delete_33h_reverse(&password[1..])), &[indx + 10, indx + 14]);
        FrameFun::add_data(&mut sub_result, "操作者代码", &FrameFun::get_data_str_with_space(operator), &format!("操作者代码：{}", FrameFun::get_data_str_delete_33h_reverse(operator)), &[indx + 14, indx + 18]);
        FrameFun::add_data(&mut data_list, "数据内容", &FrameFun::get_data_str_with_space(&frame[10..frame.len() - 2]), "电表清零", &[indx + 10, indx + 18], &sub_result);
        FrameFun::add_data(result_list, "数据域", "", "数据域传输时按字节进行加33H处理，接收后应按字节减33H处理", &[indx + 10, indx + 18], &data_list);
    }
    
    pub fn funanalysis_event_reset_frame(frame: &[u8], result_list: &mut Vec<String>, indx: usize) {
        let password = &frame[10..14];
        let operator = &frame[14..18];
        let item = &frame[18..22];
        let mut sub_result = Vec::new();
        let mut data_list = Vec::new();
        let event_type = if FrameFun::is_all_elements_equal(item, 0x32) {
            "事件总清零"
        } else {
            "分项事件清零"
        };
    
        FrameFun::add_data(&mut sub_result, "密码权限", &FrameFun::get_data_str_with_space(password), &format!("权限：{:02X} 密码：{}", (password[0] - 0x33) & 0xFF, FrameFun::get_data_str_delete_33h_reverse(&password[1..])), &[indx + 10, indx + 14]);
        FrameFun::add_data(&mut sub_result, "操作者代码", &FrameFun::get_data_str_with_space(operator), &format!("操作者代码：{}", FrameFun::get_data_str_delete_33h_reverse(operator)), &[indx + 14, indx + 18]);
        FrameFun::add_data(&mut sub_result, "事件清零类型", &FrameFun::get_data_str_with_space(item), &format!("事件清零：[{}] - {}", FrameFun::get_data_str_delete_33h_reverse(item), event_type), &[indx + 18, indx + 22]);
        FrameFun::add_data(&mut data_list, "数据内容", &FrameFun::get_data_str_with_space(&frame[10..frame.len() - 2]), "事件清零", &[indx + 10, indx + 22], &sub_result);
        FrameFun::add_data(result_list, "数据域", "", "数据域传输时按字节进行加33H处理，接收后应按字节减33H处理", &[indx + 10, indx + frame.len() - 2], &data_list);
    }
    
    pub fn funanalysis_invalid_frame(frame: &[u8], result_list: &mut Vec<String>, indx: usize) {
        let mut data_list = Vec::new();
        let length = frame.len();
        FrameFun::add_data(&mut data_list, "数据内容", &FrameFun::get_data_str_with_space(&frame[10..frame.len() - 2]), &format!("数据域数据：{}", FrameFun::get_data_str_delete_33h_reverse(&frame[10..frame.len() - 2])), &[indx + 10, indx + length - 2]);
        FrameFun::add_data(result_list, "数据域", "", "数据域传输时按字节进行加33H处理，接收后应按字节减33H处理", &[indx + 10, indx + length - 2], &data_list);
    }    
}