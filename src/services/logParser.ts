import { LogEntry } from '../store/slices/logParseSlice';
import { v4 as uuidv4 } from 'uuid';

// 常量定义
export const LOG_RECORD_FLAG = 0x22222222;
const MSG_HEAD_FLAG = 0xF9;
const MSG_TAIL_FLAG = 0x6E;

const LOG_MSG_DATA_LEN_POS = 1;
const LOG_MSG_DATA_START_POS = 4;
const LOG_MSG_PID_POS = 5;
const LOG_MSG_RECORD_HEADER_POS = 7;
const LOG_MSG_RECORD_PID_POS = 11;
const LOG_MSG_RECORD_LEN_POS = 12;
const LOG_MSG_RECORD_START_POS = 14;

// 日志级别
const LOG_LEVELS = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];

interface RawLogData {
    time: string;
    pid: string;
    tid: string;
    func: string;
    line: number; 
    level: string;
    tag: string;
    message: string;
    raw: string;
}

/**
 * 解析日志消息
 * @param buffer 日志文件内容
 * @param startPos 起始位置
 * @param endPos 结束位置
 */
export function parseLogChunk(buffer: Uint8Array, startPos: number = 0, endPos: number = 0): LogEntry[] {
    // 输入验证
    if (!buffer || !(buffer instanceof Uint8Array)) {
        console.error('无效的buffer类型', typeof buffer);
        return [];
    }
    
    // 参数安全化
    const bufferLength = buffer.length;
    const safeStartPos = Math.max(0, startPos || 0);
    const safeEndPos = endPos > 0 && endPos <= bufferLength ? endPos : bufferLength;
    
    // 如果buffer为空或范围无效，返回空数组
    if (bufferLength === 0 || safeEndPos <= safeStartPos) {
        console.warn('Buffer为空或无效的范围');
        return [];
    }
    
    // 执行解析
    try {
        const entries: LogEntry[] = [];
        let pos = safeStartPos;
        
        // 调试信息 - 以十六进制显示
        console.log("Buffer length:", bufferLength);
        console.log("解析范围:", safeStartPos, "到", safeEndPos);
        const firstBytes = Array.from(buffer.slice(0, Math.min(50, bufferLength)))
            .map(b => b.toString(16).padStart(2, '0')).join(' ');
        console.log("First 50 bytes (hex):", firstBytes);
        
        while (pos < safeEndPos - 7) { // 至少需要7字节（4字节标记 + 1字节PID + 2字节长度）
            // 确保足够的数据可读
            if (pos + 4 > safeEndPos) {
                pos++;
                continue;
            }
            
            try {
                // 查找日志标记 (0x22222222)
                const flag = new DataView(buffer.buffer, buffer.byteOffset).getUint32(pos, true);
                
                if (flag === LOG_RECORD_FLAG) {
                    console.log(`Found log record flag at position ${pos}: 0x${flag.toString(16)}`);
                    
                    // 确保有足够数据来读取PID和长度
                    if (pos + 7 > safeEndPos) {
                        console.log("Not enough data for PID and length");
                        pos++;
                        continue;
                    }
                    
                    // 提取PID（1字节）
                    const pid = buffer[pos + 4];
                    let contentLength = 0;
                    
                    // 提取内容长度（2字节）- 小端序，低字节在前
                    if (pos + 6 <= safeEndPos) {
                        const lengthHigh = buffer[pos + 5];
                        const lengthLow = buffer[pos + 6];
                        contentLength = lengthLow | lengthHigh << 8;
                        
                        console.log(`Length bytes: 0x${lengthLow.toString(16).padStart(2, '0')} 0x${lengthHigh.toString(16).padStart(2, '0')}`);
                        console.log(`At position ${pos}: PID=${pid}, Length=${contentLength} (0x${contentLength.toString(16).padStart(4, '0')})`);
                    }
                    
                    // 长度健康性检查 - 避免过大值和负值
                    if (contentLength <= 0 || contentLength > bufferLength || contentLength > 10000) {
                        console.log(`Invalid content length: ${contentLength}, skipping`);
                        pos++;
                        continue;
                    }
                    
                    // 确保有足够的内容
                    if (pos + 7 + contentLength > safeEndPos) {
                        console.log(`Not enough data for content: need ${contentLength} bytes, but only have ${safeEndPos - (pos + 7)}`);
                        pos++;
                        continue;
                    }
                    
                    // 提取日志内容
                    const contentStart = pos + 7; // 4字节标记 + 1字节PID + 2字节长度
                    const contentEnd = contentStart + contentLength;
                    
                    // 确保内容范围有效
                    if (contentEnd > bufferLength) {
                        console.log(`Content end position ${contentEnd} exceeds buffer length ${bufferLength}`);
                        pos++;
                        continue;
                    }
                    
                    const content = buffer.slice(contentStart, contentEnd);
                    
                    // 将二进制内容转换为十六进制字符串用于调试
                    const contentHex = Array.from(content.slice(0, Math.min(20, content.length)))
                        .map(b => b.toString(16).padStart(2, '0')).join(' ');
                    console.log(`Content starts with: ${contentHex}${content.length > 20 ? '...' : ''}`);
                    
                    try {
                        // 将二进制内容转换为字符串
                        const msgStr = new TextDecoder().decode(content);
                        console.log(`Decoded message: ${msgStr.substring(0, 100)}${msgStr.length > 100 ? '...' : ''}`);
                        
                        // 解析日志内容
                        const logEntry = parseLogMessage(msgStr);
                        if (logEntry) {
                            // 使用提取的pid，确保一致性
                            logEntry.pid = pid.toString();
                            entries.push(logEntry);
                            console.log(`Successfully parsed log entry: ${JSON.stringify(logEntry)}`);
                        } else {
                            console.log("Failed to parse log message");
                        }
                        
                        // 移动到下一条记录
                        pos = contentEnd;
                    } catch (e) {
                        console.error('Error parsing log content at position', pos, e);
                        pos++; // 出错时移动一个字节继续查找
                    }
                } else {
                    pos++;
                }
            } catch (e) {
                console.error('Error reading flag at position', pos, e);
                pos++; // 出错时移动一个字节继续查找
            }
        }
        
        console.log(`Parsing completed. Found ${entries.length} log entries.`);
        return entries;
    } catch (error) {
        console.error('parseLogChunk发生错误:', error);
        return [];
    }
}

/**
 * 解析单个日志消息
 * @param data 消息数据
 */
function parseLogMessage(data: string): LogEntry | null {
    try {
        if (!data) {
            console.error('Log message data is empty or undefined');
            return null;
        }
        
        console.log('Parsing log message:', data);
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
        // 使用非贪婪匹配来正确提取整个括号内容
        const bracketMatch = messageContent.match(/\[([^\]]+)\]/); 
        let infoMatch = null;
        
        if (bracketMatch) {
            const bracketContent = bracketMatch[1];
            infoMatch = bracketContent.match(/(.*?)\s+pid:([\d-]+)\s+tid:([\d-]+)\s+(.*?):(.*?)$/);
        }
        if (infoMatch) {
            // 标准格式 [TIME pid:XX tid:XX TAG:LINE]
            const time = infoMatch[1].trim();
            const pid = infoMatch[2];
            const tid = infoMatch[3];
            const func = infoMatch[4].trim(); // 这是函数名，不是tag
            const line = infoMatch[5] ? infoMatch[5].trim() : null;
            
            // 获取括号的位置以正确提取消息内容
            const bracketPos = messageContent.indexOf(']');
            
            // 确保括号存在
            if (bracketPos === -1) {
                console.error('无法找到消息内容中的右括号，无法提取消息部分');
                return {
                    id: uuidv4().toString(),
                    pid,
                    tid,
                    timeStamp: time,
                    level,
                    tag: tagPrefix || '',
                    func: func, // 使用正确提取的函数名
                    line: line ? parseInt(line) : null,
                    message: messageContent, // 返回完整内容作为消息
                    rawData: messageContent
                };
            }
            
            // 构建完整的tag（包含前缀）
            const fullTag = tagPrefix ? `${tagPrefix}` : '';
            
            return {
                id: uuidv4().toString(),
                pid,
                tid,
                timeStamp: time,
                level,
                tag: tagPrefix, // 标签应该是前缀部分
                func: func, // 使用正确提取的函数名
                line: line ? parseInt(line) : null,
                message: messageContent.substring(bracketPos + 1).trim(), // 消息是括号后的内容
                rawData: messageContent // 直接使用原始内容
            };
        } else {
            // 尝试提取非标准格式 (可能是多行拼接的情况)
            // 拆分可能的独立行
            const lines = data.split(/\r\n|\n/).filter(line => line && line.trim());
            
            if (lines.length >= 3) {
                // 格式可能是:
                // 2025-03-20 01:08:16.155
                // INFO
                // [2:13] task_check_power_process:00545
                // power_off_flag= FALSE!
                
                const time = lines[0].trim();
                level = lines[1].trim();
                const pidTidMatch = lines[2].match(/\[(\d+):(\d+)\]\s+(.*?)(?::(\d+))?/);
                
                if (pidTidMatch) {
                    const pid = pidTidMatch[1];
                    const tid = pidTidMatch[2];
                    const tag = pidTidMatch[3].trim();
                    const line = pidTidMatch[4] ? pidTidMatch[4].trim() : null;
                    
                    // 构建完整的tag（包含前缀）
                    const fullTag = tagPrefix ? `${tagPrefix}` : '';
                    
                    // 构建标准格式的内容
                    const formattedContent = `[${time} pid:${pid.padStart(2, '0')} tid:${tid.padStart(2, '0')} ${fullTag}] ${lines.slice(3).join(' ').trim()}`;
                    
                    return {
                        id: uuidv4().toString(),
                        pid,
                        tid,
                        timeStamp: time,
                        level,
                        tag: fullTag,
                        func: tag, // 在这种情况下tag确实是函数名
                        line: line ? parseInt(line) : null,
                        message: lines.slice(3).join(' ').trim(),
                        rawData: formattedContent
                    };
                }
            }
            
            // 如果所有尝试都失败，创建一个基本条目而不是返回null
            return {
                id: uuidv4().toString(),
                pid:null,
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
        console.error('Error parsing log message:', e, 'data:', data ? data.substring(0, 100) : 'undefined');
        // 出错时返回基本条目而不是null
        return {
            id: uuidv4().toString(),
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
 * 按级别筛选日志
 * @param entries 日志条目
 * @param level 级别
 */
export function filterLogsByLevel(entries: LogEntry[], level: string): LogEntry[] {
    if (!Array.isArray(entries)) {
        console.error('级别筛选接收到非数组日志:', entries);
        return [];
    }
    
    if (!level || level === 'ALL') return entries;
    
    const levelIndex = LOG_LEVELS.indexOf(level.toUpperCase());
    if (levelIndex === -1) return entries;
    
    return entries.filter(entry => {
        // 确保entry是有效对象
        if (!entry || typeof entry !== 'object' || !entry.level) return false;
        
        try {
            const entryLevelIndex = LOG_LEVELS.indexOf(entry.level.toUpperCase());
            return entryLevelIndex === levelIndex; // 修改为精确匹配
        } catch (error) {
            console.error('级别筛选处理条目时出错:', error);
            return false;
        }
    });
}

/**
 * 按关键字搜索日志
 * @param entries 日志条目
 * @param keyword 关键字
 */
export function searchLogsByKeyword(entries: LogEntry[], keyword: string): LogEntry[] {
    if (!Array.isArray(entries)) {
        console.error('关键字搜索接收到非数组日志:', entries);
        return [];
    }
    
    if (!keyword) return entries;
    
    const lowerKeyword = keyword.toLowerCase();
    return entries.filter(entry => {
        // 确保entry是有效对象
        if (!entry || typeof entry !== 'object') return false;
        
        try {
            // 安全获取消息和标签，确保为字符串
            const message = typeof entry.message === 'string' ? entry.message.toLowerCase() : '';
            const tag = typeof entry.tag === 'string' ? entry.tag.toLowerCase() : '';
            
            return message.includes(lowerKeyword) || tag.includes(lowerKeyword);
        } catch (error) {
            console.error('关键字搜索处理条目时出错:', error);
            return false;
        }
    });
}

/**
 * 按时间范围筛选日志
 * @param entries 日志条目
 * @param startTime 开始时间
 * @param endTime 结束时间
 */
export function filterLogsByTimeRange(entries: LogEntry[], startTime?: Date, endTime?: Date): LogEntry[] {
    if (!Array.isArray(entries)) {
        console.error('时间范围筛选接收到非数组日志:', entries);
        return [];
    }
    
    if (!startTime && !endTime) return entries;
    
    return entries.filter(entry => {
        // 确保entry是有效对象并且有timeStamp
        if (!entry || typeof entry !== 'object' || !entry.timeStamp) return false;
        
        try {
            const entryTime = new Date(entry.timeStamp);
            
            // 检查是否为有效日期
            if (isNaN(entryTime.getTime())) return true;
            
            if (startTime && entryTime < startTime) return false;
            if (endTime && entryTime > endTime) return false;
            
            return true;
        } catch (error) {
            console.error('时间范围筛选处理条目时出错:', error, entry);
            return false;
        }
    });
}

// 添加对前缀的筛选方法
/**
 * 按标签前缀筛选日志
 * @param entries 日志条目
 * @param prefix 前缀
 */
export function filterLogsByPrefix(entries: LogEntry[], prefix: string): LogEntry[] {
    if (!Array.isArray(entries)) {
        console.error('前缀筛选接收到非数组日志:', entries);
        return [];
    }
    
    if (!prefix) return entries;
    
    return entries.filter(entry => {
        // 确保entry是有效对象
        if (!entry || typeof entry !== 'object') return false;
        
        try {
            // 检查tag是否以前缀开头
            if (entry.tag && typeof entry.tag === 'string' && entry.tag.startsWith(prefix)) {
                return true;
            }
            
            // 检查是否完全匹配前缀（针对PowerDown#DEBUG格式）
            if (entry.rawData && typeof entry.rawData === 'string') {
                const prefixMatch = entry.rawData.match(/^(\w+)#/);
                if (prefixMatch && prefixMatch[1] === prefix) {
                    return true;
                }
            }
            
            return false;
        } catch (error) {
            console.error('前缀筛选处理条目时出错:', error);
            return false;
        }
    });
} 