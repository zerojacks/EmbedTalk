import React, { useState, useRef, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectOpenLogFiles, selectActiveLogFilePath, removeLogFile, setActiveLogFile } from '../../store/slices/logParseSlice';
import {
    FileText,
    X,
    FolderOpen,
    ChevronLeft,
    ChevronRight,
    MoreHorizontal,
    ExternalLink,
    XCircle,
    Layers,
    ArrowLeft,
    ArrowRight,
    Folder
} from 'lucide-react';
import { normalizePath } from '../../lib/utils';
import { FileCloseConfirmDialog } from '../frames/FileCloseConfirmDialog';
import { Command } from '@tauri-apps/plugin-shell';

interface FileTabsProps {
    onOpenFile: () => void;
}

interface ContextMenuState {
    visible: boolean;
    x: number;
    y: number;
    path: string;
}

export const FileTabs: React.FC<FileTabsProps> = ({ onOpenFile }) => {
    const dispatch = useDispatch();
    const openFiles = useSelector(selectOpenLogFiles);
    const activeFilePath = useSelector(selectActiveLogFilePath);
    const [hoveredTab, setHoveredTab] = useState<string | null>(null);
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const moreButtonRef = useRef<HTMLButtonElement>(null);
    const tabsContainerRef = useRef<HTMLDivElement>(null);
    const activeTabRef = useRef<HTMLDivElement>(null);
    const [contextMenu, setContextMenu] = useState<ContextMenuState>({
        visible: false,
        x: 0,
        y: 0,
        path: ''
    });
    const [fileToClose, setFileToClose] = useState<string | null>(null);

    // 处理关闭标签
    const handleCloseTab = async (path: string, event: React.MouseEvent) => {
        event.stopPropagation();
        setFileToClose(path);
    };

    // 确认关闭文件
    const confirmCloseFile = () => {
        if (fileToClose) {
            // 如果关闭的是当前活动标签，需要切换到其他标签
            if (fileToClose === activeFilePath) {
                const currentIndex = openFiles.findIndex(file => file.path === fileToClose);
                // 如果有下一个标签，切换到下一个；否则切换到前一个
                const nextFile = openFiles[currentIndex + 1] || openFiles[currentIndex - 1];
                if (nextFile) {
                    // 先移除当前文件
                    dispatch(removeLogFile(fileToClose));
                    // 然后设置新的活动文件
                    dispatch(setActiveLogFile(nextFile.path));
                } else {
                    dispatch(removeLogFile(fileToClose));
                }
            } else {
                dispatch(removeLogFile(fileToClose));
            }
            setFileToClose(null);
        }
    };

    // 取消关闭文件
    const cancelCloseFile = () => {
        setFileToClose(null);
    };

    // 处理切换标签
    const handleTabClick = (path: string) => {
        dispatch(setActiveLogFile(path));
    };

    // 处理右键菜单
    const handleContextMenu = (e: React.MouseEvent, path: string) => {
        e.preventDefault();
        setContextMenu({
            visible: true,
            x: e.clientX,
            y: e.clientY,
            path
        });
    };

    // 关闭右键菜单
    const closeContextMenu = () => {
        setContextMenu(prev => ({ ...prev, visible: false }));
    };

    // 关闭当前文件
    const closeCurrentFile = () => {
        setFileToClose(contextMenu.path);
        closeContextMenu();
    };

    // 关闭其他文件
    const closeOtherFiles = () => {
        // 先设置当前文件为活动文件
        dispatch(setActiveLogFile(contextMenu.path));
        // 然后移除其他文件
        openFiles.forEach(file => {
            if (file.path !== contextMenu.path) {
                dispatch(removeLogFile(file.path));
            }
        });
        closeContextMenu();
    };

    // 关闭右侧文件
    const closeRightFiles = () => {
        const currentIndex = openFiles.findIndex(file => file.path === contextMenu.path);
        // 如果当前活动文件在右侧，先切换到当前文件
        if (activeFilePath && openFiles.findIndex(f => f.path === activeFilePath) > currentIndex) {
            dispatch(setActiveLogFile(contextMenu.path));
        }
        // 然后移除右侧文件
        openFiles.slice(currentIndex + 1).forEach(file => {
            dispatch(removeLogFile(file.path));
        });
        closeContextMenu();
    };

    // 关闭左侧文件
    const closeLeftFiles = () => {
        const currentIndex = openFiles.findIndex(file => file.path === contextMenu.path);
        // 如果当前活动文件在左侧，先切换到当前文件
        if (activeFilePath && openFiles.findIndex(f => f.path === activeFilePath) < currentIndex) {
            dispatch(setActiveLogFile(contextMenu.path));
        }
        // 然后移除左侧文件
        openFiles.slice(0, currentIndex).forEach(file => {
            dispatch(removeLogFile(file.path));
        });
        closeContextMenu();
    };

    // 在资源管理器中显示文件
    const showInExplorer = async () => {
        try {
            const path = contextMenu.path;
            const dirPath = path.substring(0, path.lastIndexOf('\\'));
            
            const { platform } = await import('@tauri-apps/plugin-os');
            const os = platform();
            
            let commandName = 'explorer-dir'; // Windows默认
            if (os.toLowerCase() === 'darwin') {
                commandName = 'open-dir-mac';
            } else if (os.toLowerCase() === 'linux') {
                commandName = 'open-dir-linux';
            }
            
            const command = Command.create(commandName, [dirPath]);
            await command.execute();
        } catch (error) {
            console.error('打开文件夹失败:', error);
        }
        closeContextMenu();
    };

    // 点击外部关闭更多菜单
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (moreButtonRef.current && !moreButtonRef.current.contains(event.target as Node)) {
                setShowMoreMenu(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // 右键菜单样式类
    const menuItemClass = "group px-4 py-2.5 hover:bg-base-200 active:bg-base-300 flex items-center gap-3 cursor-pointer text-sm transition-all duration-150 select-none hover:pl-5 min-h-[36px]";
    const menuSeparatorClass = "border-t border-base-300 my-1 mx-2";
    const menuIconClass = "w-4 h-4 flex-shrink-0 transition-transform duration-150 group-hover:scale-110";
    const menuTextClass = "flex-1 font-medium whitespace-nowrap";
    const menuShortcutClass = "text-xs text-base-content/60 font-mono opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap";

    // 处理文件列表点击
    const handleFileListClick = (path: string) => {
        dispatch(setActiveLogFile(path));
        setShowMoreMenu(false);
    };

    // 滚动活动标签到可视区域
    const scrollActiveTabIntoView = () => {
        if (activeTabRef.current && tabsContainerRef.current) {
            const container = tabsContainerRef.current;
            const tab = activeTabRef.current;
            
            // 获取容器和标签的位置信息
            const containerRect = container.getBoundingClientRect();
            const tabRect = tab.getBoundingClientRect();
            
            // 检查标签是否在可视区域内
            const isInView = (
                tabRect.left >= containerRect.left &&
                tabRect.right <= containerRect.right
            );
            
            // 如果不在可视区域内，滚动到可视区域
            if (!isInView) {
                tab.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest',
                    inline: 'nearest'
                });
            }
        }
    };

    // 监听活动文件变化，滚动到可视区域
    useEffect(() => {
        scrollActiveTabIntoView();
    }, [activeFilePath]);

    const renderTab = (file: { path: string; name: string }) => {
        const isActive = file.path === activeFilePath;
        const isHovered = file.path === hoveredTab;
        const normalizedPath = normalizePath(file.path);
        
        return (
            <div
                key={normalizedPath}
                ref={isActive ? activeTabRef : null}
                className={`
                    group flex items-center gap-2 px-3 py-1 cursor-pointer
                    border-r border-base-300 min-w-[120px] max-w-[300px]
                    ${isActive ? 'bg-primary/10 text-primary' : 'hover:bg-base-200'}
                `}
                onClick={() => handleTabClick(file.path)}
                onContextMenu={(e) => handleContextMenu(e, file.path)}
                onMouseEnter={() => setHoveredTab(file.path)}
                onMouseLeave={() => setHoveredTab(null)}
                title={file.path}
            >
                <FileText className="h-4 w-4 flex-shrink-0" />
                <span className="truncate flex-grow text-sm" title={file.name}>{file.name}</span>
                <button
                    className={`
                        flex-shrink-0 rounded-full p-0.5
                        hover:bg-base-300 hover:text-error
                        ${isHovered ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
                    `}
                    onClick={(e) => handleCloseTab(file.path, e)}
                    title="关闭"
                >
                    <X className="h-3 w-3" />
                </button>
            </div>
        );
    };

    return (
        <div className="h-9 w-full border-b border-base-300 bg-base-100 relative">
            <div className={`absolute left-0 top-0 bottom-0 ${openFiles.length > 0 ? 'right-[80px]' : 'right-[40px]'} overflow-hidden`}>
                <div 
                    ref={tabsContainerRef}
                    className="h-full w-full overflow-x-auto hide-scrollbar"
                >
                    <div className="flex h-full">
                        {openFiles.length > 0 ? (
                            openFiles.map(file => renderTab(file))
                        ) : (
                            <div className="h-full flex items-center px-3 text-base-content/50">
                                <span className="text-xs">没有打开的日志文件</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className={`absolute right-0 top-0 bottom-0 ${openFiles.length > 0 ? 'w-[80px]' : 'w-[40px]'} flex items-center justify-center gap-1 border-l border-base-300 bg-base-100`}>
                {openFiles.length > 0 ? (
                    <>
                        <div className="relative">
                            <button
                                ref={moreButtonRef}
                                className="btn btn-ghost btn-sm p-1 h-8"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowMoreMenu(!showMoreMenu);
                                }}
                                title="更多文件"
                            >
                                <MoreHorizontal className="h-4 w-4" />
                            </button>
                            {showMoreMenu && (
                                <>
                                    <div
                                        className="fixed inset-0 z-40"
                                        onClick={() => setShowMoreMenu(false)}
                                    />
                                    <div 
                                        className="absolute right-0 top-full mt-1 bg-base-100 border border-base-300 rounded shadow-lg z-50 min-w-[300px] max-w-[400px] max-h-[400px] overflow-y-auto"
                                    >
                                        {openFiles.map(file => {
                                            const isActive = file.path === activeFilePath;
                                            return (
                                                <div
                                                    key={file.path}
                                                    className={`
                                                        group flex items-center gap-2 px-3 py-2 cursor-pointer select-none
                                                        ${isActive ? 'bg-primary/10 text-primary' : 'hover:bg-base-200'}
                                                    `}
                                                    onMouseDown={() => handleFileListClick(file.path)}
                                                    title={file.path}
                                                >
                                                    <FileText className="h-4 w-4 flex-shrink-0" />
                                                    <span className="truncate flex-grow text-sm" title={file.name}>{file.name}</span>
                                                    <button
                                                        className="flex-shrink-0 rounded-full p-0.5 hover:bg-base-300 hover:text-error opacity-0 group-hover:opacity-100"
                                                        onMouseDown={(e) => {
                                                            e.stopPropagation();
                                                            handleCloseTab(file.path, e);
                                                            setShowMoreMenu(false);
                                                        }}
                                                        title="关闭"
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </div>
                        <button 
                            className="btn btn-ghost btn-sm p-1 h-8"
                            onClick={(e) => {
                                e.stopPropagation();
                                onOpenFile();
                            }}
                            title="打开文件"
                        >
                            <FolderOpen className="h-4 w-4" />
                        </button>
                    </>
                ) : (
                    <button 
                        className="btn btn-ghost btn-sm p-1 h-8"
                        onClick={(e) => {
                            e.stopPropagation();
                            onOpenFile();
                        }}
                        title="打开文件"
                    >
                        <FolderOpen className="h-4 w-4" />
                    </button>
                )}
            </div>

            {contextMenu.visible && (
                <>
                    <div
                        className="fixed inset-0 z-50"
                        onClick={closeContextMenu}
                    ></div>
                    <div
                        className="bg-base-100 border border-base-300 rounded-lg shadow-xl backdrop-blur-sm w-64 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                        style={{
                            position: 'fixed',
                            top: contextMenu.y,
                            left: contextMenu.x,
                            transformOrigin: 'top left',
                        }}
                    >
                        <div className="py-2">
                            {/* 关闭操作 */}
                            <div className={menuItemClass} onClick={closeCurrentFile}>
                                <XCircle className={`${menuIconClass} text-red-500`} />
                                <span className={menuTextClass}>关闭</span>
                                <span className={menuShortcutClass}>Ctrl+W</span>
                            </div>
                            <div className={menuItemClass} onClick={closeOtherFiles}>
                                <Layers className={`${menuIconClass} text-orange-500`} />
                                <span className={menuTextClass}>关闭其他</span>
                                <span className={menuShortcutClass}>Ctrl+K O</span>
                            </div>
                            <div className={menuItemClass} onClick={closeRightFiles}>
                                <ArrowRight className={`${menuIconClass} text-purple-500`} />
                                <span className={menuTextClass}>关闭右侧</span>
                                <span className={menuShortcutClass}>Ctrl+K →</span>
                            </div>
                            <div className={menuItemClass} onClick={closeLeftFiles}>
                                <ArrowLeft className={`${menuIconClass} text-green-500`} />
                                <span className={menuTextClass}>关闭左侧</span>
                                <span className={menuShortcutClass}>Ctrl+K ←</span>
                            </div>
                            {/* 分隔线 */}
                            <div className={menuSeparatorClass}></div>
                                                                                    {/* 文件操作 */}
                            <div className={menuItemClass} onClick={showInExplorer}>
                                <Folder className={`${menuIconClass} text-blue-500`} />
                                <span className={menuTextClass}>显示文件位置</span>
                                <span className={menuShortcutClass}>Shift+Alt+R</span>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {fileToClose && (
                <FileCloseConfirmDialog
                    fileName={openFiles.find(f => f.path === fileToClose)?.name || ''}
                    onCancel={cancelCloseFile}
                    onConfirm={confirmCloseFile}
                />
            )}
        </div>
    );
};