import React, { useEffect, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { store } from '../store';
import { selectSplitSize, setSplitSize } from '../store/slices/splitSizeSlice';
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
    FrameFile
} from '../store/slices/frameParseSlice';
import { FrameEntry } from '../services/frameParser';
import { toast } from '../context/ToastProvider';
import { open } from '@tauri-apps/plugin-dialog';
import { lstat, readFile } from '@tauri-apps/plugin-fs';
import { listen } from '@tauri-apps/api/event';
import { UnlistenFn } from '@tauri-apps/api/event';
import { parseFrameChunk } from '../services/frameParser';
import { FolderOpen, FileText, X, XCircle } from 'lucide-react';
import { XIcon, FolderIcon, ChevronDoubleLeftIcon, ChevronDoubleRightIcon } from '@heroicons/react/outline';
import { Command } from '@tauri-apps/plugin-shell';

// 常量定义
const CHUNK_SIZE = 64 * 1024; // 64KB 块大小
const CACHE_MAX_AGE = 5 * 60 * 1000; // 5分钟缓存过期时间

// 获取方向的样式类
const getDirectionClass = (direction: number | undefined) => {
    return direction === 0 ? 'text-info' : 'text-success';
};

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
    const [resizing, setResizing] = useState(false);
    const [columns, setColumns] = useState([
        { width: 200, minWidth: 200 }, // 时间戳
        { width: 80, minWidth: 80 },   // PID
        { width: 80, minWidth: 80 },   // 标签
        { width: 80, minWidth: 80 },   // 端口
        { width: 80, minWidth: 80 },   // 协议
        { width: 80, minWidth: 80 },   // 方向
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
                    时间戳
                    <div 
                        className="absolute top-0 right-0 h-full w-1 cursor-col-resize hover:bg-primary/50 active:bg-primary"
                        onMouseDown={(e) => startResizing(e, 0)}
                    ></div>
                </th>
                <th className="py-2 px-2 font-medium text-left relative" style={{ width: `${columns[1].width}px`, maxWidth: `${columns[1].width}px` }}>
                    PID
                    <div 
                        className="absolute top-0 right-0 h-full w-1 cursor-col-resize hover:bg-primary/50 active:bg-primary"
                        onMouseDown={(e) => startResizing(e, 1)}
                    ></div>
                </th>
                <th className="py-2 px-2 font-medium text-left relative" style={{ width: `${columns[2].width}px`, maxWidth: `${columns[2].width}px` }}>
                    标签
                    <div 
                        className="absolute top-0 right-0 h-full w-1 cursor-col-resize hover:bg-primary/50 active:bg-primary"
                        onMouseDown={(e) => startResizing(e, 2)}
                    ></div>
                </th>
                <th className="py-2 px-2 font-medium text-left relative" style={{ width: `${columns[3].width}px`, maxWidth: `${columns[3].width}px` }}>
                    端口
                    <div 
                        className="absolute top-0 right-0 h-full w-1 cursor-col-resize hover:bg-primary/50 active:bg-primary"
                        onMouseDown={(e) => startResizing(e, 3)}
                    ></div>
                </th>
                <th className="py-2 px-2 font-medium text-left relative" style={{ width: `${columns[4].width}px`, maxWidth: `${columns[4].width}px` }}>
                    协议
                    <div 
                        className="absolute top-0 right-0 h-full w-1 cursor-col-resize hover:bg-primary/50 active:bg-primary"
                        onMouseDown={(e) => startResizing(e, 4)}
                    ></div>
                </th>
                <th className="py-2 px-2 font-medium text-left relative" style={{ width: `${columns[5].width}px`, maxWidth: `${columns[5].width}px` }}>
                    方向
                    <div 
                        className="absolute top-0 right-0 h-full w-1 cursor-col-resize hover:bg-primary/50 active:bg-primary"
                        onMouseDown={(e) => startResizing(e, 5)}
                    ></div>
                </th>
                <th className="py-2 px-2 font-medium text-left">
                    内容
                </th>
            </tr>
        </thead>
    );
};

// 报文条目组件
const FrameEntryRow: React.FC<{ entry: FrameEntry }> = ({ entry }) => {
    return (
        <tr className="border-b border-base-200 hover:bg-base-200/50 transition-colors text-xs">
            <td className="py-1 px-2 font-mono whitespace-nowrap overflow-hidden text-ellipsis">
                {entry.timestamp}
            </td>
            <td className="py-1 px-2 whitespace-nowrap overflow-hidden text-ellipsis">
                {entry.pid}
            </td>
            <td className="py-1 px-2 whitespace-nowrap overflow-hidden text-ellipsis">
                {entry.tag}
            </td>
            <td className="py-1 px-2 whitespace-nowrap overflow-hidden text-ellipsis">
                {entry.port}
            </td>
            <td className="py-1 px-2 whitespace-nowrap overflow-hidden text-ellipsis">
                {entry.protocol}
            </td>
            <td className={`py-1 px-2 whitespace-nowrap overflow-hidden text-ellipsis ${getDirectionClass(entry.direction)}`}>
                {entry.direction === 0 ? '发送' : '接收'}
            </td>
            <td className="py-1 px-2 font-mono break-all">
                <div className="overflow-hidden">
                    <span className="text-base-content/70 break-all whitespace-pre-wrap" style={{ wordBreak: 'break-word', overflowWrap: 'break-word', display: 'block' }}>
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
    
    // 按时间戳升序排序报文
    const sortedFrames = [...frames].sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return timeA - timeB;
    });
    
    // 如果没有报文，显示空表格
    if (sortedFrames.length === 0) {
        return (
            <div className="h-full overflow-hidden" ref={containerRef}>
                <table className="table table-pin-rows table-sm w-full">
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
    
    return (
        <div className="h-full overflow-auto" ref={containerRef}>
            <table className="table table-pin-rows table-sm w-full table-fixed">
                <FrameTableHeader />
                <tbody>
                    {sortedFrames.map(frame => (
                        <FrameEntryRow key={frame.id} entry={frame} />
                    ))}
                </tbody>
            </table>
        </div>
    );
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
                        <option value="0">发送</option>
                        <option value="1">接收</option>
                    </select>
                </div>
            </div>
            
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

// 文件标签页组件
const FileTabs = ({ onOpenFile }: { onOpenFile: () => void }) => {
    const dispatch = useDispatch();
    const openFiles = useSelector(selectOpenFrameFiles);
    const activeFilePath = useSelector(selectActiveFrameFilePath);
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
    
    // 在资源管理器中显示
    const showInExplorer = async () => {
        try {
            const path = contextMenu.filePath;
            const dirPath = path.substring(0, path.lastIndexOf('\\'));
            const command = Command.create('explorer', [dirPath]);
            await command.execute();
        } catch (error) {
            console.error('打开文件夹失败:', error);
        }
        closeContextMenu();
    };
    
    // 渲染单个标签
    const renderTab = (file: FrameFile) => (
        <div 
            key={file.path}
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
                            <li className="px-4 py-2 hover:bg-base-200 cursor-pointer" onClick={closeCurrentFile}>
                                关闭
                            </li>
                            <li className="px-4 py-2 hover:bg-base-200 cursor-pointer" onClick={closeOtherFiles}>
                                关闭其他
                            </li>
                            <li className="px-4 py-2 hover:bg-base-200 cursor-pointer" onClick={closeRightFiles}>
                                关闭右侧
                            </li>
                            <li className="px-4 py-2 hover:bg-base-200 cursor-pointer" onClick={closeLeftFiles}>
                                关闭左侧
                            </li>
                            <li className="border-t border-base-300 my-1"></li>
                            <li className="px-4 py-2 hover:bg-base-200 cursor-pointer" onClick={showInExplorer}>
                                在资源管理器中显示
                            </li>
                        </ul>
                    </div>
                </>
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
    
    // 获取所有报文条目
    const getAllFrameEntries = (): FrameEntry[] => {
        if (!activeFileContents) return [];
        
        // 直接返回第一个块的所有内容（因为我们现在只使用一个块存储所有内容）
        const chunk = activeFileContents.chunks[0];
        return chunk ? chunk.content : [];
    };
    
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
                
                // 解析整个文件内容
                const entries = parseFrameChunk(buffer, 0, buffer.length);
                
                if (entries.length > 0) {
                    // 将所有条目作为一个块添加到 Redux store
                    dispatch(addFrameChunk({
                        path: path,
                        chunk: 0,
                        content: entries,
                        startByte: 0,
                        endByte: buffer.length
                    }));
                    
                    // 初始化过滤器
                    dispatch(setFrameFilter({
                        path: path,
                        filter: {
                            port: null,
                            protocol: null,
                            direction: null,
                            startTime: null,
                            endTime: null
                        }
                    }));
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
        
        const frameEntries = getAllFrameEntries();
        
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