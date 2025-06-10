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

export interface FrameEntry {
    id: string;
    pid: number;
    tag: number;
    port: number;
    protocol: number;
    direction: number;
    timestamp: string;
    content: string;
    rawData: string;
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
 * 解析报文块
 * @param buffer 报文文件内容
 * @param startPos 起始位置
 * @param endPos 结束位置
 */
export function parseFrameChunk(buffer: Uint8Array, startPos: number = 0, endPos: number = 0): FrameEntry[] {
    const entries: FrameEntry[] = [];
    const bufferLength = buffer.length;
    const safeStartPos = Math.max(0, startPos);
    const safeEndPos = endPos > 0 && endPos <= bufferLength ? endPos : bufferLength;

    console.log(`开始解析报文，总长度: ${bufferLength}字节，解析范围: ${safeStartPos}-${safeEndPos}`);
    
    // 打印前100个字节用于调试
    const firstBytes = Array.from(buffer.slice(0, Math.min(100, bufferLength)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join(' ');
    console.log(`文件前100个字节: ${firstBytes}`);

    let pos = safeStartPos;
    let frameCount = 0;
    let errorCount = 0;

    while (pos < safeEndPos - FRAME_CONTENT_OFFSET) {
        try {
            // 检查标志头
            const flag = new DataView(buffer.buffer).getUint32(pos, false);
            
            // 添加更详细的标记检查日志
            if (pos < 100) { // 只打印前100字节位置的标记检查，避免日志过多
                console.log(`位置 ${pos} 的标记值: 0x${flag.toString(16)}`);
            }
            
            if (flag === FRM_RECORD_FLAG) {
                console.log(`\n在位置 ${pos} 找到报文标记: 0x${flag.toString(16)}`);
                
                // 解析基本信息
                const pid = buffer[pos + FRAME_PID_OFFSET];
                const contentLength = new DataView(buffer.buffer).getUint16(pos + FRAME_LENGTH_OFFSET, false);
                
                console.log(`报文头信息: PID=${pid}, 内容长度=${contentLength}`);
                
                // 验证内容长度的合理性
                if (contentLength <= 0 || contentLength > 10000) {
                    console.warn(`在位置 ${pos} 的内容长度异常: ${contentLength}，跳过此位置`);
                    pos++;
                    continue;
                }
                
                // 确保有足够的数据
                if (pos + FRAME_CONTENT_OFFSET + contentLength <= safeEndPos) {
                    const tag = buffer[pos + FRAME_TAG_OFFSET];
                    const port = buffer[pos + FRAME_PORT_OFFSET];
                    const protocol = buffer[pos + FRAME_PROTOCOL_OFFSET];
                    const direction = buffer[pos + FRAME_DIRECTION_OFFSET];
                    
                    console.log(`报文属性: TAG=${tag}, PORT=${port}, PROTOCOL=${protocol}, DIRECTION=${direction}`);
                    
                    // 解析时间戳
                    const timestamp = new DataView(buffer.buffer).getUint32(pos + FRAME_TIMESTAMP_OFFSET, false);
                    const milliseconds = new DataView(buffer.buffer).getUint16(pos + FRAME_MILLISEC_OFFSET, false);
                    
                    // 转换时间戳为可读格式
                    const date = new Date(timestamp * 1000 + milliseconds);
                    const timeStr = date.toISOString().replace('T', ' ').slice(0, -1);
                    
                    console.log(`时间戳: ${timeStr} (原始值: timestamp=${timestamp}, ms=${milliseconds})`);
                    
                    // 提取报文内容
                    const contentStart = pos + FRAME_CONTENT_OFFSET;
                    const contentEnd = contentStart + (contentLength - 10); // 减去头部10字节
                    
                    // 打印内容的前50个字节
                    const contentPreview = Array.from(buffer.slice(contentStart, Math.min(contentStart + 50, contentEnd)))
                        .map(b => b.toString(16).padStart(2, '0'))
                        .join(' ');
                    console.log(`报文内容预览 (前50字节): ${contentPreview}${contentEnd - contentStart > 50 ? '...' : ''}`);
                    
                    const content = Array.from(buffer.slice(contentStart, contentEnd))
                        .map(b => b.toString(16).padStart(2, '0'))
                        .join('');
                    
                    // 构建原始数据字符串
                    const rawData = Array.from(buffer.slice(pos, contentEnd))
                        .map(b => b.toString(16).padStart(2, '0'))
                        .join('');
                    
                    entries.push({
                        id: uuidv4(),
                        pid,
                        tag,
                        port,
                        protocol,
                        direction,
                        timestamp: timeStr,
                        content,
                        rawData
                    });
                    
                    frameCount++;
                    console.log(`成功解析第 ${frameCount} 个报文，下一个位置: ${contentEnd}\n`);
                    pos = contentEnd;
                    continue;
                } else {
                    console.warn(`在位置 ${pos} 的报文长度超出缓冲区范围: 需要 ${contentLength} 字节，但只剩 ${safeEndPos - (pos + FRAME_CONTENT_OFFSET)} 字节`);
                }
            }
            pos++;
        } catch (error) {
            errorCount++;
            console.error(`解析错误 #${errorCount} at position ${pos}:`, error);
            console.error(`错误位置的数据预览: ${Array.from(buffer.slice(pos, Math.min(pos + 20, buffer.length)))
                .map(b => b.toString(16).padStart(2, '0'))
                .join(' ')}`);
            pos++;
        }
    }
    
    console.log(`\n解析完成统计:`);
    console.log(`- 总处理字节数: ${pos - safeStartPos}`);
    console.log(`- 成功解析报文数: ${frameCount}`);
    console.log(`- 解析错误次数: ${errorCount}`);
    
    if (entries.length === 0) {
        console.warn('警告: 未能解析出任何有效报文！');
    }
    
    return entries;
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