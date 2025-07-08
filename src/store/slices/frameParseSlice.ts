import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../index';
import { FrameEntry } from '../../services/frameParser';
import { createAction } from '@reduxjs/toolkit';

export interface FrameFilter {
    port?: number | null;
    protocol?: number | null;
    direction?: number | null;
    startTime?: string | null;
    endTime?: string | null;
    minTime?: string | null;
    maxTime?: string | null;
}

export interface FrameFile {
    path: string;
    name: string;
    size: number;
    lastModified: number;
    isActive: boolean;
}

interface FrameChunk {
    content: FrameEntry[];
    startByte: number;
    endByte: number;
    timestamp: number;
}

interface FileContents {
    chunks: { [key: number]: FrameChunk };
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
        addFrameChunk: (state, action: PayloadAction<{
            path: string;
            chunk: number;
            content: FrameEntry[];
            startByte: number;
            endByte: number;
        }>) => {
            const { path, chunk, content, startByte, endByte } = action.payload;
            if (!state.fileContents[path]) {
                state.fileContents[path] = { chunks: {}, filters: {} };
            }
            state.fileContents[path].chunks[chunk] = {
                content,
                startByte,
                endByte,
                timestamp: Date.now()
            };
        },
        clearOldChunks: (state, action: PayloadAction<{
            maxAge: number;
            excludePath?: string;
        }>) => {
            const now = Date.now();
            Object.entries(state.fileContents).forEach(([path, contents]) => {
                if (path === action.payload.excludePath) return;
                
                Object.entries(contents.chunks).forEach(([chunk, chunkData]) => {
                    if (now - chunkData.timestamp > action.payload.maxAge) {
                        delete contents.chunks[Number(chunk)];
                    }
                });
            });
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
                state.fileContents[action.payload.path] = { chunks: {}, filters: {} };
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

export const selectFrameFileContents = (state: RootState, path: string) =>
    state.frameParse?.fileContents?.[path] || null;

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
    addFrameChunk,
    clearOldChunks,
    setFrameFilter,
    initializeFrameFilter,
    setLoading,
    setError
} = frameParseSlice.actions;

export default frameParseSlice.reducer;