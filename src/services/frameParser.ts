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
            endPos: task.endPos,
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
 * 解析整个报文文件
 * @param buffer 报文文件内容
 * @returns 解析结果
 */
export async function parseFrameFile(buffer: Uint8Array): Promise<FrameEntry[]> {
    // 输入验证
    if (!buffer || !(buffer instanceof Uint8Array)) {
        console.error('无效的buffer类型', typeof buffer);
        return [];
    }

    if (buffer.length === 0) {
        console.warn('Buffer为空');
        return [];
    }

    try {
        console.log(`开始解析报文文件，大小: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);

        // 解析整个文件，分段逻辑在worker中处理
        const entries = await workerPool.processSegment(buffer, 0, buffer.length);

        console.log(`报文解析完成，找到 ${entries.length} 个条目`);

        return entries;
    } catch (error) {
        console.error('解析过程中发生错误:', error);
        return [];
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
    if (!fileContents || !fileContents.entries) return [];

    return fileContents.entries.filter(entry => entry !== null && entry !== undefined);
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