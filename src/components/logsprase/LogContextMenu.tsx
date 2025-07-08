import React from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { listen } from '@tauri-apps/api/event';
import { toast } from '../../context/ToastProvider';
import { LogEntry } from '../../store/slices/logParseSlice';
import { useSelector } from 'react-redux';
import { selectActiveLogFile } from '../../store/slices/logParseSlice';
import { Filter, FileDown } from 'lucide-react';

interface LogContextMenuProps {
    show: boolean;
    x: number;
    y: number;
    onClose: () => void;
    allEntries: LogEntry[];
    filteredEntries: LogEntry[];
}

interface ExportProgressEvent {
    payload: number;
}

export const LogContextMenu: React.FC<LogContextMenuProps> = ({
    show,
    x,
    y,
    onClose,
    allEntries,
    filteredEntries
}) => {
    const activeFile = useSelector(selectActiveLogFile);

    const handleExport = async (useFiltered: boolean) => {
        try {
            const entries = useFiltered ? filteredEntries : allEntries;
            if (entries.length === 0) {
                toast.error('没有可导出的日志条目');
                return;
            }

            if (!activeFile) {
                toast.error('没有活动的日志文件');
                return;
            }

            // 从原始文件路径中提取文件名
            const originalFileName = activeFile.name;
            // 构建新的文件名：decode_{原始文件名}
            const exportFileName = `decode_${originalFileName}`;

            const filePath = await save({
                defaultPath: exportFileName,
                filters: [{
                    name: '文本文件',
                    extensions: ['txt']
                }]
            });

            if (!filePath) {
                return; // 用户取消了保存
            }

            // 监听导出进度
            const unlisten = await listen<ExportProgressEvent>('export-progress', (event) => {
                const progress = event.payload;
                // 可以在这里更新进度条UI
                console.log(`Export progress: ${progress}%`);
            });

            // 确保时间戳是字符串格式
            const formattedEntries = entries.map(entry => ({
                ...entry,
                timeStamp: entry.timeStamp.toString(),
                pid: entry.pid?.toString(),
                tid: entry.tid?.toString(),
                line: entry.line?.toString(),
            }));

            // 调用后端导出功能
            await invoke('export_logs', {
                filePath,
                entries: formattedEntries
            });

            // 取消监听进度事件
            unlisten();

            toast.success('日志导出成功');
        } catch (error) {
            console.error('导出失败:', error);
            toast.error(`导出失败: ${error}`);
        }
    };

    if (!show) return null;

    return (
        <div
            className="fixed z-50 bg-base-100 shadow-xl rounded-lg border border-base-300 backdrop-blur-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            style={{
                left: x,
                top: y,
                minWidth: '240px',
                transformOrigin: 'top left',
            }}
        >
            <div className="py-2">
                <div
                    onClick={() => {
                        handleExport(true);
                        onClose();
                    }}
                    className="group px-4 py-2.5 hover:bg-base-200 active:bg-base-300 flex items-center gap-3 cursor-pointer text-sm transition-all duration-150 select-none hover:pl-5 min-h-[36px]"
                >
                    <Filter className="w-4 h-4 flex-shrink-0 transition-transform duration-150 group-hover:scale-110 text-blue-500" />
                    <span className="flex-1 font-medium whitespace-nowrap">导出已过滤日志</span>
                    <span className="text-xs text-base-content/60 font-mono opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap">Ctrl+Shift+E</span>
                </div>
                <div
                    onClick={() => {
                        handleExport(false);
                        onClose();
                    }}
                    className="group px-4 py-2.5 hover:bg-base-200 active:bg-base-300 flex items-center gap-3 cursor-pointer text-sm transition-all duration-150 select-none hover:pl-5 min-h-[36px]"
                >
                    <FileDown className="w-4 h-4 flex-shrink-0 transition-transform duration-150 group-hover:scale-110 text-green-500" />
                    <span className="flex-1 font-medium whitespace-nowrap">导出全部日志</span>
                    <span className="text-xs text-base-content/60 font-mono opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap">Ctrl+E</span>
                </div>
            </div>
        </div>
    );
}; 