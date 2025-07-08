import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '../index';

export interface FileChunk {
    content: string;
    startByte: number;
    endByte: number;
}

export interface FileContents {
    chunks: Record<number, FileChunk>;
    chunkSize: number;
    lastAccessed: number;
}

export interface FileTab {
    path: string;
    name: string;
    encoding: 'text' | 'binary' | 'hex';
    viewMode: 'text' | 'hex' | 'auto';
    size?: number;
    lastModified?: number;
    isModified?: boolean;
    loadedRanges?: Array<{ start: number; end: number }>;
    totalLines?: number;
}

interface FileParseState {
    openFiles: FileTab[];
    activeTabPath: string;
    isLoading: boolean;
    error: string | null;
    fileContents: Record<string, FileContents>;
}

const initialState: FileParseState = {
    openFiles: [],
    activeTabPath: '',
    isLoading: false,
    error: null,
    fileContents: {}
};

const fileParseSlice = createSlice({
    name: 'fileParse',
    initialState,
    reducers: {
        addFile: (state, action: PayloadAction<FileTab>) => {
            const fileToAdd = {
                ...action.payload,
                isModified: false,
                lastModified: Date.now()
            };
            
            const existingFileIndex = state.openFiles.findIndex(
                file => file.path === action.payload.path
            );
            
            if (existingFileIndex === -1) {
                state.openFiles.push(fileToAdd);
            } else {
                state.openFiles[existingFileIndex] = fileToAdd;
            }
            
            state.activeTabPath = action.payload.path;
            state.error = null;
        },
        
        removeFile: (state, action: PayloadAction<string>) => {
            state.openFiles = state.openFiles.filter(file => file.path !== action.payload);
            
            if (state.activeTabPath === action.payload) {
                state.activeTabPath = state.openFiles[0]?.path || '';
            }
        },
        
        updateFileContent: (state, action: PayloadAction<{
            path: string;
            isModified: boolean;
        }>) => {
            const file = state.openFiles.find(f => f.path === action.payload.path);
            if (file) {
                file.isModified = action.payload.isModified;
                file.lastModified = Date.now();
            }
        },
        
        setActiveTab: (state, action: PayloadAction<string>) => {
            const tabExists = state.openFiles.some(file => file.path === action.payload);
            if (tabExists) {
                state.activeTabPath = action.payload;
                state.error = null;
            }
        },
        
        setLoading: (state, action: PayloadAction<boolean>) => {
            state.isLoading = action.payload;
            if (action.payload) {
                state.error = null;
            }
        },
        
        setError: (state, action: PayloadAction<string | null>) => {
            state.error = action.payload;
            state.isLoading = false;
        },
        
        markFileSaved: (state, action: PayloadAction<string>) => {
            const file = state.openFiles.find(f => f.path === action.payload);
            if (file) {
                file.isModified = false;
                file.lastModified = Date.now();
            }
        },
        
        setFiles: (state, action: PayloadAction<FileTab[]>) => {
            state.openFiles = action.payload;
            
            if (!state.openFiles.some(file => file.path === state.activeTabPath)) {
                state.activeTabPath = state.openFiles[0]?.path || '';
            }
        },
        
        addFileChunk: (state, action: PayloadAction<{
            path: string;
            chunk: number;
            content: string;
            chunkSize: number;
            startByte: number;
            endByte: number;
        }>) => {
            const { path, chunk, content, chunkSize, startByte, endByte } = action.payload;
            if (!state.fileContents[path]) {
                state.fileContents[path] = {
                    chunks: {},
                    chunkSize,
                    lastAccessed: Date.now()
                };
            }
            state.fileContents[path].chunks[chunk] = {
                content,
                startByte,
                endByte
            };
            state.fileContents[path].lastAccessed = Date.now();
        },
        
        clearOldChunks: (state, action: PayloadAction<number>) => {
            const now = Date.now();
            const maxAge = action.payload;
            
            Object.entries(state.fileContents).forEach(([path, content]) => {
                if (now - content.lastAccessed > maxAge) {
                    delete state.fileContents[path];
                }
            });
        },
        
        setViewMode: (state, action: PayloadAction<{
            path: string;
            mode: 'text' | 'hex' | 'auto';
        }>) => {
            const file = state.openFiles.find(f => f.path === action.payload.path);
            if (file) {
                file.viewMode = action.payload.mode;
            }
        }
    }
});

export const { 
    addFile, 
    removeFile, 
    updateFileContent, 
    setActiveTab, 
    setLoading,
    setError,
    markFileSaved,
    setFiles,
    addFileChunk,
    clearOldChunks,
    setViewMode
} = fileParseSlice.actions;

export const selectOpenFiles = (state: RootState) => state.fileParse.openFiles;
export const selectActiveTabPath = (state: RootState) => state.fileParse.activeTabPath;
export const selectActiveFile = (state: RootState) => 
    state.fileParse.openFiles.find(file => file.path === state.fileParse.activeTabPath);
export const selectFileContents = (state: RootState, path: string) => 
    state.fileParse.fileContents[path];
export const selectIsLoading = (state: RootState) => state.fileParse.isLoading;
export const selectError = (state: RootState) => state.fileParse.error;
export const selectModifiedFiles = (state: RootState) => 
    state.fileParse.openFiles.filter(file => file.isModified);

export default fileParseSlice.reducer;