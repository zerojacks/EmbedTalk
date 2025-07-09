import { LogEntry } from '../store/slices/logParseSlice';

// 常量定义
const LOG_RECORD_FLAG = 0x22222222;
const MSG_HEAD_FLAG = 0xF9;
const MSG_TAIL_FLAG = 0x6E;

const LOG_MSG_DATA_LEN_POS = 1;
const LOG_MSG_DATA_START_POS = 4;
const LOG_MSG_PID_POS = 5;
const LOG_MSG_RECORD_HEADER_POS = 7;
const LOG_MSG_RECORD_PID_POS = 11;
const LOG_MSG_RECORD_LEN_POS = 12;
const LOG_MSG_RECORD_START_POS = 14;

interface ParseRequest {
    buffer: Uint8Array;
    startPos: number;
    endPos: number;
    segmentSize?: number; // 可选的分段大小，用于worker内部分段
}

/**
 * 扫描文件中的所有日志头位置
 */
function scanLogHeaders(buffer: Uint8Array, startPos: number = 0, endPos: number = 0): number[] {
    const logPositions: number[] = [];
    const bufferLength = buffer.length;
    const safeStartPos = Math.max(0, startPos);
    const safeEndPos = endPos > 0 && endPos <= bufferLength ? endPos : bufferLength;

    let pos = safeStartPos;
    while (pos < safeEndPos - 7) { // 至少需要7字节（4字节标记 + 1字节PID + 2字节长度）
        const flag = new DataView(buffer.buffer).getUint32(pos, true);
        if (flag === LOG_RECORD_FLAG) {
            // 验证这个位置是否可能是一个有效的日志头
            if (pos + 7 <= safeEndPos) {
                const pid = buffer[pos + 4];
                const lengthHigh = buffer[pos + 5];
                const lengthLow = buffer[pos + 6];
                const contentLength = lengthLow | (lengthHigh << 8);

                // 进行基本的有效性检查
                if (contentLength > 0) {
                    const totalLogLength = 7 + contentLength;

                    // 验证日志边界：检查日志结束位置后是否有下一个有效的LOG_RECORD_FLAG
                    const logEndPos = pos + totalLogLength;
                    let isValidLog = true;

                    // 如果不是最后一个日志，检查下一个位置是否有有效的LOG_RECORD_FLAG
                    if (logEndPos + 4 <= safeEndPos) {
                        const nextFlag = new DataView(buffer.buffer).getUint32(logEndPos, true);
                        if (nextFlag !== LOG_RECORD_FLAG) {
                            isValidLog = false;
                        }
                    }
                    // 如果是最后一个日志，检查是否超出边界太多
                    else if (logEndPos > bufferLength) {
                        // 允许最后一个日志稍微超出边界（部分日志）
                        if (logEndPos - bufferLength > contentLength / 2) {
                            isValidLog = false; // 超出太多，可能是错误的日志头
                        }
                    }

                    if (isValidLog) {
                        logPositions.push(pos);
                        // 跳过整个日志，避免在日志内部找到假的LOG_RECORD_FLAG
                        pos = logEndPos - 1; // -1 因为循环末尾会 pos++
                    }
                }
            }
        }
        pos++;
    }
    return logPositions;
}
/**
 * 解析单个日志消息
 */
function parseLogMessage(data: string): LogEntry | null {
    try {
        if (!data) {
            console.error('Log message data is empty or undefined');
            return null;
        }

        // 处理多行数据，合并为一行
        const singleLine = data.replace(/\r\n|\n/g, ' ').trim();

        // 提取日志级别和tag前缀
        let level = 'INFO'; // 默认级别
        let tagPrefix = ''; // 可选的tag前缀
        let messageContent = singleLine;

        // 检查是否有带前缀的日志级别（如 PowerDown#DEBUG）
        const prefixedLevelMatch = singleLine.match(/^(\w+)#(\w+)/);
        if (prefixedLevelMatch) {
            tagPrefix = prefixedLevelMatch[1];
            level = prefixedLevelMatch[2];
            messageContent = singleLine.substring(prefixedLevelMatch[0].length).trim();
        } else if (singleLine.startsWith('#')) {
            // 处理不带前缀的日志级别
            const levelMatch = singleLine.match(/^#(\w+)/);
            if (levelMatch) {
                level = levelMatch[1];
                messageContent = singleLine.substring(levelMatch[0].length).trim();
            }
        }

        // 尝试提取时间戳和进程信息
        const bracketMatch = messageContent.match(/\[([^\]]+)\]/);
        let infoMatch = null;

        if (bracketMatch) {
            const bracketContent = bracketMatch[1];
            infoMatch = bracketContent.match(/(.*?)\s+pid:([\d-]+)\s+tid:([\d-]+)\s+(.*?):(.*?)$/);
        }
        if (infoMatch) {
            const time = infoMatch[1].trim();
            const pid = infoMatch[2];
            const tid = infoMatch[3];
            const func = infoMatch[4].trim();
            const line = infoMatch[5] ? infoMatch[5].trim() : null;
            const bracketPos = messageContent.indexOf(']');

            if (bracketPos === -1) {
                return {
                    id: crypto.randomUUID(),
                    pid,
                    tid,
                    timeStamp: time,
                    level,
                    tag: tagPrefix || '',
                    func: func,
                    line: line ? line : undefined,
                    message: messageContent,
                    rawData: messageContent
                };
            }

            return {
                id: crypto.randomUUID(),
                pid,
                tid,
                timeStamp: time,
                level,
                tag: tagPrefix,
                func: func,
                line: line ? line : undefined,
                message: messageContent.substring(bracketPos + 1).trim(),
                rawData: messageContent
            };
        } else {
            const lines = data.split(/\r\n|\n/).filter(line => line && line.trim());

            if (lines.length >= 3) {
                const time = lines[0].trim();
                level = lines[1].trim();
                const pidTidMatch = lines[2].match(/\[(\d+):(\d+)\]\s+(.*?)(?::(\d+))?/);

                if (pidTidMatch) {
                    const pid = pidTidMatch[1];
                    const tid = pidTidMatch[2];
                    const tag = pidTidMatch[3].trim();
                    const line = pidTidMatch[4] ? pidTidMatch[4].trim() : null;
                    const fullTag = tagPrefix ? `${tagPrefix}` : '';
                    const formattedContent = `[${time} pid:${pid.padStart(2, '0')} tid:${tid.padStart(2, '0')} ${fullTag}] ${lines.slice(3).join(' ').trim()}`;

                    return {
                        id: crypto.randomUUID(),
                        pid,
                        tid,
                        timeStamp: time,
                        level,
                        tag: fullTag,
                        func: tag,
                        line: line ? line : undefined,
                        message: lines.slice(3).join(' ').trim(),
                        rawData: formattedContent
                    };
                }
            }

            return {
                id: crypto.randomUUID(),
                pid: undefined,
                tid: undefined,
                timeStamp: new Date().toISOString().replace('T', ' ').substring(0, 23),
                level: level || 'INFO',
                tag: tagPrefix || '',
                func: tagPrefix,
                line: undefined,
                message: messageContent || '无法解析的日志消息',
                rawData: data
            };
        }
    } catch (e) {
        return {
            id: crypto.randomUUID(),
            pid: undefined,
            tid: undefined,
            timeStamp: new Date().toISOString().replace('T', ' ').substring(0, 23),
            level: 'ERROR',
            tag: 'ParseError',
            func: 'ParseError',
            line: undefined,
            message: `解析错误: ${e instanceof Error ? e.message : String(e)}`,
            rawData: data || ''
        };
    }
}

/**
 * Worker主函数：解析日志段
 */
function parseLogRange(buffer: Uint8Array, startPos: number, endPos: number): LogEntry[] {
    const entries: LogEntry[] = [];
    let pos = startPos;

    while (pos < endPos - 7) {
        try {
            const flag = new DataView(buffer.buffer).getUint32(pos, true);

            if (flag === LOG_RECORD_FLAG) {
                const pid = buffer[pos + 4];
                const lengthHigh = buffer[pos + 5];
                const lengthLow = buffer[pos + 6];
                const contentLength = lengthLow | lengthHigh << 8;

                if (contentLength <= 0) {
                    pos++;
                    continue;
                }

                if (pos + 7 + contentLength > endPos) {
                    break;
                }

                const contentStart = pos + 7;
                const contentEnd = contentStart + contentLength;
                const content = buffer.slice(contentStart, contentEnd);

                try {
                    const msgStr = new TextDecoder().decode(content);
                    const logEntry = parseLogMessage(msgStr);
                    if (logEntry) {
                        logEntry.pid = pid.toString();
                        entries.push(logEntry);
                    }
                    pos = contentEnd;
                    continue;
                } catch (e) {
                    console.error('Error parsing log content at position', pos, e);
                }
            }
            pos++;
        } catch (e) {
            console.error('Error reading flag at position', pos, e);
            pos++;
        }
    }

    return entries;
}

/**
 * 解析整个文件，直接使用扫描出的日志头位置
 */
function parseLogFile(buffer: Uint8Array, startPos: number, endPos: number): LogEntry[] {
    const allEntries: LogEntry[] = [];

    try {
        console.log(`开始解析日志文件，范围: ${startPos} - ${endPos}`);

        // 扫描所有日志头位置
        const logPositions = scanLogHeaders(buffer, startPos, endPos);

        if (logPositions.length === 0) {
            console.log('未找到有效的日志头');
            return [];
        }

        console.log(`找到 ${logPositions.length} 个日志头位置`);

        // 逐个解析每个日志
        for (let i = 0; i < logPositions.length; i++) {
            const logStart = logPositions[i];
            // 下一个日志的开始位置就是当前日志的结束边界
            const logEnd = i < logPositions.length - 1 ? logPositions[i + 1] : endPos;

            try {
                const logEntries = parseLogRange(buffer, logStart, logEnd);
                allEntries.push(...logEntries);
            } catch (error) {
                console.warn(`解析日志失败，位置: ${logStart}`, error);
            }
        }

        // 按照时间戳排序确保顺序正确
        allEntries.sort((a, b) =>
            new Date(a.timeStamp).getTime() - new Date(b.timeStamp).getTime()
        );

        console.log(`文件解析完成，总共找到 ${allEntries.length} 个日志条目`);

    } catch (error) {
        console.error('解析文件时出错:', error);
    }

    return allEntries;
}

// 监听消息
self.onmessage = (e: MessageEvent<ParseRequest>) => {
    try {
        const { buffer, startPos, endPos } = e.data;

        // 如果提供了segmentSize，使用扫描头位置解析；否则使用简单的范围解析
        const entries = parseLogFile(buffer, startPos, endPos);

        self.postMessage({ entries });
    } catch (error) {
        self.postMessage({ error: error instanceof Error ? error.message : String(error) });
    }
};