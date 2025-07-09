// frameParser.worker.ts - 报文解析 Worker
import { FrameDirection, FrameEntry, FrameParseRequest, FRM_RECORD_FLAG } from '../types/frameTypes';
import { getDirectionName,  getRecordTypeName, getPortName, getProtocolName } from '../utils/frameUtils'

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

const FRAME_SPECIAL_LEN = 7;

/**
 * 扫描报文头位置
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
            if (pos + FRAME_CONTENT_OFFSET <= safeEndPos) {
                const contentLength = new DataView(buffer.buffer).getUint16(pos + FRAME_LENGTH_OFFSET, false);
                if (contentLength > 0) {
                    const totalFrameLength = FRAME_SPECIAL_LEN + contentLength;

                    // 验证报文边界：检查报文结束位置后是否有下一个有效的FRM_RECORD_FLAG
                    const frameEndPos = pos + totalFrameLength;
                    let isValidFrame = true;

                    // 如果不是最后一个报文，检查下一个位置是否有有效的FRM_RECORD_FLAG
                    if (frameEndPos + 4 <= safeEndPos) {
                        const nextFlag = new DataView(buffer.buffer).getUint32(frameEndPos, false);
                        if (nextFlag !== FRM_RECORD_FLAG) {
                            isValidFrame = false;
                        }
                    }
                    // 如果是最后一个报文，检查是否超出边界太多
                    else if (frameEndPos > bufferLength) {
                        // 允许最后一个报文稍微超出边界（部分报文）
                        if (frameEndPos - bufferLength > contentLength / 2) {
                            isValidFrame = false; // 超出太多，可能是错误的报文头
                        }
                    }
                    if (isValidFrame) {
                        framePositions.push(pos);
                        // 跳过整个报文，避免在报文内部找到假的FRM_RECORD_FLAG
                        pos = frameEndPos - 1; // -1 因为循环末尾会 pos++
                    } else
                    {
                        console.error("pos:", pos, "totalFrameLength:", totalFrameLength, "frameEndPos:", frameEndPos, "safeEndPos:", safeEndPos, "bufferLength:", bufferLength);
                    }
                }
            }
        }
        pos++;
    }
    return framePositions;
}

/**
 * 解析单个报文
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
        if (contentLength <= 0 ) {
            console.warn(`位置 ${pos} 处的报文内容长度不合法: ${contentLength}`);
            return null;
        }

        const totalFrameLength = FRAME_SPECIAL_LEN + contentLength;

        // 检查报文是否完整
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
            id: crypto.randomUUID(),
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
 * 解析报文范围
 */
function parseFrameRange(buffer: Uint8Array, startPos: number, endPos: number): FrameEntry[] {
    const entries: FrameEntry[] = [];

    try {
        // 扫描报文头位置
        const framePositions = scanFrameHeaders(buffer, startPos, endPos);

        if (framePositions.length === 0) {
            return entries;
        }

        // 逐个解析每个报文
        for (let i = 0; i < framePositions.length; i++) {
            const frameStart = framePositions[i];
            // 不再依赖下一个报文位置，而是使用缓冲区结束位置
            const frameEnd = endPos;

            try {
                const entry = parseFrameAt(buffer, frameStart, frameEnd);
                if (entry) {
                    entries.push(entry);
                }
            } catch (error) {
                console.warn(`解析报文失败，位置: ${frameStart}`, error);
            }
        }
    } catch (error) {
        console.error('解析报文范围时出错:', error);
    }

    return entries;
}

// 监听消息
self.onmessage = (e: MessageEvent<FrameParseRequest>) => {
    try {
        const { buffer, startPos, endPos } = e.data;

        // 如果提供了segmentSize，使用内部分段解析；否则使用简单的范围解析
        const entries = parseFrameRange(buffer, startPos, endPos);

        self.postMessage({ entries });
    } catch (error) {
        self.postMessage({ error: error instanceof Error ? error.message : String(error) });
    }
};
