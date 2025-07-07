import { invoke } from '@tauri-apps/api/core';
import { v4 as uuidv4 } from 'uuid';
import { store } from '../store';
import { selectFrameFileContents, selectFrameFilter } from '../store/slices/frameParseSlice';

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
    // 检查方向值是否为有效的枚举值
    if (direction === FrameDirection.IN || direction === FrameDirection.OUT) {
        return directionNames[direction as FrameDirection];
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
                let direction = buffer[pos + FRAME_DIRECTION_OFFSET];

                // 验证方向字段，如果不是有效值则设为默认值（接收）
                if (direction !== FrameDirection.IN && direction !== FrameDirection.OUT) {
                    console.warn(`无效的方向值: ${direction}，设置为默认值（接收）`);
                    direction = FrameDirection.IN; // 默认为接收
                }
                
                const timestamp = new DataView(buffer.buffer).getUint32(pos + FRAME_TIMESTAMP_OFFSET, false);
                const milliseconds = new DataView(buffer.buffer).getUint16(pos + FRAME_MILLISEC_OFFSET, false);
                
                const date = new Date(timestamp * 1000 + milliseconds);
                const timeStr = date.toLocaleString('zh-CN', { 
                    hour12: false,
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                }).replace(/\//g, '-') + '.' + String(date.getMilliseconds()).padStart(3, '0');

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
 * 解析指定位置的单个报文
 * @param buffer 报文文件内容
 * @param frameStart 报文开始位置
 * @param maxEnd 最大结束位置（下一个报文开始位置或缓冲区结束）
 * @returns 解析的报文条目，如果解析失败返回null
 */
function parseFrameAt(buffer: Uint8Array, frameStart: number, maxEnd: number): FrameEntry | null {
    const pos = frameStart;

    // 检查是否有足够的空间读取报文头
    if (pos + FRAME_CONTENT_OFFSET > maxEnd || pos + FRAME_CONTENT_OFFSET > buffer.length) {
        console.warn(`位置 ${pos} 处没有足够的空间读取报文头`);
        return null;
    }

    try {
        // 验证报文标志
        const flag = new DataView(buffer.buffer).getUint32(pos, false);
        if (flag !== FRM_RECORD_FLAG) {
            console.warn(`位置 ${pos} 处的报文标志不匹配，跳过此位置`);
            return null;
        }

        // 读取报文基本信息
        const pid = buffer[pos + FRAME_PID_OFFSET];
        const contentLength = new DataView(buffer.buffer).getUint16(pos + FRAME_LENGTH_OFFSET, false);

        // 验证内容长度
        if (contentLength <= 0 || contentLength > 10000) {
            console.warn(`位置 ${pos} 处的报文内容长度不合法: ${contentLength}`);
            return null;
        }

        const totalFrameLength = FRAME_CONTENT_OFFSET + contentLength;

        console.log(`pos: ${pos}, totalFrameLength: ${totalFrameLength}, maxEnd: ${maxEnd}, buffer.length: ${buffer.length}`);

        // 检查报文是否完整
        // 优先检查缓冲区边界，然后检查maxEnd边界
        if (pos + totalFrameLength > buffer.length) {
            console.warn(`位置 ${pos} 处的报文超出缓冲区边界，跳过此位置 (需要: ${pos + totalFrameLength}, 可用: ${buffer.length})`);
            return null;
        }

        // 读取报文详细信息
        const tag = buffer[pos + FRAME_TAG_OFFSET];
        const port = buffer[pos + FRAME_PORT_OFFSET];
        const protocol = buffer[pos + FRAME_PROTOCOL_OFFSET];
        let direction = buffer[pos + FRAME_DIRECTION_OFFSET];

        // 验证方向字段，如果不是有效值则设为默认值（接收）
        if (direction !== FrameDirection.IN && direction !== FrameDirection.OUT) {
            direction = FrameDirection.IN; // 默认为接收
        }

        // 读取时间戳
        const timestamp = new DataView(buffer.buffer).getUint32(pos + FRAME_TIMESTAMP_OFFSET, false);
        const milliseconds = new DataView(buffer.buffer).getUint16(pos + FRAME_MILLISEC_OFFSET, false);

        const date = new Date(timestamp * 1000 + milliseconds);
        const timeStr = date.toLocaleString('zh-CN', {
            hour12: false,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        }).replace(/\//g, '-') + '.' + String(date.getMilliseconds()).padStart(3, '0');

        // 读取报文内容
        const contentStart = pos + FRAME_CONTENT_OFFSET;
        const contentEnd = contentStart + (contentLength - 10);

        const content = Array.from(buffer.slice(contentStart, contentEnd))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');

        const rawData = Array.from(buffer.slice(pos, contentEnd))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');

        return {
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
        };

    } catch (error) {
        console.error(`解析报文失败，位置: ${pos}, 错误:`, error);
        return null;
    }
}

/**
 * 解析报文块 - 优化版本，直接基于扫描结果解析
 * @param buffer 报文文件内容
 * @param startPos 起始位置
 * @param endPos 结束位置
 */
export function parseFrameChunk(
    buffer: Uint8Array,
    startPos: number = 0,
    endPos: number = 0
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

    console.log("所有可能的位置:",framePositions)
    // 直接基于扫描到的报文位置进行解析，不再使用固定分段
    const allEntries: FrameEntry[] = [];
    let successCount = 0;
    let errorCount = 0;

    // 逐个解析每个报文
    for (let i = 0; i < framePositions.length; i++) {
        const frameStart = framePositions[i];

        // 确定报文结束位置：下一个报文的开始位置或缓冲区结束
        // 对于最后一个报文，使用缓冲区的实际长度而不是safeEndPos
        const frameEnd = i < framePositions.length - 1 ? framePositions[i + 1] : buffer.length;

        try {
            // 解析单个报文
            const entry = parseFrameAt(buffer, frameStart, frameEnd);
            if (entry) {
                allEntries.push(entry);
                successCount++;
            }
        } catch (error) {
            console.warn(`解析报文失败，位置: ${frameStart}, 错误:`, error);
            errorCount++;
        }
    }

    console.log(`解析完成: 成功 ${successCount} 个，失败 ${errorCount} 个，总计 ${framePositions.length} 个报文头`);

    // 如果解析失败的报文太多，可能是扫描算法有问题
    if (errorCount > successCount) {
        console.warn(`警告: 解析失败率过高 (${(errorCount / framePositions.length * 100).toFixed(1)}%)，可能需要调整扫描算法`);
    }

    // 按照时间戳排序，确保报文按时间顺序排列
    // 在解析阶段就完成排序，避免在UI渲染时重复排序，提高性能
    allEntries.sort((a, b) => {
        // 首先按时间戳排序
        const timeCompare = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
        if (timeCompare !== 0) return timeCompare;

        // 如果时间戳相同，按照 PID 排序
        const pidCompare = a.pid - b.pid;
        if (pidCompare !== 0) return pidCompare;

        // 最后按照位置排序，确保完全确定的顺序
        return (a.position || 0) - (b.position || 0);
    });

    console.log(`成功解析 ${allEntries.length} 个报文，基于 ${framePositions.length} 个扫描位置`);

    return { entries: allEntries, segments: 1 }; // 现在是单次解析，不再分段
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

// 获取所有报文条目（不带过滤）
export function getAllFrameEntries(): FrameEntry[] {
    const activeFilePath = store.getState().frameParse.activeFilePath;
    if (!activeFilePath) return [];

    const fileContents = selectFrameFileContents(store.getState(), activeFilePath);
    if (!fileContents || !fileContents.chunks) return [];

    return Object.values(fileContents.chunks)
        .flatMap(chunk => chunk.content || [])
        .filter(entry => entry !== null && entry !== undefined);
}

// 获取当前过滤后的报文条目
export function getFilteredFrameEntries(): FrameEntry[] {
    const state = store.getState();
    const activeFilePath = state.frameParse.activeFilePath;
    if (!activeFilePath) return [];

    const filter = selectFrameFilter(state);
    const entries = getAllFrameEntries();

    return entries
        .filter(entry => !filter.port || entry.port === filter.port)
        .filter(entry => !filter.protocol || entry.protocol === filter.protocol)
        .filter(entry => !filter.direction || entry.direction === filter.direction)
        .filter(entry => {
            if (!filter.startTime && !filter.endTime) return true;
            const entryTime = new Date(entry.timestamp).getTime();
            
            let startTime = -Infinity;
            let endTime = Infinity;
            
            if (filter.startTime) {
                const startDate = new Date(filter.startTime);
                startDate.setMilliseconds(0);
                startTime = startDate.getTime();
            }
            
            if (filter.endTime) {
                const endDate = new Date(filter.endTime);
                endDate.setMilliseconds(999);
                endTime = endDate.getTime();
            }
            
            return entryTime >= startTime && entryTime <= endTime;
        });
}