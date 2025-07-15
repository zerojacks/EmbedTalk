import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../index';
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

// 日志文件内容
export interface LogFileContents {
    entries: LogEntry[];  // 直接存储所有日志条目
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

            // 检查文件是否已经在打开列表中，避免重复添加
            const existingFileIndex = state.openFiles.findIndex(f => f.path === file.path);
            if (existingFileIndex !== -1) {
                // 如果文件已存在，更新文件信息而不是添加新的
                state.openFiles[existingFileIndex] = file;
                return;
            }

            // 初始化文件内容存储
            if (!state.fileContents[file.path]) {
                state.fileContents[file.path] = {
                    entries: [],
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

            // 添加新文件到打开列表
            state.openFiles.push(file);
        },
        
        // 移除文件
        removeLogFile: (state, action: PayloadAction<string>) => {
            const path = action.payload;
            state.openFiles = state.openFiles.filter(file => file.path !== path);
            // 完全删除文件内容和过滤器，释放内存
            delete state.fileContents[path];
            delete state.fileFilters[path];
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
        
        // 添加日志条目
        addLogEntries: (state, action: PayloadAction<{
            path: string;
            entries: LogEntry[];
        }>) => {
            const { path, entries } = action.payload;

            // 清理旧的数据结构 - 使用类型断言来检查旧格式
            if (state.fileContents[path] && 'chunks' in (state.fileContents[path] as any)) {
                delete state.fileContents[path];
            }

            if (!state.fileContents[path]) {
                state.fileContents[path] = {
                    entries: [],
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
            state.fileContents[path].entries = entries;
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
    addLogEntries,
    setLogFilter,
    initializeFileFilter,
    setLoading,
    setError
} = logParseSlice.actions;

// 选择器 - 添加类型保护以兼容 Redux Persist
export const selectOpenLogFiles = (state: RootState) =>
    state.logParse?.openFiles || [];

export const selectActiveLogFilePath = (state: RootState) =>
    state.logParse?.activeFilePath || null;

export const selectActiveLogFile = (state: RootState) => {
    if (!state.logParse?.openFiles || !state.logParse?.activeFilePath) return undefined;
    return state.logParse.openFiles.find((file: LogFile) => file.path === state.logParse.activeFilePath);
};

// 用于跟踪已经警告过的文件，避免重复警告
const warnedFiles = new Set<string>();

export const selectLogFileContents = (state: RootState, path: string) => {
    const contents = state.logParse?.fileContents?.[path];

    // 数据迁移：如果是旧的chunks结构，返回null以触发重新解析
    if (contents && 'chunks' in (contents as any)) {
        if (!warnedFiles.has(path)) {
            console.warn(`检测到旧的数据结构，清除缓存: ${path}`);
            warnedFiles.add(path);
        }
        return null;
    }

    // 确保entries属性存在
    if (contents && !contents.entries) {
        if (!warnedFiles.has(path)) {
            console.warn(`检测到无效的数据结构，清除缓存: ${path}`);
            warnedFiles.add(path);
        }
        return null;
    }

    return contents || null;
};

export const selectLogFilter = (state: RootState, path: string) =>
    state.logParse?.fileFilters?.[path] || {};

export const selectIsLoading = (state: RootState) =>
    state.logParse?.isLoading || false;

export const selectError = (state: RootState) =>
    state.logParse?.error || null;

// 导出 reducer
export default logParseSlice.reducer;
