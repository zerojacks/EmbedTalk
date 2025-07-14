use crate::basefunc::frame_645::Frame645;
use crate::basefunc::frame_err::CustomError;
use crate::basefunc::frame_fun::FrameFun;
use crate::basefunc::protocol::{AnalysicErr, FrameAnalisyic, ProtocolInfo};
use crate::config::xmlconfig::{ProtocolConfigManager, XmlElement}; // 引入 FrameFun 模块
use chrono::{DateTime, Duration as ChronoDuration, NaiveDate, NaiveDateTime, NaiveTime};
use lazy_static::lazy_static;
use regex::Regex;
use serde_json::Value;
use std::backtrace::Backtrace;
use std::collections::HashMap;
use std::error::Error;
use std::sync::Mutex;
use tracing::info;
const ITEM_ACK_NAK: u32 = 0xE0000000;
const MASK_FIR: u8 = 0x40;
const MASK_FIN: u8 = 0x20;

#[derive(Debug)]
pub enum FramePos {
    PosStart0 = 0,
    PosDatalen = 1,
    PosStart1 = 5,
    PosCtrl = 6,
    PosRtua = 7,
    PosUid = 10,
    PosMsa = 13,
    PosAfn = 14,
    PosSeq = 15,
    PosData = 16,
    PosItem = 18,
    PosItemData = 22,
}

const ACK: u8 = 0x00;
const NAK: u8 = 0x01;

lazy_static! {
    static ref GLOBAL_VAR: Mutex<u8> = Mutex::new(0);
    static ref LOCK: Mutex<()> = Mutex::new(());
}

pub struct FrameCsg;

impl FrameCsg {
    pub fn get_csg_pseq() -> u8 {
        let mut global_var = GLOBAL_VAR.lock().unwrap();
        let current_value = *global_var;
        *global_var = (current_value + 1) % 16;
        current_value
    }

    pub fn init_frame(ctrl: u8, afn: u8, adress: &[u8], msa: u8, seq: u8, frame: &mut [u8]) {
        frame[FramePos::PosStart0 as usize] = 0x68;
        frame[FramePos::PosStart1 as usize] = 0x68;
        frame[FramePos::PosCtrl as usize] = ctrl;
        frame[FramePos::PosRtua as usize..FramePos::PosRtua as usize + 6].copy_from_slice(adress);
        frame[FramePos::PosMsa as usize] = msa;
        frame[FramePos::PosAfn as usize] = afn;
        frame[FramePos::PosSeq as usize] = seq;
    }

    pub fn get_meter_task_len(frame: &[u8]) -> usize {
        let pos = 26;
        let mut len = 27;

        len += frame[pos] as usize * 2;
        len += frame[len] as usize * 4;
        len += 1;
        len
    }

    pub fn get_normal_task_len(frame: &[u8]) -> usize {
        let pos = 19;
        let mut len = 20;

        len += frame[pos] as usize * 2;
        len += frame[len] as usize * 4;
        len += 1;
        len
    }

    pub fn get_frame_seq(tpv: u8, fir: u8, fin: u8, con: u8) -> u8 {
        let mut value = 0;
        value |= (tpv & 0x01) << 7;
        value |= (fir & 0x01) << 6;
        value |= (fin & 0x01) << 5;
        value |= (con & 0x01) << 4;
        value |= Self::get_csg_pseq() & 0x0F;
        value
    }

    pub fn push_item_data_into_frame(
        meter_point: u16,
        item_data: &HashMap<u32, String>,
        frame: &mut Vec<u8>,
    ) -> usize {
        let mut pos = 0;
        for (item, data) in item_data {
            pos += Self::add_point_to_frame(meter_point, frame);
            pos += FrameFun::item_to_di(*item, frame);
            if !data.is_empty() {
                pos += FrameFun::prase_text_to_frame(data, frame);
            }
        }
        pos
    }

    pub fn add_point_to_frame(meter_point: u16, frame: &mut Vec<u8>) -> usize {
        if meter_point == 0xFFFF {
            frame.extend_from_slice(&[0xFF, 0xFF]);
        } else {
            let (da1, da2) = Self::to_da(meter_point);
            frame.extend_from_slice(&[da1, da2]);
        }
        2
    }

    pub fn get_frame(
        point_array: Vec<u16>,
        item_data: HashMap<u32, String>,
        frame: Option<Vec<u8>>,
    ) -> usize {
        let mut frame = frame.unwrap_or_else(|| vec![]);
        let mut frame_len = 0;

        for meter_point in point_array {
            frame_len += Self::push_item_data_into_frame(meter_point, &item_data, &mut frame);
        }

        frame_len
    }

    pub fn push_item_into_frame(
        meter_point: u16,
        item_array: &[u32],
        frame: &mut Vec<u8>,
    ) -> usize {
        let mut pos = 0;
        for item in item_array {
            pos += Self::add_point_to_frame(meter_point, frame);
            pos += FrameFun::item_to_di(*item, frame);
        }
        pos
    }

    pub fn add_point_and_item_to_frame(
        point_array: Vec<u16>,
        item_array: Vec<u32>,
        frame: Option<Vec<u8>>,
    ) -> usize {
        let mut frame = frame.unwrap_or_else(|| vec![]);
        let mut frame_len = 0;

        if point_array[0] == 0xFF && point_array[1] == 0xFF {
            let meter_point = 0xFFFF;
            frame_len += Self::push_item_into_frame(meter_point, &item_array, &mut frame);
        } else {
            for meter_point in point_array {
                frame_len += Self::push_item_into_frame(meter_point, &item_array, &mut frame);
            }
        }

        frame_len
    }

    pub fn push_item_with_time_into_frame(
        meter_point: u16,
        item_array: &[u32],
        frame: &mut Vec<u8>,
        start_time: &[u8],
        end_time: &[u8],
        datakind: Option<u8>,
    ) -> usize {
        let mut pos = 0;
        for item in item_array {
            if meter_point == 0xFFFF {
                frame.extend_from_slice(&[0xFF, 0xFF]);
                pos += 2;
            } else {
                let (da1, da2) = Self::to_da(meter_point);
                frame.extend_from_slice(&[da1, da2]);
                pos += 2;
            }
            pos += FrameFun::item_to_di(*item, frame);
            frame.extend_from_slice(start_time);
            frame.extend_from_slice(end_time);
            if let Some(datakind) = datakind {
                frame.extend_from_slice(&[datakind]);
                pos += 1;
            }
            pos += 12;
        }
        pos
    }

    pub fn add_point_and_item_and_time_to_frame(
        point_array: Vec<u16>,
        item_array: Vec<u32>,
        start_time: Vec<u8>,
        end_time: Vec<u8>,
        datakind: Option<u8>,
        frame: Option<Vec<u8>>,
    ) -> usize {
        let mut frame = frame.unwrap_or_else(|| vec![]);
        let mut frame_len = 0;
        if point_array[0] == 0xFF && point_array[1] == 0xFF {
            let meter_point = 0xFFFF;
            frame_len += Self::push_item_with_time_into_frame(
                meter_point,
                &item_array,
                &mut frame,
                &start_time,
                &end_time,
                datakind,
            );
        } else {
            for meter_point in point_array {
                frame_len += Self::push_item_with_time_into_frame(
                    meter_point,
                    &item_array,
                    &mut frame,
                    &start_time,
                    &end_time,
                    datakind,
                );
            }
        }

        frame_len
    }

    pub fn add_point_array_to_frame(frame: &mut Vec<u8>, point_array: Vec<u16>) -> (usize, usize) {
        let mut pos = 0;
        let count: usize;
        if point_array[0] == 0xFFFF {
            frame.extend_from_slice(&[0xFF, 0xFF]);
            count = 1;
            pos += 2;
        } else {
            count = point_array.len();
            for meter_point in point_array {
                if meter_point == 0xFFFF {
                    frame.extend_from_slice(&[0xFF, 0xFF]);
                    pos += 2;
                } else {
                    let (da1, da2) = Self::to_da(meter_point);
                    frame.extend_from_slice(&[da1, da2]);
                    pos += 2;
                }
            }
        }
        (count, pos)
    }

    pub fn add_pw_to_frame(frame: &mut Vec<u8>) -> usize {
        frame.extend_from_slice(&[0x00; 16]);
        16
    }

    pub fn add_item_array_to_frame(frame: &mut Vec<u8>, item_array: Vec<u32>) -> usize {
        let mut pos = 0;
        for item in item_array {
            pos += FrameFun::item_to_di(item, frame);
        }
        pos
    }

    pub fn set_frame_finish(data: &mut Vec<u8>, frame: &mut Vec<u8>) -> usize {
        let mut frame_len = 0;
        if frame[FramePos::PosAfn as usize] == 0x04 {
            let pw = [0x00; 16];
            frame.extend_from_slice(&pw);
            data.extend_from_slice(&pw);
            frame_len = 16;
        }
        let caculate_cs = FrameFun::calculate_cs(data);
        frame.extend_from_slice(&[caculate_cs, 0x16]);
        frame_len
    }

    pub fn set_frame_cs(data: &[u8], frame: &mut Vec<u8>) {
        let len = frame.len(); // 先获取 frame 的长度，避免同时借用
        let caculate_cs = FrameFun::calculate_cs(data);
        frame[len - 2] = caculate_cs; // 使用事先获取的长度
    }

    pub fn set_frame_len(length: usize, frame: &mut Vec<u8>) {
        frame[FramePos::PosDatalen as usize] = (length & 0x00FF) as u8;
        frame[FramePos::PosDatalen as usize + 1] = (length >> 8) as u8;
        frame[FramePos::PosDatalen as usize + 2] = (length & 0x00FF) as u8;
        frame[FramePos::PosDatalen as usize + 3] = (length >> 8) as u8;
    }

    pub fn is_contoine_custom_head(frame: &[u8]) -> bool {
        if frame[0] != 0x66 && frame[47] != 0x66 {
            return false;
        }
        if frame[3] != frame[frame.len() - 3] && frame[4] != frame[frame.len() - 2] {
            return false;
        }
        true
    }

    pub fn is_csg_frame(data: &[u8]) -> bool {
        let mut frame = data.to_vec();
        if frame.len() < 24 {
            return false;
        }

        if frame.len() > 84 {
            if Self::is_contoine_custom_head(&frame[..84]) {
                frame = frame[84..].to_vec();
            }
        }

        if frame[0] != 0x68 || frame[5] != 0x68 {
            return false;
        }
        if frame[1] != frame[3] || frame[2] != frame[4] {
            println!("frame err");
            return false;
        }
        let frame_length = ((frame[2] as usize) << 8) | frame[1] as usize;
        if frame_length + 8 != frame.len() {
            println!("length err");
            return false;
        }
        if frame[frame.len() - 1] != 0x16 {
            return false;
        }
        true
    }

    pub fn analysic_csg_frame_by_afn(
        frame: &[u8],
        result_list: &mut Vec<Value>,
        index: usize,
        region: &str,
    ) -> Result<(), Box<dyn Error>> {
        if frame.len() > 84 {
            if Self::is_contoine_custom_head(&frame[..84]) {
                Self::analysic_csg_custom_head_frame(frame, result_list, index)?;
                let new_frame = frame[84..].to_vec();
                return Self::analysic_csg_frame_by_afn(
                    &new_frame,
                    result_list,
                    index + 84,
                    region,
                );
            }
        }

        let afn = frame[14];
        let (dir, prm) = Self::analysic_csg_head_frame(frame, result_list, index);
        println!("dir: {:?}, prm: {:?}", dir, prm);
        let protocol = ProtocolInfo::ProtocolCSG13.name().to_string();
        match afn {
            0x00 => Self::analysic_csg_ack_frame(
                frame,
                dir,
                prm,
                result_list,
                index,
                &protocol,
                region,
            )?,
            0x02 => Self::analysic_csg_link_frame(
                frame,
                dir,
                prm,
                result_list,
                index,
                &protocol,
                region,
            )?,
            0x04 => Self::analysic_csg_write_frame(
                frame,
                dir,
                prm,
                result_list,
                index,
                &protocol,
                region,
            )?,
            0x06 => Self::analysic_csg_security_frame(
                frame,
                dir,
                prm,
                result_list,
                index,
                &protocol,
                region,
            )?,
            0x0C => Self::analysic_csg_read_cur_frame(
                frame,
                dir,
                prm,
                result_list,
                index,
                &protocol,
                region,
            )?,
            0x0D => Self::analysic_csg_read_history_frame(
                frame,
                dir,
                prm,
                result_list,
                index,
                &protocol,
                region,
            )?,
            0x0A => Self::analysic_csg_read_param_frame(
                frame,
                dir,
                prm,
                result_list,
                index,
                &protocol,
                region,
            )?,
            0x10 => Self::analysic_csg_relay_frame(
                frame,
                dir,
                prm,
                result_list,
                index,
                &protocol,
                region,
            )?,
            0x12 => Self::analysic_csg_read_task_frame(
                frame,
                dir,
                prm,
                result_list,
                index,
                &protocol,
                region,
            )?,
            0x13 => Self::analysic_csg_read_alarm_frame(
                frame,
                dir,
                prm,
                result_list,
                index,
                &protocol,
                region,
            )?,
            0x0E => Self::analysic_csg_read_event_frame(
                frame,
                dir,
                prm,
                result_list,
                index,
                &protocol,
                region,
            )?,
            0x0F => Self::analysic_csg_filetrans_frame(
                frame,
                dir,
                prm,
                result_list,
                index,
                &protocol,
                region,
            )?,
            0x23 => Self::analysic_csg_topo_frame(
                frame,
                dir,
                prm,
                result_list,
                index,
                &protocol,
                region,
            )?,
            _ => (),
        }

        Self::analyze_csg_end_frame(frame, result_list, index);

        Ok(())
    }

    pub fn analysic_csg_head_frame(
        frame: &[u8],
        result_list: &mut Vec<Value>,
        start_pos: usize,
    ) -> (u8, u8) {
        let length_data = &frame[1..5];
        let control_data = frame[6];
        let length = (length_data[1] as usize) << 8 | length_data[0] as usize;
        let adress_data = &frame[7..14];
        FrameFun::add_data(
            result_list,
            "起始符".to_string(),
            format!("{:02X}", frame[0]),
            "起始符".to_string(),
            vec![start_pos, start_pos + 1],
            None,
            None,
        );
        FrameFun::add_data(
            result_list,
            "长度".to_string(),
            FrameFun::get_data_str_with_space(length_data),
            format!("长度={},总长度={}(总长度=长度+8)", length, length + 8),
            vec![start_pos + 1, start_pos + 5],
            None,
            None,
        );
        FrameFun::add_data(
            result_list,
            "起始符".to_string(),
            format!("{:02X}", frame[5]),
            "起始符".to_string(),
            vec![start_pos + 5, start_pos + 6],
            None,
            None,
        );
        println!("control_data: {:?}", control_data);
        let (contro_result, result_str, dir, prm) =
            Self::get_control_code_str(control_data, start_pos);

        FrameFun::add_data(
            result_list,
            "控制域".to_string(),
            format!("{:02X}", frame[6]),
            result_str,
            vec![start_pos + 6, start_pos + 7],
            Some(contro_result),
            None,
        );
        let (adress_result, ertu_adress) = Self::get_adress_result(adress_data, start_pos + 7);
        FrameFun::add_data(
            result_list,
            "地址域".to_string(),
            FrameFun::get_data_str_with_space(adress_data),
            format!("终端逻辑地址{}", ertu_adress),
            vec![start_pos + 7, start_pos + 14],
            Some(adress_result),
            None,
        );
        (dir, prm)
    }

    pub fn get_csg_adress(frame: &[u8]) -> String {
        let adress_data = &frame[7..14];
        let (adress_result, ertu_adress) = Self::get_adress_result(adress_data, 7);
        ertu_adress
    }

    pub fn get_frame_info(frame: &[u8]) -> (u8, u8, u8, u8, String) {
        let control_data = frame[6];
        let adress_data = &frame[7..14];
        let afn = frame[FramePos::PosAfn as usize];
        let seq = frame[FramePos::PosSeq as usize] & 0x0f;
        let (contro_result, result_str, dir, prm) = Self::get_control_code_str(control_data, 0);
        let (adress_result, ertu_adress) = Self::get_adress_result(adress_data, 7);

        (dir, prm, seq, afn, ertu_adress)
    }

    pub fn analyze_csg_end_frame(frame: &[u8], result_list: &mut Vec<Value>, start_pos: usize) {
        let cs = frame[frame.len() - 2];
        let caculate_cs = FrameFun::calculate_cs(&frame[6..frame.len() - 2]);
        let cs_str = if cs == caculate_cs {
            "校验正确".to_string()
        } else {
            format!("校验码错误，应为：{:02X}", caculate_cs)
        };
        FrameFun::add_data(
            result_list,
            "校验码CS".to_string(),
            format!("{:02X}", cs),
            cs_str,
            vec![start_pos + frame.len() - 2, start_pos + frame.len() - 1],
            None,
            None,
        );
        FrameFun::add_data(
            result_list,
            "结束符".to_string(),
            format!("{:02X}", frame[frame.len() - 1]),
            "结束符".to_string(),
            vec![start_pos + frame.len() - 1, start_pos + frame.len()],
            None,
            None,
        );
    }

    pub fn send_ack_frame(frame: &[u8], control_code: u8) -> Vec<u8> {
        let mut replay_frame = frame.to_vec();
        replay_frame.truncate(25);
        replay_frame.resize(25, 0);
        let tpv_area = &frame[frame.len() - 7..frame.len() - 2];

        if control_code == 9 {
            replay_frame[FramePos::PosCtrl as usize] = 0x0B;
        } else {
            replay_frame[FramePos::PosCtrl as usize] = 0x08;
        }

        replay_frame[FramePos::PosMsa as usize] = 0x0A;
        replay_frame[FramePos::PosAfn as usize] = 0x00;

        let tpv = if replay_frame[FramePos::PosSeq as usize] & 0x80 != 0 {
            true
        } else {
            false
        };
        replay_frame[FramePos::PosSeq as usize] &= 0x7F;
        replay_frame[FramePos::PosSeq as usize] |= MASK_FIR | MASK_FIN;
        replay_frame[FramePos::PosData as usize] = frame[FramePos::PosData as usize];
        replay_frame[FramePos::PosData as usize + 1] = frame[FramePos::PosData as usize + 1];
        replay_frame[FramePos::PosData as usize + 2] = (ITEM_ACK_NAK & 0xFF) as u8;
        replay_frame[FramePos::PosData as usize + 3] = ((ITEM_ACK_NAK >> 8) & 0xFF) as u8;
        replay_frame[FramePos::PosData as usize + 4] = ((ITEM_ACK_NAK >> 16) & 0xFF) as u8;
        replay_frame[FramePos::PosData as usize + 5] = ((ITEM_ACK_NAK >> 24) & 0xFF) as u8;
        replay_frame[FramePos::PosData as usize + 6] = ACK;
        let mut pos = FramePos::PosData as usize + 7;
        if tpv {
            replay_frame[FramePos::PosSeq as usize] |= 0x80;
            replay_frame.extend_from_slice(tpv_area);
            pos += 5;
        }
        pos -= FramePos::PosCtrl as usize;
        replay_frame[FramePos::PosDatalen as usize] = pos as u8;
        replay_frame[FramePos::PosDatalen as usize + 1] = (pos >> 8) as u8;
        replay_frame[FramePos::PosDatalen as usize + 2] = pos as u8;
        replay_frame[FramePos::PosDatalen as usize + 3] = (pos >> 8) as u8;

        let caculate_cs = FrameFun::calculate_cs(&replay_frame[6..replay_frame.len() - 2]);
        let length = replay_frame.len();
        replay_frame[length - 2] = caculate_cs;
        replay_frame[length - 1] = 0x16;

        replay_frame
    }

    pub fn get_dir_prm(control: u8) -> (u8, u8, u8, u8) {
        let array: Vec<u8> = FrameFun::get_bit_array(control); // Pass a mutable reference to the vector
        let dir = array[0];
        let prm = array[1];
        let acd = array[2];
        let fcv = array[3];

        (dir, prm, acd, fcv)
    }

    pub fn get_control_code_str(control: u8, start_pos: usize) -> (Vec<Value>, String, u8, u8) {
        let mut contro_result: Vec<Value> = Vec::new();
        let binary_array: Vec<u8> = FrameFun::get_bit_array(control);
        println!("binary_array: {:?}", binary_array);
        let dir = binary_array[0];
        let prm = binary_array[1];
        let acd = binary_array[2];
        let fcv = binary_array[3];
        println!(
            "dir: {:?}, prm: {:?}, acd: {:?}, fcv: {:?}",
            dir, prm, acd, fcv
        );
        let control_code = control & 0x0f;
        let (prm_str, ayalysic_str, service_fun) = if prm == 1 {
            (
                "来自启动站".to_string(),
                if dir == 0 {
                    "主站发送".to_string()
                } else {
                    "终端上送".to_string()
                },
                match control_code {
                    0 => "备用".to_string(),
                    1 => "复位命令".to_string(),
                    2 | 3 => "备用".to_string(),
                    4 => "用户数据".to_string(),
                    5..=8 => "备用".to_string(),
                    9 => "链路测试".to_string(),
                    10 => "请求1级数据".to_string(),
                    11 => "请求2级数据".to_string(),
                    _ => "备用".to_string(),
                },
            )
        } else {
            (
                "来自从动站".to_string(),
                if dir == 0 {
                    "主站响应".to_string()
                } else {
                    "终端响应".to_string()
                },
                match control_code {
                    0 => "认可".to_string(),
                    1..=7 => "备用".to_string(),
                    8 => "用户数据".to_string(),
                    9 => "否定：无所召唤数据".to_string(),
                    10 => "备用".to_string(),
                    11 => "链路状态".to_string(),
                    _ => "备用".to_string(),
                },
            )
        };
        let dir_str = if dir == 0 {
            "主站发出的下行报文".to_string()
        } else {
            "终端发出的上行报文".to_string()
        };
        let acd_str = if fcv == 1 {
            "有效".to_string()
        } else {
            "无效".to_string()
        };
        let fcv_str = if fcv == 1 {
            "FCB位有效".to_string()
        } else {
            "FCB位无效".to_string()
        };
        FrameFun::add_data(
            &mut contro_result,
            "D7传输方向位DIR".to_string(),
            format!("{}", dir),
            dir_str,
            vec![start_pos + 6, start_pos + 7],
            None,
            None,
        );
        FrameFun::add_data(
            &mut contro_result,
            "D6启动标志位PRM".to_string(),
            format!("{}", prm),
            prm_str.clone(),
            vec![start_pos + 6, start_pos + 7],
            None,
            None,
        );
        FrameFun::add_data(
            &mut contro_result,
            "D5帧计数位FCB(下行)/要求访问位ACD(上行)".to_string(),
            format!("{}", acd),
            acd_str,
            vec![start_pos + 6, start_pos + 7],
            None,
            None,
        );
        FrameFun::add_data(
            &mut contro_result,
            "D4帧计数有效位FCV(下行)/保留(上行)".to_string(),
            format!("{}", fcv),
            fcv_str,
            vec![start_pos + 6, start_pos + 7],
            None,
            None,
        );
        FrameFun::add_data(
            &mut contro_result,
            "D3~D0功能码".to_string(),
            format!("{}", control_code),
            format!("{}:{}", prm_str, service_fun),
            vec![start_pos + 6, start_pos + 7],
            None,
            None,
        );
        (
            contro_result,
            format!("{}{}", ayalysic_str, service_fun),
            dir,
            prm,
        )
    }

    pub fn get_adress_result(adress: &[u8], index: usize) -> (Vec<Value>, String) {
        let mut adress_result: Vec<Value> = Vec::new();
        let a1 = &adress[..3];
        let a2 = &adress[3..6];
        let a3 = adress[6];
        let a2_str = FrameFun::get_data_str_with_space(a2);
        let a1_str = FrameFun::get_data_str_with_space(a1);

        FrameFun::add_data(
            &mut adress_result,
            "省地市区县码 A1".to_string(),
            a1_str,
            format!(
                "省地市区县码={}省{:02X},地市{:02X},区县{:02X}",
                FrameFun::get_data_str_reverser(a1),
                a1[2],
                a1[1],
                a1[0]
            ),
            vec![index, index + 3],
            None,
            None,
        );
        FrameFun::add_data(
            &mut adress_result,
            "终端地址 A2".to_string(),
            a2_str,
            format!("终端地址={}", FrameFun::get_data_str_reverser(a2)),
            vec![index + 3, index + 6],
            None,
            None,
        );
        let seq = a3 & 0xf0;
        let master = a3 & 0x0f;
        let mut a3_result: Vec<Value> = Vec::new();
        FrameFun::add_data(
            &mut a3_result,
            "D7~D4帧序号".to_string(),
            format!("{}", seq),
            format!("帧序号={}", seq),
            vec![index + 6, index + 7],
            None,
            None,
        );
        FrameFun::add_data(
            &mut a3_result,
            "D3~D0主站地址".to_string(),
            format!("{}", master),
            format!("主站地址={}", master),
            vec![index + 6, index + 7],
            None,
            None,
        );
        FrameFun::add_data(
            &mut adress_result,
            "主站地址 A3".to_string(),
            format!("{:02X}", a3),
            "".to_string(),
            vec![index + 6, index + 7],
            Some(a3_result),
            None,
        );
        (
            adress_result,
            format!(
                "{}{}",
                FrameFun::get_data_str_reverser(a1),
                FrameFun::get_data_str_reverser(a2)
            ),
        )
    }

    pub fn get_afn_and_seq_result(data: &[u8], index: usize, result_list: &mut Vec<Value>) -> bool {
        let afn = data[0];
        let seq = data[1];

        let afn_str = match afn {
            0x00 => "确认/否定".to_string(),
            0x02 => "链路接口检测".to_string(),
            0x04 => "写参数".to_string(),
            0x06 => "安全认证".to_string(),
            0x0A => "读参数".to_string(),
            0x0C => "读当前数据".to_string(),
            0x0D => "读历史数据".to_string(),
            0x0E => "读事件记录".to_string(),
            0x0F => "文件传输".to_string(),
            0x10 => "中继转发".to_string(),
            0x12 => "读任务数据".to_string(),
            0x13 => "读告警数据".to_string(),
            0x14 => "级联命令".to_string(),
            0x15 => "用户自定义数据".to_string(),
            0x16 => "数据安全传输".to_string(),
            0x17 => "数据转加密".to_string(),
            0x23 => "主站中转报文".to_string(),
            _ => "备用".to_string(),
        };
        let binary_array = FrameFun::get_bit_array(seq);
        let tpv = binary_array[0];
        let fir = binary_array[1];
        let fin = binary_array[2];
        let con = binary_array[3];
        let pseq = seq & 0x0f;
        let mut seq_result: Vec<Value> = Vec::new();
        let tpv_str = if tpv == 0 {
            "帧末尾无时间标签Tp".to_string()
        } else {
            "帧末尾带有时间标签Tp".to_string()
        };
        let (fir_str, fin_str, seq_str) = if fir == 0 && fin == 0 {
            (
                "当前帧为多帧：中间帧".to_string(),
                "当前帧为多帧：中间帧".to_string(),
                "多帧：中间帧".to_string(),
            )
        } else if fir == 0 && fin == 1 {
            (
                "当前帧为多帧：结束帧".to_string(),
                "当前帧为最后一帧：结束帧".to_string(),
                "多帧：结束帧".to_string(),
            )
        } else if fir == 1 && fin == 0 {
            (
                "当前帧为多帧：第一帧".to_string(),
                "当前帧为多帧：有后续帧".to_string(),
                "多帧：第一帧".to_string(),
            )
        } else {
            (
                "当前帧为单帧：第一帧".to_string(),
                "当前帧为单帧：最后一帧".to_string(),
                "单帧：最后一帧".to_string(),
            )
        };
        let con_str = if con == 1 {
            "需要对该帧报文进行确认".to_string()
        } else {
            "不需要对该帧报文进行确认".to_string()
        };
        let pseq_str = format!("帧内序号={}", pseq);
        FrameFun::add_data(
            &mut seq_result,
            "D7帧时间标签有效位TpV".to_string(),
            format!("{}", tpv),
            tpv_str,
            vec![index + 1, index + 2],
            None,
            None,
        );
        FrameFun::add_data(
            &mut seq_result,
            "D6首帧标志FIR".to_string(),
            format!("{}", fir),
            fir_str,
            vec![index + 1, index + 2],
            None,
            None,
        );
        FrameFun::add_data(
            &mut seq_result,
            "D5首帧标志FIN".to_string(),
            format!("{}", fin),
            fin_str,
            vec![index + 1, index + 2],
            None,
            None,
        );
        FrameFun::add_data(
            &mut seq_result,
            "D4首帧标志CON".to_string(),
            format!("{}", con),
            con_str,
            vec![index + 1, index + 2],
            None,
            None,
        );
        FrameFun::add_data(
            &mut seq_result,
            "D3~D0帧内序号".to_string(),
            format!("{}", pseq),
            pseq_str,
            vec![index + 1, index + 2],
            None,
            None,
        );

        FrameFun::add_data(
            result_list,
            "应用层功能码AFN".to_string(),
            format!("{:02X}", afn),
            afn_str,
            vec![index, index + 1],
            None,
            None,
        );
        FrameFun::add_data(
            result_list,
            "命令序号SEQ".to_string(),
            format!("{:02X}", seq),
            seq_str,
            vec![index + 1, index + 2],
            Some(seq_result),
            None,
        );

        tpv == 1
    }

    pub fn to_da(ival: u16) -> (u8, u8) {
        let mut low = (ival - 1) % 8;
        let high = (ival - 1) / 8; // Use integer division

        let mut ret: u16;
        let mut mask = 1;

        if ival == 0 {
            ret = 0;
        } else {
            ret = (high + 1) << 8;
            while low > 0 {
                mask <<= 1;
                low -= 1;
            }
            ret |= mask;
        }
        let da1 = (ret & 0x00ff) as u8;
        let da2 = (ret >> 8) as u8;
        (da1, da2)
    }

    pub fn to_da_with_continuous(points: &[u16]) -> Vec<(u8, u8)> {
        if points.is_empty() {
            return Vec::new();
        }

        let mut result = Vec::new();
        let mut current_da = (0u8, 0u8);
        let mut mask = 0u8;
        let mut last_high = 0u8;

        for &point in points {
            let low = ((point - 1) % 8) as u8;
            let high = ((point - 1) / 8) as u8;

            if high != last_high {
                // 如果高位不同，保存当前的DA并开始新的
                if mask != 0 {
                    current_da.0 = mask;
                    current_da.1 = last_high + 1;
                    result.push(current_da);
                }
                mask = 0;
                last_high = high;
            }

            // 设置对应的位
            mask |= 1 << low;
        }

        // 处理最后一个DA
        if mask != 0 {
            current_da.0 = mask;
            current_da.1 = last_high + 1;
            result.push(current_da);
        }

        result
    }

    pub fn to_da_with_single(points: &[u16]) -> Vec<(u8, u8)> {
        points.iter().map(|&point| Self::to_da(point)).collect()
    }

    pub fn judge_is_exit_pw(
        data_segment: &[u8],
        item_element: Option<XmlElement>,
        data_time: Option<&[u8]>,
        with_time: bool,
        protocol: &str,
        region: &str,
        dir: Option<u8>,
    ) -> bool {
        if let Some(item_element) = item_element {
            if Self::guest_next_data_is_cur_item_data(
                Some(item_element),
                data_segment,
                data_time,
                protocol,
                region,
                dir,
            ) {
                return false;
            } else {
                return Self::judge_is_exit_pw(
                    data_segment,
                    None,
                    None,
                    with_time,
                    protocol,
                    region,
                    dir,
                );
            }
        }
        let total_len = data_segment.len();
        let mut pos = 0;
        while total_len > pos {
            if pos + 4 > total_len {
                break;
            }
            let item = &data_segment[2 + pos..6 + pos];
            let data_item = &FrameFun::get_data_str_reverser(item);
            let data_item_elem =
                ProtocolConfigManager::get_config_xml(data_item, protocol, region, dir);
            if let Some(mut data_item_elem) = data_item_elem {
                let sub_length_cont = data_item_elem.get_child_text("length");
                if let Some(sub_length_cont) = sub_length_cont {
                    let sub_length = if sub_length_cont.to_uppercase() == "UNKNOWN" {
                        Self::calculate_item_length(
                            &mut data_item_elem,
                            &data_segment[6..],
                            protocol,
                            region,
                            dir,
                            None,
                        )
                    } else {
                        sub_length_cont.parse::<usize>().unwrap()
                    };
                    pos += sub_length + 6;
                    if with_time {
                        pos += 6;
                    }
                } else {
                    return false;
                }
            } else {
                return true;
            }
        }
        false
    }

    pub fn guest_is_exit_pw(
        length: usize,
        data_segment: &[u8],
        data_item_elem: Option<XmlElement>,
        data_time: Option<&[u8]>,
        with_time: bool,
        protocol: &str,
        region: &str,
        dir: Option<u8>,
    ) -> bool {
        println!(
            "guest_is_exit_pw length{:?} pw_data{:?}",
            length, data_segment
        );
        if length <= 16 {
            return false;
        }
        if data_segment.len() < 16 {
            return false;
        }
        if FrameFun::is_array_all_zeros(&data_segment) {
            return true;
        } else {
            return Self::judge_is_exit_pw(
                &data_segment,
                data_item_elem,
                data_time,
                with_time,
                protocol,
                region,
                dir,
            );
        }
    }

    pub fn is_valid_expression(s: &str) -> bool {
        // Define the regex pattern
        let pattern = Regex::new(r"^\s*\d+\s*[\+\-\*/]\s*(\d+|[^\s]*)\s*$").unwrap();

        // Match the input string against the pattern
        pattern.is_match(s)
    }

    pub fn calculate_item_length(
        sub_element: &mut XmlElement,
        data_segment: &[u8],
        protocol: &str,
        region: &str,
        dir: Option<u8>,
        all_length_items: Option<&[XmlElement]>,
    ) -> usize {
        Self::execute_calculation(
            sub_element,
            data_segment,
            protocol,
            region,
            dir,
            all_length_items,
        )
    }

    pub fn execute_calculation(
        element: &mut XmlElement,
        data: &[u8],
        protocol: &str,
        region: &str,
        dir: Option<u8>,
        items: Option<&[XmlElement]>,
    ) -> usize {
        let mut length = 0;
        let mut length_map = std::collections::HashMap::new();

        let mut all_items = match items {
            Some(i) => i.to_vec(),
            None => element.get_items("splitByLength"),
        };
        info!("all_items:{:?} {:?}", all_items, element);
        let template_element = element.get_child("type");
        let rules = element.get_child_text("lengthrule");
        if all_items.is_empty() {
            println!("template_element:{:?} rules:{:?}", template_element, rules);
            if let Some(template_element) = template_element {
                if let Some(rules) = rules {
                    if Self::is_valid_expression(&rules) {
                        println!("rules:{:?}", rules);
                        return Self::calculate_unknown_length(
                            element,
                            data,
                            &mut length_map,
                            protocol,
                            region,
                            dir,
                        );
                    } else {
                        println!("rules:{:?} is not valid", rules);
                    }
                } else {
                    if let Some(data_type) = template_element.get_value().map(|s| s.to_uppercase()) {
                        if !["BCD", "BIN", "ASCII"].contains(&data_type.as_str()) {
                            if let Some(mut template) = ProtocolConfigManager::get_template_element(
                                &data_type, protocol, region, dir,
                            ) {
                                let template_items = template.get_items("splitByLength");
                                return Self::execute_calculation(
                                    &mut template,
                                    data,
                                    protocol,
                                    region,
                                    dir,
                                    Some(&template_items),
                                );
                            }
                        }
                    } 
                }
            }
        } else {
            for (i, data_subitem_elem) in all_items.iter_mut().enumerate() {
                let subitem_name_item = data_subitem_elem.get_child("name");
                let sub_length_content = data_subitem_elem.get_child_text("length");

                let subitem_name = if let Some(subitem_name_item) = subitem_name_item {
                    subitem_name_item
                        .get_value()
                        .unwrap_or(format!("splitByLength{}", i))
                } else if let Some(sub_item_ele) = data_subitem_elem.get_child("item") {
                    sub_item_ele
                        .get_value()
                        .unwrap_or(format!("splitByLength{}", i))
                } else {
                    format!("splitByLength{}", i)
                };
                info!("sub_length_content:{:?}", sub_length_content);
                let subitem_length = if let Some(sub_length_content) = sub_length_content {
                    if sub_length_content.to_uppercase() == "UNKNOWN" {
                        let length = Self::calculate_unknown_length(
                            data_subitem_elem,
                            data,
                            &mut length_map,
                            protocol,
                            region,
                            dir,
                        );
                        let mut newchild = data_subitem_elem.clone();
                        newchild.update_value("length", length.to_string());
                        element.update_child(&newchild);
                        info!("newchild:{:?} {:?}------", newchild.clone(), element);
                        length
                    } else {
                        sub_length_content.parse::<usize>().unwrap_or(0)
                    }
                } else {
                    let length = FrameFun::calculate_item_box_length(
                        data_subitem_elem,
                        protocol,
                        region,
                        dir,
                    );
                    let mut newchild = data_subitem_elem.clone();
                    newchild.update_value("length", length.to_string());
                    element.update_child(&newchild);
                    length
                };

                length += subitem_length;
                info!("subitem_name:{} {}", subitem_name, subitem_length);
                length_map.insert(subitem_name, (length, subitem_length, data_subitem_elem));
            }
        }
        info!("length:{}", length);
        length
    }

    pub fn calculate_unknown_length(
        data_subitem_elem: &mut XmlElement,
        data_segment: &[u8],
        length_map: &HashMap<String, (usize, usize, &XmlElement)>,
        protocol: &str,
        region: &str,
        dir: Option<u8>,
    ) -> usize {
        if data_segment.is_empty() {
            return 0;
        }
        let rules = data_subitem_elem
            .get_child_text("lengthrule")
            .unwrap_or_default();
        let operator_mapping = HashMap::from([("+", '+'), ("-", '-'), ("*", '*'), ("/", '/')]);
        let mut sub_length = 0;
        let pattern = Regex::new(r"^RANGE\(([^)]+)\)$").unwrap();
        println!(
            "data_subitem_elem:{:?} rules:{:?}",
            data_subitem_elem, rules
        );
        // Get length rule
        if !rules.is_empty() {
            // Match the regex pattern
            if let Some(captures) = pattern.captures(&rules) {
                // Get the captured string
                let match_string = captures.get(1).unwrap().as_str();
                println!("match_string:{:?}", match_string);
                if let Some(vaule) = length_map.get(match_string) {
                    let vaule_data = data_segment[(vaule.0 - vaule.1)..vaule.0][0];
                    let find_data = &data_segment[vaule.0..];

                    for (i, &data) in find_data.iter().enumerate() {
                        if data == vaule_data {
                            return i;
                        }
                    }
                }
            }

            // Split the rule using regex
            // 使用正则表达式解析规则，以处理不同格式的规则
            let number_part: &str;
            let operator_part: &str;
            let text_part: &str;
            let operator: char;
            let rule_regex = Regex::new(r"(\d+)\s*([+\-*/])\s*(.+)").unwrap();
            if let Some(captures) = rule_regex.captures(&rules) {
                number_part = captures.get(1).unwrap().as_str();
                operator_part = captures.get(2).unwrap().as_str();
                text_part = captures.get(3).unwrap().as_str().trim();

                operator = match operator_part {
                    "+" => '+',
                    "-" => '-',
                    "*" => '*',
                    "/" => '/',
                    _ => *operator_mapping.get(operator_part).unwrap_or(&'?'),
                };

                println!(
                    "number_part:{:?} operator_part:{:?} text_part:{:?}",
                    number_part, operator_part, text_part
                );
            } else {
                println!("Invalid rule format");
                return sub_length;
            }
            println!("length_map:{:?}", length_map);
            let sub_value = if text_part.chars().all(char::is_numeric) {
                text_part.parse::<usize>().unwrap_or(0)
            } else {
                if let Some(vaule) = length_map.get(text_part) {
                    println!("value {:?} vaule.0 {:?} vaule.1 {:?} data_segment {:?}", vaule, vaule.0, vaule.1, data_segment);
                    if vaule.0 - (vaule.0 - vaule.1) > data_segment.len() {
                        return 0;
                    }
                    let vaule_data = &data_segment[(vaule.0 - vaule.1)..vaule.0];
                    let mut value_element = vaule.2.clone();

                    let result = FrameAnalisyic::prase_data_item(
                        &mut value_element,
                        vaule_data,
                        0,
                        false,
                        protocol,
                        region,
                        dir,
                    );
                    let target_result = FrameFun::find_frame_in_data_list(&result, text_part);
                    let mut sub_value_str = String::new();
                    println!("target_result:{:?}", target_result);
                    if let Some(target_results) = target_result {
                        for item in target_results {
                            if let Some(sub_value) = item.get("description") {
                                if let Some(sub_value_str_temp) = sub_value.as_str() {
                                    sub_value_str = sub_value_str_temp.to_string();
                                } else {
                                    println!("Description is not a string.");
                                }
                            } else {
                                println!("No description found in item.");
                            }
                        }
                    } else {
                        println!("No matching frames found.");
                    }

                    // Extract number from sub_value using regex
                    let match_re = Regex::new(r"(\d+)").unwrap();
                    if let Some(captures) = match_re.captures(&sub_value_str) {
                        captures
                            .get(1)
                            .unwrap()
                            .as_str()
                            .parse::<usize>()
                            .unwrap_or(0)
                    } else {
                        sub_value_str.parse::<usize>().unwrap_or(0)
                    }
                } else {
                    0
                }
            };

            // Parse number_part to usize
            let decimal_number = number_part.parse::<usize>().unwrap_or_else(|_| {
                println!("Failed to convert to integer: {}", number_part);
                0
            });
            println!(
                "decimal_number:{:?} sub_value:{:?}",
                decimal_number, sub_value
            );
            // Perform the operation based on the operator
            match operator {
                '+' => sub_length = decimal_number + sub_value,
                '-' => sub_length = decimal_number - sub_value,
                '*' => sub_length = decimal_number * sub_value,
                '/' => sub_length = decimal_number / sub_value,
                _ => sub_length = 0,
            }
        } else {
            sub_length = Self::execute_calculation(
                data_subitem_elem,
                data_segment,
                protocol,
                region,
                dir,
                None,
            )
        }
        println!("calculate_unknown_length Sub length: {}", sub_length);
        sub_length
    }

    pub fn guest_next_data_is_cur_item_data(
        item_element: Option<XmlElement>,
        data_segment: &[u8],
        data_time: Option<&[u8]>,
        protocol: &str,
        region: &str,
        dir: Option<u8>,
    ) -> bool {
        if item_element.is_none() {
            return false;
        }
        let mut item_element: XmlElement = item_element.unwrap();
        let (length, new_data) =
            Self::recalculate_sub_length(&mut item_element, data_segment, protocol, region, dir);

        if (length + 6) > data_segment.len() {
            println!("length:{:?} data_segment.len():{:?}", length, data_segment.len());
            return false;
        }
        println!("data_segment[length..length + 6]:{:?} data_time:{:?}", &data_segment[length..length + 6], data_time);
        if Self::is_valid_bcd_time(&data_segment[length..length + 6]) {
            if let Some(data_time) = data_time {
                if Self::is_within_one_month(&data_segment[length..length + 6], data_time) {
                    return true;
                }
            }
        }
        let next_item = FrameFun::get_data_str_reverser(&data_segment[2..6]);
        if Some(next_item.clone()) == item_element.get_attribute("id").cloned() {
            println!("next_item:{:?} item_element:{:?}", next_item, item_element);
            return false;
        }
        let data_item_elem =
            ProtocolConfigManager::get_config_xml(&next_item, protocol, region, dir);
        if let Some(data_item_elem) = data_item_elem {
            println!("data_item_elem:{:?}", data_item_elem);
            return false;
        }
        false
    }

    pub fn recalculate_sub_length<'a>(
        data_item_elem: &mut XmlElement,
        data_segment: &'a [u8],
        protocol: &str,
        region: &str,
        dir: Option<u8>,
    ) -> (usize, &'a [u8]) {
        let sub_length_cont = data_item_elem.get_child_text("length").unwrap_or_default();
        let mut sub_length: usize;
        // info!("recalculate_sub_length {:?} {:?}", data_item_elem, sub_length_cont);
        let bt = Backtrace::capture();
        // info!("bt:{:?}", bt);
        if sub_length_cont.to_uppercase() == "UNKNOWN" {
            sub_length = Self::calculate_item_length(
                data_item_elem,
                data_segment,
                protocol,
                region,
                dir,
                None,
            );
        } else {
            sub_length = sub_length_cont.parse::<usize>().unwrap_or(0);
            if data_item_elem.get_attribute("protocol").is_some()
                && data_item_elem.get_attribute("region").is_some()
            {
                // Handle block data
                // info!("check is 费率或者组数");
                let check_type = if data_item_elem
                    .get_attribute("id")
                    .is_some_and(|value| value == "组数")
                {
                    1
                } else if data_item_elem
                    .get_attribute("id")
                    .is_some_and(|attr| attr == "费率数")
                    || Self::get_data_item_is_with_group(data_item_elem)
                {
                    2
                } else {
                    0
                };
                // info!("check type {:?} data_segment[0]:{:?}", check_type, data_segment[0]);
                if check_type > 0 {
                    if data_segment.is_empty() || data_segment[0] == 0 {
                        sub_length = 1;
                    } else {
                        let data_item_count = data_item_elem.get_items("dataItem").len() as u64;
                        let length = (sub_length as f64 - 1.0) / (data_item_count as f64 - 1.0);
                        // info!("sub_length {:?} data_items count {:?}", sub_length, data_item_count);
                        if check_type == 2 {
                            sub_length = ((data_segment[0] as f64 + 1.0) * length + 1.0) as usize;
                        } else {
                            sub_length = (data_segment[0] as f64 * length + 1.0) as usize;
                        }
                    }
                }
            }
        }

        // Ensure sub_length does not exceed data_segment length
        let sub_length = sub_length.min(data_segment.len());
        // info!("caculate length {:?}", sub_length);
        (sub_length, &data_segment[..sub_length])
    }

    pub fn get_data_item_is_with_group(data_item_element: &XmlElement) -> bool {
        if data_item_element.children.len() > 0 {
            for child in &data_item_element.children {
                info!("检查 {:?}", child);
                if child
                    .get_attribute("id")
                    .is_some_and(|value| value == "费率数")
                {
                    return true;
                }
            }
        }
        info!("没有子项");
        return false;
    }
    pub fn get_sub_length(
        data_item_element: &XmlElement,
        tar_get_item: &str,
        data_segment: &[u8],
        protocol: &str,
        region: &str,
        dir: Option<u8>,
    ) -> (usize, usize) {
        let mut length = 0;
        let mut sub_length = 0;

        // 获取所有 splitByLength 项目
        let all_splitlength = data_item_element.get_items("splitByLength");

        // 遍历所有的 splitlength_item
        for splitlength_item in all_splitlength {
            if let Some(sub_item) = splitlength_item.get_child_text("name") {
                if sub_item == tar_get_item.to_string() {
                    // 解析 sub_length 和 length
                    sub_length = splitlength_item
                        .get_child_text("length")
                        .unwrap_or_default()
                        .parse::<usize>()
                        .unwrap_or(0);

                    let (value, item_data, sub_length) = FrameAnalisyic::prase_singal_item(
                        &splitlength_item,
                        &data_segment[..sub_length],
                        0,
                        false,
                        protocol,
                        region,
                        dir,
                    );

                    length = value.parse::<usize>().unwrap_or(0);
                    break;
                }
            }
        }

        // 返回 sub_length 和 length
        (sub_length, length)
    }

    pub fn bcd_array_to_datetime(bcd_array: &[u8]) -> Option<NaiveDateTime> {
        let century = FrameFun::bcd2int(bcd_array[0]);
        let year = FrameFun::bcd2int(bcd_array[1]);
        let month = FrameFun::bcd2int(bcd_array[2]);
        let day = FrameFun::bcd2int(bcd_array[3]);
        let hour = FrameFun::bcd2int(bcd_array[4]);
        let minute = if bcd_array.len() > 5 {
            FrameFun::bcd2int(bcd_array[5])
        } else {
            0
        };

        let full_year = century * 100 + year;

        if let Some(date) = NaiveDate::from_ymd_opt(full_year as i32, month as u32, day as u32) {
            if let Some(time) = NaiveTime::from_hms_opt(hour as u32, minute as u32, 0) {
                return Some(NaiveDateTime::new(date, time));
            }
        }

        None
    }

    pub fn is_within_one_month(bcd_array1: &[u8], bcd_array2: &[u8]) -> bool {
        let dt1 = Self::bcd_array_to_datetime(bcd_array1);
        let dt2 = Self::bcd_array_to_datetime(bcd_array2);

        if dt1.is_none() || dt2.is_none() {
            return false;
        }
        let dt1 = dt1.unwrap();
        let dt2 = dt2.unwrap();

        if dt1 > dt2 {
            let time_difference = dt1 - dt2;
            return time_difference <= ChronoDuration::days(30);
        }

        false
    }

    pub fn is_valid_bcd_time(bcd_array: &[u8]) -> bool {
        if bcd_array.len() != 6 {
            return false;
        }

        let century = FrameFun::bcd2int(bcd_array[0]);
        let year = FrameFun::bcd2int(bcd_array[1]);
        let month = FrameFun::bcd2int(bcd_array[2]);
        let day = FrameFun::bcd2int(bcd_array[3]);
        let hour = FrameFun::bcd2int(bcd_array[4]);
        let minute = FrameFun::bcd2int(bcd_array[5]);

        if century > 99
            || year > 99
            || month < 1
            || month > 12
            || day < 1
            || day > 31
            || hour >= 24
            || minute >= 60
        {
            return false;
        }

        if [4, 6, 9, 11].contains(&month) && day > 30 {
            return false;
        }
        let year = century * 100 + year;
        if month == 2 && ((year % 4 == 0 && year % 100 != 0) || (year % 400 == 0)) && day > 29 {
            return false;
        }
        if month == 2 && day > 28 {
            return false;
        }

        true
    }

    pub fn prase_tpv_data(tpv: &[u8]) -> String {
        let time = &tpv[..4];
        let delay = tpv[4];
        let time_str = FrameFun::parse_time_data(time, "DDhhmmss", false);
        format!(
            "启动帧发送时标：{}。允许发送传输延迟时间：{}分",
            time_str, delay
        )
    }

    pub fn prase_err_code_result(errcode: u8) -> &'static str {
        match errcode {
            0x00 => "正确",
            0x01 => "中继命令没有返回",
            0x02 => "设置内容非法",
            0x03 => "密码权限不足",
            0x04 => "无此数据项",
            0x05 => "命令时间失效",
            0x06 => "目标地址不存在",
            0x07 => "校验失败",
            _ => "未知错误",
        }
    }

    pub fn prase_da_data(da: [u8; 2]) -> String {
        info!("da:{:?}", da);
        let (total_measurement_points, measurement_points_array) =
            FrameFun::calculate_measurement_points(&da);
        info!("total_measurement_points:{:?} {:?}", total_measurement_points, measurement_points_array);
        if measurement_points_array.is_empty() {
            return "Pn解析失败".to_string();
        }
        
        if measurement_points_array[0] == 0 && total_measurement_points == 1 {
            "Pn=测量点：0(终端)".to_string()
        } else if measurement_points_array[0] == 0xFFFF && total_measurement_points == 1 {
            "Pn=测量点：FFFF(除了终端信息点以外的所有测量点)".to_string()
        } else {
            let formatted_string: String = measurement_points_array
                .iter()
                .map(|&x| x.to_string())
                .collect::<Vec<_>>()
                .join(", ");
            format!("Pn=第{}测量点", formatted_string)
        }
    }

    pub fn try_get_item_and_point(
        item: &[u8],
        protocol: &str,
        region: &str,
        dir: Option<u8>,
    ) -> (Option<XmlElement>, String) {
        let data_item = FrameFun::get_data_str_reverser(item);
        let data_item_elem =
            ProtocolConfigManager::get_config_xml(&data_item, protocol, region, dir);
        (data_item_elem, data_item)
    }

    pub fn get_data_dinsty(dinsty: u8) -> &'static str {
        match dinsty {
            0 => "按终端实际存储数据的时间间隔",
            1 => "1分钟",
            2 => "5分钟",
            3 => "15分钟",
            4 => "30分钟",
            5 => "60分钟",
            6 => "1日",
            7 => "1月",
            _ => "备用",
        }
    }

    pub fn get_relay_type(relay_type: u8) -> &'static str {
        match relay_type {
            0x00 => "普通中继",
            0x01 => "转发主站对电能表的拉闸命令",
            0x02 => "转发主站对电能表的允许合闸命令",
            0x03 => "转发主站对电能表的保电投入命令",
            0x04 => "转发主站对电能表的保电解除命令",
            _ => "未知",
        }
    }
    pub fn analysic_csg_custom_head_frame(
        frame: &[u8],
        result_list: &mut Vec<Value>,
        start_pos: usize,
    ) -> Result<(), Box<dyn Error>> {
        let dir = frame[2];
        let receive_time = &frame[5..9];
        let head_point_start = frame[15];
        let head_point_end = &frame[20..22];
        let head_point_port = &frame[24..26];
        let ip = &frame[26..30];
        let port = &frame[30..32];
        let regesit_addr = &frame[32..44];
        let logic_addr = &frame[44..57];
        let regsit_time = &frame[58..62];
        let process_label = frame[75];
        let begin_time = &frame[76..80];

        let timestamp = FrameFun::hex_array_to_int(receive_time, false) as i64;
        let dt_object = DateTime::from_timestamp(timestamp, 0)
            .unwrap_or_default()
            .naive_local();
        let receive_time_str = format!("接收时间[{}]", dt_object.format("%Y-%m-%d %H:%M:%S"));
        let head_point_str = format!(
            "前置节点[{}:{}]",
            head_point_start,
            FrameFun::hex_array_to_int(head_point_end, false)
        );
        let head_point_port_str = format!(
            "前置端口号[{}]",
            FrameFun::hex_array_to_int(head_point_port, false)
        );
        let ip_str = format!(
            "终端IP[{}:{}]",
            FrameFun::prase_ip_str(ip),
            FrameFun::prase_port(port)
        );
        let regesit_addr_str = format!("注册地址[{}]", FrameFun::ascii_to_str(regesit_addr));
        let logic_addr_str = format!("逻辑地址[{}]", FrameFun::ascii_to_str(logic_addr));

        let timestamp = FrameFun::hex_array_to_int(regsit_time, false) as i64;
        let dt_object = DateTime::from_timestamp(timestamp, 0)
            .unwrap_or_default()
            .naive_local();
        let regsit_time_str = format!("注册时间[{}]", dt_object.format("%Y-%m-%d %H:%M:%S"));
        let process_label_str = format!(
            "处理标志[{}]",
            if process_label == 1 { "YES" } else { "NO" }
        );

        let timestamp = FrameFun::hex_array_to_int(begin_time, false) as i64;
        let begin_time_str = if timestamp > 0 {
            let dt_object = DateTime::from_timestamp(timestamp, 0)
                .unwrap_or_default()
                .naive_local();
            format!("开始时间[{}]", dt_object.format("%Y-%m-%d %H:%M:%S"))
        } else {
            "开始时间[无]".to_string()
        };

        let dir_str = if dir & 0x01 != 0 {
            "从终端接收报文"
        } else {
            "向终端接收报文"
        };

        let restlt_str = format!(
            "{}:{} {} {} {} {} {} {} {} {}",
            dir_str,
            receive_time_str,
            regsit_time_str,
            head_point_str,
            ip_str,
            head_point_port_str,
            regesit_addr_str,
            logic_addr_str,
            process_label_str,
            begin_time_str
        );

        FrameFun::add_data(
            result_list,
            "内部规约".to_string(),
            FrameFun::get_data_str_with_space(&frame[..48]),
            restlt_str,
            vec![start_pos, start_pos + 84],
            None,
            None,
        );

        Ok(())
    }

    pub fn analysic_csg_ack_frame(
        frame: &[u8],
        dir: u8,
        prm: u8,
        result_list: &mut Vec<Value>,
        start_pos: usize,
        protocol: &str,
        region: &str,
    ) -> Result<(), Box<dyn Error>> {
        let data_segment = &frame[16..frame.len() - 2];
        let tpv = Self::get_afn_and_seq_result(&frame[14..16], start_pos + 14, result_list);
        let mut length = data_segment.len();
        let total_length = frame.len();
        let mut pos = 0;
        let index = 16 + start_pos;
        let mut num = 0;
        let mut sub_result = Vec::new();
        let mut tpv_data: &[u8] = &[];
        let empty_data: &[u8] = &[];

        let (pw_data, pw_pos) = if tpv {
            length -= 5;
            tpv_data = &frame[frame.len() - 7..frame.len() - 2];
            if data_segment.len() < 21 {
                (empty_data, [0, 0])
            } else {
                let pw_data = &data_segment[data_segment.len() - 21..data_segment.len() - 5];
                (pw_data, [total_length - 23, total_length - 7])
            }
        } else {
            if data_segment.len() < 16 {
                (empty_data, [0, 0])
            } else {
                let pw_data = &data_segment[data_segment.len() - 16..];
                (pw_data, [total_length - 18, total_length - 2])
            }
        };

        let data_segment = &data_segment[..length];
        let mut pw = false;

        while pos < length {
            let da = &data_segment[pos..pos + 2];
            let item = &data_segment[pos + 2..pos + 6];
            let point_str = Self::prase_da_data([da[0], da[1]]);

            let data_item = FrameFun::get_data_str_reverser(item);

            FrameFun::add_data(
                &mut sub_result,
                format!("<第{}组>信息点标识DA", num + 1),
                FrameFun::get_data_str_with_space(da),
                point_str,
                vec![index + pos, index + pos + 2],
                None,
                None,
            );
            pos += 2;

            let data_item_elem =
                ProtocolConfigManager::get_config_xml(&data_item, protocol, region, Some(dir));
            let mut item_data: Vec<Value> = Vec::new();

            let dis_data_identifier: String;
            let mut sub_datamen: &[u8];
            let sub_length: usize;
            let sub_datament: &[u8];

            if let Some(mut data_item_elem) = data_item_elem {
                sub_length = if let Some(sublength) = data_item_elem.get_child_text("length") {
                    sublength.parse::<usize>().unwrap()
                } else {
                    data_segment[pos + 4..].len()
                };
                sub_datament = &data_segment[pos + 4..pos + 4 + sub_length];
                data_item_elem.update_value("length", sub_length.to_string());
                item_data = FrameAnalisyic::prase_data(
                    &mut data_item_elem,
                    protocol,
                    region,
                    sub_datament,
                    index + pos + 4,
                    Some(dir),
                );
                let name = data_item_elem.get_child_text("name").unwrap();
                dis_data_identifier = format!("数据标识编码：[{}]-{}", data_item, name);
            } else {
                sub_datament = &data_segment[pos + 4..];
                sub_length = sub_datament.len();
                dis_data_identifier = format!("数据标识编码：[{}]", data_item);
            };

            let result_str: String = format!("数据标识[{}]数据内容：", data_item).to_string();

            let description: String = format!(
                "{}{}",
                result_str,
                FrameFun::get_data_str(data_segment, false, true, false)
            );
            FrameFun::add_data(
                &mut sub_result,
                format!("<第{}组>数据标识编码DI", num + 1),
                FrameFun::get_data_str_with_space(item),
                dis_data_identifier,
                vec![index + pos, index + pos + 4],
                None,
                None,
            );
            FrameFun::add_data(
                &mut sub_result,
                format!("<第{}组>数据标识内容", num + 1),
                FrameFun::get_data_str_with_space(sub_datament),
                description,
                vec![index + pos + 4, index + pos + 4 + sub_length],
                Some(item_data),
                None,
            );

            pos += sub_length + 4;
            num += 1;
            if length - pos == 16 {
                pw = Self::guest_is_exit_pw(
                    length,
                    pw_data,
                    None,
                    None,
                    false,
                    protocol,
                    region,
                    Some(dir),
                );
                if pw {
                    length -= 16;
                }
            }
        }

        if pw {
            let pw_str = "PW由16个字节组成，是由主站按系统约定的认证算法产生，并在主站发送的报文中下发给终端，由终端进行校验认证。".to_string();
            FrameFun::add_data(
                &mut sub_result,
                "消息验证码Pw".to_string(),
                FrameFun::get_data_str_with_space(pw_data),
                pw_str,
                pw_pos.to_vec(),
                None,
                None,
            );
        }
        if tpv {
            let tpv_str = Self::prase_tpv_data(tpv_data);
            FrameFun::add_data(
                &mut sub_result,
                "时间标签Tp".to_string(),
                FrameFun::get_data_str_with_space(tpv_data),
                tpv_str,
                vec![total_length - 7, total_length - 2],
                None,
                None,
            );
        }
        FrameFun::add_data(
            result_list,
            "信息体".to_string(),
            FrameFun::get_data_str_with_space(&frame[16..frame.len() - 2]),
            "".to_string(),
            vec![16, total_length - 2],
            Some(sub_result),
            None,
        );
        Ok(())
    }

    pub fn analysic_csg_link_frame(
        frame: &[u8],
        dir: u8,
        prm: u8,
        result_list: &mut Vec<Value>,
        start_pos: usize,
        protocol: &str,
        region: &str,
    ) -> Result<(), Box<dyn Error>> {
        let total_length = frame.len();
        let valid_data_segment = &frame[16..frame.len() - 2];
        let tpv = Self::get_afn_and_seq_result(&frame[14..16], start_pos + 14, result_list);
        let mut length = valid_data_segment.len();
        let mut pos = 0;
        let index = 16 + start_pos;
        let mut num = 0;
        let mut sub_result = Vec::new();
        let mut tpv_data: &[u8] = &[];
        let empty_data: &[u8] = &[];
        let (pw_data, pw_pos) = if tpv {
            length -= 5;
            tpv_data = &frame[frame.len() - 7..frame.len() - 2];
            if valid_data_segment.len() < 21 {
                (empty_data, [0, 0])
            } else {
                let pw_data = &valid_data_segment
                    [valid_data_segment.len() - 21..valid_data_segment.len() - 5];
                (pw_data, [total_length - 23, total_length - 7])
            }
        } else {
            if valid_data_segment.len() < 16 {
                (empty_data, [0, 0])
            } else {
                let pw_data = &valid_data_segment[valid_data_segment.len() - 16..];
                (pw_data, [total_length - 18, total_length - 2])
            }
        };

        let data_segment = &valid_data_segment[..length];
        let mut pw = false;
        let mut sub_datament: &[u8];
        while pos < length {
            let da = &data_segment[pos..pos + 2];
            let item = &data_segment[pos + 2..pos + 6];

            let point_str = Self::prase_da_data([da[0], da[1]]);
            let data_item = FrameFun::get_data_str_reverser(item);

            FrameFun::add_data(
                &mut sub_result,
                format!("<第{}组>信息点标识DA", num + 1),
                FrameFun::get_data_str_with_space(da),
                point_str,
                vec![index + pos, index + pos + 2],
                None,
                None,
            );
            pos += 2;

            let data_item_elem =
                ProtocolConfigManager::get_config_xml(&data_item, protocol, region, Some(dir));
            let mut item_data = Vec::new();
            let sub_length: usize;
            let dis_data_identifier: String;

            if let Some(mut data_item_elem) = data_item_elem {
                (sub_length, sub_datament) = if dir == 1 && prm == 0 {
                    (1, &data_segment[pos + 4..pos + 4 + 1])
                } else {
                    let sub_length_cont = data_item_elem.get_child_text("length");
                    let mut sub_length = if let Some(sub_length_cont) = sub_length_cont {
                        if sub_length_cont.to_uppercase() == "UNKNOWN" {
                            Self::calculate_item_length(
                                &mut data_item_elem,
                                &data_segment[pos + 4..],
                                protocol,
                                region,
                                Some(dir),
                                None,
                            )
                        } else {
                            sub_length_cont.parse::<usize>().unwrap()
                        }
                    } else {
                        data_segment[pos + 4..].len()
                    };
                    println!(
                        "sub_length: {:?} data_segment: {:?}",
                        sub_length, data_segment
                    );
                    if sub_length > data_segment[pos + 4..].len() {
                        sub_length = data_segment[pos + 4..].len();
                    }
                    let sub_datament = &data_segment[pos + 4..pos + 4 + sub_length];
                    (sub_length, sub_datament)
                };
                data_item_elem.update_value("length", sub_length.to_string());
                item_data = FrameAnalisyic::prase_data(
                    &mut data_item_elem,
                    protocol,
                    region,
                    sub_datament,
                    index + pos + 4,
                    Some(dir),
                );

                let name = data_item_elem.get_child_text("name").unwrap();
                dis_data_identifier = format!("数据标识编码：[{}]-{}", data_item, name);
            } else {
                (sub_length, sub_datament) = if dir == 1 && prm == 0 {
                    (1, &data_segment[pos + 4..pos + 4 + 1])
                } else {
                    let err_str =
                        format!("未查找到数据标识：{},请检查配置文件！", data_item).to_string();
                    let err = CustomError::new(1, err_str);
                    break;
                };
                dis_data_identifier = format!("数据标识编码：[{}]", data_item);
            };

            let result_str = if dir == 1 && prm == 0 {
                format!(
                    "写参数返回结果：{}-{}",
                    FrameFun::get_data_str_reverser(sub_datament),
                    Self::prase_err_code_result(sub_datament[0])
                )
            } else {
                format!(
                    "数据标识[{}]数据内容：{}",
                    data_item,
                    FrameFun::get_data_str_reverser(sub_datament)
                )
            };
            FrameFun::add_data(
                &mut sub_result,
                format!("<第{}组>数据标识编码DI", num + 1),
                FrameFun::get_data_str_with_space(item),
                dis_data_identifier,
                vec![index + pos, index + pos + 4],
                None,
                None,
            );
            if dir == 1 && prm == 0 {
                FrameFun::add_data(
                    &mut sub_result,
                    format!("<第{}组>ERR", num + 1),
                    FrameFun::get_data_str_with_space(sub_datament),
                    result_str,
                    vec![index + pos + 4, index + pos + 4 + sub_length],
                    Some(item_data),
                    None,
                );
            } else {
                if !item_data.is_empty() {
                    FrameFun::add_data(
                        &mut sub_result,
                        format!("<第{}组>数据标识内容", num + 1),
                        FrameFun::get_data_str_with_space(sub_datament),
                        result_str,
                        vec![index + pos + 4, index + pos + 4 + sub_length],
                        Some(item_data),
                        None,
                    );
                }
            }

            pos += sub_length + 4;
            num += 1;
            if length - pos == 16 {
                pw = Self::guest_is_exit_pw(
                    length,
                    pw_data,
                    None,
                    None,
                    false,
                    protocol,
                    region,
                    Some(dir),
                );
                if pw {
                    length -= 16;
                }
            }
        }

        if pw {
            let pw_str = "PW由16个字节组成，是由主站按系统约定的认证算法产生，并在主站发送的报文中下发给终端，由终端进行校验认证。".to_string();
            FrameFun::add_data(
                &mut sub_result,
                "消息验证码Pw".to_string(),
                FrameFun::get_data_str_with_space(pw_data),
                pw_str,
                pw_pos.to_vec(),
                None,
                None,
            );
        }
        if tpv {
            let tpv_str = Self::prase_tpv_data(tpv_data);
            FrameFun::add_data(
                &mut sub_result,
                "时间标签Tp".to_string(),
                FrameFun::get_data_str_with_space(tpv_data),
                tpv_str,
                vec![total_length - 7, total_length - 2],
                None,
                None,
            );
        }
        FrameFun::add_data(
            result_list,
            "信息体".to_string(),
            FrameFun::get_data_str_with_space(&frame[16..frame.len() - 2]),
            "".to_string(),
            vec![16, total_length - 2],
            Some(sub_result),
            None,
        );

        Ok(())
    }

    pub fn analysic_csg_write_frame(
        frame: &[u8],
        dir: u8,
        prm: u8,
        result_list: &mut Vec<Value>,
        start_pos: usize,
        protocol: &str,
        region: &str,
    ) -> Result<(), Box<dyn Error>> {
        let total_length = frame.len();
        let valid_data_segment = &frame[16..frame.len() - 2];
        let tpv = Self::get_afn_and_seq_result(&frame[14..16], start_pos + 14, result_list);
        let mut length = valid_data_segment.len();
        let mut pos = 0;
        let index = 16 + start_pos;
        let mut num = 0;
        let mut sub_result = Vec::new();
        let mut tpv_data: &[u8] = &[];
        let pw_data: &[u8] = &[];
        let empty_data: &[u8] = &[];
        info!("dir {} prm {}", dir, prm);
        let (pw_data, pw_pos) = if tpv {
            length -= 5;
            tpv_data = &frame[frame.len() - 7..frame.len() - 2];
            if valid_data_segment.len() < 21 {
                (empty_data, [0, 0])
            } else {
                let pw_data = &valid_data_segment
                    [valid_data_segment.len() - 21..valid_data_segment.len() - 5];
                (pw_data, [total_length - 23, total_length - 7])
            }
        } else {
            if valid_data_segment.len() < 16 {
                (empty_data, [0, 0])
            } else {
                let pw_data = &valid_data_segment[valid_data_segment.len() - 16..];
                (pw_data, [total_length - 18, total_length - 2])
            }
        };

        let data_segment = &valid_data_segment[..length];
        let mut pw = false;
        println!("write_csg_frame:---------------");
        while pos < length {
            let da = &data_segment[pos..pos + 2];
            let item = &data_segment[pos + 2..pos + 6];

            let point_str = Self::prase_da_data([da[0], da[1]]);
            let data_item = FrameFun::get_data_str_reverser(item);

            FrameFun::add_data(
                &mut sub_result,
                format!("<第{}组>信息点标识DA", num + 1),
                FrameFun::get_data_str_with_space(da),
                point_str,
                vec![index + pos, index + pos + 2],
                None,
                None,
            );
            pos += 2;

            let data_item_elem =
                ProtocolConfigManager::get_config_xml(&data_item, protocol, region, Some(dir));
            let mut item_data = Vec::new();
            let sub_length: usize;
            let sub_datament: &[u8];
            let dis_data_identifier: String;
            if let Some(mut data_item_elem) = data_item_elem {
                (sub_length, sub_datament) = if dir == 1 && prm == 0 {
                    (1, &data_segment[pos + 4..pos + 4 + 1])
                } else {
                    let sub_length_cont = data_item_elem.get_child_text("length");
                    let mut sub_length = if let Some(sub_length_cont) = sub_length_cont {
                        if sub_length_cont.to_uppercase() == "UNKNOWN" {
                            Self::calculate_item_length(
                                &mut data_item_elem,
                                &data_segment[pos + 4..],
                                protocol,
                                region,
                                Some(dir),
                                None,
                            )
                        } else {
                            sub_length_cont.parse::<usize>().unwrap()
                        }
                    } else {
                        data_segment[pos + 4..].len()
                    };
                    if sub_length > data_segment[pos + 4..].len() {
                        sub_length = data_segment[pos + 4..].len();
                    }
                    let sub_datament = &data_segment[pos + 4..pos + 4 + sub_length];
                    (sub_length, sub_datament)
                };
                data_item_elem.update_value("length", sub_length.to_string());
                // println!("sub_datament: {:?}", data_item_elem);
                if dir == 0 || prm == 1 {
                    item_data = FrameAnalisyic::prase_data(
                        &mut data_item_elem,
                        protocol,
                        region,
                        sub_datament,
                        index + pos + 4,
                        Some(dir),
                    );
                }
                let name = data_item_elem.get_child_text("name").unwrap();
                dis_data_identifier = format!("数据标识编码：[{}]-{}", data_item, name);
            } else {
                (sub_length, sub_datament) = if dir == 1 && prm == 0 {
                    (1, &data_segment[pos + 4..pos + 4 + 1])
                } else {
                    let err_str =
                        format!("未查找到数据标识：{},请检查配置文件！", data_item).to_string();
                    let err = CustomError::new(1, err_str);
                    break;
                };
                dis_data_identifier = format!("数据标识编码：[{}]", data_item);
            };

            let result_str = if dir == 1 && prm == 0 {
                format!(
                    "写参数返回结果：{}-{}",
                    FrameFun::get_data_str_reverser(sub_datament),
                    Self::prase_err_code_result(sub_datament[0])
                )
            } else {
                format!(
                    "数据标识[{}]数据内容：{}",
                    data_item,
                    FrameFun::get_data_str_reverser(sub_datament)
                )
            };
            FrameFun::add_data(
                &mut sub_result,
                format!("<第{}组>数据标识编码DI", num + 1),
                FrameFun::get_data_str_with_space(item),
                dis_data_identifier,
                vec![index + pos, index + pos + 4],
                None,
                None,
            );
            if dir == 1 && prm == 0 {
                FrameFun::add_data(
                    &mut sub_result,
                    format!("<第{}组>ERR", num + 1),
                    FrameFun::get_data_str_with_space(sub_datament),
                    result_str,
                    vec![index + pos + 4, index + pos + 4 + sub_length],
                    None,
                    None,
                );
            } else {
                if !item_data.is_empty() {
                    FrameFun::add_data(
                        &mut sub_result,
                        format!("<第{}组>数据标识内容", num + 1),
                        FrameFun::get_data_str_with_space(sub_datament),
                        result_str,
                        vec![index + pos + 4, index + pos + 4 + sub_length],
                        Some(item_data),
                        None,
                    );
                }
            }

            pos += sub_length + 4;
            num += 1;
            if length - pos == 16 {
                pw = Self::guest_is_exit_pw(
                    length,
                    pw_data,
                    None,
                    None,
                    false,
                    protocol,
                    region,
                    Some(dir),
                );

                if pw {
                    length -= 16;
                }
            }
        }

        if pw {
            let pw_str = "PW由16个字节组成，是由主站按系统约定的认证算法产生，并在主站发送的报文中下发给终端，由终端进行校验认证。".to_string();
            FrameFun::add_data(
                &mut sub_result,
                "消息验证码Pw".to_string(),
                FrameFun::get_data_str_with_space(pw_data),
                pw_str,
                pw_pos.to_vec(),
                None,
                None,
            );
        }
        if tpv {
            let tpv_str = Self::prase_tpv_data(tpv_data);
            FrameFun::add_data(
                &mut sub_result,
                "时间标签Tp".to_string(),
                FrameFun::get_data_str_with_space(tpv_data),
                tpv_str,
                vec![total_length - 7, total_length - 2],
                None,
                None,
            );
        }
        FrameFun::add_data(
            result_list,
            "信息体".to_string(),
            FrameFun::get_data_str_with_space(&frame[16..frame.len() - 2]),
            "".to_string(),
            vec![16, total_length - 2],
            Some(sub_result),
            None,
        );

        Ok(())
    }

    pub fn analysic_csg_security_frame(
        frame: &[u8],
        dir: u8,
        prm: u8,
        result_list: &mut Vec<Value>,
        start_pos: usize,
        protocol: &str,
        region: &str,
    ) -> Result<(), Box<dyn Error>> {
        let valid_data_segment = &frame[16..frame.len() - 2];
        let tpv = Self::get_afn_and_seq_result(&frame[14..16], start_pos + 14, result_list);
        let mut length = valid_data_segment.len();
        let mut pos = 0;
        let index = 16 + start_pos;
        let mut num = 0;
        let mut sub_result = vec![];
        let total_length = frame.len();
        let empty_data: &[u8] = &[];

        let (tpv_data, pw_data, pw_pos, length_ref) = if tpv {
            (
                &frame[frame.len() - 7..frame.len() - 2],
                if valid_data_segment.len() > 21 {
                    &valid_data_segment[valid_data_segment.len() - 21..valid_data_segment.len() - 5]
                } else {
                    empty_data
                },
                [total_length - 23, total_length - 7],
                &mut (length - 5),
            )
        } else {
            (
                empty_data,
                if valid_data_segment.len() > 16 {
                    &valid_data_segment[valid_data_segment.len() - 16..]
                } else {
                    empty_data
                },
                [total_length - 18, total_length - 2],
                &mut length,
            )
        };

        // 取消引用 `&mut length_ref` 以便进行切片
        length = *length_ref;
        let mut pw = false;
        let data_segment = &valid_data_segment[..length];
        let mut sub_length: usize = 0;
        let mut new_datament: &[u8] = &[];
        while pos < length {
            let result = (|| -> Result<(), Box<dyn Error>> {
                let da = &data_segment[pos..pos + 2];
                let item = &data_segment[pos + 2..pos + 6];
                let point_str = Self::prase_da_data([da[0], da[1]]).clone();
                let data_item = FrameFun::get_data_str_reverser(item);
                FrameFun::add_data(
                    &mut sub_result,
                    format!("<第{}组>信息点标识DA", num + 1),
                    FrameFun::get_data_str_with_space(da),
                    point_str.clone(),
                    vec![index + pos, index + pos + 2],
                    None,
                    None,
                );
                pos += 2;

                let data_item_elem =
                    ProtocolConfigManager::get_config_xml(&data_item, protocol, region, Some(dir));

                let mut item_data: Vec<Value> = Vec::new();

                if let Some(mut data_item_elem) = data_item_elem {
                    if dir == 1 && prm == 0 {
                        let sub_length_cont = data_item_elem.get_child_text("length");
                        (sub_length, new_datament) = if let Some(sub_length_cont) = sub_length_cont
                        {
                            if sub_length_cont.to_uppercase() == "UNKNOWN" {
                                let new_sub_length = Self::calculate_item_length(
                                    &mut data_item_elem,
                                    &data_segment[pos + 4..],
                                    protocol,
                                    region,
                                    Some(dir),
                                    None,
                                );
                                let sub_datament = &data_segment[pos + 4..pos + 4 + new_sub_length];
                                (new_sub_length, sub_datament)
                            } else {
                                // 解析 sub_length_cont 为 usize
                                let mut sub_length = sub_length_cont.parse::<usize>()?;
                                if sub_length > data_segment.len() - pos - 4 {
                                    sub_length = data_segment.len() - pos - 4;
                                }
                                let sub_datament = &data_segment[pos + 4..pos + 4 + sub_length];
                                // 重新计算长度并获取新的数据段
                                let (new_sub_length, new_datament) = Self::recalculate_sub_length(
                                    &mut data_item_elem,
                                    sub_datament,
                                    protocol,
                                    region,
                                    Some(dir),
                                );
                                (new_sub_length, new_datament)
                            }
                        } else {
                            // 如果 sub_length_cont 为 None，则返回默认的值
                            let sub_datament = &data_segment[pos + 4..];
                            (0 as usize, sub_datament)
                        };
                        data_item_elem.update_value("length", sub_length.to_string());
                        item_data = FrameAnalisyic::prase_data(
                            &mut data_item_elem,
                            protocol,
                            region,
                            &new_datament,
                            index + pos + 4,
                            Some(dir),
                        );
                    } else {
                        let sub_length = 0;
                    };

                    let name = data_item_elem.get_child_text("name").unwrap();
                    let dis_data_identifier =
                        format!("数据标识编码：[{}]-{}", data_item, name).to_string();

                    FrameFun::add_data(
                        &mut sub_result,
                        format!("<第{}组>数据标识编码DI", num + 1),
                        FrameFun::get_data_str_with_space(item),
                        dis_data_identifier.clone(),
                        vec![index + pos, index + pos + 4],
                        None,
                        None,
                    );

                    if dir == 1 && prm == 0 {
                        let new_point_str = point_str.replace("Pn=", ""); // 使用新的变量保存结果
                        let dis_data_identifier = format!("[{}]-{}", data_item, name).to_string();

                        FrameFun::add_data(
                            &mut sub_result,
                            format!("<第{}组>数据内容", num + 1),
                            FrameFun::get_data_str_with_space(new_datament),
                            format!("{}-{}", new_point_str.clone(), dis_data_identifier.clone()),
                            vec![index + pos + 4, index + pos + 4 + sub_length],
                            Some(item_data),
                            None,
                        );
                    }

                    pos += sub_length + 4;
                    num += 1;

                    if length - pos == 16 {
                        pw = Self::guest_is_exit_pw(
                            length,
                            pw_data,
                            None,
                            None,
                            false,
                            protocol,
                            region,
                            Some(dir),
                        );
                        if pw {
                            length -= 16;
                        }
                    }
                } else {
                    if dir == 1 && prm == 0 {
                        pw = Self::guest_is_exit_pw(
                            length,
                            &pw_data,
                            None,
                            None,
                            false,
                            protocol,
                            region,
                            Some(dir),
                        );
                        let err_str =
                            format!("未查找到数据标识：{},请检查配置文件！", data_item).to_string();
                        let err = CustomError::new(1, err_str);
                        return Err(Box::new(err));
                    } else {
                        let sub_length = 0;
                    }

                    let dis_data_identifier = format!("数据标识编码：[{}]", data_item);
                    FrameFun::add_data(
                        &mut sub_result,
                        format!("<第{}组>数据标识编码DI", num + 1),
                        FrameFun::get_data_str_with_space(item),
                        dis_data_identifier,
                        vec![index + pos, index + pos + 4],
                        None,
                        None,
                    );
                }
                Ok(())
            })();

            match result {
                Ok(_) => {}
                Err(e) => {
                    let err_str = format!("数据解析失败!").to_string();
                    let err = CustomError::new(1, err_str);
                    break;
                }
            }
        }

        if pw {
            let pw_str = "PW由16个字节组成，是由主站按系统约定的认证算法产生，并在主站发送的报文中下发给终端，由终端进行校验认证。".to_string();
            FrameFun::add_data(
                &mut sub_result,
                "消息验证码Pw".to_string(),
                FrameFun::get_data_str_with_space(pw_data),
                pw_str,
                pw_pos.to_vec(),
                None,
                None,
            );
        }

        if tpv {
            let tpv_str = Self::prase_tpv_data(tpv_data);
            FrameFun::add_data(
                &mut sub_result,
                "时间标签Tp".to_string(),
                FrameFun::get_data_str_with_space(tpv_data),
                tpv_str,
                vec![total_length - 7, total_length - 2],
                None,
                None,
            );
        }

        FrameFun::add_data(
            result_list,
            "信息体".to_string(),
            FrameFun::get_data_str_with_space(&frame[16..total_length - 2]),
            "".to_string(),
            vec![16, total_length - 2],
            Some(sub_result),
            None,
        );

        Ok(())
    }

    pub fn analysic_csg_read_cur_frame(
        frame: &[u8],
        dir: u8,
        prm: u8,
        result_list: &mut Vec<Value>,
        start_pos: usize,
        protocol: &str,
        region: &str,
    ) -> Result<(), Box<dyn Error>> {
        let valid_data_segment = &frame[16..frame.len() - 2];
        let tpv = Self::get_afn_and_seq_result(&frame[14..16], start_pos + 14, result_list);
        let length = valid_data_segment.len();
        let mut pos = 0;
        let index = 16 + start_pos;
        let mut num = 0;
        let mut sub_result = vec![];
        let total_length = frame.len();
        let empty_data: &[u8] = &[];
        let (tpv_data, pw_data, pw_pos, cur_length) = if tpv {
            (
                &frame[frame.len() - 7..frame.len() - 2],
                if valid_data_segment.len() > 21 {
                    &valid_data_segment[valid_data_segment.len() - 21..valid_data_segment.len() - 5]
                } else {
                    empty_data
                },
                [total_length - 23, total_length - 7],
                length - 5,
            )
        } else {
            (
                empty_data,
                if valid_data_segment.len() > 16 {
                    &valid_data_segment[valid_data_segment.len() - 16..]
                } else {
                    empty_data
                },
                [total_length - 18, total_length - 2],
                length,
            )
        };

        let mut pw = false;
        let data_segment = &valid_data_segment[..cur_length];
        let mut length = cur_length;
        while pos < length {
            let result = (|| -> Result<(), CustomError> {
                let da: &[u8] = &data_segment[pos..pos + 2];
                let item = &data_segment[pos + 2..pos + 6];
                let point_str = Self::prase_da_data([da[0], da[1]]);
                let data_item = FrameFun::get_data_str_reverser(item);
                FrameFun::add_data(
                    &mut sub_result,
                    format!("<第{}组>信息点标识DA", num + 1),
                    FrameFun::get_data_str_with_space(da),
                    point_str.clone(),
                    vec![index + pos, index + pos + 2],
                    None,
                    None,
                );
                pos += 2;

                let data_item_elem =
                    ProtocolConfigManager::get_config_xml(&data_item, protocol, region, Some(dir));

                let mut item_data: Vec<Value> = Vec::new();
                let mut sub_length = 0;
                let mut sub_datament: &[u8] = &[];
                if let Some(mut data_item_elem) = data_item_elem {
                    if dir == 1 && prm == 0 {
                        let sub_length_cont = data_item_elem.get_child_text("length").unwrap();
                        (sub_length, sub_datament) = if sub_length_cont.to_uppercase() == "UNKNOWN"
                        {
                            let new_sub_length = Self::calculate_item_length(
                                &mut data_item_elem,
                                &data_segment[pos + 4..],
                                protocol,
                                region,
                                Some(dir),
                                None,
                            );
                            let new_sub_datament = &data_segment[pos + 4..pos + 4 + new_sub_length];
                            println!("new_sub_datament:{:?} sub_length:{:?}", new_sub_datament, new_sub_length);
                            (new_sub_length, new_sub_datament)
                        } else {
                            let mut sub_length = sub_length_cont.parse::<usize>().unwrap();
                            if sub_length > data_segment.len() - pos - 4 {
                                sub_length = data_segment.len() - pos - 4;
                            }
                            let sub_datament = &data_segment[pos + 4..pos + 4 + sub_length];
                            let (new_sub_length, new_datament) = Self::recalculate_sub_length(
                                &mut data_item_elem,
                                sub_datament,
                                protocol,
                                region,
                                Some(dir),
                            );
                            (new_sub_length, new_datament)
                        };

                        item_data = FrameAnalisyic::prase_data(
                            &mut data_item_elem,
                            protocol,
                            region,
                            sub_datament,
                            index + pos + 4,
                            Some(dir),
                        );
                    } else {
                        let sub_length = 0;
                    }

                    let name = data_item_elem.get_child_text("name").unwrap();
                    let dis_data_identifier = format!("数据标识编码：[{}]-{}", data_item, name);

                    FrameFun::add_data(
                        &mut sub_result,
                        format!("<第{}组>数据标识编码DI", num + 1),
                        FrameFun::get_data_str_with_space(item),
                        dis_data_identifier.clone(),
                        vec![index + pos, index + pos + 4],
                        None,
                        None,
                    );

                    if dir == 1 && prm == 0 {
                        FrameFun::add_data(
                            &mut sub_result,
                            format!("<第{}组>数据内容", num + 1),
                            FrameFun::get_data_str_with_space(sub_datament),
                            format!(
                                "{}-{}",
                                &point_str["Pn=".len()..],
                                &dis_data_identifier["数据标识编码：".len()..]
                            ),
                            vec![index + pos + 4, index + pos + 4 + sub_length],
                            Some(item_data),
                            None,
                        );
                    }

                    pos += sub_length + 4;
                    num += 1;

                    if length - pos == 16 {
                        pw = Self::guest_is_exit_pw(
                            length,
                            pw_data,
                            None,
                            None,
                            false,
                            protocol,
                            region,
                            Some(dir),
                        );

                        if pw {
                            length -= 16;
                        }
                    }
                } else {
                    if dir == 1 && prm == 0 {
                        pw = Self::guest_is_exit_pw(
                            length,
                            &pw_data,
                            None,
                            None,
                            false,
                            protocol,
                            region,
                            Some(dir),
                        );
                        let err_str = format!("数据解析失败!").to_string();
                        let err = CustomError::new(1, err_str);
                        return Err(err);
                    } else {
                        let sub_length = 0;
                    }

                    let dis_data_identifier = format!("数据标识编码：[{}]", data_item);
                    FrameFun::add_data(
                        &mut sub_result,
                        format!("<第{}组>数据标识编码DI", num + 1),
                        FrameFun::get_data_str_with_space(item),
                        dis_data_identifier,
                        vec![index + pos, index + pos + 4],
                        None,
                        None,
                    );
                }
                Ok(())
            })();

            match result {
                Ok(_) => {}
                Err(e) => {
                    let err_str = format!("数据解析失败!").to_string();
                    let err = CustomError::new(1, err_str);
                    break;
                }
            }
        }

        if pw {
            let pw_str = "PW由16个字节组成，是由主站按系统约定的认证算法产生，并在主站发送的报文中下发给终端，由终端进行校验认证。".to_string();
            FrameFun::add_data(
                &mut sub_result,
                "消息验证码Pw".to_string(),
                FrameFun::get_data_str_with_space(pw_data),
                pw_str,
                pw_pos.to_vec(),
                None,
                None,
            );
        }

        if tpv {
            let tpv_str = Self::prase_tpv_data(tpv_data);
            FrameFun::add_data(
                &mut sub_result,
                "时间标签Tp".to_string(),
                FrameFun::get_data_str_with_space(tpv_data),
                tpv_str,
                vec![total_length - 7, total_length - 2],
                None,
                None,
            );
        }

        FrameFun::add_data(
            result_list,
            "信息体".to_string(),
            FrameFun::get_data_str_with_space(&frame[16..frame.len() - 2]),
            "".to_string(),
            vec![16, total_length - 2],
            Some(sub_result),
            None,
        );

        Ok(())
    }

    pub fn analysic_csg_read_history_frame(
        frame: &[u8],
        dir: u8,
        prm: u8,
        result_list: &mut Vec<Value>,
        start_pos: usize,
        protocol: &str,
        region: &str,
    ) -> Result<(), Box<dyn Error>> {
        let valid_data_segment = &frame[16..frame.len() - 2];
        let tpv = Self::get_afn_and_seq_result(&frame[14..16], start_pos + 14, result_list);
        let mut length = valid_data_segment.len();
        let mut pos = 0;
        let index = 16 + start_pos;
        let mut num = 0;
        let mut sub_result = vec![];
        let total_length = frame.len();
        let empty_data: &[u8] = &[];

        let (tpv_data, pw_data, pw_pos, cur_length) = if tpv {
            (
                &frame[frame.len() - 7..frame.len() - 2],
                if valid_data_segment.len() > 21 {
                    &valid_data_segment[valid_data_segment.len() - 21..valid_data_segment.len() - 5]
                } else {
                    empty_data
                },
                [total_length - 23, total_length - 7],
                length - 5,
            )
        } else {
            (
                empty_data,
                if valid_data_segment.len() > 16 {
                    &valid_data_segment[valid_data_segment.len() - 16..]
                } else {
                    empty_data
                },
                [total_length - 18, total_length - 2],
                length,
            )
        };

        length = cur_length;
        let mut pw = false;
        let data_segment = &valid_data_segment[..length];
        let mut data_item_elem: Option<XmlElement> = None;
        let sub_length: usize;
        let mut last_data_time: Option<&[u8]> = None;
        let sub_pos: usize;
        let mut point_str: String = String::new();
        let mut dis_data_identifier: String = String::new();
        while pos < length {
            let result = (|| -> Result<(), CustomError> {
                if !Self::guest_next_data_is_cur_item_data(
                    data_item_elem.clone(),
                    &data_segment[pos..],
                    last_data_time.as_deref(),
                    protocol,
                    region,
                    Some(dir),
                ) {
                    let da = &data_segment[pos..pos + 2];
                    let item = &data_segment[pos + 2..pos + 6];
                    point_str = Self::prase_da_data([da[0], da[1]]);
                    let (data_item_elem_opt, data_item) =
                        Self::try_get_item_and_point(item, protocol, region, Some(dir));
                    data_item_elem = data_item_elem_opt.clone();

                    dis_data_identifier = if let Some(data_item_elem) = data_item_elem.clone() {
                        let name = data_item_elem.get_child_text("name").unwrap();
                        format!("数据标识编码：[{}]-{}", data_item, name)
                    } else {
                        format!("数据标识编码：[{}]", data_item)
                    };

                    FrameFun::add_data(
                        &mut sub_result,
                        format!("<第{}组>信息点标识DA", num + 1),
                        FrameFun::get_data_str_with_space(da),
                        point_str.clone(),
                        vec![index + pos, index + pos + 2],
                        None,
                        None,
                    );
                    pos += 2;
                    FrameFun::add_data(
                        &mut sub_result,
                        format!("<第{}组>数据标识编码DI", num + 1),
                        FrameFun::get_data_str_with_space(item),
                        dis_data_identifier.clone(),
                        vec![index + pos, index + pos + 4],
                        None,
                        None,
                    );
                    pos += 4;

                    if region == "海南" {
                        let data_count = data_segment[pos];
                        let identifier = format!("数据时间个数: {:02o}", data_count);
                        FrameFun::add_data(
                            &mut sub_result,
                            format!("<第{}组>数据时间个数", num + 1),
                            FrameFun::get_data_str_with_space(&data_segment[pos..pos + 1]),
                            identifier,
                            vec![index + pos, index + pos + 1],
                            None,
                            None,
                        );
                        pos += 1;
                    }
                }

                let mut item_data: Vec<Value> = Vec::new();
                let mut sub_length = 0;
                let mut sub_datament: &[u8] = &[];

                if let Some(mut item_elem) = data_item_elem.clone() {
                    if dir == 1 && prm == 0 {
                        let sub_length_cont = item_elem.get_child_text("length").unwrap();
                        (sub_length, sub_datament) = if sub_length_cont.to_uppercase() == "UNKNOWN"
                        {
                            let sub_length = Self::calculate_item_length(
                                &mut item_elem,
                                &data_segment[pos..],
                                protocol,
                                region,
                                Some(dir),
                                None,
                            );
                            let sub_datament = &data_segment[pos..pos + sub_length];
                            (sub_length, sub_datament)
                        } else {
                            let mut sub_length = sub_length_cont.parse::<usize>().unwrap();
                            if sub_length > data_segment.len() - pos {
                                sub_length = data_segment.len() - pos;
                            }
                            let sub_datament = &data_segment[pos..pos + sub_length];
                            let (new_sub_length, new_datament) = Self::recalculate_sub_length(
                                &mut item_elem,
                                sub_datament,
                                protocol,
                                region,
                                Some(dir),
                            );
                            (new_sub_length, new_datament)
                        };
                        item_elem.update_value("length", sub_length.to_string());
                        item_data = FrameAnalisyic::prase_data(
                            &mut item_elem,
                            protocol,
                            region,
                            sub_datament,
                            index + pos,
                            Some(dir),
                        );
                    } else {
                        sub_length = 0;
                    }
                } else {
                    if dir == 1 && prm == 0 {
                        let sub_length = length;
                        pw = Self::guest_is_exit_pw(
                            length,
                            &pw_data,
                            data_item_elem.clone(),
                            last_data_time,
                            true,
                            protocol,
                            region,
                            Some(dir),
                        );
                        let err_str = format!("数据解析失败!").to_string();
                        let err = CustomError::new(1, err_str);
                        return Err(err);
                    } else {
                        let sub_length = 0;
                    }
                }

                if dir == 1 {
                    let new_point_str = point_str.clone().replace("Pn=", "");
                    let new_dis_str: String =
                        dis_data_identifier.clone().replace("数据标识编码：", "");
                    FrameFun::add_data(
                        &mut sub_result,
                        format!("<第{}组>数据内容", num + 1),
                        FrameFun::get_data_str_with_space(sub_datament),
                        format!("{}-{}", new_point_str, new_dis_str),
                        vec![index + pos, index + pos + sub_length + 6],
                        Some(item_data),
                        None,
                    );
                    let data_time = &data_segment[pos + sub_length..pos + sub_length + 6];
                    last_data_time = Some(data_time);
                    let time_str = FrameFun::parse_time_data(data_time, "CCYYMMDDhhmm", false);
                    FrameFun::add_data(
                        &mut sub_result,
                        format!("<第{}组>数据时间", num + 1),
                        FrameFun::get_data_str_with_space(data_time),
                        format!("数据时间：{}", time_str),
                        vec![index + pos + sub_length, index + pos + sub_length + 6],
                        None,
                        None,
                    );
                    pos += 6;
                } else {
                    let start_time = &data_segment[pos..pos + 6];
                    let end_time = &data_segment[pos + 6..pos + 12];
                    let data_dinsty = data_segment[pos + 12];
                    let start_time_str =
                        FrameFun::parse_time_data(start_time, "CCYYMMDDhhmm", false);
                    let end_time_str = FrameFun::parse_time_data(end_time, "CCYYMMDDhhmm", false);
                    let data_dinsty_str = Self::get_data_dinsty(data_dinsty);
                    FrameFun::add_data(
                        &mut sub_result,
                        format!("<第{}组>数据起始时间", num + 1),
                        FrameFun::get_data_str_with_space(start_time),
                        start_time_str,
                        vec![index + pos, index + pos + 6],
                        None,
                        None,
                    );
                    FrameFun::add_data(
                        &mut sub_result,
                        format!("<第{}组>数据结束时间", num + 1),
                        FrameFun::get_data_str_with_space(end_time),
                        end_time_str,
                        vec![index + pos + 6, index + pos + 12],
                        None,
                        None,
                    );
                    FrameFun::add_data(
                        &mut sub_result,
                        format!("<第{}组>数据密度", num + 1),
                        format!("{:02X}", data_dinsty),
                        format!("数据间隔时间：{}", data_dinsty_str),
                        vec![index + pos + 12, index + pos + 13],
                        None,
                        None,
                    );
                    pos += 13;
                }

                pos += sub_length;
                num += 1;

                if length - pos == 16 {
                    pw = Self::guest_is_exit_pw(
                        length,
                        pw_data,
                        data_item_elem.clone(),
                        last_data_time,
                        true,
                        protocol,
                        region,
                        Some(dir),
                    );
                    if pw {
                        length -= 16;
                    }
                }
                Ok(())
            })();
            match result {
                Ok(_) => {}
                Err(e) => {
                    let err_str = format!("数据解析失败!").to_string();
                    let err = CustomError::new(1, err_str);
                    break;
                }
            }
        }
        if pw {
            let pw_str = "PW由16个字节组成，是由主站按系统约定的认证算法产生，并在主站发送的报文中下发给终端，由终端进行校验认证。".to_string();
            FrameFun::add_data(
                &mut sub_result,
                "消息验证码Pw".to_string(),
                FrameFun::get_data_str_with_space(pw_data),
                pw_str,
                pw_pos.to_vec(),
                None,
                None,
            );
        }

        if tpv {
            let tpv_str = Self::prase_tpv_data(tpv_data);
            FrameFun::add_data(
                &mut sub_result,
                "时间标签Tp".to_string(),
                FrameFun::get_data_str_with_space(tpv_data),
                tpv_str,
                vec![total_length - 7, total_length - 2],
                None,
                None,
            );
        }

        FrameFun::add_data(
            result_list,
            "信息体".to_string(),
            FrameFun::get_data_str_with_space(&frame[16..frame.len() - 2]),
            "".to_string(),
            vec![16, total_length - 2],
            Some(sub_result),
            None,
        );

        Ok(())
    }

    pub fn analysic_csg_read_param_frame(
        frame: &[u8],
        dir: u8,
        prm: u8,
        result_list: &mut Vec<Value>,
        start_pos: usize,
        protocol: &str,
        region: &str,
    ) -> Result<(), Box<dyn Error>> {
        let valid_data_segment = &frame[16..frame.len() - 2];
        let tpv = Self::get_afn_and_seq_result(&frame[14..16], start_pos + 14, result_list);
        let mut length = valid_data_segment.len();
        let mut pos = 0;
        let index = 16 + start_pos;
        let mut num = 0;
        let mut sub_result = vec![];
        let total_length = frame.len();
        let empty_data: &[u8] = &[];
        let (tpv_data, pw_data, pw_pos, cur_length) = if tpv {
            (
                &frame[frame.len() - 7..frame.len() - 2],
                if valid_data_segment.len() > 21 {
                    &valid_data_segment[valid_data_segment.len() - 21..valid_data_segment.len() - 5]
                } else {
                    empty_data
                },
                [total_length - 23, total_length - 7],
                length - 5,
            )
        } else {
            (
                empty_data,
                if valid_data_segment.len() > 16 {
                    &valid_data_segment[valid_data_segment.len() - 16..]
                } else {
                    empty_data
                },
                [total_length - 18, total_length - 2],
                length,
            )
        };
        length = cur_length;
        let mut pw = false;
        let data_segment = &valid_data_segment[..length];

        while pos < length {
            let result = (|| -> Result<(), CustomError> {
                let da = &data_segment[pos..pos + 2];
                let item = &data_segment[pos + 2..pos + 6];
                let point_str = Self::prase_da_data([da[0], da[1]]);
                let data_item = FrameFun::get_data_str_reverser(item);
                FrameFun::add_data(
                    &mut sub_result,
                    format!("<第{}组>信息点标识DA", num + 1),
                    FrameFun::get_data_str_with_space(da),
                    point_str.clone(),
                    vec![index + pos, index + pos + 2],
                    None,
                    None,
                );
                pos += 2;

                let data_item_elem =
                    ProtocolConfigManager::get_config_xml(&data_item, protocol, region, Some(dir));
                let mut item_data: Vec<Value> = Vec::new();
                let sub_length: usize;
                let mut sub_datament: &[u8] = &[];

                if let Some(mut data_item_elem) = data_item_elem {
                    if dir == 1 && prm == 0 {
                        let sub_length_cont = data_item_elem.get_child_text("length").unwrap();
                        (sub_length, sub_datament) = if sub_length_cont.to_uppercase() == "UNKNOWN"
                        {
                            let sub_length = Self::calculate_item_length(
                                &mut data_item_elem,
                                &data_segment[pos + 4..],
                                protocol,
                                region,
                                Some(dir),
                                None,
                            );
                            let sub_datament = &data_segment[pos + 4..pos + 4 + sub_length];
                            (sub_length, sub_datament)
                        } else {
                            let mut sub_length = sub_length_cont.parse::<usize>().unwrap();
                            if sub_length > data_segment.len() - pos - 4 {
                                sub_length = data_segment.len() - pos - 4;
                            }
                            let sub_datament = &data_segment[pos + 4..pos + 4 + sub_length];
                            let (new_sub_length, new_datament) = Self::recalculate_sub_length(
                                &mut data_item_elem,
                                sub_datament,
                                protocol,
                                region,
                                Some(dir),
                            );
                            (new_sub_length, new_datament)
                        };
                        data_item_elem.update_value("length", sub_length.to_string());
                        println!("read_param:{:?}", sub_datament);
                        item_data = FrameAnalisyic::prase_data(
                            &mut data_item_elem,
                            protocol,
                            region,
                            sub_datament,
                            index + pos + 4,
                            Some(dir),
                        );
                    } else {
                        sub_length = 0;
                    }

                    let name = data_item_elem.get_child_text("name").unwrap();
                    let dis_data_identifier = format!("数据标识编码：[{}]-{}", data_item, name);

                    FrameFun::add_data(
                        &mut sub_result,
                        format!("<第{}组>数据标识编码DI", num + 1),
                        FrameFun::get_data_str_with_space(item),
                        dis_data_identifier.clone(),
                        vec![index + pos, index + pos + 4],
                        None,
                        None,
                    );

                    if dir == 1 && prm == 0 {
                        let new_point_str = point_str.clone().replace("Pn=", "");
                        let new_dis_str: String =
                            dis_data_identifier.clone().replace("数据标识编码：", "");
                        FrameFun::add_data(
                            &mut sub_result,
                            format!("<第{}组>数据内容", num + 1),
                            FrameFun::get_data_str_with_space(sub_datament),
                            format!("{}-{}", new_point_str, new_dis_str),
                            vec![index + pos + 4, index + pos + 4 + sub_length],
                            Some(item_data),
                            None,
                        );
                    }

                    pos += sub_length + 4;
                    num += 1;

                    if length - pos == 16 {
                        pw = Self::guest_is_exit_pw(
                            length,
                            pw_data,
                            None,
                            None,
                            false,
                            protocol,
                            region,
                            Some(dir),
                        );
                        if pw {
                            length -= 16;
                        }
                    }
                } else {
                    if dir == 1 && prm == 0 {
                        pw = Self::guest_is_exit_pw(
                            length,
                            &pw_data,
                            None,
                            None,
                            false,
                            protocol,
                            region,
                            Some(dir),
                        );
                        let err_str = format!("数据解析失败!").to_string();
                        let err = CustomError::new(1, err_str);
                        return Err(err);
                    } else {
                        let sub_length = 0;
                    }

                    let dis_data_identifier = format!("数据标识编码：[{}]", data_item);
                    FrameFun::add_data(
                        &mut sub_result,
                        format!("<第{}组>数据标识编码DI", num + 1),
                        FrameFun::get_data_str_with_space(item),
                        dis_data_identifier,
                        vec![index + pos, index + pos + 4],
                        None,
                        None,
                    );
                }
                Ok(())
            })();
            match result {
                Ok(_) => {}
                Err(e) => {
                    let err_str = format!("数据解析失败!").to_string();
                    let err = CustomError::new(1, err_str);
                    break;
                }
            }
        }

        if pw {
            let pw_str = "PW由16个字节组成，是由主站按系统约定的认证算法产生，并在主站发送的报文中下发给终端，由终端进行校验认证。".to_string();
            FrameFun::add_data(
                &mut sub_result,
                "消息验证码Pw".to_string(),
                FrameFun::get_data_str_with_space(pw_data),
                pw_str,
                pw_pos.to_vec(),
                None,
                None,
            );
        }

        if tpv {
            let tpv_str = Self::prase_tpv_data(tpv_data);
            FrameFun::add_data(
                &mut sub_result,
                "时间标签Tp".to_string(),
                FrameFun::get_data_str_with_space(tpv_data),
                tpv_str,
                vec![total_length - 7, total_length - 2],
                None,
                None,
            );
        }

        FrameFun::add_data(
            result_list,
            "信息体".to_string(),
            FrameFun::get_data_str_with_space(&frame[16..frame.len() - 2]),
            "".to_string(),
            vec![16, total_length - 2],
            Some(sub_result),
            None,
        );

        Ok(())
    }

    pub fn analysic_csg_read_task_frame(
        frame: &[u8],
        dir: u8,
        prm: u8,
        result_list: &mut Vec<Value>,
        start_pos: usize,
        protocol: &str,
        region: &str,
    ) -> Result<(), Box<dyn Error>> {
        let valid_data_segment = &frame[16..frame.len() - 2];
        let tpv = Self::get_afn_and_seq_result(&frame[14..16], start_pos + 14, result_list);
        let mut length = valid_data_segment.len();
        let mut pos = 0;
        let mut num = 0;
        let mut sub_result = vec![];
        let mut task_result = vec![];
        let total_length = frame.len();
        let empty_data: &[u8] = &[];

        let (tpv_data, pw_data, pw_pos, cur_length) = if tpv {
            (
                &frame[frame.len() - 7..frame.len() - 2],
                if valid_data_segment.len() > 21 {
                    &valid_data_segment[valid_data_segment.len() - 21..valid_data_segment.len() - 5]
                } else {
                    &empty_data
                },
                [total_length - 23, total_length - 7],
                length - 5,
            )
        } else {
            (
                &Vec::<u8>::new()[..],
                if valid_data_segment.len() > 16 {
                    &valid_data_segment[valid_data_segment.len() - 16..]
                } else {
                    &Vec::<u8>::new()[..]
                },
                [total_length - 18, total_length - 2],
                length,
            )
        };
        length = cur_length;
        let mut data_item: String = String::new();
        let mut data_segment = valid_data_segment;
        let mut pncount = 0;
        let mut item_count = 0;

        let mut task_name = String::new();
        let mut index = 16 + 9 + start_pos;

        if dir == 1 {
            let da = &frame[16..18];
            let item = &frame[18..22];
            let point_str = Self::prase_da_data([da[0], da[1]]);
            let (data_item_elem, cur_data_item) =
                Self::try_get_item_and_point(item, protocol, region, Some(dir));

            task_name = if let Some(data_item_elem) = data_item_elem {
                let name = data_item_elem.get_child_text("name").unwrap();
                format!("{}号： {}", name, cur_data_item)
            } else {
                format!("任务号：{}", cur_data_item)
            };

            FrameFun::add_data(
                &mut task_result,
                "信息点标识DA".to_string(),
                FrameFun::get_data_str_with_space(da),
                point_str.clone(),
                vec![16, 18],
                None,
                None,
            );
            FrameFun::add_data(
                &mut task_result,
                "数据标识编码DI".to_string(),
                FrameFun::get_data_str_with_space(item),
                task_name.clone(),
                vec![18, 22],
                None,
                None,
            );

            let task_kind = frame[22];
            let task_kind_str = match task_kind {
                0 => "自描述方式",
                1 => "任务模板",
                2 => "补上报数据",
                _ => "未知",
            };
            FrameFun::add_data(
                &mut sub_result,
                "数据结构方式".to_string(),
                FrameFun::get_data_str_with_space(&frame[22..23]),
                task_kind_str.to_string(),
                vec![22, 23],
                None,
                None,
            );

            let expire_item = &frame[27..31];
            println!("expire_item:{:?}", expire_item);
            let expire_data_item = FrameFun::get_data_str_reverser(expire_item);
            let data_item_elem = ProtocolConfigManager::get_config_xml(
                &expire_data_item,
                protocol,
                region,
                Some(dir),
            );
            println!("data_item_elem:{:?}", data_item_elem);
            if let Some(data_item_elem) = data_item_elem {
                pncount = frame[23];
                item_count = frame[24];
                FrameFun::add_data(
                    &mut sub_result,
                    "数据组数".to_string(),
                    FrameFun::get_data_str_with_space(&frame[23..25]),
                    format!(
                        "信息点标识数{},数据标识编码数{},共有{}个数据组数",
                        pncount,
                        item_count,
                        pncount * item_count
                    ),
                    vec![23, 25],
                    None,
                    None,
                );

                data_segment = &valid_data_segment[9..];
                length -= 9;
                data_item = cur_data_item;
                index = 16 + 9 + start_pos;
            } else {
                pncount = frame[23];
                item_count = 1;
                FrameFun::add_data(
                    &mut sub_result,
                    "数据组数".to_string(),
                    FrameFun::get_data_str_with_space(&frame[23..24]),
                    format!("共有{}个数据组数", pncount),
                    vec![23, 24],
                    None,
                    None,
                );

                data_segment = &valid_data_segment[8..];
                length -= 8;
                data_item = cur_data_item;
                index = 16 + 8 + start_pos;
            }
        }

        let mut pw = false;
        let data_segment = &data_segment[..length];
        let mut data_item_elem: Option<XmlElement> = None;
        let data_time: Option<&[u8]> = None;
        let mut point_str: String = String::new();
        let mut dis_data_identifier: String = String::new();

        while pos < length {
            let result = (|| -> Result<AnalysicErr, Box<dyn Error>> {
                if !Self::guest_next_data_is_cur_item_data(
                    data_item_elem.clone(),
                    &data_segment[pos..],
                    data_time,
                    protocol,
                    region,
                    Some(dir),
                ) {
                    let da = &data_segment[pos..pos + 2];
                    let item = &data_segment[pos + 2..pos + 6];
                    point_str = Self::prase_da_data([da[0], da[1]]);
                    let (data_item_elem_opt, cur_data_item) =
                        Self::try_get_item_and_point(item, protocol, region, Some(dir));

                    // info!(
                    //     "data_item:{:?} {:?} {:?}",
                    //     data_item_elem_opt, data_segment, item
                    // );
                    data_item_elem = data_item_elem_opt.clone();
                    dis_data_identifier = if data_item_elem_opt.is_some() {
                        let name = data_item_elem_opt.unwrap().get_child_text("name").unwrap();
                        format!("数据标识编码：[{}]-{}", cur_data_item, name)
                    } else {
                        format!("数据标识编码：[{}]", cur_data_item)
                    };
                    data_item = cur_data_item;
                    FrameFun::add_data(
                        &mut sub_result,
                        format!("<第{}组>信息点标识DA", num + 1),
                        FrameFun::get_data_str_with_space(da),
                        point_str.clone(),
                        vec![index + pos, index + pos + 2],
                        None,
                        None,
                    );
                    pos += 2;
                    FrameFun::add_data(
                        &mut sub_result,
                        format!("<第{}组>数据标识编码DI", num + 1),
                        FrameFun::get_data_str_with_space(item),
                        dis_data_identifier.clone(),
                        vec![index + pos, index + pos + 4],
                        None,
                        None,
                    );
                    pos += 4;
                }

                let mut item_data: Vec<Value> = Vec::new();
                let mut sub_length = 0;
                let mut sub_datament: &[u8] = &[];
                // info!("dir {:} item{:?}", dir, data_item_elem);
                if let Some(mut item_elem) = data_item_elem.clone() {
                    if dir == 1 {
                        let sub_length_cont = item_elem.get_child_text("length").unwrap();
                        (sub_length, sub_datament) = if sub_length_cont.to_uppercase() == "UNKNOWN"
                        {
                            let sub_length = Self::calculate_item_length(
                                &mut item_elem,
                                &data_segment[pos..],
                                protocol,
                                region,
                                Some(dir),
                                None,
                            );
                            let sub_datament = &data_segment[pos..pos + sub_length];
                            (sub_length, sub_datament)
                        } else {
                            let mut sub_length = sub_length_cont.parse::<usize>().unwrap();
                            // info!("sub_length {:?} pos{:?} data_len {:?}", sub_length, pos, data_segment.len());
                            if sub_length > data_segment[pos..].len() {
                                sub_length = data_segment[pos..].len();
                            }
                            let sub_datament = &data_segment[pos..pos + sub_length];
                            let (new_sub_length, new_datament) = Self::recalculate_sub_length(
                                &mut item_elem,
                                sub_datament,
                                protocol,
                                region,
                                Some(dir),
                            );
                            (new_sub_length, new_datament)
                        };
                        item_elem.update_value("length", sub_length.to_string());
                        // info!("length {:?} data:{:?} item_elem:{:?}", sub_length, sub_datament, item_elem);
                        item_data = FrameAnalisyic::prase_data(
                            &mut item_elem,
                            protocol,
                            region,
                            sub_datament,
                            index + pos,
                            Some(dir),
                        );
                    } else {
                        sub_length = 0;
                    }
                }

                if dir == 1 {
                    let new_point_str = point_str.clone().replace("Pn=", "");
                    let new_dis_str: String =
                        dis_data_identifier.clone().replace("数据标识编码：", "");
                    FrameFun::add_data(
                        &mut sub_result,
                        format!("<第{}组>数据内容", num + 1),
                        FrameFun::get_data_str_with_space(sub_datament),
                        format!("{}-{}", new_point_str, new_dis_str),
                        vec![index + pos, index + pos + sub_length],
                        Some(item_data),
                        None,
                    );
                    let data_time = &data_segment[pos + sub_length..pos + sub_length + 5];
                    let time_str = FrameFun::parse_time_data(data_time, "YYMMDDhhmm", false);
                    FrameFun::add_data(
                        &mut sub_result,
                        format!("<第{}组>数据时间", num + 1),
                        FrameFun::get_data_str_with_space(data_time),
                        format!("数据时间：{}", time_str),
                        vec![index + pos + sub_length, index + pos + sub_length + 5],
                        None,
                        None,
                    );
                    pos += 5;
                } else {
                    let start_time = &data_segment[pos..pos + 6];
                    let end_time = &data_segment[pos + 6..pos + 12];
                    let data_dinsty = data_segment[pos + 12];
                    let start_time_str =
                        FrameFun::parse_time_data(start_time, "CCYYMMDDhhmm", false);
                    let end_time_str = FrameFun::parse_time_data(end_time, "CCYYMMDDhhmm", false);
                    let data_dinsty_str = Self::get_data_dinsty(data_dinsty);
                    FrameFun::add_data(
                        &mut task_result,
                        format!("数据起始时间"),
                        FrameFun::get_data_str_with_space(start_time),
                        start_time_str,
                        vec![index + pos, index + pos + 6],
                        None,
                        None,
                    );
                    FrameFun::add_data(
                        &mut task_result,
                        format!("数据结束时间"),
                        FrameFun::get_data_str_with_space(end_time),
                        end_time_str,
                        vec![index + pos + 6, index + pos + 12],
                        None,
                        None,
                    );
                    FrameFun::add_data(
                        &mut task_result,
                        format!("数据密度"),
                        format!("{:02X}", data_dinsty),
                        format!("数据间隔时间：{}", data_dinsty_str),
                        vec![index + pos + 12, index + pos + 13],
                        None,
                        None,
                    );
                    pos += 13;
                }

                pos += sub_length;
                num += 1;

                if length - pos == 16 || length - pos == 22 || ((num == (item_count * pncount)) && (length - pos >= 16)) {
                    pw = Self::guest_is_exit_pw(
                        length,
                        pw_data,
                        data_item_elem.clone(),
                        data_time,
                        true,
                        protocol,
                        region,
                        Some(dir),
                    );
                    if pw {
                        length -= 16;
                    }
                }
                if dir == 1 {
                    if num >= (item_count * pncount) {
                        return Ok(AnalysicErr::ErrLength);
                    }
                    if (length - pos == 6)
                        && (!Self::guest_next_data_is_cur_item_data(
                            data_item_elem.clone(),
                            &data_segment[pos..],
                            data_time,
                            protocol,
                            region,
                            Some(dir),
                        ))
                    {
                        return Ok(AnalysicErr::ErrLength);
                    }
                }
                Ok(AnalysicErr::ErrOk)
            })();

            match result {
                Ok(res) => match res {
                    AnalysicErr::ErrOk => {}
                    AnalysicErr::ErrLength => break,
                    _ => {}
                },
                Err(e) => {
                    let err_str = format!("数据解析失败!").to_string();
                    let err = CustomError::new(1, err_str);
                    break;
                }
            }
        }

        if dir == 1 {
            FrameFun::add_data(
                &mut task_result,
                "任务数据内容".to_string(),
                FrameFun::get_data_str_with_space(&valid_data_segment[6..]),
                format!("{}数据内容", task_name),
                vec![22, frame.len() - 2],
                Some(sub_result),
                None,
            );

            if length - pos == 6 {
                let data_time = &data_segment[pos..pos + 6];
                let time_str = FrameFun::parse_time_data(data_time, "CCYYMMDDhhmm", false);
                FrameFun::add_data(
                    &mut task_result,
                    "任务数据时间".to_string(),
                    FrameFun::get_data_str_with_space(data_time),
                    time_str,
                    vec![index + pos, index + pos + 6],
                    None,
                    None,
                );
            }
        }

        FrameFun::add_data(
            result_list,
            "信息体".to_string(),
            FrameFun::get_data_str_with_space(&frame[16..frame.len() - 2]),
            "".to_string(),
            vec![16, total_length - 2],
            Some(task_result),
            None,
        );

        if pw {
            let pw_str = "PW由16个字节组成，是由主站按系统约定的认证算法产生，并在主站发送的报文中下发给终端，由终端进行校验认证。".to_string();
            FrameFun::add_data(
                result_list,
                "消息验证码Pw".to_string(),
                FrameFun::get_data_str_with_space(pw_data),
                pw_str,
                pw_pos.to_vec(),
                None,
                None,
            );
        }

        if tpv {
            let tpv_str = Self::prase_tpv_data(tpv_data);
            FrameFun::add_data(
                result_list,
                "时间标签Tp".to_string(),
                FrameFun::get_data_str_with_space(tpv_data),
                tpv_str,
                vec![total_length - 7, total_length - 2],
                None,
                None,
            );
        }

        Ok(())
    }

    pub fn analysic_csg_read_alarm_frame(
        frame: &[u8],
        dir: u8,
        prm: u8,
        result_list: &mut Vec<Value>,
        start_pos: usize,
        protocol: &str,
        region: &str,
    ) -> Result<(), Box<dyn Error>> {
        let valid_data_segment = &frame[16..frame.len() - 2];
        let tpv = Self::get_afn_and_seq_result(&frame[14..16], start_pos + 14, result_list);
        let length = valid_data_segment.len();
        let mut pos = 0;
        let index = 16 + start_pos;
        let mut num = 0;
        let mut sub_result = vec![];
        let total_length = frame.len();
        let (tpv_data, pw_data, pw_pos, mut length) = if tpv {
            (
                frame[frame.len() - 7..frame.len() - 2].to_vec(),
                if valid_data_segment.len() > 21 {
                    valid_data_segment[valid_data_segment.len() - 21..valid_data_segment.len() - 5]
                        .to_vec()
                } else {
                    [].to_vec()
                },
                [total_length - 23, total_length - 7],
                length - 5,
            )
        } else {
            (
                vec![],
                if valid_data_segment.len() > 16 {
                    valid_data_segment[valid_data_segment.len() - 16..].to_vec()
                } else {
                    [].to_vec()
                },
                [total_length - 18, total_length - 2],
                length,
            )
        };

        let mut pw = false;
        let data_segment = &valid_data_segment[..length];
        let mut item_is_unknown = false;

        while pos < length {
            match (|| -> Result<(), CustomError> {
                let da = &data_segment[pos..pos + 2];
                let item = &data_segment[pos + 2..pos + 6];
                println!("da: {:?}", da);
                let point_str = Self::prase_da_data([da[0], da[1]]);
                let data_item = FrameFun::get_data_str_reverser(item);

                FrameFun::add_data(
                    &mut sub_result,
                    format!("<第{}组>信息点标识DA", num + 1),
                    FrameFun::get_data_str_with_space(da),
                    point_str.clone(),
                    vec![index + pos, index + pos + 2],
                    None,
                    None,
                );
                pos += 2;

                let data_item_elem =
                    ProtocolConfigManager::get_config_xml(&data_item, protocol, region, Some(dir));
                let mut item_data: Vec<Value> = Vec::new();
                let mut sub_length = 0;
                let mut sub_datament: &[u8] = &[];
                let dis_data_identifier: String;
                if let Some(mut data_item_elem) = data_item_elem {
                    if dir == 1 {
                        let sub_length_cont = data_item_elem.get_child_text("length").unwrap();
                        (sub_length, sub_datament) = if sub_length_cont.to_uppercase() == "UNKNOWN"
                        {
                            let sub_length = Self::calculate_item_length(
                                &mut data_item_elem,
                                &data_segment[pos + 4..],
                                protocol,
                                region,
                                Some(dir),
                                None,
                            );
                            let sub_datament = &data_segment[pos + 4..pos + 4 + sub_length];
                            (sub_length, sub_datament)
                        } else {
                            let mut sub_length = sub_length_cont.parse::<usize>().unwrap();
                            if sub_length > data_segment.len() - pos - 4 {
                                sub_length = data_segment.len() - pos - 4;
                            }
                            let new_sub_datament = &data_segment[pos + 4..pos + 4 + sub_length];
                            let (new_sub_length, new_datament) = Self::recalculate_sub_length(
                                &mut data_item_elem,
                                new_sub_datament,
                                protocol,
                                region,
                                Some(dir),
                            );
                            (new_sub_length, new_datament)
                        };
                        data_item_elem.update_value("length", sub_length.to_string());
                        item_is_unknown = true;
                        item_data = FrameAnalisyic::prase_data(
                            &mut data_item_elem,
                            protocol,
                            region,
                            &sub_datament,
                            index + pos + 4,
                            Some(dir),
                        );
                    } else {
                        let sub_length = 0;
                    }

                    let name = data_item_elem.get_child_text("name").unwrap();
                    dis_data_identifier = format!("数据标识编码：[{}]-{}", data_item, name);
                } else {
                    if dir == 1 {
                        pw = Self::guest_is_exit_pw(
                            length,
                            &pw_data,
                            None,
                            None,
                            false,
                            protocol,
                            region,
                            Some(dir),
                        );

                        let err_str = format!("数据解析失败!").to_string();
                        let err = CustomError::new(1, err_str);
                        return Err(err);
                    } else {
                        let sub_length = 0;
                    }
                    dis_data_identifier = format!("数据标识编码：[{}]", data_item);
                }

                FrameFun::add_data(
                    &mut sub_result,
                    format!("<第{}组>数据标识编码DI", num + 1),
                    FrameFun::get_data_str_with_space(item),
                    dis_data_identifier.clone(),
                    vec![index + pos, index + pos + 4],
                    None,
                    None,
                );
                pos += 4;

                if dir == 1 {
                    let new_point_str = point_str.clone().replace("Pn=", "");
                    let new_dis_str: String =
                        dis_data_identifier.clone().replace("数据标识编码：", "");
                    FrameFun::add_data(
                        &mut sub_result,
                        format!("<第{}组>数据内容", num + 1),
                        FrameFun::get_data_str_with_space(&sub_datament),
                        format!("{}-{}", new_point_str, new_dis_str),
                        vec![index + pos, index + pos + sub_length],
                        Some(item_data),
                        None,
                    );
                } else {
                    let start_time = &data_segment[pos..pos + 6];
                    let end_time = &data_segment[pos + 6..pos + 12];
                    let start_time_str =
                        FrameFun::parse_time_data(start_time, "CCYYMMDDhhmm", false);
                    let end_time_str = FrameFun::parse_time_data(end_time, "CCYYMMDDhhmm", false);

                    FrameFun::add_data(
                        &mut sub_result,
                        "数据起始时间".to_string(),
                        FrameFun::get_data_str_with_space(start_time),
                        start_time_str,
                        vec![index + pos, index + pos + 6],
                        None,
                        None,
                    );
                    FrameFun::add_data(
                        &mut sub_result,
                        "数据结束时间".to_string(),
                        FrameFun::get_data_str_with_space(end_time),
                        end_time_str,
                        vec![index + pos + 6, index + pos + 12],
                        None,
                        None,
                    );
                    pos += 12;
                }

                pos += sub_length;
                num += 1;

                if length - pos == 16 {
                    pw = Self::guest_is_exit_pw(
                        length,
                        &pw_data,
                        None,
                        None,
                        false,
                        protocol,
                        region,
                        Some(dir),
                    );
                    if pw {
                        length -= 16;
                    }
                }

                Ok(())
            })() {
                Ok(_) => {}
                Err(e) => {
                    let err_str = format!("数据解析失败!").to_string();
                    let err = CustomError::new(1, err_str);
                    break;
                }
            }
        }

        if pw {
            let pw_str = "PW由16个字节组成，是由主站按系统约定的认证算法产生，并在主站发送的报文中下发给终端，由终端进行校验认证。".to_string();
            FrameFun::add_data(
                &mut sub_result,
                "消息验证码Pw".to_string(),
                FrameFun::get_data_str_with_space(&pw_data),
                pw_str,
                pw_pos.to_vec(),
                None,
                None,
            );
        }

        if tpv {
            let tpv_str = Self::prase_tpv_data(&tpv_data);
            FrameFun::add_data(
                &mut sub_result,
                "时间标签Tp".to_string(),
                FrameFun::get_data_str_with_space(&tpv_data),
                tpv_str,
                vec![total_length - 7, total_length - 2],
                None,
                None,
            );
        }

        FrameFun::add_data(
            result_list,
            "信息体".to_string(),
            FrameFun::get_data_str_with_space(&frame[16..frame.len() - 2]),
            "".to_string(),
            vec![16, total_length - 2],
            Some(sub_result),
            None,
        );

        Ok(())
    }

    pub fn analysic_csg_read_event_frame(
        frame: &[u8],
        dir: u8,
        prm: u8,
        result_list: &mut Vec<Value>,
        start_pos: usize,
        protocol: &str,
        region: &str,
    ) -> Result<(), Box<dyn Error>> {
        let valid_data_segment = &frame[16..frame.len() - 2];
        let tpv = Self::get_afn_and_seq_result(&frame[14..16], start_pos + 14, result_list);
        let mut length = valid_data_segment.len();
        let mut pos = 0;
        let index = 16 + start_pos;
        let mut num = 0;
        let mut sub_result: Vec<Value> = Vec::new();
        let total_length = frame.len();
        let mut tpv_data: &[u8] = &[];
        let mut pw_data: &[u8] = &[];

        let (pw_data, pw_pos) = if tpv {
            length -= 5;
            tpv_data = &frame[frame.len() - 7..frame.len() - 2];
            if valid_data_segment.len() < 21 {
                (pw_data, vec![0, 0])
            } else {
                let pw_data = &valid_data_segment[valid_data_segment.len() - 21..];
                (pw_data, vec![total_length - 23, total_length - 7])
            }
        } else {
            if valid_data_segment.len() < 16 {
                (pw_data, vec![0, 0])
            } else {
                pw_data = &valid_data_segment[valid_data_segment.len() - 16..];
                (pw_data, vec![total_length - 18, total_length - 2])
            }
        };
        let mut pw = false;

        let data_segment = &valid_data_segment[..length];

        while pos < length {
            let da = &data_segment[pos..pos + 2];
            let item = &data_segment[pos + 2..pos + 6];

            let point_str = Self::prase_da_data([da[0], da[1]]);

            let data_item = FrameFun::get_data_str_reverser(item);

            FrameFun::add_data(
                &mut sub_result,
                format!("<第{}组>信息点标识DA", num + 1),
                FrameFun::get_data_str_with_space(da),
                point_str.clone(),
                vec![index + pos, index + pos + 2],
                None,
                None,
            );
            pos += 2;

            let data_item_elem =
                ProtocolConfigManager::get_config_xml(&data_item, protocol, region, Some(dir));

            let mut item_data: Vec<Value> = Vec::new();
            let mut sub_length = 0;
            let mut sub_datament: &[u8] = &[];
            let dis_data_identifier: String;

            if let Some(mut data_item_elem) = data_item_elem {
                if dir == 1 && prm == 0 {
                    // 上行回复
                    let sub_length_cont = data_item_elem.get_child_text("length").unwrap();
                    (sub_length, sub_datament) = if sub_length_cont.to_uppercase() == "UNKNOWN" {
                        let sub_length = Self::calculate_item_length(
                            &mut data_item_elem,
                            &data_segment[pos + 4..],
                            protocol,
                            region,
                            Some(dir),
                            None,
                        );
                        let new_segment = &data_segment[pos + 4..pos + 4 + sub_length];
                        (sub_length, new_segment)
                    } else {
                        let mut sub_length = sub_length_cont.parse::<usize>()?;
                        if sub_length > data_segment[pos + 4..].len() {
                            sub_length = data_segment[pos + 4..].len();
                        }
                        let sub_datament = &data_segment[pos + 4..pos + 4 + sub_length];
                        (sub_length, sub_datament)
                    };
                    data_item_elem.update_value("length", sub_length.to_string());
                    item_data = FrameAnalisyic::prase_data(
                        &mut data_item_elem,
                        protocol,
                        region,
                        sub_datament,
                        index + pos + 4,
                        Some(dir),
                    );
                } else {
                    let sub_length = 0; // 下行读取报文
                }
                let name = data_item_elem.get_child_text("name").unwrap();
                dis_data_identifier = format!("数据标识编码：[{}]-{}", data_item, name);
            } else {
                if dir == 1 && prm == 0 {
                    pw = Self::guest_is_exit_pw(
                        length,
                        pw_data,
                        None,
                        None,
                        false,
                        protocol,
                        region,
                        Some(dir),
                    );
                    let err_str =
                        format!("未找到数据标识{},请检查配置文件!", data_item).to_string();
                    let err = CustomError::new(1, err_str);
                    break;
                } else {
                    let sub_length = 0;
                }
                dis_data_identifier = format!("数据标识编码：[{}]", data_item);
            }

            FrameFun::add_data(
                &mut sub_result,
                format!("<第{}组>数据标识编码DI", num + 1),
                FrameFun::get_data_str_with_space(item),
                dis_data_identifier.clone(),
                vec![index + pos, index + pos + 4],
                None,
                None,
            );
            pos += 4;
            if dir == 1 && prm == 0 {
                FrameFun::add_data(
                    &mut sub_result,
                    format!("<第{}组>数据内容", num + 1),
                    FrameFun::get_data_str_with_space(sub_datament),
                    format!("{}-{}", &point_str[3..], &dis_data_identifier[7..]),
                    vec![index + pos, index + pos + sub_length],
                    Some(item_data),
                    None,
                );
            } else {
                let start_time = &data_segment[pos..pos + 6];
                let end_time = &data_segment[pos + 6..pos + 12];
                let start_time_str = FrameFun::parse_time_data(start_time, "CCYYMMDDhhmm", false);
                let end_time_str = FrameFun::parse_time_data(end_time, "CCYYMMDDhhmm", false);
                FrameFun::add_data(
                    &mut sub_result,
                    "数据起始时间".to_string(),
                    FrameFun::get_data_str_with_space(start_time),
                    start_time_str,
                    vec![index + pos, index + pos + 6],
                    None,
                    None,
                );
                FrameFun::add_data(
                    &mut sub_result,
                    "数据结束时间".to_string(),
                    FrameFun::get_data_str_with_space(end_time),
                    end_time_str,
                    vec![index + pos + 6, index + pos + 12],
                    None,
                    None,
                );
                pos += 12;
            }
            pos += sub_length;
            num += 1;

            if length - pos == 16 {
                pw = Self::guest_is_exit_pw(
                    length,
                    pw_data,
                    None,
                    None,
                    false,
                    protocol,
                    region,
                    Some(dir),
                );
                if pw {
                    length -= 16;
                }
            }
        }
        if pw {
            let pw_str = "PW由16个字节组成，是由主站按系统约定的认证算法产生，并在主站发送的报文中下发给终端，由终端进行校验认证。".to_string();
            FrameFun::add_data(
                &mut sub_result,
                "消息验证码Pw".to_string(),
                FrameFun::get_data_str_with_space(pw_data),
                pw_str,
                pw_pos.to_vec(),
                None,
                None,
            );
        }
        if tpv {
            let tpv_str = Self::prase_tpv_data(tpv_data);
            FrameFun::add_data(
                &mut sub_result,
                "时间标签Tp".to_string(),
                FrameFun::get_data_str_with_space(tpv_data),
                tpv_str,
                vec![total_length - 7, total_length - 2],
                None,
                None,
            );
        }
        FrameFun::add_data(
            result_list,
            "信息体".to_string(),
            FrameFun::get_data_str_with_space(&frame[16..frame.len() - 2]),
            "".to_string(),
            vec![16, total_length - 2],
            Some(sub_result),
            None,
        );

        Ok(())
    }

    pub fn analysic_csg_relay_frame(
        frame: &[u8],
        dir: u8,
        prm: u8,
        result_list: &mut Vec<Value>,
        start_pos: usize,
        protocol: &str,
        region: &str,
    ) -> Result<(), Box<dyn Error>> {
        let valid_data_segment = &frame[16..frame.len() - 2];
        let tpv = Self::get_afn_and_seq_result(&frame[14..16], start_pos + 14, result_list);
        let mut length = valid_data_segment.len();
        let mut pos = 0;
        let index = 16 + start_pos;
        let mut num = 0;
        let mut sub_result: Vec<Value> = Vec::new();
        let total_length = frame.len();
        let tmp_pw_data: &[u8] = &[];

        let (tpv_data, pw_data, pw_pos) = if tpv {
            let tpv_data = &frame[frame.len() - 7..frame.len() - 2];
            length -= 5;
            if valid_data_segment.len() < 21 {
                (tpv_data, tmp_pw_data, vec![0, 0])
            } else {
                let pw_data = &valid_data_segment
                    [valid_data_segment.len() - 21..valid_data_segment.len() - 5];
                (tpv_data, pw_data, vec![total_length - 23, total_length - 7])
            }
        } else {
            let pw_data = if valid_data_segment.len() > 16 {
                &valid_data_segment[valid_data_segment.len() - 16..]
            } else {
                tmp_pw_data
            };
            (
                &Vec::<u8>::new()[..],
                pw_data,
                vec![total_length - 18, total_length - 2],
            )
        };
        let mut pw = false;

        let data_segment = &valid_data_segment[..length];

        while pos < length {
            let da = &data_segment[pos..pos + 2];
            let item = &data_segment[pos + 2..pos + 6];

            let point_str = Self::prase_da_data([da[0], da[1]]);

            let data_item = FrameFun::get_data_str_reverser(item);

            FrameFun::add_data(
                &mut sub_result,
                format!("<第{}组>信息点标识DA", num + 1),
                FrameFun::get_data_str_with_space(da),
                point_str.clone(),
                vec![index + pos, index + pos + 2],
                None,
                None,
            );
            pos += 2;

            let data_item_elem =
                ProtocolConfigManager::get_config_xml(&data_item, protocol, region, Some(dir));

            let mut item_data: Vec<Value> = Vec::new();
            let mut sub_length = 0;
            let mut sub_datament: &[u8] = &[];
            let mut dis_data_identifier: String;

            if let Some(mut data_item_elem) = data_item_elem {
                if dir == 1 && prm == 0 {
                    let frame_result: Vec<String> = Vec::new();
                    let sub_length_cont = data_item_elem.get_child_text("length").unwrap();
                    (sub_length, sub_datament) = if sub_length_cont.to_uppercase() == "UNKNOWN" {
                        let sub_length = Self::calculate_item_length(
                            &mut data_item_elem,
                            &data_segment[pos + 4..],
                            protocol,
                            region,
                            Some(dir),
                            None,
                        );
                        let sub_datament = &data_segment[pos + 4..pos + 4 + sub_length];
                        (sub_length, sub_datament)
                    } else {
                        let mut sub_length = sub_length_cont.parse::<usize>()?;
                        if sub_length > data_segment.len() - pos - 4 {
                            sub_length = data_segment.len() - pos - 4;
                        }
                        let sub_datament = &data_segment[pos + 4..pos + 4 + sub_length];
                        let (sub_length, new_datament) = Self::recalculate_sub_length(
                            &mut data_item_elem,
                            sub_datament,
                            protocol,
                            region,
                            Some(dir),
                        );
                        (sub_length, new_datament)
                    };

                    let (new_sub_length, frame_len) = Self::get_sub_length(
                        &data_item_elem,
                        "中继报文长度",
                        &data_segment[pos + 5..],
                        protocol,
                        region,
                        Some(dir),
                    );
                    let replay_type = Self::get_relay_type(data_segment[pos + 4]);
                    FrameFun::add_data(
                        &mut item_data,
                        "中继类型".to_string(),
                        FrameFun::get_data_str_with_space(&data_segment[pos + 4..pos + 5]),
                        format!("中继类型:{}", replay_type),
                        vec![index + pos + 4, index + pos + 5],
                        None,
                        None,
                    );
                    FrameFun::add_data(
                        &mut item_data,
                        "中继应答长度".to_string(),
                        FrameFun::get_data_str_with_space(
                            &data_segment[pos + 5..pos + 5 + sub_length],
                        ),
                        format!("中继应答长度{}", frame_len),
                        vec![index + pos + 5, index + pos + 5 + sub_length],
                        None,
                        None,
                    );
                    let mut frame_result: Vec<Value> = Vec::new();
                    Frame645::analysic_645_frame_by_afn(
                        &data_segment[pos + 5 + sub_length..pos + 5 + frame_len + sub_length],
                        &mut frame_result,
                        pos + 5 + sub_length + index,
                        region,
                    );
                    FrameFun::add_data(
                        &mut item_data,
                        "中继应答内容".to_string(),
                        FrameFun::get_data_str_with_space(
                            &data_segment[pos + 5 + sub_length..pos + 5 + frame_len],
                        ),
                        "中继应答内容".to_string(),
                        vec![index + pos + 5 + sub_length, index + pos + 5 + frame_len],
                        Some(frame_result),
                        None,
                    );
                    sub_length += frame_len + 1;
                    let sub_datament = &data_segment[pos + 4..pos + 4 + new_sub_length];
                } else {
                    let sub_length_cont = data_item_elem.get_child_text("length").unwrap();
                    let (sub_length, new_datament) = if sub_length_cont.to_uppercase() == "UNKNOWN"
                    {
                        let sub_length = Self::calculate_item_length(
                            &mut data_item_elem,
                            &data_segment[pos + 4..],
                            protocol,
                            region,
                            Some(dir),
                            None,
                        );
                        let sub_datament = &data_segment[pos + 4..pos + 4 + sub_length];
                        (sub_length, sub_datament)
                    } else {
                        let mut sub_length = sub_length_cont.parse::<usize>()?;
                        if sub_length > data_segment.len() - pos - 4 {
                            sub_length = data_segment.len() - pos - 4;
                        }
                        let sub_datament = &data_segment[pos + 4..pos + 4 + sub_length];
                        let (sub_length, new_datament) = Self::recalculate_sub_length(
                            &mut data_item_elem,
                            sub_datament,
                            protocol,
                            region,
                            Some(dir),
                        );
                        (sub_length, new_datament)
                    };
                    data_item_elem.update_value("length", sub_length.to_string());
                    item_data = FrameAnalisyic::prase_data(
                        &mut data_item_elem,
                        protocol,
                        region,
                        new_datament,
                        index + pos + 4,
                        Some(dir),
                    );
                }
                let name = data_item_elem.get_child_text("name").unwrap();
                let dis_data_identifier = format!("数据标识编码：[{}]-{}", data_item, name);
                FrameFun::add_data(
                    &mut sub_result,
                    format!("<第{}组>数据标识编码DI", num + 1),
                    FrameFun::get_data_str_with_space(item),
                    dis_data_identifier.clone(),
                    vec![index + pos, index + pos + 4],
                    None,
                    None,
                );
                FrameFun::add_data(
                    &mut sub_result,
                    format!("<第{}组>数据内容", num + 1),
                    FrameFun::get_data_str_with_space(sub_datament),
                    format!("{}-{}", &point_str[3..], &dis_data_identifier[7..]),
                    vec![index + pos + 4, index + pos + 4 + sub_length],
                    Some(item_data),
                    None,
                );
                pos += sub_length + 4;
                num += 1;

                if length - pos == 16 {
                    pw = Self::guest_is_exit_pw(
                        length,
                        &pw_data,
                        None,
                        None,
                        false,
                        protocol,
                        region,
                        Some(dir),
                    );
                    if pw {
                        length -= 16;
                    }
                }
            } else {
                pw = Self::guest_is_exit_pw(
                    length,
                    pw_data,
                    None,
                    None,
                    false,
                    protocol,
                    region,
                    Some(dir),
                );
                let err_str = format!("未找到数据标识{},请检查配置文件!", data_item).to_string();
                let err = CustomError::new(1, err_str);
                break;
            }
        }
        if pw {
            let pw_str = "PW由16个字节组成，是由主站按系统约定的认证算法产生，并在主站发送的报文中下发给终端，由终端进行校验认证。".to_string();
            FrameFun::add_data(
                &mut sub_result,
                "消息验证码Pw".to_string(),
                FrameFun::get_data_str_with_space(pw_data),
                pw_str,
                pw_pos.to_vec(),
                None,
                None,
            );
        }
        if tpv {
            let tpv_str = Self::prase_tpv_data(tpv_data);
            FrameFun::add_data(
                &mut sub_result,
                "时间标签Tp".to_string(),
                FrameFun::get_data_str_with_space(tpv_data),
                tpv_str,
                vec![total_length - 7, total_length - 2],
                None,
                None,
            );
        }
        FrameFun::add_data(
            result_list,
            "信息体".to_string(),
            FrameFun::get_data_str_with_space(&frame[16..frame.len() - 2]),
            "".to_string(),
            vec![16, frame.len() - 2],
            Some(sub_result),
            None,
        );
        Ok(())
    }

    pub fn analysic_csg_topo_frame(
        frame: &[u8],
        dir: u8,
        prm: u8,
        result_list: &mut Vec<Value>,
        start_pos: usize,
        protocol: &str,
        region: &str,
    ) -> Result<(), Box<dyn Error>> {
        let valid_data_segment = &frame[16..frame.len() - 2];
        let tpv = Self::get_afn_and_seq_result(&frame[14..16], start_pos + 14, result_list);
        let mut length = valid_data_segment.len();
        let mut pos = 0;
        let index = 16 + start_pos;
        let mut num = 0;
        let total_length = frame.len();
        let tmp_pw_data: &[u8] = &[];
        let (tpv_data, pw_data, pw_pos) = if tpv {
            length -= 5;
            let tpv_data = &frame[frame.len() - 7..frame.len() - 2];
            if valid_data_segment.len() < 21 {
                (tpv_data, tmp_pw_data, vec![0, 0])
            } else {
                let pw_data = &valid_data_segment
                    [valid_data_segment.len() - 21..valid_data_segment.len() - 5];
                (
                    tpv_data,
                    pw_data,
                    vec![start_pos + frame.len() - 23, start_pos + frame.len() - 7],
                )
            }
        } else {
            let pw_data = if valid_data_segment.len() > 16 {
                &valid_data_segment[valid_data_segment.len() - 16..]
            } else {
                tmp_pw_data
            };
            (
                tmp_pw_data,
                pw_data,
                vec![start_pos + frame.len() - 18, start_pos + frame.len() - 2],
            )
        };
        let mut pw = false;

        let data_segment = &valid_data_segment[..length];
        let mut sub_result: Vec<Value> = Vec::new();

        while pos < length {
            sub_result.clear();
            let da: &[u8] = &data_segment[pos..pos + 2];
            let item = &data_segment[pos + 2..pos + 6];

            let point_str = Self::prase_da_data([da[0], da[1]]);

            let data_item = FrameFun::get_data_str_reverser(item);
            FrameFun::add_data(
                &mut sub_result,
                format!("<第{}组>信息点标识DA", num + 1),
                FrameFun::get_data_str_with_space(da),
                point_str.clone(),
                vec![index + pos, index + pos + 2],
                None,
                None,
            );
            pos += 2;

            let data_item_elem =
                ProtocolConfigManager::get_config_xml(&data_item, protocol, region, Some(dir));

            let item_data: Vec<Value>;
            let dis_data_identifier: String;

            if let Some(mut data_item_elem) = data_item_elem {
                let sub_length_cont = data_item_elem.get_child_text("length").unwrap();
                let (sub_length, new_datament) = if sub_length_cont.to_uppercase() == "UNKNOWN" {
                    let sub_length = Self::calculate_item_length(
                        &mut data_item_elem,
                        &data_segment[pos + 4..],
                        protocol,
                        region,
                        Some(dir),
                        None,
                    );
                    let sub_datament = &data_segment[pos + 4..pos + 4 + sub_length];
                    (sub_length, sub_datament)
                } else {
                    let mut sub_length = sub_length_cont.parse::<usize>()?;
                    if sub_length > data_segment.len() - pos - 4 {
                        sub_length = data_segment.len() - pos - 4;
                    }
                    let sub_datament = &data_segment[pos + 4..pos + 4 + sub_length];
                    let (sub_length, new_datament) = Self::recalculate_sub_length(
                        &mut data_item_elem,
                        sub_datament,
                        protocol,
                        region,
                        Some(dir),
                    );
                    (sub_length, new_datament)
                };

                item_data = FrameAnalisyic::prase_data(
                    &mut data_item_elem,
                    protocol,
                    region,
                    new_datament,
                    index + pos + 4,
                    Some(dir),
                );
                let name = data_item_elem.get_child_text("name").unwrap();
                dis_data_identifier = format!("数据标识编码：[{}]-{}", data_item, name);
                FrameFun::add_data(
                    &mut sub_result,
                    format!("<第{}组>数据标识编码DI", num + 1),
                    FrameFun::get_data_str_with_space(item),
                    dis_data_identifier.clone(),
                    vec![index + pos, index + pos + 4],
                    None,
                    None,
                );
                FrameFun::add_data(
                    &mut sub_result,
                    format!("<第{}组>数据内容", num + 1),
                    FrameFun::get_data_str_with_space(new_datament),
                    point_str["Pn=".len()..].to_string()
                        + "-"
                        + &dis_data_identifier["数据标识编码：".len()..],
                    vec![index + pos + 4, index + pos + 4 + sub_length],
                    Some(item_data),
                    None,
                );
                pos += sub_length + 4;
                num += 1;

                if length - pos == 16 {
                    pw = Self::guest_is_exit_pw(
                        length,
                        pw_data,
                        None,
                        None,
                        false,
                        protocol,
                        region,
                        Some(dir),
                    );
                    if pw {
                        length -= 16;
                    }
                }
            } else {
                if dir == 1 && prm == 0 {
                    pw = Self::guest_is_exit_pw(
                        length,
                        pw_data,
                        None,
                        None,
                        false,
                        protocol,
                        region,
                        Some(dir),
                    );
                    let err_str =
                        format!("未找到数据标识{},请检查配置文件!", data_item).to_string();
                    let err = CustomError::new(1, err_str);
                    break;
                } else {
                    let sub_length = 0;
                    let dis_data_identifier = format!("数据标识编码：[{}]", data_item);
                    FrameFun::add_data(
                        &mut sub_result,
                        format!("<第{}组>数据标识编码DI", num + 1),
                        FrameFun::get_data_str_with_space(item),
                        dis_data_identifier.clone(),
                        vec![index + pos, index + pos + 4],
                        None,
                        None,
                    );
                    pos += sub_length + 4;
                    num += 1;
                }
            }
        }
        if pw {
            let pw_str = "PW由16个字节组成，是由主站按系统约定的认证算法产生，并在主站发送的报文中下发给终端，由终端进行校验认证。".to_string();
            FrameFun::add_data(
                &mut sub_result,
                "消息验证码Pw".to_string(),
                FrameFun::get_data_str_with_space(pw_data),
                pw_str,
                pw_pos.to_vec(),
                None,
                None,
            );
        }
        if tpv {
            let tpv_str = Self::prase_tpv_data(tpv_data);
            FrameFun::add_data(
                &mut sub_result,
                "时间标签Tp".to_string(),
                FrameFun::get_data_str_with_space(tpv_data),
                tpv_str,
                vec![start_pos + frame.len() - 7, start_pos + frame.len() - 2],
                None,
                None,
            );
        }
        FrameFun::add_data(
            result_list,
            "信息体".to_string(),
            FrameFun::get_data_str_with_space(&frame[16..frame.len() - 2]),
            "".to_string(),
            vec![index, start_pos + frame.len() - 2],
            Some(sub_result),
            None,
        );
        Ok(())
    }

    pub fn analysic_csg_filetrans_frame(
        frame: &[u8],
        dir: u8,
        prm: u8,
        result_list: &mut Vec<Value>,
        start_pos: usize,
        protocol: &str,
        region: &str,
    ) -> Result<(), Box<dyn Error>> {
        let total_length = frame.len();
        let valid_data_segment = &frame[16..frame.len() - 2];
        let tpv = Self::get_afn_and_seq_result(&frame[14..16], start_pos + 14, result_list);
        let mut length = valid_data_segment.len();
        let mut pos = 0;
        let index = 16 + start_pos;
        let mut num = 0;
        let mut sub_result = Vec::new();
        let mut tpv_data: &[u8] = &[];
        let pw_data: &[u8] = &[];
        let empty_data: &[u8] = &[];
        let (pw_data, pw_pos) = if tpv {
            length -= 5;
            tpv_data = &frame[frame.len() - 7..frame.len() - 2];
            if valid_data_segment.len() < 21 {
                (empty_data, [0, 0])
            } else {
                let pw_data = &valid_data_segment
                    [valid_data_segment.len() - 21..valid_data_segment.len() - 5];
                (pw_data, [total_length - 23, total_length - 7])
            }
        } else {
            if valid_data_segment.len() < 16 {
                (empty_data, [0, 0])
            } else {
                let pw_data = &valid_data_segment[valid_data_segment.len() - 16..];
                (pw_data, [total_length - 18, total_length - 2])
            }
        };

        let data_segment = &valid_data_segment[..length];
        let mut pw = false;
        println!(
            "data_segment: {:?}, tpv: {:?}, pw_data: {:?}, length: {}",
            data_segment, tpv, pw_data, length
        );
        while pos < length {
            let da = &data_segment[pos..pos + 2];
            let item = &data_segment[pos + 2..pos + 6];

            let point_str = Self::prase_da_data([da[0], da[1]]);
            let data_item = FrameFun::get_data_str_reverser(item);

            FrameFun::add_data(
                &mut sub_result,
                format!("<第{}组>信息点标识DA", num + 1),
                FrameFun::get_data_str_with_space(da),
                point_str,
                vec![index + pos, index + pos + 2],
                None,
                None,
            );
            pos += 2;

            let data_item_elem =
                ProtocolConfigManager::get_config_xml(&data_item, protocol, region, Some(dir));
            let mut item_data = Vec::new();
            let sub_length: usize;
            let sub_datament: &[u8];
            let dis_data_identifier: String;
            if let Some(mut data_item_elem) = data_item_elem {
                (sub_length, sub_datament) = if dir == 1 && prm == 0 {
                    (1, &data_segment[pos + 4..pos + 4 + 1])
                } else {
                    let sub_length_cont = data_item_elem.get_child_text("length");
                    let mut sub_length = if let Some(sub_length_cont) = sub_length_cont {
                        if sub_length_cont.to_uppercase() == "UNKNOWN" {
                            Self::calculate_item_length(
                                &mut data_item_elem,
                                &data_segment[pos + 4..],
                                protocol,
                                region,
                                Some(dir),
                                None,
                            )
                        } else {
                            sub_length_cont.parse::<usize>().unwrap()
                        }
                    } else {
                        data_segment[pos + 4..].len()
                    };
                    if sub_length > data_segment[pos + 4..].len() {
                        sub_length = data_segment[pos + 4..].len();
                    }
                    let sub_datament = &data_segment[pos + 4..pos + 4 + sub_length];
                    (sub_length, sub_datament)
                };
                data_item_elem.update_value("length", sub_length.to_string());
                // println!("sub_datament: {:?}", data_item_elem);
                item_data = FrameAnalisyic::prase_data(
                    &mut data_item_elem,
                    protocol,
                    region,
                    sub_datament,
                    index + pos + 4,
                    Some(dir),
                );
                let name = data_item_elem.get_child_text("name").unwrap();
                dis_data_identifier = format!("数据标识编码：[{}]-{}", data_item, name);
            } else {
                (sub_length, sub_datament) = if dir == 1 && prm == 0 {
                    (1, &data_segment[pos + 4..pos + 4 + 1])
                } else {
                    let err_str =
                        format!("未查找到数据标识：{},请检查配置文件！", data_item).to_string();
                    let err = CustomError::new(1, err_str);
                    break;
                };
                dis_data_identifier = format!("数据标识编码：[{}]", data_item);
            };

            FrameFun::add_data(
                &mut sub_result,
                format!("<第{}组>数据标识编码DI", num + 1),
                FrameFun::get_data_str_with_space(item),
                dis_data_identifier,
                vec![index + pos, index + pos + 4],
                None,
                None,
            );
            let result_str: String;
            if sub_length > 0 {
                result_str = format!(
                    "数据标识[{}]数据内容：{}",
                    data_item,
                    FrameFun::get_data_str_reverser(sub_datament)
                );
                FrameFun::add_data(
                    &mut sub_result,
                    format!("<第{}组>数据标识内容", num + 1),
                    FrameFun::get_data_str_with_space(sub_datament),
                    result_str,
                    vec![index + pos + 4, index + pos + 4 + sub_length],
                    Some(item_data),
                    None,
                );
            }
            println!("pos: {}, sub_length: {}", pos, sub_length);
            pos += sub_length + 4;
            num += 1;
            if length - pos == 16 {
                pw = Self::guest_is_exit_pw(
                    length,
                    pw_data,
                    None,
                    None,
                    false,
                    protocol,
                    region,
                    Some(dir),
                );

                if pw {
                    length -= 16;
                }
            }
        }

        if pw {
            let pw_str = "PW由16个字节组成，是由主站按系统约定的认证算法产生，并在主站发送的报文中下发给终端，由终端进行校验认证。".to_string();
            FrameFun::add_data(
                &mut sub_result,
                "消息验证码Pw".to_string(),
                FrameFun::get_data_str_with_space(pw_data),
                pw_str,
                pw_pos.to_vec(),
                None,
                None,
            );
        }
        if tpv {
            let tpv_str = Self::prase_tpv_data(tpv_data);
            FrameFun::add_data(
                &mut sub_result,
                "时间标签Tp".to_string(),
                FrameFun::get_data_str_with_space(tpv_data),
                tpv_str,
                vec![total_length - 7, total_length - 2],
                None,
                None,
            );
        }
        FrameFun::add_data(
            result_list,
            "信息体".to_string(),
            FrameFun::get_data_str_with_space(&frame[16..frame.len() - 2]),
            "".to_string(),
            vec![16, total_length - 2],
            Some(sub_result),
            None,
        );

        Ok(())
    }
}
