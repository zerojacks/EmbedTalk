import React, { useEffect, useRef } from 'react';
import { save, open } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { FaArrowLeft, FaFileExport, FaDatabase, FaColumns, FaGripVertical } from 'react-icons/fa';
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
    toggleColumnVisibility,
    setAllColumnsVisibility,
    reorderColumns,
    toggleTaskSelection,
    setAllTasksSelection,
    selectTasks,
    selectLoading,
    selectError,
    selectColumnConfigs,
    selectIsDragging,
    selectSelectedTasks,
    TaskData,
    ColumnConfig
} from '../store/slices/taskAnalysisSlice';
import { createPortal } from 'react-dom';

const TaskAnalysis: React.FC = () => {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const tasks = useAppSelector(selectTasks);
    const loading = useAppSelector(selectLoading);
    const error = useAppSelector(selectError);
    const columnConfigs = useAppSelector(selectColumnConfigs);
    const isDragging = useAppSelector(selectIsDragging);
    const selectedTasks = useAppSelector(selectSelectedTasks);
    const [unlistenFns, setUnlistenFns] = React.useState<UnlistenFn[]>([]);
    const [isColumnSelectorOpen, setIsColumnSelectorOpen] = React.useState(false);
    const { loadDatabase, closeDatabase } = useDbWorker();
    const columnSelectorRef = useRef<HTMLDivElement>(null);
    const selectAllRef = useRef<HTMLInputElement>(null);
    const dragRowIndex = useRef<number | null>(null);
    const dragItem = useRef<number | null>(null);
    const dragOverItem = useRef<number | null>(null);
    const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);
    const [dropIndex, setDropIndex] = React.useState<number | null>(null);
    const [selectorPosition, setSelectorPosition] = React.useState({ top: 0, left: 0, maxHeight: 0 });

    // 三态checkbox逻辑
    useEffect(() => {
        if (!selectAllRef.current) return;
        if (selectedTasks.length === 0) {
            selectAllRef.current.indeterminate = false;
            selectAllRef.current.checked = false;
        } else if (selectedTasks.length === tasks.length) {
            selectAllRef.current.indeterminate = false;
            selectAllRef.current.checked = true;
        } else {
            selectAllRef.current.indeterminate = true;
            selectAllRef.current.checked = false;
        }
    }, [selectedTasks, tasks]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (columnSelectorRef.current && !columnSelectorRef.current.contains(event.target as Node)) {
                const portal = document.querySelector('.column-selector-portal');
                if (!portal || !portal.contains(event.target as Node)) {
                    setIsColumnSelectorOpen(false);
                }
            }
        };

        if (isColumnSelectorOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            // 计算选择器位置
            if (columnSelectorRef.current) {
                const rect = columnSelectorRef.current.getBoundingClientRect();
                const viewportWidth = window.innerWidth;
                const selectorWidth = 256;
                const margin = 16;
                
                let left = rect.right - selectorWidth;
                left = Math.max(margin, left);
                left = Math.min(left, viewportWidth - selectorWidth - margin);
                
                const top = rect.bottom + 8;
                const maxHeight = window.innerHeight - top - margin;
                
                setSelectorPosition({ top, left, maxHeight });
            }
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isColumnSelectorOpen]);

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
                        const filePath = paths[0];
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

    // 拖动排序任务
    const handleRowDragStart = (index: number) => {
        dragRowIndex.current = index;
    };
    const handleRowDrop = (index: number) => {
        if (dragRowIndex.current === null || dragRowIndex.current === index) return;
        const newTasks = [...tasks];
        const [removed] = newTasks.splice(dragRowIndex.current, 1);
        newTasks.splice(index, 0, removed);
        dispatch(setTasks(newTasks));
        dragRowIndex.current = null;
    };
    // 拖动排序列
    const handleColDragStart = (index: number) => {
        dragItem.current = index;
    };
    const handleColDragEnter = (index: number) => {
        dragOverItem.current = index;
    };
    const handleColDragEnd = () => {
        if (dragItem.current !== null && dragOverItem.current !== null) {
            dispatch(reorderColumns({ 
                sourceIndex: dragItem.current, 
                targetIndex: dragOverItem.current 
            }));
        }
        dragItem.current = null;
        dragOverItem.current = null;
    };

    const handleBack = () => {
        navigate(-1);
    };

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
            const exportTasks = selectedTasks.length > 0 
                ? tasks.filter(task => selectedTasks.includes(task.task_id))
                : tasks;
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(exportTasks.map(task => ({
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

    // 处理列排序
    const handleDragStart = (index: number) => {
        console.log('拖动开始 - 索引:', index);
        setDraggedIndex(index);
        // 设置拖动数据
        const dragEvent = window.event as DragEvent;
        if (dragEvent?.dataTransfer) {
            dragEvent.dataTransfer.effectAllowed = 'move';
            dragEvent.dataTransfer.setData('text/plain', index.toString());
            
            // 设置拖动时的视觉效果
            const dragImage = document.createElement('div');
            dragImage.className = 'bg-base-100 shadow-lg rounded p-2';
            dragImage.textContent = columnConfigs[index].name;
            dragImage.style.position = 'absolute';
            dragImage.style.top = '-1000px';
            document.body.appendChild(dragImage);
            dragEvent.dataTransfer.setDragImage(dragImage, 0, 0);
            setTimeout(() => document.body.removeChild(dragImage), 0);
        }
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (draggedIndex === null || index === draggedIndex) return;
        
        const dragElement = e.currentTarget as HTMLElement;
        const rect = dragElement.getBoundingClientRect();
        const mouseY = e.clientY;
        const isInUpperHalf = mouseY < rect.top + rect.height / 2;
        
        // 清除其他元素的边框
        document.querySelectorAll('.column-item').forEach(el => {
            if (el !== dragElement) {
                (el as HTMLElement).style.borderTop = 'none';
                (el as HTMLElement).style.borderBottom = 'none';
            }
        });
        
        // 设置当前元素的边框
        dragElement.style.borderTop = isInUpperHalf ? '2px solid var(--primary)' : 'none';
        dragElement.style.borderBottom = !isInUpperHalf ? '2px solid var(--primary)' : 'none';
        
        if (dropIndex !== index) {
            console.log('拖动悬停 - 目标索引:', index, isInUpperHalf ? '上半部分' : '下半部分');
            setDropIndex(index);
        }
    };

    const handleDrop = (e: React.DragEvent, targetIndex: number) => {
        e.preventDefault();
        e.stopPropagation();
        
        // 清除所有边框样式
        document.querySelectorAll('.column-item').forEach(el => {
            (el as HTMLElement).style.borderTop = 'none';
            (el as HTMLElement).style.borderBottom = 'none';
        });
        
        if (draggedIndex === null || targetIndex === draggedIndex) {
            console.log('拖动取消 - 无效的拖动操作');
            return;
        }
        
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const mouseY = e.clientY;
        const isInUpperHalf = mouseY < rect.top + rect.height / 2;
        
        console.log('拖动放下 - 源索引:', draggedIndex, '目标索引:', targetIndex, isInUpperHalf ? '上方' : '下方');
        
        try {
            const finalTargetIndex = isInUpperHalf ? targetIndex : targetIndex + 1;
            const adjustedTargetIndex = finalTargetIndex > draggedIndex ? finalTargetIndex - 1 : finalTargetIndex;
            
            dispatch(reorderColumns({ 
                sourceIndex: draggedIndex, 
                targetIndex: adjustedTargetIndex 
            }));
            console.log('派发重排动作完成 - 最终目标索引:', adjustedTargetIndex);
        } catch (error) {
            console.error('列重排序失败:', error);
        } finally {
            setDraggedIndex(null);
            setDropIndex(null);
        }
    };

    const handleDragEnd = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('拖动结束');
        
        // 清除所有边框样式
        document.querySelectorAll('.column-item').forEach(el => {
            (el as HTMLElement).style.borderTop = 'none';
            (el as HTMLElement).style.borderBottom = 'none';
        });
        
        setDraggedIndex(null);
        setDropIndex(null);
    };

    // 监听状态变化
    useEffect(() => {
        console.log('拖动状态更新 - draggedIndex:', draggedIndex, 'dropIndex:', dropIndex);
    }, [draggedIndex, dropIndex]);

    // 监听列配置变化
    useEffect(() => {
        console.log('列配置更新:', columnConfigs.map(c => ({ key: c.key, order: c.order, visible: c.visible })));
    }, [columnConfigs]);

    const renderColumnSelector = () => {
        if (!isColumnSelectorOpen || !columnSelectorRef.current) return null;
        
        return createPortal(
            <div 
                className="fixed w-64 bg-base-100 rounded-lg shadow-xl z-[9999] border border-base-300 column-selector-portal"
                style={{
                    top: `${selectorPosition.top}px`,
                    left: `${selectorPosition.left}px`,
                    maxHeight: `${selectorPosition.maxHeight}px`,
                    overflowY: 'auto'
                }}
                onClick={e => e.stopPropagation()}
            >
                <div className="p-2 border-b sticky top-0 bg-base-100 z-10">
                    <button
                        type="button"
                        className="btn btn-sm btn-outline w-full mb-2"
                        onClick={(e) => {
                            e.stopPropagation();
                            dispatch(setAllColumnsVisibility(true));
                        }}
                    >
                        全选
                    </button>
                    <button
                        type="button"
                        className="btn btn-sm btn-outline w-full"
                        onClick={(e) => {
                            e.stopPropagation();
                            dispatch(setAllColumnsVisibility(false));
                        }}
                    >
                        取消全选
                    </button>
                </div>
                <div className="p-2">
                    {columnConfigs.map((column, index) => (
                        <div
                            key={column.key}
                            className={`flex items-center p-2 rounded group relative select-none column-item
                                ${draggedIndex === index ? 'opacity-50 bg-base-200' : ''}
                                ${dropIndex === index ? 'bg-base-100' : ''}
                                ${draggedIndex !== index && dropIndex !== index ? 'hover:bg-base-200' : ''}`}
                            draggable="true"
                            data-index={index}
                            onDragStart={(e) => {
                                e.stopPropagation();
                                console.log('开始拖动元素:', column.key);
                                handleDragStart(index);
                            }}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDrop={(e) => handleDrop(e, index)}
                            onDragEnd={handleDragEnd}
                            onDragEnter={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleDragOver(e, index);
                            }}
                            onDragLeave={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const target = e.currentTarget as HTMLElement;
                                target.style.borderTop = 'none';
                                target.style.borderBottom = 'none';
                            }}
                        >
                            <input
                                type="checkbox"
                                className="checkbox checkbox-sm mr-2"
                                checked={column.visible}
                                onChange={(e) => {
                                    e.stopPropagation();
                                    dispatch(toggleColumnVisibility(column.key));
                                }}
                            />
                            <span className="flex-grow text-sm">{column.name}</span>
                            <div 
                                className="opacity-0 group-hover:opacity-100 cursor-move px-2"
                                onMouseDown={(e) => {
                                    console.log('鼠标按下拖动手柄:', column.key);
                                    e.stopPropagation();
                                }}
                            >
                                <FaGripVertical className="text-base-content/50" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>,
            document.body
        );
    };

    // 列定义
    const columns = [
        {
            key: 'selection',
            name: '',
            frozen: true,
            width: 35,
            resizable: false,
            editable: false,
            renderHeaderCell: () => (
                <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    ref={selectAllRef}
                    onChange={e => dispatch(setAllTasksSelection(e.target.checked))}
                />
            ),
            renderCell: ({ row }: { row: TaskData }) => (
                <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={selectedTasks.includes(row.task_id)}
                    onChange={() => dispatch(toggleTaskSelection(row.task_id))}
                />
            )
        },
        ...columnConfigs
            .filter(col => col.visible)
            .sort((a, b) => a.order - b.order)
            .map(col => ({
                key: col.key,
                name: col.name,
                resizable: true,
                width: col.width,
                frozen: col.key === 'task_id',
                renderCell: (props: { row: TaskData }) => {
                    const value = props.row[col.key as keyof TaskData];
                    if (col.key === 'begin_time' || col.key === 'end_time' || col.key === 'op_time') {
                        return new Date(value as number).toLocaleString();
                    }
                    if (col.key === 'exec_period' || col.key === 'acq_content' || col.key === 'acq_set') {
                        return formatBlob(value as string);
                    }
                    return value;
                }
            })),
        {
            key: 'row-drag',
            name: '',
            width: 35,
            resizable: false,
            renderHeaderCell: () => (
                <div className="flex justify-center items-center h-full w-full">
                    <div ref={columnSelectorRef}>
                        <button
                            type="button"
                            className="btn btn-ghost btn-xs"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIsColumnSelectorOpen(!isColumnSelectorOpen);
                            }}
                        >
                            <FaColumns />
                        </button>
                        {renderColumnSelector()}
                    </div>
                </div>
            ),
            renderCell: ({ rowIdx }: { rowIdx: number }) => (
                <span
                    draggable
                    onDragStart={() => handleRowDragStart(rowIdx)}
                    onDragOver={e => e.preventDefault()}
                    onDrop={() => handleRowDrop(rowIdx)}
                    style={{ cursor: 'grab', display: 'flex', alignItems: 'center', height: '100%' }}
                >
                    <FaGripVertical />
                </span>
            )
        }
    ];

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
                        {/* 优化后的表头布局 */}
                        <div className="flex justify-between items-center p-4 border-b sticky top-0 bg-base-100 z-10">
                            <div className="text-lg font-semibold">
                                已加载 <span className="text-primary font-bold">{tasks.length}</span> 条任务数据
                                {selectedTasks.length > 0 && (
                                    <span className="ml-2 text-accent">(已选择 {selectedTasks.length} 条)</span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {/* 显示列按钮已集成到表格最后一列表头，无需再放这里 */}
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
                        </div>
                        <div className="relative flex-1 bg-base-100" style={{ height: 'calc(100vh - 250px)' }}>
                            <DataGrid
                                rows={tasks}
                                columns={columns}
                                rowKeyGetter={(row) => row.task_id}
                                onColumnResize={handleColumnResize}
                                className="bg-base-100 border-none"
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