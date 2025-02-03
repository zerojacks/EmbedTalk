use crate::basefunc::frame_err::CustomError;
use crate::basefunc::frame_fun::FrameFun;
use crate::basefunc::protocol::ProtocolInfo;
use crate::config::oadmapconfig::TaskOadConfigManager;
use crate::config::xmlconfig::ProtocolConfigManager;
use serde_json::Value;

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
pub struct TCMeterTask;

impl TCMeterTask {
    pub fn is_meter_task(task_content: &[u8]) -> bool {
        if task_content.len() <= 26 {
            return false;
        }
        task_content[0] == 0x01
            && task_content[4] == 0x51
            && task_content[9] == 0x51
            && task_content[14] == 0x51
            && task_content[25] == 0x5C
    }

    pub fn get_oad(task_content: &[u8]) -> (u32, usize) {
        let master_oad = FrameFun::cosem_bin2_int32u(&task_content[0..4]);
        (master_oad, 4)
    }

    pub fn get_master_oad_info(master_oad: u32) -> Option<&'static str> {
        match master_oad {
            0x00000000 => Some("当前数据"),
            0x50020200 => Some("分钟冻结"),
            0x50040200 => Some("日冻结"),
            0x50060200 => Some("月冻结"),
            _ => None,
        }
    }

    pub fn get_sub_oad_info(master_oad: &str, sub_oad: &str, region: &str) -> (String, String) {
        let result = TaskOadConfigManager::get_voad(master_oad, sub_oad);
        if let Some(item) = result {
            let item_set = item.item_07.to_uppercase();
            let protocol = ProtocolInfo::ProtocolDLT64507.name().to_string();
            let template_element =
                ProtocolConfigManager::get_config_xml(&item_set, &protocol, region, None);
            if let Some(item_ele) = template_element {
                if let Some(name) = item_ele.get_child_text("name") {
                    return (item_set, name);
                }
            } else {
                return (item_set, String::new());
            }
        }
        return (String::new(), String::new());
    }

    pub fn get_range_type(range_type: u8) -> &'static str {
        match range_type {
            0 => "前闭后开",
            1 => "前开后闭",
            2 => "前闭后闭",
            3 => "前开后开",
            _ => "未知",
        }
    }

    pub fn get_ms_len(
        ms_type: u8,
        task_content: &[u8],
        sub_result: &mut Vec<Value>,
        start_pos: usize,
    ) -> (usize, String) {
        let mut pos = 0;

        match ms_type {
            MS_TYPE_ALL_USER => {
                return (0, "全部用户类型".to_string());
            }
            MS_TYPE_A_SET_OF_USER => {
                pos += 1;
                let mut ms_result = vec![];
                for i in 0..task_content[0] {
                    let dis_data_identifier = format!("用户类型:{}", task_content[pos]);
                    FrameFun::add_data(
                        &mut ms_result,
                        format!("<第{}组>用户类型", i + 1),
                        FrameFun::get_data_str_with_space(&task_content[pos..pos + 1]),
                        dis_data_identifier,
                        vec![start_pos + pos, start_pos + pos + 1],
                        None,
                        None,
                    );
                    pos += 1;
                }
                let dis_data_identifier = format!("用户类型个数:{}", task_content[0]);
                FrameFun::add_data(
                    sub_result,
                    "用户类型个数".to_string(),
                    FrameFun::get_data_str_with_space(&[task_content[0]]),
                    dis_data_identifier,
                    vec![start_pos, start_pos + 1],
                    Some(ms_result),
                    None,
                );
                return (pos, "一组用户类型".to_string());
            }
            MS_TYPE_A_SET_OF_ADDRESSES => {
                pos += 1;
                let mut ms_result = vec![];
                for i in 0..task_content[0] {
                    pos += 1;
                    let len = (task_content[pos] + 1) as usize;
                    pos += 1;
                    let address = FrameFun::get_data_str_order(&task_content[pos..pos + len]);
                    FrameFun::add_data(
                        &mut ms_result,
                        format!("<第{}组>用户地址", i + 1),
                        FrameFun::get_data_str_with_space(&task_content[pos..pos + len]),
                        address,
                        vec![start_pos + pos, start_pos + pos + len],
                        None,
                        None,
                    );
                    pos += len;
                }
                let dis_data_identifier = format!("用户地址个数:{}", task_content[0]);
                FrameFun::add_data(
                    sub_result,
                    "用户地址个数".to_string(),
                    FrameFun::get_data_str_with_space(&[task_content[0]]),
                    dis_data_identifier,
                    vec![start_pos, start_pos + 1],
                    Some(ms_result),
                    None,
                );
                return (pos, "一组用户地址".to_string());
            }
            MS_TYPE_A_SET_OF_NUMBERS => {
                pos += 1;
                let mut ms_result = vec![];
                for i in 0..task_content[0] {
                    let range_type = Self::get_range_type(task_content[pos]);
                    let spot_id = FrameFun::cosem_bin2_int32u(&task_content[pos..pos + 2]);
                    let dis_data_identifier = format!("测量点号:{:04}", spot_id);
                    FrameFun::add_data(
                        &mut ms_result,
                        format!("<第{}组>测量点号", i + 1),
                        FrameFun::get_data_str_with_space(&task_content[pos..pos + 2]),
                        dis_data_identifier,
                        vec![start_pos + pos, start_pos + pos + 2],
                        None,
                        None,
                    );
                    pos += 2;
                }
                let dis_data_identifier = format!("测量点个数:{:02}", task_content[0]);
                FrameFun::add_data(
                    sub_result,
                    "测量点个数".to_string(),
                    FrameFun::get_data_str_with_space(&[task_content[0]]),
                    dis_data_identifier,
                    vec![start_pos, start_pos + 1],
                    Some(ms_result),
                    None,
                );
                return (pos, "一组配置序号".to_string());
            }
            MS_TYPE_A_RANGE_OF_USER_TYPES => {
                pos += 1;
                let mut ms_result = vec![];
                for i in 0..task_content[0] {
                    let range_type = Self::get_range_type(task_content[pos]);
                    FrameFun::add_data(
                        &mut ms_result,
                        format!("<第{}组>区间类型", i + 1),
                        FrameFun::get_data_str_with_space(&task_content[pos..pos + 1]),
                        range_type.to_string(),
                        vec![start_pos + pos, start_pos + pos + 1],
                        None,
                        None,
                    );
                    pos += 2;
                    let user1 = format!("用户类型:{}", task_content[pos]);
                    FrameFun::add_data(
                        &mut ms_result,
                        format!("<第{}组>用户类型", i + 1),
                        FrameFun::get_data_str_with_space(&task_content[pos..pos + 1]),
                        user1,
                        vec![start_pos + pos, start_pos + pos + 1],
                        None,
                        None,
                    );
                    pos += 2;
                    let user2 = format!("用户类型:{}", task_content[pos]);
                    FrameFun::add_data(
                        &mut ms_result,
                        format!("<第{}组>用户类型", i + 1),
                        FrameFun::get_data_str_with_space(&task_content[pos..pos + 1]),
                        user2,
                        vec![start_pos + pos, start_pos + pos + 1],
                        None,
                        None,
                    );
                    pos += 1;
                }
                let dis_data_identifier = format!("区间个数:{:02}", task_content[0]);
                FrameFun::add_data(
                    sub_result,
                    "区间个数".to_string(),
                    FrameFun::get_data_str_with_space(&[task_content[0]]),
                    dis_data_identifier,
                    vec![start_pos, start_pos + 1],
                    Some(ms_result),
                    None,
                );
                return (pos, "一组用户类型区间".to_string());
            }
            MS_TYPE_A_SET_OF_USER_ADDRESS_RANGES => {
                pos += 1;
                let mut ms_result = vec![];
                for i in 0..task_content[0] {
                    let range_type = Self::get_range_type(task_content[pos]);
                    FrameFun::add_data(
                        &mut ms_result,
                        format!("<第{}组>区间类型", i + 1),
                        FrameFun::get_data_str_with_space(&task_content[pos..pos + 1]),
                        range_type.to_string(),
                        vec![start_pos + pos, start_pos + pos + 1],
                        None,
                        None,
                    );
                    pos += 3;
                    let len = (task_content[pos] + 1) as usize;
                    pos += 1;
                    let address = FrameFun::get_data_str_order(&task_content[pos..pos + len]);
                    FrameFun::add_data(
                        &mut ms_result,
                        format!("<第{}组>用户地址", i + 1),
                        FrameFun::get_data_str_with_space(&task_content[pos..pos + len]),
                        address,
                        vec![start_pos + pos, start_pos + pos + len],
                        None,
                        None,
                    );
                    pos += len;
                    pos += 2;
                    let len = (task_content[pos] + 1) as usize;
                    pos += 1;
                    let address = FrameFun::get_data_str_order(&task_content[pos..pos + len]);
                    FrameFun::add_data(
                        &mut ms_result,
                        format!("<第{}组>用户地址", i + 1),
                        FrameFun::get_data_str_with_space(&task_content[pos..pos + len]),
                        address,
                        vec![start_pos + pos, start_pos + pos + len],
                        None,
                        None,
                    );
                    pos += len;
                }
                let dis_data_identifier = format!("区间个数:{:02}", task_content[0]);
                FrameFun::add_data(
                    sub_result,
                    "区间个数".to_string(),
                    FrameFun::get_data_str_with_space(&[task_content[0]]),
                    dis_data_identifier,
                    vec![start_pos, start_pos + 1],
                    Some(ms_result),
                    None,
                );
                return (pos, "一组用户地址区间".to_string());
            }
            MS_TYPE_A_SET_OF_NUMBER_RANGES => {
                pos += 1;
                let mut ms_result = vec![];
                for i in 0..task_content[0] {
                    let range_type = Self::get_range_type(task_content[pos]);
                    FrameFun::add_data(
                        &mut ms_result,
                        format!("<第{}组>区间类型", i + 1),
                        FrameFun::get_data_str_with_space(&task_content[pos..pos + 1]),
                        range_type.to_string(),
                        vec![start_pos + pos, start_pos + pos + 1],
                        None,
                        None,
                    );
                    pos += 2;
                    let spot_id = FrameFun::cosem_bin2_int32u(&task_content[pos..pos + 2]);
                    let dis_data_identifier = format!("测量点号:{:04}", spot_id);
                    FrameFun::add_data(
                        &mut ms_result,
                        format!("<第{}组>测量点号", i + 1),
                        FrameFun::get_data_str_with_space(&task_content[pos..pos + 2]),
                        dis_data_identifier,
                        vec![start_pos + pos, start_pos + pos + 2],
                        None,
                        None,
                    );
                    pos += 2;
                    pos += 1;
                    let spot_id = FrameFun::cosem_bin2_int32u(&task_content[pos..pos + 2]);
                    let dis_data_identifier = format!("测量点号:{:04}", spot_id);
                    FrameFun::add_data(
                        &mut ms_result,
                        format!("<第{}组>测量点号", i + 1),
                        FrameFun::get_data_str_with_space(&task_content[pos..pos + 2]),
                        dis_data_identifier,
                        vec![start_pos + pos, start_pos + pos + 2],
                        None,
                        None,
                    );
                    pos += 2;
                }
                let dis_data_identifier = format!("测量点个数:{:02}", task_content[0]);
                FrameFun::add_data(
                    sub_result,
                    "测量点个数".to_string(),
                    FrameFun::get_data_str_with_space(&[task_content[0]]),
                    dis_data_identifier,
                    vec![start_pos, start_pos + 1],
                    Some(ms_result),
                    None,
                );
                return (pos, "一组配置序号".to_string());
            }
            MS_TYPE_ALL_USER_WITHOUT_JC => {
                return (0, "除交采外所有表".to_string());
            }
            MS_TYPE_A_SET_OF_VIP_USER_BY_PORT => {
                pos += 1;
                let mut ms_result = Vec::new();
                for i in 0..task_content[0] {
                    let dis_data_identifier = format!("用户类型:{}", task_content[pos]);
                    FrameFun::add_data(
                        &mut ms_result,
                        format!("<第{}组>用户类型", i + 1),
                        FrameFun::get_data_str_with_space(&task_content[pos..pos + 1]),
                        dis_data_identifier.clone(),
                        vec![start_pos + pos, start_pos + pos + 1],
                        None,
                        None,
                    );
                    pos += 1;
                }
                let dis_data_identifier = format!("用户类型个数:{}", task_content[0]);
                FrameFun::add_data(
                    sub_result,
                    "用户类型个数".to_string(),
                    FrameFun::get_data_str_with_space(&[task_content[0]]),
                    dis_data_identifier,
                    vec![start_pos, start_pos + 1],
                    Some(ms_result),
                    None,
                );
                let dis_data_identifier =
                    "一组重点用户类型区分端口(300<=任务号<=500:载波，其他：非载波)".to_string();
                return (pos, dis_data_identifier);
            }
            MS_TYPE_A_SET_OF_USER_BY_PORT => {
                pos += 1;
                let mut ms_result = Vec::new();
                for i in 0..task_content[0] {
                    let dis_data_identifier = format!("用户类型:{}", task_content[pos]);
                    FrameFun::add_data(
                        &mut ms_result,
                        format!("<第{}组>用户类型", i + 1),
                        FrameFun::get_data_str_with_space(&task_content[pos..pos + 1]),
                        dis_data_identifier.clone(),
                        vec![start_pos + pos, start_pos + pos + 1],
                        None,
                        None,
                    );
                    pos += 1;
                }
                let dis_data_identifier = format!("用户类型个数:{}", task_content[0]);
                FrameFun::add_data(
                    sub_result,
                    "用户类型个数".to_string(),
                    FrameFun::get_data_str_with_space(&[task_content[0]]),
                    dis_data_identifier,
                    vec![start_pos, start_pos + 1],
                    Some(ms_result),
                    None,
                );
                let dis_data_identifier =
                    "一组用户类型区分端口(300<=任务号<=500:载波，其他：非载波)".to_string();
                return (pos, dis_data_identifier);
            }

            MS_TYPE_A_GROUP_OF_VIP_USER_TYPES => {
                let dis_data_identifier = format!("用户类型:{:02}", task_content[pos]);
                FrameFun::add_data(
                    sub_result,
                    "用户类型".to_string(),
                    FrameFun::get_data_str_with_space(&[task_content[pos]]),
                    dis_data_identifier,
                    vec![start_pos + pos, start_pos + pos + 1],
                    None,
                    None,
                );
                pos += 1;
                let dis_data_identifier = "一组重点用户类型".to_string();
                return (pos, dis_data_identifier);
            }

            MS_TYPE_A_SET_OF_USER_EVENT_LEVELS => {
                pos += 1;
                let mut ms_result = Vec::new();
                for i in 0..task_content[0] {
                    let dis_data_identifier = format!("事件等级:{:02}", task_content[pos]);
                    FrameFun::add_data(
                        &mut ms_result,
                        format!("<第{}组>事件等级", i + 1),
                        FrameFun::get_data_str_with_space(&[task_content[pos]]),
                        dis_data_identifier.clone(),
                        vec![start_pos + pos, start_pos + pos + 1],
                        None,
                        None,
                    );
                    pos += 1;
                }
                let dis_data_identifier = format!("事件等级个数:{:02}", task_content[0]);
                FrameFun::add_data(
                    sub_result,
                    "事件等级个数".to_string(),
                    FrameFun::get_data_str_with_space(&[task_content[0]]),
                    dis_data_identifier,
                    vec![start_pos, start_pos + 1],
                    Some(ms_result),
                    None,
                );
                let dis_data_identifier = "一组用户事件等级".to_string();
                return (pos, dis_data_identifier);
            }

            MS_TYPE_VIP_USER_TYPES => {
                let dis_data_identifier = "重点用户".to_string();
                return (0, dis_data_identifier);
            }

            MS_TYPE_A_SET_OF_USER_PORT_NUMBERS => {
                pos += 1;
                let mut ms_result = Vec::new();
                for i in 0..task_content[0] {
                    let dis_data_identifier = format!("端口号:{:02X}", task_content[pos]);
                    FrameFun::add_data(
                        &mut ms_result,
                        format!("<第{}组>端口号", i + 1),
                        FrameFun::get_data_str_with_space(&[task_content[pos]]),
                        dis_data_identifier.clone(),
                        vec![start_pos + pos, start_pos + pos + 1],
                        None,
                        None,
                    );
                    pos += 1;
                }
                let dis_data_identifier = format!("端口号个数:{:02}", task_content[0]);
                FrameFun::add_data(
                    sub_result,
                    "端口号个数".to_string(),
                    FrameFun::get_data_str_with_space(&[task_content[0]]),
                    dis_data_identifier,
                    vec![start_pos, start_pos + 1],
                    Some(ms_result),
                    None,
                );
                let dis_data_identifier = "一组端口号".to_string();
                return (pos, dis_data_identifier);
            }

            _ => {
                // 处理未知 ms_type 的情况
                return (task_content.len(), "未知的 MS 类型".to_string());
            }
        }
    }

    pub fn analysic_meter_task(
        task_content: &[u8],
        result_list: &mut Vec<Value>,
        index: usize,
        region: &str,
    ) -> Result<(), CustomError> {
        let oad_count = task_content[1];
        if oad_count == 0 {
            return Ok(());
        }
        let mut pos = 1;
        let dis_data_identifier = format!("采集数据项个数：{}", oad_count);
        FrameFun::add_data(
            result_list,
            "数据项个数".to_string(),
            FrameFun::get_data_str_with_space(&[oad_count]),
            dis_data_identifier,
            vec![index + pos, index + pos + 1],
            None,
            None,
        );
        pos = 2;

        for i in 0..oad_count {
            let start_pos = pos;
            let mut sub_result = vec![];
            pos += 3;

            let (master_oad, len) = Self::get_oad(&task_content[pos..]);
            let oad_info = Self::get_master_oad_info(master_oad);
            let masterr_str = format!("{:08X}", master_oad);

            let dis_data_identifier = if let Some(oad_str) = oad_info {
                format!("主数据项:{}-{}", masterr_str, oad_str)
            } else {
                format!("主数据项:{}", masterr_str)
            };

            FrameFun::add_data(
                &mut sub_result,
                "主数据项".to_string(),
                FrameFun::get_data_str_with_space(&task_content[pos..pos + len]),
                dis_data_identifier,
                vec![index + pos, index + pos + len],
                None,
                None,
            );
            pos += len + 1;

            let (sub_oad, len) = Self::get_oad(&task_content[pos..]);
            let sud_oad_str = format!("{:08X}", sub_oad);
            let (item, info) = Self::get_sub_oad_info(&masterr_str, &sud_oad_str, region);
            let dis_data_identifier = if !item.is_empty() {
                if !info.is_empty() {
                    format!("分数据项:{}-{}:{}", sud_oad_str, item, info)
                } else {
                    format!("分数据项:{}-{}", sud_oad_str, item)
                }
            } else {
                format!("分数据项:{}", sud_oad_str)
            };

            FrameFun::add_data(
                &mut sub_result,
                "分数据项".to_string(),
                FrameFun::get_data_str_with_space(&task_content[pos..pos + len]),
                dis_data_identifier,
                vec![index + pos, index + pos + len],
                None,
                None,
            );
            pos += len + 1;

            let (sub_oad, len) = Self::get_oad(&task_content[pos..]);
            let dis_data_identifier = format!("分数据项:{:08X}", sub_oad);
            FrameFun::add_data(
                &mut sub_result,
                "分数据项".to_string(),
                FrameFun::get_data_str_with_space(&task_content[pos..pos + len]),
                dis_data_identifier,
                vec![index + pos, index + pos + len],
                None,
                None,
            );
            pos += len;
            pos += 6; // 假设这是固定的偏移量
            pos += 1;

            let ms_type = task_content[pos];
            pos += 1;
            let mut ms_data = vec![];
            let (len, me_info) =
                Self::get_ms_len(ms_type, &task_content[pos..], &mut ms_data, pos + index);
            FrameFun::add_data(
                &mut sub_result,
                "MS".to_string(),
                FrameFun::get_data_str_with_space(&[ms_type]),
                me_info,
                vec![index + pos - 1, index + pos],
                None,
                None,
            );

            if len > 0 {
                let dis_data_identifier = format!(
                    "MS内容:{}",
                    FrameFun::get_data_str_order(&task_content[pos + index..pos + index + len])
                );
                FrameFun::add_data(
                    &mut sub_result,
                    "MS内容".to_string(),
                    FrameFun::get_data_str_with_space(
                        &task_content[pos + index..pos + index + len],
                    ),
                    dis_data_identifier,
                    vec![pos + index, pos + index + len],
                    Some(ms_data),
                    None,
                );
            }
            pos += len;

            let dis_data_identifier = format!("<第{}组>数据采集:{:08X}", i + 1, master_oad);
            FrameFun::add_data(
                result_list,
                format!("<第{}组>数据采集", i + 1),
                FrameFun::get_data_str_with_space(&task_content[index + start_pos..index + pos]),
                dis_data_identifier,
                vec![index + start_pos, index + pos],
                Some(sub_result),
                None,
            );
        }

        Ok(())
    }
}
