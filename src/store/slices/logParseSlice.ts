import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../store';
import { createAction } from '@reduxjs/toolkit';

// 日志条目接口定义
export interface LogEntry {
    id: string;
    pid?: string;
    tid?: string;
    func?: string;
    line?: string;
    timeStamp: string;
    level?: string;
    tag?: string;
    message?: string;
    rawData?: string;
}

// 日志文件接口
export interface LogFile {
    path: string;
    name: string;
    size: number;
    lastModified: number;
    isActive: boolean;
}

// 日志块接口
export interface LogChunk {
    content: LogEntry[];
    startByte: number;
    endByte: number;
    lastAccessed: number;
}

// 日志文件内容
export interface LogFileContents {
    chunks: { [key: number]: LogChunk };
    filter: LogFilter;
    minTime?: string;  // 保存完整的时间戳（包含毫秒）
    maxTime?: string;  // 保存完整的时间戳（包含毫秒）
}

// 过滤器接口
export interface LogFilter {
    level?: string;
    tag?: string;
    keyword?: string;
    startTime?: string;
    endTime?: string;
    pid?: string;
    tid?: string;
}

// 状态接口
interface LogParseState {
    openFiles: LogFile[];
    activeFilePath: string | null;
    fileContents: { [path: string]: LogFileContents };
    fileFilters: { [path: string]: LogFilter };
    isLoading: boolean;
    error: string | null;
}

// 初始状态
const initialState: LogParseState = {
    openFiles: [],
    activeFilePath: null,
    fileContents: {},
    fileFilters: {},
    isLoading: false,
    error: null
};

// 创建 slice
const logParseSlice = createSlice({
    name: 'logParse',
    initialState,
    reducers: {
        // 添加文件
        addLogFile: (state, action: PayloadAction<LogFile>) => {
            const file = action.payload;
            if (!state.fileContents[file.path]) {
                state.fileContents[file.path] = {
                    chunks: {},
                    filter: {
                        level: undefined,
                        tag: undefined,
                        keyword: undefined,
                        startTime: undefined,
                        endTime: undefined,
                        pid: undefined,
                        tid: undefined
                    }
                };
            }
            state.openFiles.push(file);
        },
        
        // 移除文件
        removeLogFile: (state, action: PayloadAction<string>) => {
            const path = action.payload;
            state.openFiles = state.openFiles.filter(file => file.path !== path);
            if (state.fileContents[path]) {
                state.fileContents[path] = {
                    chunks: {},
                    filter: {
                        level: undefined,
                        tag: undefined,
                        keyword: undefined,
                        startTime: undefined,
                        endTime: undefined,
                        pid: undefined,
                        tid: undefined
                    }
                };
            }
            if (state.activeFilePath === path) {
                state.activeFilePath = state.openFiles[0]?.path || null;
            }
        },
        
        // 设置活动文件
        setActiveLogFile: (state, action: PayloadAction<string>) => {
            // 更新所有文件的活动状态
            state.openFiles.forEach(file => {
                file.isActive = file.path === action.payload;
            });
            state.activeFilePath = action.payload;
        },
        
        // 添加日志块
        addLogChunk: (state, action: PayloadAction<{
            path: string;
            chunk: number;
            content: LogEntry[];
            startByte: number;
            endByte: number;
        }>) => {
            const { path, chunk, content, startByte, endByte } = action.payload;
            if (!state.fileContents[path]) {
                state.fileContents[path] = {
                    chunks: {},
                    filter: {
                        level: undefined,
                        tag: undefined,
                        keyword: undefined,
                        startTime: undefined,
                        endTime: undefined,
                        pid: undefined,
                        tid: undefined
                    }
                };
            }
            state.fileContents[path].chunks[chunk] = {
                content,
                startByte,
                endByte,
                lastAccessed: Date.now()
            };
        },
        
        // 清除旧的日志块 - 增强版本，支持排除当前活动文件
        clearOldChunks: (state, action: PayloadAction<{
            maxAge: number;
            excludePath?: string;
        }>) => {
            const now = Date.now();
            Object.entries(state.fileContents).forEach(([path, fileContent]) => {
                if (path === action.payload.excludePath) return;
                
                Object.entries(fileContent.chunks).forEach(([chunkIndex, chunk]) => {
                    if (now - chunk.lastAccessed > action.payload.maxAge) {
                        delete fileContent.chunks[Number(chunkIndex)];
                    }
                });
            });
        },
        
        // 设置过滤器
        setLogFilter: (state, action: PayloadAction<{
            path: string;
            filter: Partial<LogFilter>;
        }>) => {
            const { path, filter } = action.payload;
            state.fileFilters[path] = { ...state.fileFilters[path], ...filter };
        },
        
        // 初始化文件过滤器
        initializeFileFilter: (state, action: PayloadAction<{
            path: string;
            minTime?: string;
            maxTime?: string;
        }>) => {
            const { path, minTime, maxTime } = action.payload;
            state.fileFilters[path] = {
                level: undefined,
                tag: undefined,
                keyword: undefined,
                startTime: undefined,
                endTime: undefined,
                pid: undefined,
                tid: undefined
            };
        },
        
        // 设置加载状态
        setLoading: (state, action: PayloadAction<boolean>) => {
            state.isLoading = action.payload;
        },
        
        // 设置错误信息
        setError: (state, action: PayloadAction<string | null>) => {
            state.error = action.payload;
        }
    }
});

// 导出 actions
export const {
    addLogFile,
    removeLogFile,
    setActiveLogFile,
    addLogChunk,
    clearOldChunks,
    setLogFilter,
    initializeFileFilter,
    setLoading,
    setError
} = logParseSlice.actions;

// 选择器
export const selectOpenLogFiles = (state: RootState) => state.logParse.openFiles;
export const selectActiveLogFilePath = (state: RootState) => state.logParse.activeFilePath;
export const selectActiveLogFile = (state: RootState) => 
    state.logParse.openFiles.find(file => file.path === state.logParse.activeFilePath);
export const selectLogFileContents = (state: RootState, path: string) => 
    state.logParse.fileContents[path];
export const selectLogFilter = (state: RootState, path: string) => 
    state.logParse.fileFilters[path] || {};
export const selectIsLoading = (state: RootState) => state.logParse.isLoading;
export const selectError = (state: RootState) => state.logParse.error;

// 导出 reducer
export default logParseSlice.reducer;
