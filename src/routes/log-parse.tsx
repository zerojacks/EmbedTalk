import React, { useRef, useEffect, useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { store } from '../store';
import { selectSplitSize, setSplitSize } from '../store/slices/splitSizeSlice';
import {
    addLogFile,
    removeLogFile,
    setActiveLogFile,
    addLogChunk,
    clearOldChunks,
    setLogFilter,
    initializeFileFilter,
    setLoading,
    setError,
    selectOpenLogFiles,
    selectActiveLogFilePath,
    selectActiveLogFile,
    selectLogFileContents,
    selectLogFilter,
    selectIsLoading,
    selectError,
    LogEntry,
    LogFile
} from '../store/slices/logParseSlice';
import { toast } from '../context/ToastProvider';
import { open } from '@tauri-apps/plugin-dialog';
import { lstat, readFile } from '@tauri-apps/plugin-fs';
import { listen } from '@tauri-apps/api/event';
import { UnlistenFn } from '@tauri-apps/api/event';
import { selectEffectiveTheme } from '../store/slices/themeSlice';
import { parseLogChunk } from '../services/logParser';
import { FolderOpen, FileText, X, XCircle } from 'lucide-react'
import { XIcon, FolderIcon, ChevronDoubleLeftIcon,ChevronDoubleRightIcon } from '@heroicons/react/outline'
import { Command } from '@tauri-apps/plugin-shell';
// 常量定义
const CHUNK_SIZE = 64 * 1024; // 64KB 块大小
const CACHE_MAX_AGE = 5 * 60 * 1000; // 5分钟缓存过期时间

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

// 获取日志级别的样式类
const getLevelClass = (level: string | null | undefined) => {
    switch (level?.toUpperCase()) {
        case 'DEBUG': return 'text-info';
        case 'INFO': return 'text-success';
        case 'WARN': return 'text-warning';
        case 'ERROR': return 'text-error';
        case 'FATAL': return 'text-error font-bold';
        default: return 'text-base-content';
    }
};

// 可调整列宽的表格头部组件
const LogTableHeader: React.FC = () => {
    const [resizing, setResizing] = useState(false);
    const [columns, setColumns] = useState([
        { width: 200, minWidth: 200 },
        { width: 150, minWidth: 150 },
        { width: 120, minWidth: 120 },
    ]);
    const startColumnX = useRef(0);
    const activeColumnIndex = useRef(-1);
    const startColumnWidth = useRef(0);

    const startResizing = (e: React.MouseEvent, index: number) => {
        setResizing(true);
        startColumnX.current = e.clientX;
        activeColumnIndex.current = index;
        startColumnWidth.current = columns[index].width;
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', stopResizing);
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!resizing) return;
        const index = activeColumnIndex.current;
        if (index === -1) return;

        const deltaX = e.clientX - startColumnX.current;
        const newWidth = Math.max(columns[index].minWidth, startColumnWidth.current + deltaX);
        
        setColumns(prev => {
            const newColumns = [...prev];
            newColumns[index] = { ...newColumns[index], width: newWidth };
            return newColumns;
        });
    };

    const stopResizing = () => {
        setResizing(false);
        activeColumnIndex.current = -1;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', stopResizing);
    };

    useEffect(() => {
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', stopResizing);
        };
    }, []);

    return (
        <thead>
            <tr className="text-xs bg-base-200/80 sticky top-0 z-10">
                <th className="py-2 px-2 font-medium text-left relative" style={{ width: `${columns[0].width}px`, maxWidth: `${columns[0].width}px` }}>
                    时间
                    <div 
                        className="absolute top-0 right-0 h-full w-1 cursor-col-resize hover:bg-primary/50 active:bg-primary"
                        onMouseDown={(e) => startResizing(e, 0)}
                    ></div>
                </th>
                <th className="py-2 px-2 font-medium text-left relative" style={{ width: `${columns[1].width}px`, maxWidth: `${columns[1].width}px` }}>
                    级别/标签
                    <div 
                        className="absolute top-0 right-0 h-full w-1 cursor-col-resize hover:bg-primary/50 active:bg-primary"
                        onMouseDown={(e) => startResizing(e, 1)}
                    ></div>
                </th>
                <th className="py-2 px-2 font-medium text-left relative" style={{ width: `${columns[2].width}px`, maxWidth: `${columns[2].width}px` }}>
                    PID/TID
                    <div 
                        className="absolute top-0 right-0 h-full w-1 cursor-col-resize hover:bg-primary/50 active:bg-primary"
                        onMouseDown={(e) => startResizing(e, 2)}
                    ></div>
                </th>
                <th className="py-2 px-2 font-medium text-left" style={{ maxWidth: 'calc(100% - 400px)' }}>
                    消息
                </th>
            </tr>
        </thead>
    );
};

// 日志条目组件
const LogEntryRow: React.FC<{ entry: LogEntry }> = ({ entry }) => {
    const logtag = entry.tag ? `${entry.level}#${entry.tag}` : entry.level;
    const pidTid = (entry.pid || entry.tid) ? `[pid:${entry.pid || '-'} tid:${entry.tid || '-'}]` : '';
    const funcLine = (entry.func && entry.line) ? `${entry.func}:${entry.line}` : '';
    const message = entry.message || entry.rawData;
    
    return (
        <tr className="border-b border-base-200 hover:bg-base-200/50 transition-colors text-xs">
            <td className="py-1 px-2 font-mono whitespace-nowrap overflow-hidden text-ellipsis" style={{ width: '180px', maxWidth: '180px' }} title={entry.timeStamp || ''}>
                <span className={getLevelClass(entry.level)}>
                    {entry.timeStamp}
                </span>
            </td>
            <td className="py-1 px-2 whitespace-nowrap overflow-hidden text-ellipsis" style={{ width: '100px', maxWidth: '100px' }} title={logtag || ''}>
                <span className={getLevelClass(entry.level)}>
                    {logtag}
                </span>
            </td>
            <td className="py-1 px-2 whitespace-nowrap overflow-hidden text-ellipsis" style={{ width: '120px', maxWidth: '120px' }} title={pidTid || ''}>
                <span className="text-base-content/70">
                    {pidTid}
                </span>
            </td>
            <td className="py-1 px-2 w-auto" style={{ maxWidth: '100px' }}>
                <div className="overflow-hidden">
                    <span className="text-base-content/70 break-all whitespace-pre-wrap" style={{ wordBreak: 'break-word', overflowWrap: 'break-word', display: 'block' }}>
                        {funcLine && <span className="mr-1">{funcLine}</span>}
                        {message}
                    </span>
                </div>
            </td>
        </tr>
    );
};

// 表格式虚拟滚动列表组件
const VirtualLogList: React.FC<{ 
    logs: LogEntry[],
    height: number,
    itemHeight: number 
}> = ({ logs, height }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    
    // 按时间戳升序排序日志
    const sortedLogs = [...logs].sort((a, b) => {
        const timeA = new Date(a.timeStamp || 0).getTime();
        const timeB = new Date(b.timeStamp || 0).getTime();
        return timeA - timeB; // 升序排列
    });
    
    // 如果没有日志，显示空表格
    if (sortedLogs.length === 0) {
        return (
            <div className="h-full overflow-hidden" ref={containerRef}>
                <table className="table table-pin-rows table-sm w-full">
                    <LogTableHeader />
                    <tbody>
                        <tr>
                            <td colSpan={4} className="text-center py-4 text-base-content/50">
                                没有日志数据
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        );
    }
    
    return (
        <div className="h-full overflow-auto" ref={containerRef}>
            <table className="table table-pin-rows table-sm w-full table-fixed">
                <LogTableHeader />
                <tbody>
                    {sortedLogs.map(log => (
                        <LogEntryRow key={log.id} entry={log} />
                    ))}
                </tbody>
            </table>
        </div>
    );
};

// 日志过滤器组件
const LogFilter: React.FC<{ availableTags: string[] }> = ({ availableTags }) => {
    const dispatch = useDispatch();
    const filter = useSelector(selectLogFilter);
    
    const handleLevelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const level = e.target.value === 'ALL' ? null : e.target.value;
        dispatch(setLogFilter({ level }));
    };
    
    const handleTagChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const tag = e.target.value === 'ALL' ? null : e.target.value;
        dispatch(setLogFilter({ tag }));
    };
    
    const handleKeywordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const keyword = e.target.value || null;
        dispatch(setLogFilter({ keyword }));
    };
    
    const handleStartTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const startTime = e.target.value || null;
        dispatch(setLogFilter({ startTime }));
    };
    
    const handleEndTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const endTime = e.target.value || null;
        dispatch(setLogFilter({ endTime }));
    };
    
    return (
        <div className="flex flex-wrap gap-2 p-2 bg-base-200/50 border-b border-base-300">
            {/* 第一行过滤器 */}
            <div className="w-full flex flex-wrap gap-2">
                <div className="flex-none w-[120px] flex items-center">
                    <label className="text-xs mr-1 whitespace-nowrap">级别:</label>
                    <select 
                        className="select select-xs select-bordered w-full"
                        value={filter.level || 'ALL'}
                        onChange={handleLevelChange}
                    >
                        <option value="ALL">全部</option>
                        <option value="DEBUG">DEBUG</option>
                        <option value="INFO">INFO</option>
                        <option value="WARN">WARN</option>
                        <option value="ERROR">ERROR</option>
                        <option value="FATAL">FATAL</option>
                    </select>
                </div>
                
                <div className="flex-none w-[150px] flex items-center">
                    <label className="text-xs mr-1 whitespace-nowrap">标签:</label>
                    <select 
                        className="select select-xs select-bordered w-full"
                        value={filter.tag || 'ALL'}
                        onChange={handleTagChange}
                    >
                        <option value="ALL">全部</option>
                        {availableTags.map(tag => (
                            <option key={tag} value={tag}>{tag}</option>
                        ))}
                    </select>
                </div>
                
                <div className="flex-1 flex items-center">
                    <label className="text-xs mr-1 whitespace-nowrap">关键字:</label>
                    <input 
                        type="text" 
                        className="input input-xs input-bordered w-full"
                        value={filter.keyword || ''}
                        onChange={handleKeywordChange}
                        placeholder="搜索..."
                    />
                </div>
            </div>
            
            {/* 第二行时间过滤器 */}
            <div className="w-full flex flex-wrap gap-2">
                <div className="flex-1 min-w-[250px] max-w-[400px] flex items-center">
                    <label className="text-xs mr-1 whitespace-nowrap">开始时间:</label>
                    <input 
                        type="datetime-local" 
                        className="input input-xs input-bordered w-full"
                        value={filter.startTime || ''}
                        onChange={handleStartTimeChange}
                    />
                </div>
                
                <div className="flex-1 min-w-[250px] max-w-[400px] flex items-center">
                    <label className="text-xs mr-1 whitespace-nowrap">结束时间:</label>
                    <input 
                        type="datetime-local" 
                        className="input input-xs input-bordered w-full"
                        value={filter.endTime || ''}
                        onChange={handleEndTimeChange}
                    />
                </div>
            </div>
        </div>
    );
};

// 文件标签页组件 - 简化版
const FileTabs = ({ onOpenFile }: { onOpenFile: () => void }) => {
    const dispatch = useDispatch();
    const openFiles = useSelector(selectOpenLogFiles);
    const activeFilePath = useSelector(selectActiveLogFilePath);
    const [fileToClose, setFileToClose] = useState<string | null>(null);
    const [showDropdown, setShowDropdown] = useState(false);
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
        dispatch(setActiveLogFile(path));
    };
    
    // 处理关闭按钮点击
    const handleCloseClick = (e: React.MouseEvent, path: string) => {
        e.stopPropagation();
        setFileToClose(path);
    };
    
    // 确认关闭文件
    const confirmClose = () => {
        if (fileToClose) {
            dispatch(removeLogFile(fileToClose));
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
        openFiles.forEach(file => {
            if (file.path !== currentPath) {
                dispatch(removeLogFile(file.path));
            }
        });
        dispatch(setActiveLogFile(currentPath));
        closeContextMenu();
    };
    
    // 关闭右侧文件
    const closeRightFiles = () => {
        const currentIndex = openFiles.findIndex(file => file.path === contextMenu.filePath);
        if (currentIndex !== -1) {
            for (let i = currentIndex + 1; i < openFiles.length; i++) {
                dispatch(removeLogFile(openFiles[i].path));
            }
        }
        closeContextMenu();
    };
    
    // 关闭左侧文件
    const closeLeftFiles = () => {
        const currentIndex = openFiles.findIndex(file => file.path === contextMenu.filePath);
        if (currentIndex !== -1) {
            for (let i = 0; i < currentIndex; i++) {
                dispatch(removeLogFile(openFiles[i].path));
            }
        }
        closeContextMenu();
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
    
    // 切换下拉菜单显示状态
    const toggleDropdown = () => {
        setShowDropdown(!showDropdown);
    };
    
    // 关闭下拉菜单
    const closeDropdown = () => {
        setShowDropdown(false);
    };
    
    // 点击外部时关闭下拉菜单
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        };
        
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);
    
    // 渲染单个标签
    const renderTab = (file: LogFile) => (
        <div 
            key={file.path}
            data-path={file.path}
            title={file.name}
            className={`h-full flex items-center border-r border-base-300 cursor-pointer ${
                file.path === activeFilePath ? 'bg-primary/10 text-primary' : 'hover:bg-base-200'
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
    
    // 渲染更多文件按钮
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
                                className={`px-3 py-2 flex items-center justify-between rounded-md cursor-pointer ${
                                    file.path === activeFilePath ? 'bg-primary/10 text-primary' : 'hover:bg-base-200'
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
    
    // 渲染右键菜单
    const renderContextMenu = () => {
        if (!contextMenu.visible) return null;
        
        const menuStyle = {
            position: 'fixed' as const,
            top: `${contextMenu.y}px`,
            left: `${contextMenu.x}px`,
            zIndex: 1000,
        };
        
        const menuItemClass = "px-4 py-2 hover:bg-base-200 flex items-center gap-2 cursor-pointer";
        
        return (
            <>
                <div 
                    className="fixed inset-0 z-50" 
                    onClick={closeContextMenu}
                ></div>
                <div 
                    className="bg-base-100 border border-base-300 rounded shadow-lg w-64 z-50"
                    style={menuStyle}
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
        );
    };
    
    return (
        <div className="h-9 w-full border-b border-base-300 bg-base-100 relative">
            {/* 左侧标签区域 */}
            <div className="absolute left-0 top-0 bottom-0 right-[80px] overflow-hidden">
                <div className="h-full w-full overflow-x-auto hide-scrollbar">
                    <div className="flex h-full">
                        {openFiles.length > 0 ? (
                            openFiles.map(file => renderTab(file))
                        ) : (
                            <div className="h-full flex items-center px-3 text-base-content/50">
                                <span className="text-xs">没有打开的文件</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            {/* 右侧按钮区域 - 固定宽度 */}
            <div className="absolute right-0 top-0 bottom-0 w-[80px] flex items-center justify-end border-l border-base-300 bg-base-100">
                {openFiles.length > 0 && (
                    <div className="flex-shrink-0 mr-1">
                        {renderMoreButton()}
                    </div>
                )}
                <button className="btn btn-primary btn-sm mx-1 flex-shrink-0" onClick={onOpenFile}>
                    <FolderOpen className="h-4 w-4" />
                </button>
            </div>
            
            {/* 文件关闭确认对话框 */}
            {fileToClose && (
                <FileCloseConfirmDialog
                    fileName={openFiles.find(f => f.path === fileToClose)?.name || ''}
                    onCancel={cancelClose}
                    onConfirm={confirmClose}
                />
            )}
            
            {/* 右键菜单 */}
            {contextMenu.visible && renderContextMenu()}
        </div>
    );
};

// 主日志解析组件
export default function LogParse() {
    const [isDragging, setIsDragging] = useState(false);
    const [unlistenFns, setUnlistenFns] = useState<UnlistenFn[]>([]);
    const effectiveTheme = useSelector(selectEffectiveTheme);
    const dragTargetRef = useRef<HTMLDivElement>(null);
    
    const dispatch = useDispatch();
    const splitSize = useSelector(selectSplitSize);
    const openFiles = useSelector(selectOpenLogFiles);
    const activeFilePath = useSelector(selectActiveLogFilePath);
    const activeFile = useSelector(selectActiveLogFile);
    const activeFileContents = useSelector((state: RootState) => 
        activeFilePath ? selectLogFileContents(state, activeFilePath) : null
    );
    const isLoading = useSelector(selectIsLoading);
    const error = useSelector(selectError);
    const filter = useSelector(selectLogFilter);
    
    const handlePanelResize = (sizes: number[]) => {
        dispatch(setSplitSize(sizes));
    };
    
    // 获取所有日志条目
    const getAllLogEntries = (): LogEntry[] => {
        if (!activeFileContents) return [];
        
        // 合并所有已加载的块中的日志条目
        let allEntries: LogEntry[] = [];
        Object.values(activeFileContents.chunks).forEach(chunk => {
            allEntries = [...allEntries, ...chunk.content];
        });
        
        // 按时间戳排序
        return allEntries.sort((a, b) => 
            new Date(a.timeStamp).getTime() - new Date(b.timeStamp).getTime()
        );
    };
    
    // 获取指定文件的所有日志条目
    const getFileLogEntries = (filePath: string): LogEntry[] => {
        const state = store.getState() as RootState;
        const fileContents = selectLogFileContents(state, filePath);
        
        if (!fileContents) return [];
        
        // 合并所有已加载的块中的日志条目
        let allEntries: LogEntry[] = [];
        Object.values(fileContents.chunks).forEach(chunk => {
            allEntries = [...allEntries, ...chunk.content];
        });
        
        // 按时间戳排序
        return allEntries.sort((a, b) => 
            new Date(a.timeStamp).getTime() - new Date(b.timeStamp).getTime()
        );
    };
    
    // 初始化文件过滤器为默认值
    const initializeFileFilterWithDefaults = (filePath: string) => {
        // 获取文件的所有日志条目
        const entries = getFileLogEntries(filePath);
        
        if (entries.length === 0) {
            // 如果没有条目，使用空的默认值
            dispatch(initializeFileFilter({
                path: filePath
            }));
            return;
        }
        
        // 找出最小和最大时间
        let minTimeStr: string | undefined = undefined;
        let maxTimeStr: string | undefined = undefined;
        
        // 首先收集所有有效的时间戳
        const validTimestamps: string[] = [];
        
        entries.forEach(entry => {
            if (entry.timeStamp) {
                try {
                    const entryTime = new Date(entry.timeStamp);
                    if (!isNaN(entryTime.getTime())) {
                        validTimestamps.push(entry.timeStamp);
                    }
                } catch (e) {
                    // 忽略无效的时间戳
                }
            }
        });
        
        // 如果有有效的时间戳，找出最小和最大值
        if (validTimestamps.length > 0) {
            // 按时间戳排序
            validTimestamps.sort((a, b) => {
                return new Date(a).getTime() - new Date(b).getTime();
            });
            
            minTimeStr = validTimestamps[0];
            maxTimeStr = validTimestamps[validTimestamps.length - 1];
        }
        
        // 初始化过滤器
        dispatch(initializeFileFilter({
            path: filePath,
            minTime: minTimeStr,
            maxTime: maxTimeStr
        }));
    };
    
    // 获取所有唯一的标签
    const getAllTags = (): string[] => {
        const allEntries = getAllLogEntries();
        const tagSet = new Set<string>();
        
        allEntries.forEach(entry => {
            if (entry.tag) {
                tagSet.add(entry.tag);
            }
        });
        
        return Array.from(tagSet).sort();
    };
    
    // 应用过滤器
    const getFilteredLogEntries = (): LogEntry[] => {
        let entries = getAllLogEntries();
        
        // 应用级别过滤
        if (filter.level) {
            entries = entries.filter(entry => entry.level === filter.level);
        }
        
        // 应用标签过滤
        if (filter.tag) {
            const tagFilter = filter.tag.toLowerCase();
            entries = entries.filter(entry => 
                entry.tag?.toLowerCase().includes(tagFilter)
            );
        }
        
        // 应用关键字过滤
        if (filter.keyword) {
            const keyword = filter.keyword.toLowerCase();
            entries = entries.filter(entry => 
                entry.message?.toLowerCase().includes(keyword) ||
                entry.rawData?.toLowerCase().includes(keyword)
            );
        }
        
        // 应用时间范围过滤
        if (filter.startTime || filter.endTime) {
            entries = entries.filter(entry => {
                const entryTime = new Date(entry.timeStamp);
                
                if (filter.startTime && entryTime < new Date(filter.startTime)) {
                    return false;
                }
                
                if (filter.endTime && entryTime > new Date(filter.endTime)) {
                    return false;
                }
                
                return true;
            });
        }
        
        return entries;
    };
    
    // 加载文件块 - 优化版本，支持缓存
    const loadFileChunk = async (filePath: string, chunk: number) => {
        const start = chunk * CHUNK_SIZE;
        
        try {
            // 首先检查这个块是否已经在缓存中
            const state = store.getState() as RootState;
            const fileContents = selectLogFileContents(state, filePath);
            
            // 如果这个块已经存在于缓存中，则直接返回
            if (fileContents && fileContents.chunks[chunk]) {
                console.log(`使用缓存的文件块: ${filePath}, 块编号: ${chunk}`);
                return;
            }
            
            dispatch(setLoading(true));
            
            const buffer = await readFile(filePath);
            const end = buffer.length;
            
            // 使用 logParser 服务解析日志，现在使用并行处理
            const entries = await parseLogChunk(buffer, start, end, CHUNK_SIZE);
            
            // 将解析的日志条目添加到Redux存储中
            dispatch(addLogChunk({
                path: filePath,
                chunk,
                content: entries,
                startByte: start,
                endByte: end
            }));
            
            // 清理旧的块，保持内存使用量合理
            dispatch(clearOldChunks({
                maxAge: CACHE_MAX_AGE,
                excludePath: filePath // 不清理当前文件的块
            }));
            
            dispatch(setLoading(false));
        } catch (error) {
            console.error('加载文件块失败:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            dispatch(setError(errorMessage));
            dispatch(setLoading(false));
            toast.error(`加载文件块失败: ${errorMessage}`);
        }
    };
    
    // 加载文件 - 优化版本，避免重复解析
    const loadFile = async (path: string) => {
        try {
            // 检查文件是否已经在打开列表中
            const existingFile = openFiles.find(file => file.path === path);
            if (existingFile) {
                // 如果文件已经打开，只需要设置为活动文件
                dispatch(setActiveLogFile(path));
                return;
            }
            
            const fileStats = await lstat(path);
            
            // 创建文件对象
            const fileTab: LogFile = {
                path,
                name: path.split(/[\/\\]/).pop() || '未命名文件',
                size: fileStats.size,
                lastModified: Date.now(),
                isActive: false
            };
            
            // 添加文件并设置为活动文件
            dispatch(addLogFile(fileTab));
            dispatch(setActiveLogFile(path));
            
            // 获取当前的Redux状态中的文件内容缓存
            const state = store.getState() as RootState;
            const cachedContents = selectLogFileContents(state, path);
            
            // 如果没有缓存内容或内容为空，加载第一个块
            if (!cachedContents || Object.keys(cachedContents.chunks).length === 0) {
                await loadFileChunk(path, 0);
                
                // 在加载完文件内容后，初始化该文件的过滤器
                initializeFileFilterWithDefaults(path);
            } else {
                // 如果有缓存内容，但还没有初始化过滤器，也初始化一下
                const currentState = store.getState() as RootState;
                if (!currentState.logParse.fileFilters[path]) {
                    initializeFileFilterWithDefaults(path);
                }
            }
        } catch (error) {
            console.error('加载文件失败:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            dispatch(setError(errorMessage));
            toast.error(`文件 ${path} 加载失败: ${errorMessage}`);
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
                const { listen } = await import('@tauri-apps/api/event');
                
                const unlistenDragEnter = await listen('tauri://drag-enter', () => {
                    setIsDragging(true);
                });
                
                const unlistenDragLeave = await listen('tauri://drag-leave', () => {
                    setIsDragging(false);
                });
                
                const unlistenDrop = await listen('tauri://drag-drop', async (event) => {
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
                        } finally {
                            dispatch(setLoading(false));
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
            // 清理函数会在 unlistenFns 的 useEffect 中处理
        };
    }, []);
    
    // 定期清理旧的缓存块
    useEffect(() => {
        const cleanupInterval = setInterval(() => {
            dispatch(clearOldChunks(CACHE_MAX_AGE));
        }, CACHE_MAX_AGE);
        
        return () => clearInterval(cleanupInterval);
    }, [dispatch]);
    
    // 组件卸载时清理监听器
    useEffect(() => {
        return () => {
            unlistenFns.forEach(fn => fn());
        };
    }, [unlistenFns]);
    
    // 渲染日志内容
    const renderLogContent = () => {
        if (!activeFile) {
            return (
                <div className="flex flex-col items-center justify-center h-full text-base-content/50">
                    <FileText className="h-16 w-16 mb-4" strokeWidth={1} />
                    <p className="text-lg mb-2">没有打开的日志文件</p>
                    <p className="text-sm mb-6">拖放日志文件到此处或点击下方按钮打开</p>
                    <button 
                        className="btn btn-primary"
                        onClick={handleOpenFile}
                    >
                        打开日志文件
                    </button>
                </div>
            );
        }
        
        if (isLoading) {
            return (
                <div className="flex items-center justify-center h-full">
                    <div className="loading loading-spinner loading-lg text-primary"></div>
                    <span className="ml-4">正在加载日志...</span>
                </div>
            );
        }
        
        if (error) {
            return (
                <div className="flex flex-col items-center justify-center h-full text-error">
                    <XCircle className="h-16 w-16 mb-4" />
                    <p className="text-lg mb-2">加载日志时出错</p>
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
        
        const logEntries = getFilteredLogEntries();
        
        if (logEntries.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center h-full text-base-content/50">
                    <FileText className="h-16 w-16 mb-4" />
                    <p className="text-lg mb-2">没有找到日志条目</p>
                    <p className="text-sm">尝试调整过滤器或加载更多日志数据</p>
                </div>
            );
        }
        
        return (
            <VirtualLogList 
                logs={logEntries} 
                height={window.innerHeight - 200} // 减去顶部和底部元素的高度
                itemHeight={30} // 每个日志条目的估计高度
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
                            <p className="text-lg font-medium">释放鼠标以添加日志文件</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col h-full">
                        <LogFilter availableTags={getAllTags()} />
                        <div className="flex-1 overflow-hidden">
                            {renderLogContent()}
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
                            <span>日志条目: {getAllLogEntries().length}</span>
                            <span className="mx-2">|</span>
                            <span>过滤后: {getFilteredLogEntries().length}</span>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
