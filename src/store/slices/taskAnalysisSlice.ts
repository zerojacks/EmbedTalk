import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '..';

export interface TaskData {
    task_id: number;
    project_id: number;
    project_type: number;
    exec_cycle_unit: number;
    exec_cycle: number;
    begin_time: number;
    end_time: number;
    delay_unit: number;
    delay_time: number;
    priority: number;
    status: number;
    before_script_id: number;
    after_script_id: number;
    exec_period: string;
    task_cs: number;
    op_time: number;
    depth: number;
    acq_type: number;
    acq_content: string;
    acq_set: string;
    td_option: number;
    project_cs: number;
}

interface TaskAnalysisState {
    tasks: TaskData[];
    loading: boolean;
    error: string | null;
    columnWidths: { [key: string]: number };
    isDragging: boolean;
}

const initialState: TaskAnalysisState = {
    tasks: [],
    loading: false,
    error: null,
    columnWidths: {},
    isDragging: false
};

export const taskAnalysisSlice = createSlice({
    name: 'taskAnalysis',
    initialState,
    reducers: {
        setTasks: (state, action: PayloadAction<TaskData[]>) => {
            state.tasks = action.payload;
        },
        setLoading: (state, action: PayloadAction<boolean>) => {
            state.loading = action.payload;
        },
        setError: (state, action: PayloadAction<string | null>) => {
            state.error = action.payload;
        },
        setColumnWidths: (state, action: PayloadAction<{ [key: string]: number }>) => {
            state.columnWidths = action.payload;
        },
        updateColumnWidth: (state, action: PayloadAction<{ key: string; width: number }>) => {
            state.columnWidths[action.payload.key] = action.payload.width;
        },
        setIsDragging: (state, action: PayloadAction<boolean>) => {
            state.isDragging = action.payload;
        },
        clearTasks: (state) => {
            state.tasks = [];
            state.error = null;
        }
    }
});

export const {
    setTasks,
    setLoading,
    setError,
    setColumnWidths,
    updateColumnWidth,
    setIsDragging,
    clearTasks
} = taskAnalysisSlice.actions;

// 选择器
export const selectTasks = (state: RootState) => state.taskAnalysis.tasks;
export const selectLoading = (state: RootState) => state.taskAnalysis.loading;
export const selectError = (state: RootState) => state.taskAnalysis.error;
export const selectColumnWidths = (state: RootState) => state.taskAnalysis.columnWidths;
export const selectIsDragging = (state: RootState) => state.taskAnalysis.isDragging;

export default taskAnalysisSlice.reducer;