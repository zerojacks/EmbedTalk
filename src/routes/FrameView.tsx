import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { store } from '../store';
import {
    addFrameFile,
    removeFrameFile,
    setActiveFrameFile,
    addFrameChunk,
    clearOldChunks,
    setFrameFilter,
    initializeFrameFilter,
    setLoading,
    setError,
    selectOpenFrameFiles,
    selectActiveFrameFilePath,
    selectActiveFrameFile,
    selectFrameFileContents,
    selectFrameFilter,
    selectIsLoading,
    selectError,
    selectFilteredFrames,
    FrameFile
} from '../store/slices/frameParseSlice';
import { FrameEntry } from '../services/frameParser';
import { toast } from '../context/ToastProvider';
import { open } from '@tauri-apps/plugin-dialog';
import { lstat, readFile } from '@tauri-apps/plugin-fs';
import { listen } from '@tauri-apps/api/event';
import { UnlistenFn } from '@tauri-apps/api/event';
import { parseFrameChunk, exportFrames } from '../services/frameParser';
import { FolderOpen, FileText, X, XCircle, Download } from 'lucide-react';
import { Command } from '@tauri-apps/plugin-shell';
import { FrameDirection, getDirectionName, RecordPort, getPortName, getProtocolName } from '../services/frameParser';
import { XIcon, FolderIcon, ChevronDoubleLeftIcon,ChevronDoubleRightIcon } from '@heroicons/react/outline'
import { invoke } from '@tauri-apps/api/core';


// 文件关闭确认对话框组件
const FileCloseConfirmDialog: React.FC<{
    fileName: string;
    onCancel: () => void;
    onConfirm: () => void;
}> = ({ fileName, onCancel, onConfirm }) => {
    return (
        <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200"
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    onCancel();
                }
            }}
        >
            <div
                className="bg-base-100/95 backdrop-blur-sm p-6 max-w-sm w-full mx-4 rounded-xl shadow-xl border border-base-200/50 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center space-x-3 mb-4">
                    <div className="p-2 bg-error/10 rounded-lg">
                        <X className="w-6 h-6 text-error" />
                    </div>
                    <h3 className="text-lg font-medium">确认关闭文件</h3>
                </div>

                <p className="text-base-content/70 mb-6 ml-10">
                    是否要关闭文件 "{fileName}"？
                </p>

                <div className="flex justify-end space-x-3">
                    <button
                        className="btn btn-sm btn-ghost min-w-[5rem] hover:bg-base-200 active:scale-95 transition-all duration-200"
                        onClick={onCancel}
                    >
                        取消
                    </button>
                    <button
                        className="btn btn-sm btn-error min-w-[5rem] hover:bg-error/90 active:scale-95 transition-all duration-200"
                        onClick={onConfirm}
                    >
                        关闭
                    </button>
                </div>
            </div>
        </div>
    );
};

// 报文表格头部组件
const FrameTableHeader: React.FC = () => {
    return (
        <thead>
            <tr className="text-xs bg-base-200/80 sticky top-0 z-10">
                <th className="py-2 px-2 font-medium text-left whitespace-nowrap" style={{ width: '180px', minWidth: '180px', maxWidth: '180px' }}>
                    时间戳
                </th>
                <th className="py-2 px-2 font-medium text-center whitespace-nowrap" style={{ width: '50px', minWidth: '50px', maxWidth: '50px' }}>
                    PID
                </th>
                <th className="py-2 px-2 font-medium text-center whitespace-nowrap" style={{ width: '120px', minWidth: '120px', maxWidth: '120px' }}>
                    标签
                </th>
                <th className="py-2 px-2 font-medium text-center whitespace-nowrap" style={{ width: '120px', minWidth: '120px', maxWidth: '120px' }}>
                    端口
                </th>
                <th className="py-2 px-2 font-medium text-center whitespace-nowrap" style={{ width: '120px', minWidth: '120px', maxWidth: '120px' }}>
                    协议
                </th>
                <th className="py-2 px-2 font-medium text-center whitespace-nowrap" style={{ width: '60px', minWidth: '60px', maxWidth: '60px' }}>
                    方向
                </th>
                <th className="py-2 px-2 font-medium text-left flex-1">
                    内容
                </th>
            </tr>
        </thead>
    );
};

// 报文条目组件
const FrameEntryRow: React.FC<{ entry: FrameEntry }> = ({ entry }) => {
    const tagName = entry.tag_name ? entry.tag + ":" + entry.tag_name : entry.tag.toString();
    const portName = entry.port_name ? entry.port + ":" + entry.port_name : entry.port.toString();
    const protocolName = entry.protocol_name ? entry.protocol + ":" + entry.protocol_name : entry.protocol.toString();
    const directionName = entry.direction_name ? entry.direction_name : entry.direction.toString();

    return (
        <tr className="border-b border-base-200/50 hover:bg-base-200/30 transition-colors text-xs">
            <td className="py-1.5 px-2 font-mono whitespace-nowrap" style={{ width: '180px', minWidth: '180px', maxWidth: '180px' }}>
                {entry.timestamp}
            </td>
            <td className="py-1.5 px-2 text-center whitespace-nowrap" style={{ width: '50px', minWidth: '50px', maxWidth: '50px' }}>
                {entry.pid}
            </td>
            <td className="py-1.5 px-2 text-center whitespace-nowrap" style={{ width: '120px', minWidth: '120px', maxWidth: '120px' }}>
                {tagName}
            </td>
            <td className="py-1.5 px-2 text-center whitespace-nowrap" style={{ width: '120px', minWidth: '120px', maxWidth: '120px' }}>
                {portName}
            </td>
            <td className="py-1.5 px-2 text-center whitespace-nowrap" style={{ width: '120px', minWidth: '120px', maxWidth: '120px' }}>
                {protocolName}
            </td>
            <td className={`py-1.5 px-2 text-center whitespace-nowrap ${entry.direction === 0 ? 'text-info' : 'text-success'}`} style={{ width: '60px', minWidth: '60px', maxWidth: '60px' }}>
                {directionName}
            </td>
            <td className="py-1.5 px-2 font-mono break-all">
                <div className="flex items-center space-x-2">
                    <span className="text-base-content/70 break-all whitespace-pre-wrap flex-1">
                        {entry.content}
                    </span>
                </div>
            </td>
        </tr>
    );
};

// 表格式虚拟滚动列表组件
const VirtualFrameList: React.FC<{
    frames: FrameEntry[],
    height: number,
    itemHeight: number
}> = ({ frames, height }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 });

    const sortedFrames = useMemo(() => {
        if (!Array.isArray(frames)) {
            console.warn("frames is not an array:", frames);
            return [];
        }
        console.log("Processing frames, total count:", frames.length);
        return frames;
    }, [frames]);

    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        if (!Array.isArray(sortedFrames)) {
            console.warn("sortedFrames is not an array in handleScroll");
            return;
        }

        const container = e.currentTarget;
        const scrollTop = container.scrollTop;
        const viewportHeight = container.clientHeight;

        const itemHeight = 32; // 调整行高
        const overscan = 20;

        const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
        const endIndex = Math.min(
            sortedFrames.length,
            Math.ceil((scrollTop + viewportHeight) / itemHeight) + overscan
        );

        setVisibleRange({ start: startIndex, end: endIndex });
    }, [sortedFrames]);

    if (!Array.isArray(sortedFrames) || sortedFrames.length === 0) {
        return (
            <div className="h-full overflow-hidden" ref={containerRef}>
                <table className="table table-sm w-full border-separate border-spacing-0">
                    <FrameTableHeader />
                    <tbody>
                        <tr>
                            <td colSpan={7} className="text-center py-4 text-base-content/50">
                                没有报文数据
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        );
    }

    const totalHeight = sortedFrames.length * 32; // 调整行高
    const visibleFrames = sortedFrames.slice(visibleRange.start, visibleRange.end);

    return (
        <div
            className="h-full overflow-auto relative"
            ref={containerRef}
            onScroll={handleScroll}
        >
            <div style={{ height: totalHeight, position: 'relative' }}>
                <table className="table table-sm w-full border-separate border-spacing-0 sticky top-0 z-10 bg-base-100">
                    <FrameTableHeader />
                </table>
                <div style={{
                    position: 'absolute',
                    top: visibleRange.start * 32, // 调整行高
                    left: 0,
                    right: 0
                }}>
                    <table className="table table-sm w-full border-separate border-spacing-0">
                        <tbody>
                            {visibleFrames.map(frame => (
                                <FrameEntryRow key={frame.id} entry={frame} />
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// 获取所有报文条目（不带过滤）
const getAllFrameEntries = (): FrameEntry[] => {
    const activeFilePath = store.getState().frameParse.activeFilePath;
    if (!activeFilePath) return [];

    const activeFile = store.getState().frameParse.fileContents[activeFilePath];
    if (!activeFile || !activeFile.chunks) return [];

    // 合并所有chunks中的报文
    const entries = Object.values(activeFile.chunks)
        .flatMap(chunk => chunk.content || [])
        .filter(entry => entry !== null && entry !== undefined);

    if (!Array.isArray(entries)) {
        console.warn("Entries is not an array:", entries);
        return [];
    }

    return entries;
};

// 获取当前过滤后的报文条目
const getFilteredFrameEntries = (): FrameEntry[] => {
    const activeFilePath = store.getState().frameParse.activeFilePath;
    if (!activeFilePath) return [];

    const entries = selectFilteredFrames(store.getState(), activeFilePath);
    if (!Array.isArray(entries)) {
        console.warn("Filtered entries is not an array:", entries);
        return [];
    }

    return entries;
};

// 报文过滤器组件
const FrameFilter: React.FC = () => {
    const dispatch = useDispatch();
    const filter = useSelector(selectFrameFilter);
    const activeFilePath = useSelector(selectActiveFrameFilePath);

    if (!filter || !activeFilePath) return null;

    const handlePortChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const port = e.target.value ? parseInt(e.target.value) : null;
        dispatch(setFrameFilter({ path: activeFilePath, filter: { port } }));
    };

    const handleProtocolChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const protocol = e.target.value ? parseInt(e.target.value) : null;
        dispatch(setFrameFilter({ path: activeFilePath, filter: { protocol } }));
    };

    const handleDirectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const direction = e.target.value ? parseInt(e.target.value) : null;
        dispatch(setFrameFilter({ path: activeFilePath, filter: { direction } }));
    };

    const handleStartTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const startTime = e.target.value || null;
        dispatch(setFrameFilter({ path: activeFilePath, filter: { startTime } }));
    };

    const handleEndTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const endTime = e.target.value || null;
        dispatch(setFrameFilter({ path: activeFilePath, filter: { endTime } }));
    };

    const handleResetTimeRange = () => {
        dispatch(setFrameFilter({
            path: activeFilePath,
            filter: {
                startTime: filter.minTime,
                endTime: filter.maxTime
            }
        }));
    };

    return (
        <div className="flex flex-wrap gap-2 p-2 bg-base-200/50 border-b border-base-300">
            <div className="w-full flex flex-wrap gap-2">
                <div className="flex-none w-[120px] flex items-center">
                    <label className="text-xs mr-1 whitespace-nowrap">端口:</label>
                    <input
                        type="number"
                        className="input input-xs input-bordered w-full"
                        value={filter.port || ''}
                        onChange={handlePortChange}
                        placeholder="端口号"
                    />
                </div>

                <div className="flex-none w-[120px] flex items-center">
                    <label className="text-xs mr-1 whitespace-nowrap">协议:</label>
                    <input
                        type="number"
                        className="input input-xs input-bordered w-full"
                        value={filter.protocol || ''}
                        onChange={handleProtocolChange}
                        placeholder="协议号"
                    />
                </div>

                <div className="flex-none w-[150px] flex items-center">
                    <label className="text-xs mr-1 whitespace-nowrap">方向:</label>
                    <select
                        className="select select-xs select-bordered w-full"
                        value={filter.direction?.toString() || ''}
                        onChange={handleDirectionChange}
                    >
                        <option value="">全部</option>
                        <option value={FrameDirection.IN}>{getDirectionName(FrameDirection.IN)}</option>
                        <option value={FrameDirection.OUT}>{getDirectionName(FrameDirection.OUT)}</option>
                    </select>
                </div>
            </div>

            <div className="w-full flex flex-wrap gap-2 items-center">
                <div className="flex-1 min-w-[250px] max-w-[400px] flex items-center">
                    <label className="text-xs mr-1 whitespace-nowrap">开始时间:</label>
                    <input
                        type="datetime-local"
                        className="input input-xs input-bordered w-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50"
                        value={filter.startTime || ''}
                        onChange={handleStartTimeChange}
                        min={filter.minTime || undefined}
                        max={filter.maxTime || undefined}
                        step="1"  // 允许选择秒
                        style={{
                            padding: '0.25rem',
                            fontSize: '12px',
                            lineHeight: '1.5',
                        }}
                    />
                </div>

                <div className="flex-1 min-w-[250px] max-w-[400px] flex items-center">
                    <label className="text-xs mr-1 whitespace-nowrap">结束时间:</label>
                    <input
                        type="datetime-local"
                        className="input input-xs input-bordered w-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50"
                        value={filter.endTime || ''}
                        onChange={handleEndTimeChange}
                        min={filter.minTime || undefined}
                        max={filter.maxTime || undefined}
                        step="1"  // 允许选择秒
                        style={{
                            padding: '0.25rem',
                            fontSize: '12px',
                            lineHeight: '1.5',
                        }}
                    />
                </div>

                <div className="flex items-center space-x-2">
                    <button
                        className="btn btn-xs btn-outline"
                        onClick={handleResetTimeRange}
                    >
                        重置时间范围
                    </button>
                </div>
            </div>
        </div>
    );
};

// 导出对话框组件
const ExportDialog: React.FC<{
    onCancel: () => void;
    onConfirm: (exportAll: boolean) => void;
}> = ({ onCancel, onConfirm }) => {
    return (
        <div 
            className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200"
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    onCancel();
                }
            }}
        >
            <div 
                className="bg-base-100/95 backdrop-blur-sm p-6 max-w-sm w-full mx-4 rounded-xl shadow-xl border border-base-200/50 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center space-x-3 mb-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <Download className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-medium">导出报文数据</h3>
                </div>
                
                <p className="text-base-content/70 mb-6">
                    请选择要导出的数据范围：
                </p>

                <div className="flex justify-end space-x-3">
                    <button
                        className="btn btn-sm btn-ghost min-w-[5rem] hover:bg-base-200 active:scale-95 transition-all duration-200"
                        onClick={onCancel}
                    >
                        取消
                    </button>
                    <button
                        className="btn btn-sm btn-primary min-w-[5rem] hover:bg-primary/90 active:scale-95 transition-all duration-200"
                        onClick={() => onConfirm(false)}
                    >
                        导出当前
                    </button>
                    {/* <button
                        className="btn btn-sm btn-primary min-w-[5rem] hover:bg-primary/90 active:scale-95 transition-all duration-200"
                        onClick={() => onConfirm(true)}
                    >
                        导出全部
                    </button> */}
                </div>
            </div>
        </div>
    );
};

// 导出进度对话框组件
const ExportProgressDialog: React.FC<{
    onCancel: () => void;
}> = ({ onCancel }) => {
    const [progress, setProgress] = useState<{
        total_entries: number;
        processed_entries: number;
        current_tag: string;
        percentage: number;
    } | null>(null);

    useEffect(() => {
        const unsubscribe = listen('export-progress', (event) => {
            setProgress(event.payload as any);
        });

        return () => {
            unsubscribe.then(fn => fn());
        };
    }, []);

    return (
        <div 
            className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200"
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    onCancel();
                }
            }}
        >
            <div 
                className="bg-base-100/95 backdrop-blur-sm p-6 max-w-sm w-full mx-4 rounded-xl shadow-xl border border-base-200/50 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center space-x-3 mb-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <Download className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-medium">导出进度</h3>
                </div>
                
                {progress && (
                    <div className="space-y-4">
                        <div className="w-full bg-base-200 rounded-full h-2.5">
                            <div 
                                className="bg-primary h-2.5 rounded-full transition-all duration-300" 
                                style={{ width: `${progress.percentage}%` }}
                            ></div>
                        </div>
                        <div className="text-sm space-y-1">
                            <p>当前处理: {progress.current_tag}</p>
                            <p>进度: {progress.processed_entries} / {progress.total_entries} ({progress.percentage.toFixed(1)}%)</p>
                        </div>
                    </div>
                )}
                
                <div className="mt-6 flex justify-end">
                    <button
                        className="btn btn-sm btn-ghost min-w-[5rem] hover:bg-base-200 active:scale-95 transition-all duration-200"
                        onClick={onCancel}
                    >
                        取消
                    </button>
                </div>
            </div>
        </div>
    );
};

// 文件标签页组件
const FileTabs = ({ onOpenFile }: { onOpenFile: () => void }) => {
    const dispatch = useDispatch();
    const openFiles = useSelector(selectOpenFrameFiles);
    const activeFilePath = useSelector(selectActiveFrameFilePath);
    const [fileToClose, setFileToClose] = useState<string | null>(null);
    const [showDropdown, setShowDropdown] = useState(false);
    const [showExportDialog, setShowExportDialog] = useState(false);
    const [showExportProgress, setShowExportProgress] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // 右键菜单状态
    const [contextMenu, setContextMenu] = useState<{
        visible: boolean;
        x: number;
        y: number;
        filePath: string;
    }>({ visible: false, x: 0, y: 0, filePath: '' });

    // 处理标签点击
    const handleTabClick = (path: string) => {
        dispatch(setActiveFrameFile(path));
    };

    // 处理关闭按钮点击
    const handleCloseClick = (e: React.MouseEvent, path: string) => {
        e.stopPropagation();
        setFileToClose(path);
    };

    // 确认关闭文件
    const confirmClose = () => {
        if (fileToClose) {
            dispatch(removeFrameFile(fileToClose));
            setFileToClose(null);
        }
    };

    // 取消关闭文件
    const cancelClose = () => {
        setFileToClose(null);
    };

    // 处理右键点击
    const handleContextMenu = (e: React.MouseEvent, path: string) => {
        e.preventDefault();
        setContextMenu({
            visible: true,
            x: e.clientX,
            y: e.clientY,
            filePath: path
        });
    };

    // 关闭右键菜单
    const closeContextMenu = () => {
        setContextMenu(prev => ({ ...prev, visible: false }));
    };

    // 关闭当前文件
    const closeCurrentFile = () => {
        setFileToClose(contextMenu.filePath);
        closeContextMenu();
    };

    // 关闭其他文件
    const closeOtherFiles = () => {
        const currentPath = contextMenu.filePath;
        openFiles.forEach((file: FrameFile) => {
            if (file.path !== currentPath) {
                dispatch(removeFrameFile(file.path));
            }
        });
        dispatch(setActiveFrameFile(currentPath));
        closeContextMenu();
    };

    // 关闭右侧文件
    const closeRightFiles = () => {
        const currentIndex = openFiles.findIndex((file: FrameFile) => file.path === contextMenu.filePath);
        if (currentIndex !== -1) {
            for (let i = currentIndex + 1; i < openFiles.length; i++) {
                dispatch(removeFrameFile(openFiles[i].path));
            }
        }
        closeContextMenu();
    };

    // 关闭左侧文件
    const closeLeftFiles = () => {
        const currentIndex = openFiles.findIndex((file: FrameFile) => file.path === contextMenu.filePath);
        if (currentIndex !== -1) {
            for (let i = 0; i < currentIndex; i++) {
                dispatch(removeFrameFile(openFiles[i].path));
            }
        }
        closeContextMenu();
    };

    // 切换下拉菜单显示状态
    const toggleDropdown = () => {
        setShowDropdown(!showDropdown);
    };

    // 关闭下拉菜单
    const closeDropdown = () => {
        setShowDropdown(false);
    };
    
    // 在资源管理器中显示
    const showInExplorer = async () => {
        try {
            // 获取文件路径
            const path = contextMenu.filePath;
            
            // 获取文件所在目录
            const dirPath = path.substring(0, path.lastIndexOf('\\'));
            
            // 使用Command API直接执行命令打开文件夹
            const { Command } = await import('@tauri-apps/plugin-shell');
            const { platform } = await import('@tauri-apps/plugin-os');
            
            // 获取当前操作系统平台
            const os = await platform();            
            let commandName = 'explorer-dir'; // Windows默认
            
            // 根据不同平台选择命令
            if (os.toLowerCase() === 'darwin') {
                commandName = 'open-dir-mac'; // macOS
            } else if (os.toLowerCase() === 'linux') {
                commandName = 'open-dir-linux'; // Linux
            }
            
            // 执行命令
            const command = Command.create(commandName, [dirPath]);
            const output = await command.execute();            
            // 显示成功消息
        } catch (error) {
            console.error('打开文件夹失败:', error);
        }
        closeContextMenu();
    };

    // 处理导出
    const handleExport = async (exportAll: boolean) => {
        try {
            if (!activeFilePath) return;

            // 选择导出目录
            const selectedDir = await open({
                directory: true,
                multiple: false,
                title: '选择导出目录'
            });

            if (!selectedDir) return;

            // 显示进度对话框
            setShowExportProgress(true);

            // 根据 exportAll 选择导出内容
            const entries = exportAll ? getAllFrameEntries() : getFilteredFrameEntries();

            // 调用导出服务
            await exportFrames({
                sourcePath: activeFilePath,
                exportDir: selectedDir,
                entries
            });

            toast.success('导出成功');
        } catch (error) {
            console.error('导出失败:', error);
            toast.error(`导出失败: ${error}`);
        } finally {
            setShowExportProgress(false);
            setShowExportDialog(false);
        }
    };

    const renderMoreButton = () => (
        <div ref={dropdownRef} className="relative flex flex-shrink-0">
            <button
                className="h-7 w-7 hover:bg-base-200 rounded flex items-center justify-center"
                onClick={toggleDropdown}
                title="更多文件"
            >
                <span className="text-xs font-medium">...</span>
            </button>

            {showDropdown && (
                <div className="absolute right-0 top-full mt-1 bg-base-100 border border-base-300 rounded-md shadow-lg z-50 w-64">
                    <div className="p-1 max-h-60 overflow-y-auto">
                        {openFiles.map(file => (
                            <div
                                key={file.path}
                                className={`px-3 py-2 flex items-center justify-between rounded-md cursor-pointer ${file.path === activeFilePath ? 'bg-primary/10 text-primary' : 'hover:bg-base-200'
                                    }`}
                                onClick={() => {
                                    handleTabClick(file.path);
                                    closeDropdown();
                                }}
                            >
                                <span className="truncate">{file.name}</span>
                                <button
                                    className="p-1 rounded-full hover:bg-base-300 text-base-content/70"
                                    onClick={(e) => {
                                        handleCloseClick(e, file.path);
                                        closeDropdown();
                                    }}
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );

    // 渲染单个标签
    const renderTab = (file: FrameFile) => (
        <div
            key={file.path}
            className={`h-full flex items-center border-r border-base-300 cursor-pointer ${file.path === activeFilePath ? 'bg-primary/10 text-primary' : 'hover:bg-base-200'
                }`}
            onClick={() => handleTabClick(file.path)}
            onContextMenu={(e) => handleContextMenu(e, file.path)}
        >
            <div className="flex items-center px-2 w-full overflow-hidden">
                <span className="truncate flex-grow text-xs">{file.name}</span>
                <button
                    className="ml-1 p-0.5 rounded-full hover:bg-base-300 text-base-content/70 flex-shrink-0"
                    onClick={(e) => handleCloseClick(e, file.path)}
                >
                    <X className="w-3 h-3" />
                </button>
            </div>
        </div>
    );
    const menuItemClass = "px-4 py-2 hover:bg-base-200 flex items-center gap-2 cursor-pointer";

    return (
        <div className="h-9 w-full border-b border-base-300 bg-base-100 relative">
            <div className="absolute left-0 top-0 bottom-0 right-[80px] overflow-hidden">
                <div className="h-full w-full overflow-x-auto hide-scrollbar">
                    <div className="flex h-full">
                        {openFiles.length > 0 ? (
                            openFiles.map((file: FrameFile) => renderTab(file))
                        ) : (
                            <div className="h-full flex items-center px-3 text-base-content/50">
                                <span className="text-xs">没有打开的文件</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="absolute right-0 top-0 bottom-0 w-[80px] flex items-center justify-end border-l border-base-300 bg-base-100">
                {openFiles.length > 0 && (
                    <>
                        <div className="flex-shrink-0 mr-1">
                            {renderMoreButton()}
                        </div>
                        <button 
                            className="btn btn-primary btn-sm mx-1 flex-shrink-0"
                            onClick={() => setShowExportDialog(true)}
                            title="导出"
                        >
                            <Download className="h-4 w-4" />
                        </button>
                    </>
                )}
                <button className="btn btn-primary btn-sm mx-1 flex-shrink-0" onClick={onOpenFile}>
                    <FolderOpen className="h-4 w-4" />
                </button>
            </div>

            {fileToClose && (
                <FileCloseConfirmDialog
                    fileName={openFiles.find((f: FrameFile) => f.path === fileToClose)?.name || ''}
                    onCancel={cancelClose}
                    onConfirm={confirmClose}
                />
            )}

            {contextMenu.visible && (
                <>
                    <div
                        className="fixed inset-0 z-50"
                        onClick={closeContextMenu}
                    ></div>
                    <div
                        className="bg-base-100 border border-base-300 rounded shadow-lg w-64 z-50"
                        style={{
                            position: 'fixed',
                            top: contextMenu.y,
                            left: contextMenu.x,
                        }}
                    >
                        <ul className="py-1">
                            <li className={menuItemClass} onClick={closeCurrentFile}>
                                <XIcon className="w-4 h-4" />
                                <span>关闭</span>
                            </li>
                            <li className={menuItemClass} onClick={closeOtherFiles}>
                                <XIcon className="w-4 h-4" />
                                <span>关闭其他</span>
                            </li>
                            <li className={menuItemClass} onClick={closeRightFiles}>
                                <ChevronDoubleLeftIcon className="w-4 h-4" />
                                <span>关闭右侧</span>
                            </li>
                            <li className={menuItemClass} onClick={closeLeftFiles}>
                                <ChevronDoubleRightIcon className="w-4 h-4" />
                                <span>关闭左侧</span>
                            </li>
                            <li className="border-t border-base-300 my-1"></li>
                            <li className={menuItemClass} onClick={showInExplorer}>
                                <FolderIcon className="w-4 h-4" />
                                <span>在资源管理器中显示</span>
                            </li>
                        </ul>
                    </div>
                </>
            )}

            {showExportDialog && (
                <ExportDialog
                    onCancel={() => setShowExportDialog(false)}
                    onConfirm={handleExport}
                />
            )}

            {showExportProgress && (
                <ExportProgressDialog
                    onCancel={() => setShowExportProgress(false)}
                />
            )}
        </div>
    );
};

// 主组件
const FrameView: React.FC = () => {
    const [isDragging, setIsDragging] = useState(false);
    const [unlistenFns, setUnlistenFns] = useState<UnlistenFn[]>([]);
    const dragTargetRef = useRef<HTMLDivElement>(null);

    const dispatch = useDispatch();
    const openFiles = useSelector(selectOpenFrameFiles);
    const activeFilePath = useSelector(selectActiveFrameFilePath);
    const activeFile = useSelector(selectActiveFrameFile);
    const activeFileContents = useSelector((state: RootState) =>
        activeFilePath ? selectFrameFileContents(state, activeFilePath) : null
    );
    const isLoading = useSelector(selectIsLoading);
    const error = useSelector(selectError);

    // 加载文件
    const loadFile = async (path: string) => {
        try {
            // 检查文件是否已经在打开列表中
            const existingFile = openFiles.find((file: FrameFile) => file.path === path);
            if (existingFile) {
                dispatch(setActiveFrameFile(path));
                return;
            }

            const fileStats = await lstat(path);

            // 创建文件对象
            const fileTab: FrameFile = {
                path,
                name: path.split(/[\/\\]/).pop() || '未命名文件',
                size: fileStats.size,
                lastModified: Date.now(),
                isActive: false
            };

            dispatch(addFrameFile(fileTab));
            dispatch(setActiveFrameFile(path));
            dispatch(setLoading(true));

            try {
                // 读取整个文件
                const buffer = await readFile(path);

                // 解析整个文件
                const { entries, segments } = parseFrameChunk(buffer, 0, buffer.length);

                if (entries.length > 0) {
                    // 初始化过滤器（包含时间范围）
                    dispatch(initializeFrameFilter({
                        path: path,
                        entries: entries
                    }));

                    // 将解析结果添加到store
                    dispatch(addFrameChunk({
                        path: path,
                        chunk: 0,
                        content: entries,
                        startByte: 0,
                        endByte: buffer.length
                    }));

                    toast.success(`成功解析 ${entries.length} 个报文，使用了 ${segments} 个段`);
                } else {
                    toast.error('未能解析出任何报文内容');
                }
            } catch (error) {
                console.error('解析文件失败:', error);
                const errorMessage = error instanceof Error ? error.message : String(error);
                dispatch(setError(errorMessage));
                toast.error(`解析文件失败: ${errorMessage}`);
            } finally {
                dispatch(setLoading(false));
            }

        } catch (error) {
            console.error('加载文件失败:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            dispatch(setError(errorMessage));
            toast.error(`文件 ${path} 加载失败: ${errorMessage}`);
            dispatch(setLoading(false));
        }
    };

    // 打开文件对话框
    const handleOpenFile = async () => {
        try {
            const selected = await open({
                multiple: false,
                filters: [
                    { name: '所有文件', extensions: ['*'] }
                ]
            });

            if (selected) {
                await loadFile(selected as string);
            }
        } catch (error) {
            console.error('打开文件失败:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            toast.error(`打开文件失败: ${errorMessage}`);
        }
    };

    // 处理拖放
    useEffect(() => {
        const setupTauriEvents = async () => {
            try {
                const unlistenDragEnter = await listen('tauri://drag-enter', () => {
                    const currentPath = window.location.pathname;
                    if (currentPath.includes('frame-view')) {
                        setIsDragging(true);
                    }
                    setIsDragging(true);
                });

                const unlistenDragLeave = await listen('tauri://drag-leave', () => {
                    const currentPath = window.location.pathname;
                    if (currentPath.includes('frame-view')) {
                        setIsDragging(false);
                    }
                    setIsDragging(false);
                });

                const unlistenDrop = await listen('tauri://drag-drop', async (event) => {
                    const currentPath = window.location.pathname;
                    if (currentPath.includes('frame-view')) {
                        setIsDragging(false);
                    }
                    setIsDragging(false);

                    if (typeof event.payload === 'object' && event.payload !== null && 'paths' in event.payload) {
                        const paths = event.payload.paths as string[];
                        if (!paths || !Array.isArray(paths) || paths.length === 0) {
                            return;
                        }

                        try {
                            await Promise.all(paths.map(path => loadFile(path)));
                            toast.success(`成功加载 ${paths.length} 个文件`);
                        } catch (error) {
                            const errorMessage = error instanceof Error ? error.message : String(error);
                            toast.error('文件读取失败');
                            dispatch(setError(errorMessage));
                        }
                    }
                });

                setUnlistenFns(prev => [
                    ...prev,
                    unlistenDragEnter,
                    unlistenDragLeave,
                    unlistenDrop
                ]);
            } catch (err) {
                console.warn('设置拖放事件失败:', err);
            }
        };

        setupTauriEvents();

        return () => {
            unlistenFns.forEach(fn => fn());
        };
    }, []);

    // 渲染报文内容
    const renderFrameContent = () => {
        if (!activeFile) {
            return (
                <div className="flex flex-col items-center justify-center h-full text-base-content/50">
                    <FileText className="h-16 w-16 mb-4" strokeWidth={1} />
                    <p className="text-lg mb-2">没有打开的报文文件</p>
                    <p className="text-sm mb-6">拖放报文文件到此处或点击下方按钮打开</p>
                    <button
                        className="btn btn-primary"
                        onClick={handleOpenFile}
                    >
                        打开报文文件
                    </button>
                </div>
            );
        }

        if (isLoading) {
            return (
                <div className="flex items-center justify-center h-full">
                    <div className="loading loading-spinner loading-lg text-primary"></div>
                    <span className="ml-4">正在加载报文...</span>
                </div>
            );
        }

        if (error) {
            return (
                <div className="flex flex-col items-center justify-center h-full text-error">
                    <XCircle className="h-16 w-16 mb-4" />
                    <p className="text-lg mb-2">加载报文时出错</p>
                    <p className="text-sm mb-6">{error}</p>
                    <button
                        className="btn btn-error"
                        onClick={() => dispatch(setError(null))}
                    >
                        清除错误
                    </button>
                </div>
            );
        }

        const frameEntries = getFilteredFrameEntries();

        if (frameEntries.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center h-full text-base-content/50">
                    <FileText className="h-16 w-16 mb-4" />
                    <p className="text-lg mb-2">没有找到报文条目</p>
                    <p className="text-sm">尝试调整过滤器或加载更多报文数据</p>
                </div>
            );
        }

        return (
            <VirtualFrameList
                frames={frameEntries}
                height={window.innerHeight - 200}
                itemHeight={30}
            />
        );
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <FileTabs onOpenFile={handleOpenFile} />
            <div
                ref={dragTargetRef}
                className={`flex-1 overflow-hidden ${isDragging ? 'bg-primary/10 border-2 border-dashed border-primary' : ''}`}
            >
                {isDragging ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                            <FileText className="h-16 w-16 mx-auto mb-4 text-primary" />
                            <p className="text-lg font-medium">释放鼠标以添加报文文件</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col h-full">
                        <FrameFilter />
                        <div className="flex-1 overflow-hidden">
                            {renderFrameContent()}
                        </div>
                    </div>
                )}
            </div>

            <div className="p-2 border-t border-base-300 bg-base-200/50 flex justify-between items-center text-xs text-base-content/70">
                <div>
                    {activeFile && (
                        <>
                            <span>文件: {activeFile.name}</span>
                            <span className="mx-2">|</span>
                            <span>大小: {(activeFile.size / 1024).toFixed(2)} KB</span>
                        </>
                    )}
                </div>
                <div>
                    {activeFile && (
                        <>
                            <span>报文条目: {getAllFrameEntries().length}</span>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FrameView;