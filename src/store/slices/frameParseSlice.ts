import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../store';
import { FrameEntry } from '../../services/frameParser';

export interface FrameFile {
    path: string;
    name: string;
    size: number;
    lastModified: number;
    isActive: boolean;
}

export interface FrameFilter {
    port: number | null;
    protocol: number | null;
    direction: number | null;
    startTime: string | null;
    endTime: string | null;
}

interface FrameChunk {
    content: FrameEntry[];
    startByte: number;
    endByte: number;
    timestamp: number;
}

interface FrameFileContents {
    chunks: { [key: number]: FrameChunk };
    filter: FrameFilter;
}

interface FrameParseState {
    openFiles: FrameFile[];
    activeFilePath: string | null;
    fileContents: { [key: string]: FrameFileContents };
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

const frameParseSlice = createSlice({
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
            state.openFiles = state.openFiles.map(file => ({
                ...file,
                isActive: file.path === action.payload
            }));
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
                state.fileContents[path] = { chunks: {}, filter: { port: null, protocol: null, direction: null, startTime: null, endTime: null } };
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
            const { maxAge, excludePath } = action.payload;
            const now = Date.now();
            Object.keys(state.fileContents).forEach(path => {
                if (path === excludePath) return;
                Object.keys(state.fileContents[path].chunks).forEach(chunkKey => {
                    const chunk = state.fileContents[path].chunks[Number(chunkKey)];
                    if (now - chunk.timestamp > maxAge) {
                        delete state.fileContents[path].chunks[Number(chunkKey)];
                    }
                });
            });
        },
        setFrameFilter: (state, action: PayloadAction<{
            path: string;
            filter: Partial<FrameFilter>;
        }>) => {
            const { path, filter } = action.payload;
            if (!state.fileContents[path]) {
                state.fileContents[path] = { 
                    chunks: {},
                    filter: { port: null, protocol: null, direction: null, startTime: null, endTime: null }
                };
            }
            state.fileContents[path].filter = {
                ...state.fileContents[path].filter,
                ...filter
            };
        },
        initializeFrameFilter: (state, action: PayloadAction<{
            path: string;
            minTime?: string;
            maxTime?: string;
        }>) => {
            const { path, minTime, maxTime } = action.payload;
            state.fileContents[path] = {
                chunks: {},
                filter: {
                    port: null,
                    protocol: null,
                    direction: null,
                    startTime: minTime || null,
                    endTime: maxTime || null
                }
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

// Selectors
export const selectOpenFrameFiles = (state: RootState) => state.frameParse.openFiles;
export const selectActiveFrameFilePath = (state: RootState) => state.frameParse.activeFilePath;
export const selectActiveFrameFile = (state: RootState) => 
    state.frameParse.openFiles.find(f => f.path === state.frameParse.activeFilePath);
export const selectFrameFileContents = (state: RootState, path: string) => state.frameParse.fileContents[path];
export const selectFrameFilter = (state: RootState) => {
    const path = state.frameParse.activeFilePath;
    return path ? state.frameParse.fileContents[path]?.filter : null;
};
export const selectIsLoading = (state: RootState) => state.frameParse.isLoading;
export const selectError = (state: RootState) => state.frameParse.error;

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