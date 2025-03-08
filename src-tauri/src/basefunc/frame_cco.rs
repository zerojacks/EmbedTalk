use crate::basefunc::frame_csg::FrameCsg;
use crate::basefunc::frame_fun::FrameFun;
use crate::basefunc::protocol::{FrameAnalisyic, ProtocolInfo};
use crate::config::xmlconfig::ProtocolConfigManager;
use serde_json::Value;

const FRAME_START: u8 = 0x68;
const FRAME_END: u8 = 0x16;

pub struct FrameCCO;

impl FrameCCO {
    pub fn is_cco_frame(frame: &[u8]) -> bool {
        if frame.len() < 3 {
            return false;
        }
        if frame[0] != FRAME_START || frame[frame.len() - 1] != FRAME_END {
            return false;
        }
        let length = FrameFun::bintodecimal(&frame[1..3]);
        let bit_array = FrameFun::get_bit_array(frame[3]);
        let dir = bit_array[0];
        let prm = bit_array[1];
        let add = bit_array[2];
        if add == 0 {
            if frame.len() < 10 {
                return false;
            }
            let item_data = frame[6..10].to_vec();
            let item = FrameFun::bintodecimal(&item_data);
            if item & 0xEC000000 == 0xEC000000 {
                return false;
            }
        }
        return length == frame.len() as u64;
    }

    pub fn get_control_code_str(
        control_data: u8,
        control_result: &mut Vec<Value>,
        index: usize,
    ) -> (u8, u8, u8, u8) {
        let bit_array = FrameFun::get_bit_array(control_data);
        let dir = bit_array[0];
        let prm = bit_array[1];
        let add = bit_array[2];
        let ver = control_data & 0x0c;
        let keep = control_data & 0x03;

        let dir_str = if dir == 0 {
            "下行报文"
        } else {
            "上行报文"
        };
        let prm_str = if prm == 1 {
            "表示此帧报文来自启动站"
        } else {
            "表示此帧报文来自从动站"
        };
        let add_str = if add == 1 {
            "表示此帧报文带地址域"
        } else {
            "表示此帧报文不带地址域"
        };
        let ver_str = format!("协议版本号:{}", ver);

        FrameFun::add_data(
            control_result,
            "传输方向位DIR".to_string(),
            dir.to_string(),
            dir_str.to_string(),
            vec![index + 0, index + 1],
            None,
            None,
        );
        FrameFun::add_data(
            control_result,
            "启动标志位PRM".to_string(),
            prm.to_string(),
            prm_str.to_string(),
            vec![index + 0, index + 1],
            None,
            None,
        );
        FrameFun::add_data(
            control_result,
            "地址域标志位ADD".to_string(),
            add.to_string(),
            add_str.to_string(),
            vec![index + 0, index + 1],
            None,
            None,
        );
        FrameFun::add_data(
            control_result,
            "协议版本号VER".to_string(),
            ver.to_string(),
            ver_str.to_string(),
            vec![index + 0, index + 1],
            None,
            None,
        );
        FrameFun::add_data(
            control_result,
            "保留位".to_string(),
            keep.to_string(),
            format!("保留位={}", keep),
            vec![index + 0, index + 1],
            None,
            None,
        );

        (dir, prm, add, ver)
    }

    pub fn get_user_data_result(
        adress_area: &[u8],
        add: u8,
        result_list: &mut Vec<Value>,
        index: usize,
    ) {
        let source_address = &adress_area[0..6];
        let target_address = &adress_area[6..12];

        FrameFun::add_data(
            result_list,
            "源地址 ASR".to_string(),
            FrameFun::get_data_str_with_space(source_address),
            format!("源地址:{}", FrameFun::get_data_str_reverser(source_address)),
            vec![index, index + 6],
            None,
            None,
        );

        FrameFun::add_data(
            result_list,
            "目的地址 ADST".to_string(),
            FrameFun::get_data_str_with_space(target_address),
            format!(
                "目的地址:{}",
                FrameFun::get_data_str_reverser(target_address)
            ),
            vec![index + 6, index + 12],
            None,
            None,
        );
    }

    pub fn get_afn_info(dir_type: u8, _prm: u8, afn: u8) -> &'static str {
        match dir_type {
            0xE8 => match afn {
                0x00 => "确认/否认",
                0x01 => "初始化模块",
                0x02 => "管理任务",
                0x03 => "读参数",
                0x04 => "写参数",
                0x05 => "上报信息",
                0x06 => "请求信息",
                0x07 => "传输文件",
                0x10 => "维护命令",
                0xF0 => "维护模块",
                _ => "未知",
            },
            _ => match afn {
                0x00 => "确认/否认",
                0x21 => "管理电表",
                0x22 => "转发数据",
                0x23 => "读参数",
                0x24 => "传输文件",
                0x25 => "请求信息",
                0x31 => "管理映射表表计",
                _ => "未知",
            },
        }
    }

    pub fn analysic_cco_frame_by_afn(
        frame: &[u8],
        result_list: &mut Vec<Value>,
        index: usize,
        region: &str,
    ) {
        let (dir, prm, add, afn, pos, mut user_result) =
            Self::analysic_cco_head_frame(frame, result_list, index);

        let app_data = &frame[pos..frame.len() - 2];
        let mut app_data_result = Vec::new();
        let protocol = ProtocolInfo::ProtocolCSG16.name().to_string();
        Self::analysic_cco_appdata_frame(
            app_data,
            &mut app_data_result,
            dir,
            index + pos,
            &protocol,
            region,
        );

        // 添加应用数据域
        FrameFun::add_data(
            &mut user_result,
            "应用数据域".to_string(),
            FrameFun::get_data_str_with_space(app_data),
            format!("应用数据:{}", FrameFun::get_data_str_reverser(app_data)),
            vec![index + pos, index + pos + app_data.len()],
            Some(app_data_result),
            None,
        );

        // 添加用户数据域
        FrameFun::add_data(
            result_list,
            "用户数据域".to_string(),
            FrameFun::get_data_str_with_space(&frame[4..frame.len() - 2]),
            format!(
                "用户数据:{}",
                FrameFun::get_data_str_reverser(&frame[4..frame.len() - 2])
            ),
            vec![index + 4, index + frame.len() - 2],
            Some(user_result),
            None,
        );

        Self::analysic_cco_end_frame(frame, result_list, dir, index);
    }

    fn analysic_cco_head_frame(
        frame: &[u8],
        result_list: &mut Vec<Value>,
        index: usize,
    ) -> (u8, u8, u8, u8, usize, Vec<Value>) {
        let start = frame[0];
        let len_data = &frame[1..3];
        let length = FrameFun::bintodecimal(len_data);
        let control_data = frame[3];

        let mut pos = 4;

        FrameFun::add_data(
            result_list,
            "起始符".to_string(),
            format!("{:02X}", start),
            "起始符".to_string(),
            vec![index, index + 1],
            None,
            None,
        );

        FrameFun::add_data(
            result_list,
            "长度".to_string(),
            FrameFun::get_data_str_with_space(len_data),
            format!("总长度={}", length),
            vec![index + 1, index + 3],
            None,
            None,
        );

        let mut contro_result = Vec::new();
        let (dir, prm, add, ver) =
            Self::get_control_code_str(control_data, &mut contro_result, index + 3);

        FrameFun::add_data(
            result_list,
            "控制域C".to_string(),
            format!("{:02X}", control_data),
            format!("控制域:{:02X}", control_data),
            vec![index + 3, index + 4],
            Some(contro_result),
            None,
        );

        let mut user_result = Vec::new();

        if add == 1 {
            let mut address_area_result = Vec::new();
            let address_area = &frame[pos..pos + 12];
            Self::get_user_data_result(address_area, add, &mut address_area_result, index + 4);

            FrameFun::add_data(
                &mut user_result,
                "地址域A".to_string(),
                FrameFun::get_data_str_with_space(address_area),
                format!("地址域:{}", FrameFun::get_data_str_reverser(address_area)),
                vec![index + pos, index + pos + 12],
                Some(address_area_result),
                None,
            );

            pos += 12;
        }

        let afn = frame[pos];
        let dir_type = frame[pos + 5];
        let afn_str = Self::get_afn_info(dir_type, prm, afn);

        FrameFun::add_data(
            &mut user_result,
            "应用功能码 AFN".to_string(),
            format!("{:02X}", afn),
            format!("AFN:{:02X}-{}", afn, afn_str),
            vec![index + pos, index + pos + 1],
            None,
            None,
        );

        pos += 1;
        let seq = frame[pos];

        FrameFun::add_data(
            &mut user_result,
            "帧序列域 SEQ".to_string(),
            format!("{:02X}", seq),
            format!("帧序列SEQ:{}", seq),
            vec![index + pos, index + pos + 1],
            None,
            None,
        );

        pos += 1;
        (dir, prm, add, afn, pos, user_result)
    }

    fn get_direction_str(dir: u8) -> &'static str {
        match dir {
            0x00 => "上下行均用，但下行无数据内容",
            0x01 => "上下行均用，数据内容格式一致",
            0x02 => "仅下行用，上行为确认/否认报文",
            0x03 => "仅下行用，带数据内容。对应上行报文为 04",
            0x04 => "仅上行用，带数据内容。对应下行报文为 03",
            0x05 => "仅上行用，下行为确认/否认报文",
            0x06 => "上下行均用，但上行无数据内容",
            _ => "未知",
        }
    }

    fn analysic_cco_di_data(di: &[u8], result: &mut Vec<Value>, index: usize) {
        let di0 = di[0];
        let di1 = di[1];
        let di2 = di[2];
        let di3 = di[3];

        let di0_str = "功能码子类型".to_string();
        let di1_str = format!(
            "功能码类型定义,与AFN值保持一致：{}",
            Self::get_afn_info(di3, 1, di1)
        );
        let di2_str = format!("报文上下行类型{}", Self::get_direction_str(di2));
        let di3_str = format!(
            "通信双方类型标识:{:02X}-{}",
            di3,
            if di3 == 0xE8 {
                "集中器与本地模块通信"
            } else {
                "采集器与本地模块通信"
            }
        );

        FrameFun::add_data(
            result,
            "DI0".to_string(),
            format!("{:02X}", di0),
            di0_str,
            vec![index, index + 1],
            None,
            None,
        );
        FrameFun::add_data(
            result,
            "DI1".to_string(),
            format!("{:02X}", di1),
            di1_str,
            vec![index + 1, index + 2],
            None,
            None,
        );
        FrameFun::add_data(
            result,
            "DI2".to_string(),
            format!("{:02X}", di2),
            di2_str,
            vec![index + 2, index + 3],
            None,
            None,
        );
        FrameFun::add_data(
            result,
            "DI3".to_string(),
            format!("{:02X}", di3),
            di3_str,
            vec![index + 3, index + 4],
            None,
            None,
        );
    }

    fn analysic_cco_appdata_frame(
        data_content: &[u8],
        result: &mut Vec<Value>,
        dir: u8,
        index: usize,
        protocol: &str,
        region: &str,
    ) {
        let di = &data_content[0..4];
        let mut di_result = Vec::new();

        Self::analysic_cco_di_data(di, &mut di_result, index);

        let di_data = &data_content[4..];
        let data_item = FrameFun::get_data_str_reverser(di);

        if let Some(mut data_item_elem) =
            ProtocolConfigManager::get_config_xml(&data_item, protocol, region, Some(dir))
        {
            let pos: usize = 0;

            let length_ele = data_item_elem.get_child_text("length");

            let sub_length = if let Some(length_text) = length_ele {
                match length_text.to_uppercase().as_str() {
                    "UNKNOWN" => FrameCsg::calculate_item_length(
                        &mut data_item_elem,
                        di_data,
                        protocol,
                        region,
                        Some(dir),
                        None,
                    ),
                    _ => length_text.parse::<usize>().unwrap_or(0),
                }
            } else {
                di_data.len()
            };

            let sub_datament = &di_data[pos..pos + sub_length];
            data_item_elem.update_value("length", sub_length.to_string());
            let item_data = FrameAnalisyic::prase_data(
                &mut data_item_elem,
                protocol,
                region,
                sub_datament,
                index + pos + 4,
                Some(dir),
            );

            let name = data_item_elem.get_child_text("name");
            let dis_data_identifier = if let Some(name_text) = name {
                format!("数据标识编码：[{}]-{}", data_item, name_text)
            } else {
                format!("数据标识编码：[{}]", data_item)
            };

            FrameFun::add_data(
                result,
                "数据标识编码".to_string(),
                FrameFun::get_data_str_with_space(di),
                dis_data_identifier,
                vec![index, index + 4],
                Some(di_result),
                None,
            );

            FrameFun::add_data(
                result,
                "数据标识内容".to_string(),
                FrameFun::get_data_str_with_space(sub_datament),
                format!(
                    "数据内容：{}",
                    FrameFun::get_data_str_reverser(sub_datament)
                ),
                vec![index + 4, index + 4 + sub_length],
                Some(item_data),
                None,
            );
        } else {
            panic!("未查找到数据标识：{}，请检查配置文件！", data_item);
        }
    }

    fn analysic_cco_end_frame(
        data_content: &[u8],
        result: &mut Vec<Value>,
        _dir: u8,
        index: usize,
    ) {
        let crc16 = &data_content[3..data_content.len() - 2];
        let calc_crc = FrameFun::calculate_cs(crc16);
        let original_crc = data_content[data_content.len() - 2];

        let cs_str = if calc_crc == original_crc {
            "正确".to_string()
        } else {
            format!("错误，应为：{:02X}", calc_crc)
        };

        let crc_str = format!("校验和:{}", cs_str);

        FrameFun::add_data(
            result,
            "校验和CS".to_string(),
            format!("{:02X}", original_crc),
            crc_str,
            vec![
                index + data_content.len() - 2,
                index + data_content.len() - 1,
            ],
            None,
            None,
        );

        FrameFun::add_data(
            result,
            "结束符".to_string(),
            format!("{:02X}", data_content[data_content.len() - 1]),
            "结束符".to_string(),
            vec![index + data_content.len() - 1, index + data_content.len()],
            None,
            None,
        );
    }
}
