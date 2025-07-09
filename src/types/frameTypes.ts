// frameTypes.ts - 报文相关的共享类型定义
// 常量定义
export const FRM_RECORD_FLAG = 0x22222223;

/**
 * 报文方向枚举
 */
export enum FrameDirection {
    OUT = 0,
    IN = 1,
}

/**
 * 报文类型枚举
 */
export enum RecordType {
    GPRS = 0,           // 记录ppp报文，不允许应用层使用
    RECORD_3761 = 1,
    RECORD_3762 = 2,
    CYMETER = 3,
    RECORD_485_1 = 4,
    RECORD_485_2 = 5,
    RECORD_485_3 = 6,
    CY_SEC_REC = 7,
    DJB = 8,
    UNKNOWN = 9,
    UART = 10,
    SOCKET = 11,
    MQTT = 12,
    RECORD_485_4 = 13,
    RECORD_485_5 = 14,
    RECORD_485_6 = 15,
    RECORD_485_7 = 16,
    BRAN_MON = 17,
    BAT = 18,
    BRAN_MON_1 = 19,
    BRAN_MON_2 = 20,
    ESAM = 28,
    DEBUG = 29
}

/**
 * 报文端口枚举
 */
export enum RecordPort {
    NULL = 0,
    GPRS_CLINT = 1,
    RS232 = 2,
    RS4851 = 3,
    INFA = 4,
    ETH_CLINT = 5,
    RS4852 = 6,
    RS4853 = 7,
    PLC = 8,
    CY = 9,
    INTE_COMM = 10,
    UART = 11,
    RS4854 = 12,
    RS4855 = 13,
    RS4856 = 14,
    RS4857 = 15,
    BRAN_MON = 16,
    BAT = 17,
    EXK = 18,
    BRAN_MON_1 = 19,
    BRAN_MON_2 = 20
}

/**
 * 报文协议枚举
 */
export enum RecordProtocol {
    NULL = 0,
    RECORD_3761 = 1,
    OOP = 2,
    CSG = 3,
    RECORD_62056 = 4,
    RECORD_3762 = 5,
    RECORD_645 = 6,
    EDMI = 7,
    MODBUS = 8,
    DLMS = 9,
    MQTT_AXDR = 10,
    MQTT_JSON = 11
}

/**
 * 报文条目接口
 */
export interface FrameEntry {
    id: string;
    pid: number;
    tag: number;
    tag_name?: string;  // 添加标签名称字段
    port: number;
    port_name?: string;  // 添加端口名称字段
    protocol: number;
    protocol_name?: string;  // 添加协议名称字段
    direction: number;
    direction_name?: string;  // 添加方向名称字段
    timestamp: string;
    content: string;
    raw_data: string;
    position?: number;
}

/**
 * 报文解析请求接口（用于 Worker 通信）
 */
export interface FrameParseRequest {
    buffer: Uint8Array;
    startPos: number;
    endPos: number;
}

/**
 * 报文解析响应接口（用于 Worker 通信）
 */
export interface FrameParseResponse {
    entries?: FrameEntry[];
    error?: string;
}
