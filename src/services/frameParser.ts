import { invoke } from '@tauri-apps/api/core';
import { v4 as uuidv4 } from 'uuid';

// 常量定义
export const FRM_RECORD_FLAG = 0x22222223;

// 报文记录结构偏移量
const FRAME_PID_OFFSET = 4;
const FRAME_LENGTH_OFFSET = 5;
const FRAME_TAG_OFFSET = 7;
const FRAME_PORT_OFFSET = 8;
const FRAME_PROTOCOL_OFFSET = 9;
const FRAME_DIRECTION_OFFSET = 10;
const FRAME_TIMESTAMP_OFFSET = 11;
const FRAME_MILLISEC_OFFSET = 15;
const FRAME_CONTENT_OFFSET = 17;

export enum FrameDirection {
    OUT = 0,
    IN = 1,
}
    
const directionNames: { [key in FrameDirection]: string } = {
    [FrameDirection.IN]: '接收',
    [FrameDirection.OUT]: '发送'
};

export function getDirectionName(direction: number): string {
    if (direction in FrameDirection) {
        return directionNames[direction as FrameDirection] || `未知方向(${direction})`;
    }
    return `未知方向(${direction})`;
}

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

// 获取报文类型名称的映射
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

export function getPortName(port: number): string {
    if (port in RecordPort) {
        return portNames[port as RecordPort] || `未知端口(${port})`;
    }
    return `未知端口(${port})`;
}

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
    
export function getProtocolName(protocol: number): string {
    if (protocol in RecordProtocol) {
        return protocolNames[protocol as RecordProtocol] || `未知协议(${protocol})`;
    }
    return `未知协议(${protocol})`;
}

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
 * 检查是否为有效的报文记录
 * @param data 二进制数据
 * @param offset 偏移量
 */
export function isFrameRecord(data: Uint8Array, offset: number): boolean {
    if (offset + 4 > data.length) return false;
    
    // 检查报文标记
    const flag = new DataView(data.buffer).getUint32(offset, true);
    return flag === FRM_RECORD_FLAG;
}

/**
 * 扫描文件中的所有报文头位置
 */
function scanFrameHeaders(buffer: Uint8Array, startPos: number = 0, endPos: number = 0): number[] {
    const framePositions: number[] = [];
    const bufferLength = buffer.length;
    const safeStartPos = Math.max(0, startPos);
    const safeEndPos = endPos > 0 && endPos <= bufferLength ? endPos : bufferLength;
    
    let pos = safeStartPos;
    while (pos < safeEndPos - 4) {
        const flag = new DataView(buffer.buffer).getUint32(pos, false);
        if (flag === FRM_RECORD_FLAG) {
            // 验证这个位置是否可能是一个有效的报文头
            if (pos + FRAME_CONTENT_OFFSET < safeEndPos) {
                const contentLength = new DataView(buffer.buffer).getUint16(pos + FRAME_LENGTH_OFFSET, false);
                if (contentLength > 0 && contentLength <= 10000) {
                    framePositions.push(pos);
                }
            }
        }
        pos++;
    }
    return framePositions;
}

/**
 * 解析指定范围内的报文
 */
function parseFrameRange(buffer: Uint8Array, startPos: number, endPos: number): FrameEntry[] {
    const entries: FrameEntry[] = [];
    let pos = startPos;

    while (pos < endPos - FRAME_CONTENT_OFFSET) {
        try {
            const flag = new DataView(buffer.buffer).getUint32(pos, false);
            if (flag === FRM_RECORD_FLAG) {
                const pid = buffer[pos + FRAME_PID_OFFSET];
                const contentLength = new DataView(buffer.buffer).getUint16(pos + FRAME_LENGTH_OFFSET, false);
                
                if (contentLength <= 0 || contentLength > 10000) {
                    pos++;
                    continue;
                }

                const totalFrameLength = FRAME_CONTENT_OFFSET + contentLength;
                if (pos + totalFrameLength > endPos) {
                    break;
                }

                const tag = buffer[pos + FRAME_TAG_OFFSET];
                const port = buffer[pos + FRAME_PORT_OFFSET];
                const protocol = buffer[pos + FRAME_PROTOCOL_OFFSET];
                const direction = buffer[pos + FRAME_DIRECTION_OFFSET];
                
                const timestamp = new DataView(buffer.buffer).getUint32(pos + FRAME_TIMESTAMP_OFFSET, false);
                const milliseconds = new DataView(buffer.buffer).getUint16(pos + FRAME_MILLISEC_OFFSET, false);
                
                const date = new Date(timestamp * 1000 + milliseconds);
                const timeStr = date.toISOString().replace('T', ' ').slice(0, -1);
                
                const contentStart = pos + FRAME_CONTENT_OFFSET;
                const contentEnd = contentStart + (contentLength - 10);
                
                const content = Array.from(buffer.slice(contentStart, contentEnd))
                    .map(b => b.toString(16).padStart(2, '0'))
                    .join('');
                
                const rawData = Array.from(buffer.slice(pos, contentEnd))
                    .map(b => b.toString(16).padStart(2, '0'))
                    .join('');
                
                entries.push({
                    id: uuidv4(),
                    pid,
                    tag,
                    tag_name: getRecordTypeName(tag),
                    port,
                    port_name: getPortName(port),
                    protocol,
                    protocol_name: getProtocolName(protocol),
                    direction,
                    direction_name: getDirectionName(direction),
                    timestamp: timeStr,
                    content,
                    raw_data: rawData,
                    position: pos
                });
                
                pos = contentEnd;
                continue;
            }
            pos++;
        } catch (error) {
            console.error(`解析错误 at position ${pos}:`, error);
            pos++;
        }
    }
    
    return entries;
}

/**
 * 解析报文块
 * @param buffer 报文文件内容
 * @param startPos 起始位置
 * @param endPos 结束位置
 * @param segmentSize 分段大小，默认1MB
 */
export function parseFrameChunk(
    buffer: Uint8Array, 
    startPos: number = 0, 
    endPos: number = 0,
    segmentSize: number = 1024 * 1024 // 1MB
): { entries: FrameEntry[], segments: number } {
    const bufferLength = buffer.length;
    const safeStartPos = Math.max(0, startPos);
    const safeEndPos = endPos > 0 && endPos <= bufferLength ? endPos : bufferLength;

    console.log(`开始扫描报文头，总长度: ${bufferLength}字节，扫描范围: ${safeStartPos}-${safeEndPos}`);
    
    // 扫描所有报文头位置
    const framePositions = scanFrameHeaders(buffer, safeStartPos, safeEndPos);
    console.log(`找到 ${framePositions.length} 个可能的报文头`);
    
    if (framePositions.length === 0) {
        return { entries: [], segments: 0 };
    }

    // 根据报文头位置进行分段
    const segments: { start: number; end: number }[] = [];
    let currentStart = safeStartPos;
    let segmentCount = 0;

    while (currentStart < safeEndPos) {
        let segmentEnd = Math.min(currentStart + segmentSize, safeEndPos);
        
        // 找到段结束位置之后的第一个报文头
        const nextFrameIndex = framePositions.findIndex(pos => pos > segmentEnd);
        if (nextFrameIndex !== -1) {
            // 将段结束位置调整到上一个报文头之后
            const lastFrameInSegment = framePositions[nextFrameIndex - 1];
            if (lastFrameInSegment > currentStart) {
                segmentEnd = lastFrameInSegment;
            }
        }

        segments.push({ start: currentStart, end: segmentEnd });
        currentStart = segmentEnd;
        segmentCount++;
    }

    // 并行解析所有段
    const allEntries: FrameEntry[] = [];
    for (const segment of segments) {
        const segmentEntries = parseFrameRange(buffer, segment.start, segment.end);
        allEntries.push(...segmentEntries);
    }

    // 按照位置排序确保顺序正确
    allEntries.sort((a, b) => (a.position || 0) - (b.position || 0));

    console.log(`成功解析 ${allEntries.length} 个报文，使用了 ${segmentCount} 个段`);

    return { entries: allEntries, segments: segmentCount };
}

/**
 * 按时间范围筛选报文
 */
export function filterFramesByTimeRange(entries: FrameEntry[], startTime?: Date, endTime?: Date): FrameEntry[] {
    if (!Array.isArray(entries)) {
        console.error('时间范围筛选接收到非数组报文:', entries);
        return [];
    }
    
    if (!startTime && !endTime) return entries;
    
    return entries.filter(entry => {
        if (!entry || !entry.timestamp) return false;
        
        try {
            const entryTime = new Date(entry.timestamp);
            if (isNaN(entryTime.getTime())) return true;
            
            if (startTime && entryTime < startTime) return false;
            if (endTime && entryTime > endTime) return false;
            
            return true;
        } catch (error) {
            console.error('时间范围筛选处理报文时出错:', error);
            return false;
        }
    });
}

/**
 * 按端口筛选报文
 */
export function filterFramesByPort(entries: FrameEntry[], port: number): FrameEntry[] {
    if (!Array.isArray(entries)) return [];
    if (port === undefined || port === null) return entries;
    
    return entries.filter(entry => entry.port === port);
}

/**
 * 按协议筛选报文
 */
export function filterFramesByProtocol(entries: FrameEntry[], protocol: number): FrameEntry[] {
    if (!Array.isArray(entries)) return [];
    if (protocol === undefined || protocol === null) return entries;
    
    return entries.filter(entry => entry.protocol === protocol);
}

/**
 * 按方向筛选报文
 */
export function filterFramesByDirection(entries: FrameEntry[], direction: number): FrameEntry[] {
    if (!Array.isArray(entries)) return [];
    if (direction === undefined || direction === null) return entries;
    
    return entries.filter(entry => entry.direction === direction);
}

export interface ExportProgress {
    total_entries: number;
    processed_entries: number;
    current_tag: string;
    percentage: number;
}

export async function exportFrames(params: {
    sourcePath: string;
    exportDir: string;
    entries: FrameEntry[];
}): Promise<void> {
    try {
        await invoke('export_frames', params);
    } catch (error) {
        console.error('导出失败:', error);
        throw error;
    }
}