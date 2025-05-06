import React, { useEffect } from 'react';
import { save, open } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { FaArrowLeft, FaFileExport, FaDatabase } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { listen } from '@tauri-apps/api/event';
import type { UnlistenFn } from '@tauri-apps/api/event';
import { useDbWorker } from '../hooks/useDbWorker';
import { DataGrid } from 'react-data-grid';
import 'react-data-grid/lib/styles.css';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
    setTasks,
    setLoading,
    setError,
    updateColumnWidth,
    setIsDragging,
    clearTasks,
    selectTasks,
    selectLoading,
    selectError,
    selectColumnWidths,
    selectIsDragging,
    TaskData
} from '../store/slices/taskAnalysisSlice';

const TaskAnalysis: React.FC = () => {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const tasks = useAppSelector(selectTasks);
    const loading = useAppSelector(selectLoading);
    const error = useAppSelector(selectError);
    const columnWidths = useAppSelector(selectColumnWidths);
    const isDragging = useAppSelector(selectIsDragging);
    const [unlistenFns, setUnlistenFns] = React.useState<UnlistenFn[]>([]);
    const { loadDatabase, closeDatabase } = useDbWorker();

    // 定义表格列配置
    const columns = [
        { key: 'task_id', name: '任务ID', resizable: true, width: columnWidths['task_id'] || 80 },
        { key: 'project_id', name: '项目ID', resizable: true, width: columnWidths['project_id'] || 80 },
        { key: 'project_type', name: '项目类型', resizable: true, width: columnWidths['project_type'] || 80 },
        { key: 'exec_cycle_unit', name: '执行周期单位', resizable: true, width: columnWidths['exec_cycle_unit'] || 100 },
        { key: 'exec_cycle', name: '执行周期', resizable: true, width: columnWidths['exec_cycle'] || 80 },
        { 
            key: 'begin_time', 
            name: '开始时间', 
            resizable: true, 
            width: columnWidths['begin_time'] || 150,
            renderCell: ({ row }: { row: TaskData }) => new Date(row.begin_time).toLocaleString()
        },
        { 
            key: 'end_time', 
            name: '结束时间', 
            resizable: true, 
            width: columnWidths['end_time'] || 150,
            renderCell: ({ row }: { row: TaskData }) => new Date(row.end_time).toLocaleString()
        },
        { key: 'delay_unit', name: '延迟单位', resizable: true, width: columnWidths['delay_unit'] || 80 },
        { key: 'delay_time', name: '延迟时间', resizable: true, width: columnWidths['delay_time'] || 80 },
        { key: 'priority', name: '优先级', resizable: true, width: columnWidths['priority'] || 70 },
        { key: 'status', name: '状态', resizable: true, width: columnWidths['status'] || 70 },
        { key: 'before_script_id', name: '前置脚本ID', resizable: true, width: columnWidths['before_script_id'] || 100 },
        { key: 'after_script_id', name: '后置脚本ID', resizable: true, width: columnWidths['after_script_id'] || 100 },
        { 
            key: 'exec_period', 
            name: '执行区段', 
            resizable: true, 
            width: columnWidths['exec_period'] || 150,
            renderCell: ({ row }: { row: TaskData }) => formatBlob(row.exec_period)
        },
        { key: 'task_cs', name: '任务校验和', resizable: true, width: columnWidths['task_cs'] || 100 },
        { 
            key: 'op_time', 
            name: '操作时间', 
            resizable: true, 
            width: columnWidths['op_time'] || 150,
            renderCell: ({ row }: { row: TaskData }) => new Date(row.op_time).toLocaleString()
        },
        { key: 'depth', name: '深度', resizable: true, width: columnWidths['depth'] || 70 },
        { key: 'acq_type', name: '采集类型', resizable: true, width: columnWidths['acq_type'] || 80 },
        { 
            key: 'acq_content', 
            name: '采集内容', 
            resizable: true, 
            width: columnWidths['acq_content'] || 150,
            renderCell: ({ row }: { row: TaskData }) => formatBlob(row.acq_content)
        },
        { 
            key: 'acq_set', 
            name: '采集设置', 
            resizable: true, 
            width: columnWidths['acq_set'] || 150,
            renderCell: ({ row }: { row: TaskData }) => formatBlob(row.acq_set)
        },
        { key: 'td_option', name: 'TD选项', resizable: true, width: columnWidths['td_option'] || 80 },
        { key: 'project_cs', name: '项目校验和', resizable: true, width: columnWidths['project_cs'] || 100 }
    ];

    const handleBack = () => {
        navigate(-1);
    };

    useEffect(() => {
        const setupTauriEvents = async () => {
            try {
                const unlistenDragEnter = await listen('tauri://drag-enter', () => {
                    dispatch(setIsDragging(true));
                });
                
                const unlistenDragLeave = await listen('tauri://drag-leave', () => {
                    dispatch(setIsDragging(false));
                });
                
                const unlistenDrop = await listen('tauri://drag-drop', async (event) => {
                    dispatch(setIsDragging(false));
                    
                    if (typeof event.payload === 'object' && event.payload !== null && 'paths' in event.payload) {
                        const paths = event.payload.paths as string[];
                        if (!paths || !Array.isArray(paths) || paths.length === 0) {
                            return;
                        }
                        
                        const filePath = paths[0]; // 只处理第一个文件
                        if (filePath.endsWith('.db')) {
                            await handleLoadDatabase(filePath);
                        }
                    }
                });
                
                setUnlistenFns([unlistenDragEnter, unlistenDragLeave, unlistenDrop]);
            } catch (err) {
                console.warn('设置拖放事件失败:', err);
            }
        };
        
        setupTauriEvents();
        
        return () => {
            unlistenFns.forEach(fn => fn());
            closeDatabase();
        };
    }, []);

    const handleLoadDatabase = async (filePath: string) => {
        try {
            dispatch(setLoading(true));
            dispatch(setError(null));
            const result = await loadDatabase(filePath);
            dispatch(setTasks(result));
        } catch (err) {
            console.error('加载数据库失败:', err);
            dispatch(setError(err instanceof Error ? err.message : '加载数据库失败'));
        } finally {
            dispatch(setLoading(false));
        }
    };

    const handleFileSelect = async () => {
        try {
            const selected = await open({
                multiple: false,
                filters: [{
                    name: 'SQLite Database',
                    extensions: ['db']
                }]
            });

            if (selected && !Array.isArray(selected)) {
                await handleLoadDatabase(selected);
            }
        } catch (err) {
            console.error('文件选择错误:', err);
            dispatch(setError(err instanceof Error ? err.message : '文件选择错误'));
        }
    };

    const handleExport = async () => {
        if (tasks.length === 0) return;

        try {
            const filePath = await save({
                filters: [{
                    name: 'Excel',
                    extensions: ['xlsx']
                }]
            });
            
            if (!filePath) return;

            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(tasks.map(task => ({
                '任务ID': task.task_id,
                '项目ID': task.project_id,
                '项目类型': task.project_type,
                '执行周期单位': task.exec_cycle_unit,
                '执行周期': task.exec_cycle,
                '开始时间': new Date(task.begin_time).toLocaleString(),
                '结束时间': new Date(task.end_time).toLocaleString(),
                '延迟单位': task.delay_unit,
                '延迟时间': task.delay_time,
                '优先级': task.priority,
                '状态': task.status,
                '前置脚本ID': task.before_script_id,
                '后置脚本ID': task.after_script_id,
                '执行区段': formatBlob(task.exec_period),
                '任务校验和': task.task_cs,
                '操作时间': new Date(task.op_time).toLocaleString(),
                '深度': task.depth,
                '采集类型': task.acq_type,
                '采集内容': formatBlob(task.acq_content),
                '采集设置': formatBlob(task.acq_set),
                'TD选项': task.td_option,
                '项目校验和': task.project_cs
            })));

            XLSX.utils.book_append_sheet(wb, ws, '任务数据');
            const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
            
            await writeFile(filePath, new Uint8Array(buffer));
        } catch (error) {
            console.error('导出失败:', error);
            dispatch(setError(error instanceof Error ? error.message : '导出失败'));
        }
    };

    const formatBlob = (blob: string): string => {
        if (!blob) return '';
        const cleanStr = blob.replace(/[^0-9A-Fa-f]/g, '');
        return cleanStr.match(/.{2}/g)?.join(' ').toUpperCase() || '';
    };

    // 处理列宽变化
    const handleColumnResize = (column: { key: string }, width: number) => {
        dispatch(updateColumnWidth({ key: column.key, width }));
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center p-4 bg-base-100 shadow-sm">
                <button className="btn btn-ghost" onClick={handleBack}>
                    <FaArrowLeft className="mr-2" />
                    返回
                </button>
            </div>

            <div className="flex-1 p-4 flex flex-col">
                <div
                    className={`mb-4 border-2 border-dashed rounded-lg p-6 text-center transition-colors
                        ${isDragging ? 'border-primary bg-base-200' : 'border-base-300'}
                        ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    onClick={() => !loading && handleFileSelect()}
                >
                    <FaDatabase className="mx-auto h-12 w-12 text-base-content opacity-50 mb-4" />
                    <p className="text-base-content">
                        {loading ? '正在加载数据库...' : '点击选择或拖放数据库文件到此处'}
                    </p>
                    <p className="text-sm text-base-content opacity-75 mt-2">
                        支持 SQLite 数据库文件 (.db)
                    </p>
                </div>

                {error && (
                    <div className="alert alert-error mb-4">
                        <span>{error}</span>
                    </div>
                )}

                {tasks.length > 0 && (
                    <div className="flex-1 flex flex-col bg-base-100 rounded-lg shadow-sm">
                        <div className="flex justify-between items-center p-4 border-b">
                            <h2 className="text-lg font-semibold">已加载 {tasks.length} 条任务数据</h2>
                            <button
                                className="btn btn-primary"
                                onClick={handleExport}
                                disabled={loading}
                            >
                                {loading ? (
                                    <span className="loading loading-spinner"></span>
                                ) : (
                                    <>
                                        <FaFileExport className="mr-2" />
                                        导出Excel
                                    </>
                                )}
                            </button>
                        </div>
                        
                        <div className="relative flex-1" style={{ height: 'calc(100vh - 250px)' }}>
                            <DataGrid
                                rows={tasks}
                                columns={columns}
                                rowKeyGetter={(row) => row.task_id}
                                onColumnResize={handleColumnResize}
                                className="rdg-light"
                                style={{
                                    height: '100%',
                                    position: 'absolute',
                                    left: 0,
                                    top: 0,
                                    right: 0,
                                    bottom: 0
                                }}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TaskAnalysis;