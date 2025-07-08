import { invoke } from '@tauri-apps/api/core';
import { v4 as uuidv4 } from 'uuid';
import { store } from '../store/index';
import { selectFrameFileContents, selectFrameFilter } from '../store/slices/frameParseSlice';
import { FrameEntry, FrameParseRequest, FrameParseResponse } from '../types/frameTypes';

// Worker Pool 管理器
interface FrameParserWorker extends Worker {
    busy?: boolean;
    taskCount?: number;
}

class FrameParserWorkerPool {
    private workers: FrameParserWorker[] = [];
    private queue: any[] = [];
    private activeWorkers = 0;
    private maxWorkers = Math.min(navigator.hardwareConcurrency || 4, 8);

    constructor() {
        console.log(`初始化报文解析 Worker Pool，最大 Worker 数量: ${this.maxWorkers}`);
    }

    private getWorker(): FrameParserWorker {
        // 寻找空闲的 worker
        let worker = this.workers.find(w => !w.busy);

        if (!worker && this.workers.length < this.maxWorkers) {
            // 创建新的 worker
            worker = new Worker(new URL('../workers/frameParser.worker.ts', import.meta.url), {
                type: 'module'
            }) as FrameParserWorker;
            worker.busy = false;
            worker.taskCount = 0;
            this.workers.push(worker);
            console.log(`创建新的报文解析 Worker，当前总数: ${this.workers.length}`);
        }

        if (!worker) {
            // 选择任务最少的 worker
            worker = this.workers.reduce((min, current) =>
                (current.taskCount || 0) < (min.taskCount || 0) ? current : min
            );
        }

        worker.busy = true;
        worker.taskCount = (worker.taskCount || 0) + 1;
        return worker;
    }

    async processSegment(buffer: Uint8Array, startPos: number, endPos: number): Promise<FrameEntry[]> {
        return new Promise((resolve, reject) => {
            const task = { buffer, startPos, endPos, resolve, reject };

            if (this.activeWorkers < this.maxWorkers) {
                this.runTask(task);
            } else {
                this.queue.push(task);
            }
        });
    }

    private runTask(task: { buffer: Uint8Array; startPos: number; endPos: number; resolve: (entries: FrameEntry[]) => void; reject: (error: any) => void; }) {
        const worker = this.getWorker();
        this.activeWorkers++;

        const handleMessage = (e: MessageEvent<FrameParseResponse>) => {
            if (e.data.error) {
                task.reject(new Error(e.data.error));
            } else {
                task.resolve(e.data.entries || []);
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

        // 发送任务到 worker
        const request: FrameParseRequest = {
            buffer: task.buffer,
            startPos: task.startPos,
            endPos: task.endPos
        };
        worker.postMessage(request);
    }

    terminate() {
        this.workers.forEach(worker => worker.terminate());
        this.workers = [];
        this.queue = [];
        this.activeWorkers = 0;
    }
}

// 创建全局 Worker Pool 实例
const workerPool = new FrameParserWorkerPool();

/**
 * 创建解析段
 */
function createParseSegments(bufferLength: number, segmentSize: number): Array<{ start: number; end: number }> {
    const segments: Array<{ start: number; end: number }> = [];

    for (let start = 0; start < bufferLength; start += segmentSize) {
        const end = Math.min(start + segmentSize, bufferLength);
        segments.push({ start, end });
    }

    return segments;
}

/**
 * 并行解析报文块 - 新的多线程版本
 * @param buffer 报文文件内容
 * @param startPos 起始位置
 * @param endPos 结束位置
 * @param segmentSize 分段大小，默认1MB
 */
export async function parseFrameChunkParallel(
    buffer: Uint8Array,
    startPos: number = 0,
    endPos: number = 0,
    segmentSize: number = 1024 * 1024 // 1MB
): Promise<{ entries: FrameEntry[], segments: number }> {
    // 输入验证和参数安全化
    if (!buffer || !(buffer instanceof Uint8Array)) {
        console.error('无效的buffer类型', typeof buffer);
        return { entries: [], segments: 0 };
    }

    const bufferLength = buffer.length;
    const safeStartPos = Math.max(0, startPos);
    const safeEndPos = endPos > 0 && endPos <= bufferLength ? endPos : bufferLength;

    if (bufferLength === 0 || safeEndPos <= safeStartPos) {
        console.warn('Buffer为空或无效的范围');
        return { entries: [], segments: 0 };
    }

    const actualLength = safeEndPos - safeStartPos;

    // 如果数据量较小，直接使用单线程处理
    if (actualLength < segmentSize) {
        console.log('数据量较小，使用单线程处理');
        const entries = await workerPool.processSegment(buffer, safeStartPos, safeEndPos);
        return { entries, segments: 1 };
    }

    // 创建解析段
    const segments = createParseSegments(actualLength, segmentSize).map(segment => ({
        start: segment.start + safeStartPos,
        end: segment.end + safeStartPos
    }));

    const segmentCount = segments.length;

    console.log(`将使用 ${segmentCount} 个段进行并行解析，总长度: ${actualLength} 字节`);

    try {
        // 并行处理所有段
        const segmentPromises = segments.map(segment =>
            workerPool.processSegment(buffer, segment.start, segment.end)
        );

        // 等待所有段处理完成
        const segmentResults = await Promise.all(segmentPromises);

        // 合并所有段的结果
        const allEntries = segmentResults.flat();

        // 按照时间戳排序确保顺序正确
        allEntries.sort((a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        console.log(`成功解析 ${allEntries.length} 个报文条目，使用了 ${segmentCount} 个段`);

        return { entries: allEntries, segments: segmentCount };
    } catch (error) {
        console.error('并行解析过程中发生错误:', error);
        return { entries: [], segments: 0 };
    }
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
    const state = store.getState();

    // 类型保护：确保 frameParse 属性存在
    if (!state.frameParse) {
        console.warn('frameParse state not available');
        return [];
    }

    const activeFilePath = state.frameParse.activeFilePath;
    if (!activeFilePath) return [];

    const fileContents = selectFrameFileContents(state, activeFilePath);
    if (!fileContents || !fileContents.chunks) return [];

    return Object.values(fileContents.chunks)
        .flatMap(chunk => chunk.content || [])
        .filter(entry => entry !== null && entry !== undefined);
}

// 获取当前过滤后的报文条目
export function getFilteredFrameEntries(): FrameEntry[] {
    const state = store.getState();

    // 类型保护：确保 frameParse 属性存在
    if (!state.frameParse) {
        console.warn('frameParse state not available');
        return [];
    }

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