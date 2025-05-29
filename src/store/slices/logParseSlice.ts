import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '..';

// 日志条目接口定义
export interface LogEntry {
    id: string;           // 唯一标识符
    timeStamp: string;    // 时间戳
    level: string | null;        // 日志级别
    tag: string | null;          // 标签
    pid: string | null;          // 进程ID
    tid: string | null;          // 线程ID
    func: string | null;         // 函数名
    line: number | null;         // 行号
    message: string | null;      // 日志消息内容
    rawData: string;          // 原始日志行
}

// 日志文件接口
export interface LogFile {
    path: string;         // 文件路径
    name: string;         // 文件名
    size: number;         // 文件大小
    lastModified: number; // 最后修改时间
    isActive: boolean;    // 是否为活动文件
}

// 日志块接口
export interface LogChunk {
    startByte: number;    // 起始字节
    endByte: number;      // 结束字节
    content: LogEntry[];  // 日志条目
    timestamp: number;    // 加载时间戳
}

// 日志文件内容
export interface LogFileContent {
    path: string;                     // 文件路径
    totalSize: number;                // 总大小
    chunks: Record<number, LogChunk>; // 日志块，键为块索引
    lastAccessed: number;             // 最后访问时间
}

// 过滤器接口
export interface LogFilter {
    level: string | null;             // 日志级别
    tag: string | null;               // 标签
    keyword: string | null;           // 关键字
    startTime: string | null;         // 开始时间
    endTime: string | null;           // 结束时间
}

// 状态接口
interface LogParseState {
    openFiles: LogFile[];                       // 打开的文件
    fileContents: Record<string, LogFileContent>; // 文件内容，键为文件路径
    activeFilePath: string | null;              // 活动文件路径
    fileFilters: Record<string, LogFilter>;     // 每个文件的过滤器，键为文件路径
    filter: LogFilter;                          // 当前活动的过滤器
    isLoading: boolean;                         // 是否正在加载
    error: string | null;                       // 错误信息
}

// 初始状态
const initialState: LogParseState = {
    openFiles: [],
    fileContents: {},
    activeFilePath: null,
    fileFilters: {},
    filter: {
        level: null,
        tag: null,
        keyword: null,
        startTime: null,
        endTime: null
    },
    isLoading: false,
    error: null
};

// 创建 slice
export const logParseSlice = createSlice({
    name: 'logParse',
    initialState,
    reducers: {
        // 添加文件
        addLogFile: (state, action: PayloadAction<LogFile>) => {
            const existingFile = state.openFiles.find(file => file.path === action.payload.path);
            if (!existingFile) {
                state.openFiles.push(action.payload);
                
                // 如果是第一个文件，设置为活动文件
                if (state.openFiles.length === 1) {
                    state.activeFilePath = action.payload.path;
                    state.openFiles[0].isActive = true;
                }
            }
        },
        
        // 移除文件
        removeLogFile: (state, action: PayloadAction<string>) => {
            const index = state.openFiles.findIndex(file => file.path === action.payload);
            if (index !== -1) {
                state.openFiles.splice(index, 1);
                
                // 如果删除的是活动文件，设置新的活动文件
                if (action.payload === state.activeFilePath) {
                    if (state.openFiles.length > 0) {
                        state.activeFilePath = state.openFiles[0].path;
                        state.openFiles[0].isActive = true;
                    } else {
                        state.activeFilePath = null;
                    }
                }
                
                // 从文件内容中删除
                if (state.fileContents[action.payload]) {
                    delete state.fileContents[action.payload];
                }
            }
        },
        
        // 设置活动文件
        setActiveLogFile: (state, action: PayloadAction<string>) => {
            if (state.activeFilePath !== action.payload) {
                // 先保存当前文件的过滤器状态
                if (state.activeFilePath) {
                    state.fileFilters[state.activeFilePath] = { ...state.filter };
                }
                
                // 重置当前活动文件
                state.openFiles.forEach(file => {
                    file.isActive = file.path === action.payload;
                });
                state.activeFilePath = action.payload;
                
                // 加载新文件的过滤器状态
                if (state.fileFilters[action.payload]) {
                    state.filter = { ...state.fileFilters[action.payload] };
                }
                
                // 更新文件内容的最后访问时间，以便缓存管理
                if (state.fileContents[action.payload]) {
                    state.fileContents[action.payload].lastAccessed = Date.now();
                }
            }
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
            
            // 如果文件内容不存在，创建它
            if (!state.fileContents[path]) {
                state.fileContents[path] = {
                    path,
                    totalSize: 0,
                    chunks: {},
                    lastAccessed: Date.now()
                };
            }
            
            // 更新文件内容
            state.fileContents[path].chunks[chunk] = {
                startByte,
                endByte,
                content,
                timestamp: Date.now()
            };
            
            // 更新总大小
            state.fileContents[path].totalSize = Math.max(
                state.fileContents[path].totalSize,
                endByte
            );
            
            // 更新最后访问时间
            state.fileContents[path].lastAccessed = Date.now();
        },
        
        // 清除旧的日志块 - 增强版本，支持排除当前活动文件
        clearOldChunks: (state, action: PayloadAction<number | { maxAge: number, excludePath?: string }>) => {
            // 支持两种参数形式：简单的数字或带排除路径的对象
            let maxAge: number;
            let excludePath: string | undefined;
            
            if (typeof action.payload === 'number') {
                maxAge = action.payload;
            } else {
                maxAge = action.payload.maxAge;
                excludePath = action.payload.excludePath;
            }
            
            const now = Date.now();
            
            // 遍历所有文件内容
            Object.keys(state.fileContents).forEach(path => {
                // 如果是活动文件或指定排除的文件，不清理
                if (path === state.activeFilePath || path === excludePath) {
                    return;
                }
                
                const fileContent = state.fileContents[path];
                
                // 如果文件最后访问时间超过最大年龄，删除所有块
                if (now - fileContent.lastAccessed > maxAge) {
                    Object.keys(fileContent.chunks).forEach(chunkKey => {
                        const chunk = fileContent.chunks[Number(chunkKey)];
                        if (now - chunk.timestamp > maxAge) {
                            delete fileContent.chunks[Number(chunkKey)];
                        }
                    });
                }
            });
        },
        
        // 设置过滤器
        setLogFilter: (state, action: PayloadAction<Partial<LogFilter>>) => {
            state.filter = { ...state.filter, ...action.payload };
            
            // 如果有活动文件，同时更新该文件的过滤器
            if (state.activeFilePath) {
                state.fileFilters[state.activeFilePath] = { ...state.filter };
            }
        },
        
        // 初始化文件过滤器
        initializeFileFilter: (state, action: PayloadAction<{
            path: string;
            minTime?: string;
            maxTime?: string;
        }>) => {
            const { path, minTime, maxTime } = action.payload;
            
            // 创建默认过滤器：级别和标签为“全部”，关键字为空，时间范围为文件的最小和最大时间
            state.fileFilters[path] = {
                level: null, // null 表示“全部”
                tag: null,   // null 表示“全部”
                keyword: null,
                startTime: minTime || null,
                endTime: maxTime || null
            };
            
            // 如果这是当前活动文件，也更新当前过滤器
            if (state.activeFilePath === path) {
                state.filter = { ...state.fileFilters[path] };
            }
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
export const selectActiveLogFile = (state: RootState) => {
    const activeFilePath = state.logParse.activeFilePath;
    return activeFilePath ? state.logParse.openFiles.find(file => file.path === activeFilePath) : null;
};
export const selectLogFileContents = (state: RootState, path: string) => state.logParse.fileContents[path] || null;
export const selectLogFilter = (state: RootState) => state.logParse.filter;
export const selectIsLoading = (state: RootState) => state.logParse.isLoading;
export const selectError = (state: RootState) => state.logParse.error;

// 导出 reducer
export default logParseSlice.reducer;
