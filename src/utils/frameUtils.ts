// frameUtils.ts - 报文相关的共享工具函数

import { FrameDirection, RecordType, RecordPort, RecordProtocol } from '../types/frameTypes';

/**
 * 方向名称映射
 */
const directionNames: { [key in FrameDirection]: string } = {
    [FrameDirection.IN]: '接收',
    [FrameDirection.OUT]: '发送'
};

/**
 * 获取方向名称
 * @param direction 方向值
 * @returns 方向名称
 */
export function getDirectionName(direction: number): string {
    // 检查方向值是否为有效的枚举值
    if (direction === FrameDirection.IN || direction === FrameDirection.OUT) {
        return directionNames[direction as FrameDirection];
    }
    return `未知方向(${direction})`;
}

/**
 * 报文类型名称映射
 */
const recordTypeNames: { [key in RecordType]: string } = {
    [RecordType.GPRS]: 'PPP报文',
    [RecordType.RECORD_3761]: '376.1报文',
    [RecordType.RECORD_3762]: '376.2报文',
    [RecordType.CYMETER]: '采样计量',
    [RecordType.RECORD_485_1]: '485通道1',
    [RecordType.RECORD_485_2]: '485通道2',
    [RecordType.RECORD_485_3]: '485通道3',
    [RecordType.CY_SEC_REC]: '秒级交采',
    [RecordType.DJB]: '冻结表',
    [RecordType.UNKNOWN]: '未知类型',
    [RecordType.UART]: 'UART',
    [RecordType.SOCKET]: 'Socket',
    [RecordType.MQTT]: 'MQTT',
    [RecordType.RECORD_485_4]: '485通道4',
    [RecordType.RECORD_485_5]: '485通道5',
    [RecordType.RECORD_485_6]: '485通道6',
    [RecordType.RECORD_485_7]: '485通道7',
    [RecordType.BRAN_MON]: '分支监测',
    [RecordType.BAT]: '电池',
    [RecordType.BRAN_MON_1]: '分支监测1',
    [RecordType.BRAN_MON_2]: '分支监测2',
    [RecordType.ESAM]: 'ESAM',
    [RecordType.DEBUG]: '调试'
};

/**
 * 获取报文类型的名称
 * @param type 报文类型值
 * @returns 报文类型名称
 */
export function getRecordTypeName(type: number): string {
    if (type in RecordType) {
        return recordTypeNames[type as RecordType] || `未知类型(${type})`;
    }
    return `未知类型(${type})`;
}

/**
 * 端口名称映射
 */
const portNames: { [key in RecordPort]: string } = {
    [RecordPort.NULL]: 'NULL',
    [RecordPort.GPRS_CLINT]: 'GPRS_CLINT',
    [RecordPort.RS232]: 'RS232',
    [RecordPort.RS4851]: 'RS4851',
    [RecordPort.INFA]: 'INFA',
    [RecordPort.ETH_CLINT]: 'ETH_CLINT',
    [RecordPort.RS4852]: 'RS4852',
    [RecordPort.RS4853]: 'RS4853',
    [RecordPort.PLC]: 'PLC',
    [RecordPort.CY]: 'CY',
    [RecordPort.INTE_COMM]: 'INTE_COMM',
    [RecordPort.UART]: 'UART',
    [RecordPort.RS4854]: 'RS4854',
    [RecordPort.RS4855]: 'RS4855',
    [RecordPort.RS4856]: 'RS4856',
    [RecordPort.RS4857]: 'RS4857',
    [RecordPort.BRAN_MON]: 'BRAN_MON',
    [RecordPort.BAT]: 'BAT',
    [RecordPort.EXK]: 'EXK',
    [RecordPort.BRAN_MON_1]: 'BRAN_MON_1',
    [RecordPort.BRAN_MON_2]: 'BRAN_MON_2'
};

/**
 * 获取端口名称
 * @param port 端口值
 * @returns 端口名称
 */
export function getPortName(port: number): string {
    if (port in RecordPort) {
        return portNames[port as RecordPort] || `未知端口(${port})`;
    }
    return `未知端口(${port})`;
}

/**
 * 协议名称映射
 */
const protocolNames: { [key in RecordProtocol]: string } = {
    [RecordProtocol.NULL]: 'NULL',
    [RecordProtocol.RECORD_3761]: '376.1',
    [RecordProtocol.RECORD_3762]: '376.2',
    [RecordProtocol.OOP]: 'OOP',
    [RecordProtocol.CSG]: 'CSG',
    [RecordProtocol.RECORD_62056]: '62056',
    [RecordProtocol.RECORD_645]: '645',
    [RecordProtocol.EDMI]: 'EDMI',
    [RecordProtocol.MODBUS]: 'MODBUS',
    [RecordProtocol.DLMS]: 'DLMS',
    [RecordProtocol.MQTT_AXDR]: 'MQTT_AXDR',
    [RecordProtocol.MQTT_JSON]: 'MQTT_JSON'
};

/**
 * 获取协议名称
 * @param protocol 协议值
 * @returns 协议名称
 */
export function getProtocolName(protocol: number): string {
    if (protocol in RecordProtocol) {
        return protocolNames[protocol as RecordProtocol] || `未知协议(${protocol})`;
    }
    return `未知协议(${protocol})`;
}

/**
 * 格式化报文内容为十六进制字符串
 * @param bytes 字节数组
 * @returns 格式化的十六进制字符串
 */
export function formatFrameContent(bytes: Uint8Array): string {
    return Array.from(bytes)
        .map(byte => byte.toString(16).padStart(2, '0').toUpperCase())
        .join(' ');
}

/**
 * 验证报文方向是否有效
 * @param direction 方向值
 * @returns 是否有效
 */
export function isValidDirection(direction: number): direction is FrameDirection {
    return direction === FrameDirection.IN || direction === FrameDirection.OUT;
}

/**
 * 验证报文类型是否有效
 * @param type 类型值
 * @returns 是否有效
 */
export function isValidRecordType(type: number): type is RecordType {
    return type in RecordType;
}

/**
 * 验证端口是否有效
 * @param port 端口值
 * @returns 是否有效
 */
export function isValidPort(port: number): port is RecordPort {
    return port in RecordPort;
}

/**
 * 验证协议是否有效
 * @param protocol 协议值
 * @returns 是否有效
 */
export function isValidProtocol(protocol: number): protocol is RecordProtocol {
    return protocol in RecordProtocol;
}
