use crate::basefunc::frame_csg::FrameCsg;
use crate::basefunc::frame_err::CustomError;
use crate::basefunc::frame_fun::FrameFun;
use crate::basefunc::protocol::ProtocolInfo;
use crate::basefunc::protocol::{AnalysicErr, FrameAnalisyic};
use crate::config::xmlconfig::{ProtocolConfigManager, XmlElement};
use serde_json::Value;
use std::error::Error;

const MS_TYPE_ALL_USER: u8 = 0x01; //全部用户类型*/
const MS_TYPE_A_SET_OF_USER: u8 = 0x02; //一组用户类型 */
const MS_TYPE_A_SET_OF_ADDRESSES: u8 = 0x03; //一组用户地址*/
const MS_TYPE_A_SET_OF_NUMBERS: u8 = 0x04; //一组配置序号*/
const MS_TYPE_A_RANGE_OF_USER_TYPES: u8 = 0x05; //一组用户类型区间*/
const MS_TYPE_A_SET_OF_USER_ADDRESS_RANGES: u8 = 0x06; //一组用户地址区间*/
const MS_TYPE_A_SET_OF_NUMBER_RANGES: u8 = 0x07; //一组配置序号区间*/
const MS_TYPE_ALL_USER_WITHOUT_JC: u8 = 0xF7; //除交采外的所有表 247*/
const MS_TYPE_A_SET_OF_VIP_USER_BY_PORT: u8 = 0xF8; //一组用户类型区分端口*/
const MS_TYPE_A_SET_OF_USER_BY_PORT: u8 = 0xF9; //一组用户类型区分端口*/
const MS_TYPE_A_GROUP_OF_VIP_USER_TYPES: u8 = 0xFB; //一组重点用户类型 251*/
const MS_TYPE_A_SET_OF_USER_EVENT_LEVELS: u8 = 0xFC; //一组用户事件等级 252*/
const MS_TYPE_VIP_USER_TYPES: u8 = 0xFD; //重点用户 253*/
const MS_TYPE_A_SET_OF_USER_PORT_NUMBERS: u8 = 0xFE; //一组用户端口号 254*/
pub struct SpcialFrame;

impl SpcialFrame {
    pub fn is_special_frame(data: &[u8], region: &str) -> bool {
        let frame = data.to_vec();
        if frame.len() < 6 {
            return false;
        }
        let item = &frame[2..6];
        let protocol = ProtocolInfo::ProtocolCSG13.name().to_string();
        let item_str = FrameFun::get_data_str_reverser(item);
        let data_item_elem =
            ProtocolConfigManager::get_config_xml(&item_str, &protocol, region, Some(1));
        if data_item_elem.is_none() {
            return false;
        }
        true
    }

    pub fn analysic_special_frame(
        frame: &[u8],
        result_list: &mut Vec<Value>,
        index: usize,
        region: &str,
    ) -> Result<(), Box<dyn Error>> {
        let protocol = ProtocolInfo::ProtocolCSG13.name().to_string();
        let _ =
            Self::analysic_csg_history_data_frame(frame, 1, result_list, index, &protocol, region);
        Ok(())
    }

    fn analysic_csg_history_data_frame(
        frame: &[u8],
        dir: u8,
        sub_result: &mut Vec<Value>,
        start_pos: usize,
        protocol: &str,
        region: &str,
    ) -> Result<(), Box<dyn Error>> {
        let length = frame.len();
        let mut pos = 0;
        let mut num = 0;

        let mut data_item: String = String::new();

        let index = 0;

        let data_segment = frame;
        let mut data_item_elem: Option<XmlElement> = None;
        let data_time: Option<&[u8]> = None;
        let mut point_str: String = String::new();
        let mut dis_data_identifier: String = String::new();

        while pos < length {
            let result = (|| -> Result<AnalysicErr, Box<dyn Error>> {
                if !FrameCsg::guest_next_data_is_cur_item_data(
                    data_item_elem.clone(),
                    &data_segment[pos..],
                    data_time,
                    protocol,
                    region,
                    Some(dir),
                ) {
                    let da = &data_segment[pos..pos + 2];
                    let item = &data_segment[pos + 2..pos + 6];
                    point_str = FrameCsg::prase_da_data([da[0], da[1]]);
                    let (data_item_elem_opt, cur_data_item) =
                        FrameCsg::try_get_item_and_point(item, protocol, region, Some(dir));

                    println!(
                        "data_item:{:?} {:?} {:?}",
                        data_item_elem_opt, data_segment, item
                    );
                    data_item_elem = data_item_elem_opt.clone();
                    dis_data_identifier = if data_item_elem_opt.is_some() {
                        let name = data_item_elem_opt.unwrap().get_child_text("name").unwrap();
                        format!("数据标识编码：[{}]-{}", cur_data_item, name)
                    } else {
                        format!("数据标识编码：[{}]", cur_data_item)
                    };
                    data_item = cur_data_item;
                    FrameFun::add_data(
                        sub_result,
                        format!("<第{}组>信息点标识DA", num + 1),
                        FrameFun::get_data_str_with_space(da),
                        point_str.clone(),
                        vec![index + pos, index + pos + 2],
                        None,
                        None,
                    );
                    pos += 2;
                    FrameFun::add_data(
                        sub_result,
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

                if let Some(mut item_elem) = data_item_elem.clone() {
                    let sub_length_cont = item_elem.get_child_text("length").unwrap();
                    (sub_length, sub_datament) = if sub_length_cont.to_uppercase() == "UNKNOWN" {
                        let sub_length = FrameCsg::calculate_item_length(
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
                        let (new_sub_length, new_datament) = FrameCsg::recalculate_sub_length(
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
                }

                let new_point_str = point_str.clone().replace("Pn=", "");
                let new_dis_str: String = dis_data_identifier.clone().replace("数据标识编码：", "");
                FrameFun::add_data(
                    sub_result,
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
                    sub_result,
                    format!("<第{}组>数据时间", num + 1),
                    FrameFun::get_data_str_with_space(data_time),
                    format!("数据时间：{}", time_str),
                    vec![index + pos + sub_length, index + pos + sub_length + 5],
                    None,
                    None,
                );
                pos += 5;

                pos += sub_length;
                num += 1;

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

        Ok(())
    }
}
