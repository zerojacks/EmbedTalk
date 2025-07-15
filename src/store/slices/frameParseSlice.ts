import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../index';
import { FrameEntry } from '../../types/frameTypes';

export interface FrameFilter {
    pid?: number | null;
    tag?: number | null;
    port?: number | null;
    protocol?: number | null;
    direction?: number | null;
    startTime?: string | null;
    endTime?: string | null;
    minTime?: string | null;
    maxTime?: string | null;
    contentKeyword?: string | null;
}

export interface FrameFile {
    path: string;
    name: string;
    size: number;
    lastModified: number;
    isActive: boolean;
}

interface FileContents {
    entries: FrameEntry[];  // 直接存储所有报文条目
    filters: FrameFilter;
}

interface FrameParseState {
    openFiles: FrameFile[];
    activeFilePath: string | null;
    fileContents: { [key: string]: FileContents };
    isLoading: boolean;
    error: string | null;
}

const initialState: FrameParseState = {
    openFiles: [],
    activeFilePath: null,
    fileContents: {},
    isLoading: false,
    error: null
};

export const frameParseSlice = createSlice({
    name: 'frameParse',
    initialState,
    reducers: {
        addFrameFile: (state, action: PayloadAction<FrameFile>) => {
            if (!state.openFiles.find(file => file.path === action.payload.path)) {
                state.openFiles.push(action.payload);
            }
        },
        removeFrameFile: (state, action: PayloadAction<string>) => {
            state.openFiles = state.openFiles.filter(file => file.path !== action.payload);
            delete state.fileContents[action.payload];
            if (state.activeFilePath === action.payload) {
                state.activeFilePath = state.openFiles[0]?.path || null;
            }
        },
        setActiveFrameFile: (state, action: PayloadAction<string>) => {
            state.activeFilePath = action.payload;
            state.openFiles.forEach(file => {
                file.isActive = file.path === action.payload;
            });
        },
        addFrameEntries: (state, action: PayloadAction<{
            path: string;
            entries: FrameEntry[];
        }>) => {
            const { path, entries } = action.payload;

            // 清理旧的数据结构 - 使用类型断言来检查旧格式
            if (state.fileContents[path] && 'chunks' in (state.fileContents[path] as any)) {
                delete state.fileContents[path];
            }

            if (!state.fileContents[path]) {
                state.fileContents[path] = { entries: [], filters: {} };
            }
            state.fileContents[path].entries = entries;
        },

        setFrameFilter: (state, action: PayloadAction<{
            path: string;
            filter: Partial<FrameFilter>;
        }>) => {
            if (state.fileContents[action.payload.path]) {
                state.fileContents[action.payload.path].filters = {
                    ...state.fileContents[action.payload.path].filters,
                    ...action.payload.filter
                };
            }
        },
        initializeFrameFilter: (state, action: PayloadAction<{
            path: string;
            minTime?: string;
            maxTime?: string;
            startTime?: string;
            endTime?: string;
        }>) => {
            if (!state.fileContents[action.payload.path]) {
                state.fileContents[action.payload.path] = { entries: [], filters: {} };
            }
            state.fileContents[action.payload.path].filters = {
                ...state.fileContents[action.payload.path].filters,
                minTime: action.payload.minTime,
                maxTime: action.payload.maxTime
            };
        },
        setLoading: (state, action: PayloadAction<boolean>) => {
            state.isLoading = action.payload;
        },
        setError: (state, action: PayloadAction<string | null>) => {
            state.error = action.payload;
        }
    }
});

// Selectors with type guards for Redux Persist compatibility
export const selectOpenFrameFiles = (state: RootState) =>
    state.frameParse?.openFiles || [];

export const selectActiveFrameFilePath = (state: RootState) =>
    state.frameParse?.activeFilePath || null;

export const selectActiveFrameFile = (state: RootState) => {
    if (!state.frameParse?.openFiles || !state.frameParse?.activeFilePath) return undefined;
    return state.frameParse.openFiles.find(file => file.path === state.frameParse.activeFilePath);
};

// 用于跟踪已经警告过的文件，避免重复警告
const warnedFrameFiles = new Set<string>();

export const selectFrameFileContents = (state: RootState, path: string) => {
    const contents = state.frameParse?.fileContents?.[path];

    // 数据迁移：如果是旧的chunks结构，返回null以触发重新解析
    if (contents && 'chunks' in (contents as any)) {
        if (!warnedFrameFiles.has(path)) {
            console.warn(`检测到旧的数据结构，清除缓存: ${path}`);
            warnedFrameFiles.add(path);
        }
        return null;
    }

    // 确保entries属性存在
    if (contents && !contents.entries) {
        if (!warnedFrameFiles.has(path)) {
            console.warn(`检测到无效的数据结构，清除缓存: ${path}`);
            warnedFrameFiles.add(path);
        }
        return null;
    }

    return contents || null;
};

export const selectFrameFilter = (state: RootState) => {
    const path = state.frameParse?.activeFilePath;
    if (!path || !state.frameParse?.fileContents) {
        return {
            port: null,
            protocol: null,
            direction: null,
            startTime: null,
            endTime: null,
            minTime: null,
            maxTime: null
        } as FrameFilter;
    }
    return state.frameParse.fileContents[path]?.filters || {
        port: null,
        protocol: null,
        direction: null,
        startTime: null,
        endTime: null,
        minTime: null,
        maxTime: null
    } as FrameFilter;
};

export const selectIsLoading = (state: RootState) =>
    state.frameParse?.isLoading || false;

export const selectError = (state: RootState) =>
    state.frameParse?.error || null;

export const {
    addFrameFile,
    removeFrameFile,
    setActiveFrameFile,
    addFrameEntries,
    setFrameFilter,
    initializeFrameFilter,
    setLoading,
    setError
} = frameParseSlice.actions;

export default frameParseSlice.reducer;