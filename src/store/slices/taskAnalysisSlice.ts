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

export interface ColumnConfig {
    key: string;
    name: string;
    width: number;
    visible: boolean;
    order: number;
}

interface TaskAnalysisState {
    tasks: TaskData[];
    loading: boolean;
    error: string | null;
    isDragging: boolean;
    columnConfigs: ColumnConfig[];
    selectedTasks: number[];
}

const defaultColumns: ColumnConfig[] = [
    { key: 'task_id', name: '任务ID', width: 80, visible: true, order: 0 },
    { key: 'project_id', name: '项目ID', width: 80, visible: true, order: 1 },
    { key: 'project_type', name: '项目类型', width: 80, visible: true, order: 2 },
    { key: 'exec_cycle_unit', name: '执行周期单位', width: 100, visible: true, order: 3 },
    { key: 'exec_cycle', name: '执行周期', width: 80, visible: true, order: 4 },
    { key: 'begin_time', name: '开始时间', width: 150, visible: true, order: 5 },
    { key: 'end_time', name: '结束时间', width: 150, visible: true, order: 6 },
    { key: 'delay_unit', name: '延迟单位', width: 80, visible: true, order: 7 },
    { key: 'delay_time', name: '延迟时间', width: 80, visible: true, order: 8 },
    { key: 'priority', name: '优先级', width: 70, visible: true, order: 9 },
    { key: 'status', name: '状态', width: 70, visible: true, order: 10 },
    { key: 'before_script_id', name: '前置脚本ID', width: 100, visible: true, order: 11 },
    { key: 'after_script_id', name: '后置脚本ID', width: 100, visible: true, order: 12 },
    { key: 'exec_period', name: '执行区段', width: 150, visible: true, order: 13 },
    { key: 'task_cs', name: '任务校验和', width: 100, visible: true, order: 14 },
    { key: 'op_time', name: '操作时间', width: 150, visible: true, order: 15 },
    { key: 'depth', name: '深度', width: 70, visible: true, order: 16 },
    { key: 'acq_type', name: '采集类型', width: 80, visible: true, order: 17 },
    { key: 'acq_content', name: '采集内容', width: 150, visible: true, order: 18 },
    { key: 'acq_set', name: '采集设置', width: 150, visible: true, order: 19 },
    { key: 'td_option', name: 'TD选项', width: 80, visible: true, order: 20 },
    { key: 'project_cs', name: '项目校验和', width: 100, visible: true, order: 21 }
];

const initialState: TaskAnalysisState = {
    tasks: [],
    loading: false,
    error: null,
    isDragging: false,
    columnConfigs: defaultColumns,
    selectedTasks: []
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
        updateColumnWidth: (state, action: PayloadAction<{ key: string; width: number }>) => {
            const column = state.columnConfigs.find(c => c.key === action.payload.key);
            if (column) {
                column.width = action.payload.width;
            }
        },
        setIsDragging: (state, action: PayloadAction<boolean>) => {
            state.isDragging = action.payload;
        },
        clearTasks: (state) => {
            state.tasks = [];
            state.error = null;
            state.selectedTasks = [];
        },
        toggleColumnVisibility: (state, action: PayloadAction<string>) => {
            const column = state.columnConfigs.find(c => c.key === action.payload);
            if (column) {
                column.visible = !column.visible;
            }
        },
        setAllColumnsVisibility: (state, action: PayloadAction<boolean>) => {
            state.columnConfigs.forEach(column => {
                column.visible = action.payload;
            });
        },
        reorderColumns: (state, action: PayloadAction<{ sourceIndex: number; targetIndex: number }>) => {
            const { sourceIndex, targetIndex } = action.payload;
            const columns = [...state.columnConfigs];
            const [removed] = columns.splice(sourceIndex, 1);
            columns.splice(targetIndex, 0, removed);
            columns.forEach((column, index) => {
                column.order = index;
            });
            state.columnConfigs = columns;
        },
        toggleTaskSelection: (state, action: PayloadAction<number>) => {
            const taskId = action.payload;
            const index = state.selectedTasks.indexOf(taskId);
            if (index === -1) {
                state.selectedTasks.push(taskId);
            } else {
                state.selectedTasks.splice(index, 1);
            }
        },
        setAllTasksSelection: (state, action: PayloadAction<boolean>) => {
            if (action.payload) {
                state.selectedTasks = state.tasks.map(task => task.task_id);
            } else {
                state.selectedTasks = [];
            }
        }
    }
});

export const {
    setTasks,
    setLoading,
    setError,
    updateColumnWidth,
    setIsDragging,
    clearTasks,
    toggleColumnVisibility,
    setAllColumnsVisibility,
    reorderColumns,
    toggleTaskSelection,
    setAllTasksSelection
} = taskAnalysisSlice.actions;

// 选择器
export const selectTasks = (state: RootState) => state.taskAnalysis.tasks;
export const selectLoading = (state: RootState) => state.taskAnalysis.loading;
export const selectError = (state: RootState) => state.taskAnalysis.error;
export const selectColumnConfigs = (state: RootState) => state.taskAnalysis.columnConfigs;
export const selectIsDragging = (state: RootState) => state.taskAnalysis.isDragging;
export const selectSelectedTasks = (state: RootState) => state.taskAnalysis.selectedTasks;

export default taskAnalysisSlice.reducer;