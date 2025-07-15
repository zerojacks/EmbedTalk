import { LogEntry } from '../store/slices/logParseSlice';
import { v4 as uuidv4 } from 'uuid';

// 扩展 Worker 类型
interface ExtendedWorker extends Worker {
    busy: boolean;
    taskCount: number;
}

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
 * 创建Worker池
 */
class WorkerPool {
    private workers: ExtendedWorker[] = [];
    private queue: { buffer: Uint8Array; startPos: number; endPos: number; resolve: (entries: LogEntry[]) => void; reject: (error: any) => void; }[] = [];
    private activeWorkers = 0;
    private readonly maxWorkers: number;

    constructor(maxWorkers: number = 5) {
        this.maxWorkers = maxWorkers;
    }

    private getWorker(): ExtendedWorker {
        // 如果有空闲的worker，重用它
        const availableWorker = this.workers.find(worker => !worker.busy);
        if (availableWorker) {
            availableWorker.busy = true;
            return availableWorker;
        }

        // 如果还可以创建新的worker
        if (this.workers.length < this.maxWorkers) {
            const worker = new Worker(
                new URL('../workers/logParser.worker.ts', import.meta.url),
                { type: 'module' }
            ) as ExtendedWorker;
            worker.busy = true;
            worker.taskCount = 1;
            this.workers.push(worker);
            return worker;
        }

        // 如果没有可用的worker，返回负载最小的worker
        return this.workers.reduce((min, w) => (!min || w.taskCount < min.taskCount) ? w : min);
    }

    async processSegment(buffer: Uint8Array, startPos: number, endPos: number): Promise<LogEntry[]> {
        return new Promise((resolve, reject) => {
            const task = { buffer, startPos, endPos, resolve, reject };
            
            if (this.activeWorkers < this.maxWorkers) {
                this.runTask(task);
            } else {
                this.queue.push(task);
            }
        });
    }

    private runTask(task: { buffer: Uint8Array; startPos: number; endPos: number; resolve: (entries: LogEntry[]) => void; reject: (error: any) => void; }) {
        const worker = this.getWorker();
        this.activeWorkers++;

        const handleMessage = (e: MessageEvent) => {
            if (e.data.error) {
                task.reject(new Error(e.data.error));
            } else {
                task.resolve(e.data.entries);
            }
            
            worker.busy = false;
            worker.taskCount = (worker.taskCount || 0) - 1;
            this.activeWorkers--;

            // 处理队列中的下一个任务
            if (this.queue.length > 0) {
                const nextTask = this.queue.shift();
                if (nextTask) {
                    this.runTask(nextTask);
                }
            }

            worker.removeEventListener('message', handleMessage);
            worker.removeEventListener('error', handleError);
        };

        const handleError = (error: ErrorEvent) => {
            task.reject(error);
            worker.busy = false;
            worker.taskCount = (worker.taskCount || 0) - 1;
            this.activeWorkers--;

            worker.removeEventListener('message', handleMessage);
            worker.removeEventListener('error', handleError);
        };

        worker.addEventListener('message', handleMessage);
        worker.addEventListener('error', handleError);
        worker.taskCount = (worker.taskCount || 0) + 1;

        worker.postMessage({
            buffer: task.buffer,
            startPos: task.startPos,
            endPos: task.endPos,
        });
    }

    terminate() {
        this.workers.forEach(worker => worker.terminate());
        this.workers = [];
        this.queue = [];
        this.activeWorkers = 0;
    }
}

// 创建一个全局的Worker池实例，增加worker数量以支持多文件并发
const workerPool = new WorkerPool(10);

/**
 * 解析日志块
 * @param buffer 日志文件内容
 * @param startPos 起始位置
 * @param endPos 结束位置
 * @param segmentSize 分段大小，默认1MB
 */
export async function parseLogChunk(
    buffer: Uint8Array,
    startPos: number = 0,
    endPos: number = 0,
): Promise<LogEntry[]> {
    // 输入验证和参数安全化
    if (!buffer || !(buffer instanceof Uint8Array)) {
        console.error('无效的buffer类型', typeof buffer);
        return [];
    }

    const bufferLength = buffer.length;
    const safeStartPos = Math.max(0, startPos);
    const safeEndPos = endPos > 0 && endPos <= bufferLength ? endPos : bufferLength;

    if (bufferLength === 0 || safeEndPos <= safeStartPos) {
        console.warn('Buffer为空或无效的范围');
        return [];
    }

    try {
        console.log(`开始解析日志，范围: ${safeStartPos} - ${safeEndPos}, 总长度: ${safeEndPos - safeStartPos} 字节`);

        // 直接将整个buffer传递给worker进行处理，包含segmentSize用于worker内部分段
        const entries = await workerPool.processSegment(buffer, safeStartPos, safeEndPos);

        console.log(`成功解析 ${entries.length} 个日志条目`);

        return entries;
    } catch (error) {
        console.error('解析过程中发生错误:', error);
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
                    line: line ? line : undefined,
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
                line: line ? line : undefined,
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
                        line: line ? line : undefined,
                        message: lines.slice(3).join(' ').trim(),
                        rawData: formattedContent
                    };
                }
            }
            
            // 如果所有尝试都失败，创建一个基本条目而不是返回null
            return {
                id: uuidv4().toString(),
                pid:undefined,
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
        console.error('Error parsing log message:', e, 'data:', data ? data.substring(0, 100) : 'undefined');
        // 出错时返回基本条目而不是null
        return {
            id: uuidv4().toString(),
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