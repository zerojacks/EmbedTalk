import { LogEntry } from '../store/slices/logParseSlice';

// 常量定义
const LOG_RECORD_FLAG = 0x22222222;

interface ParseRequest {
    buffer: Uint8Array;
    startPos: number;
    endPos: number;
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
                    line: line ? parseInt(line) : null,
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
                line: line ? parseInt(line) : null,
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
                        line: line ? parseInt(line) : null,
                        message: lines.slice(3).join(' ').trim(),
                        rawData: formattedContent
                    };
                }
            }
            
            return {
                id: crypto.randomUUID(),
                pid: null,
                tid: null,
                timeStamp: new Date().toISOString().replace('T', ' ').substring(0, 23),
                level: level || 'INFO',
                tag: tagPrefix || '',
                func: tagPrefix,
                line: null,
                message: messageContent || '无法解析的日志消息',
                rawData: data
            };
        }
    } catch (e) {
        return {
            id: crypto.randomUUID(),
            pid: null,
            tid: null,
            timeStamp: new Date().toISOString().replace('T', ' ').substring(0, 23),
            level: 'ERROR',
            tag: 'ParseError',
            func: 'ParseError',
            line: null,
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
                
                if (contentLength <= 0 || contentLength > 10000) {
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

// 监听消息
self.onmessage = (e: MessageEvent<ParseRequest>) => {
    try {
        const { buffer, startPos, endPos } = e.data;
        const entries = parseLogRange(buffer, startPos, endPos);
        self.postMessage({ entries });
    } catch (error) {
        self.postMessage({ error: error instanceof Error ? error.message : String(error) });
    }
}; 