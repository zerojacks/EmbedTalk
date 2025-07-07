import React, { useState, useRef, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
    removeFrameFile,
    setActiveFrameFile,
    selectOpenFrameFiles,
    selectActiveFrameFilePath,
    FrameFile
} from '../../store/slices/frameParseSlice';
import { FolderOpen, X } from 'lucide-react';
import { XIcon, FolderIcon, ChevronDoubleLeftIcon, ChevronDoubleRightIcon } from '@heroicons/react/outline';
import { Command } from '@tauri-apps/plugin-shell';
import { FileCloseConfirmDialog } from './FileCloseConfirmDialog';

interface FileTabsProps {
    onOpenFile: () => void;
}

export const FileTabs: React.FC<FileTabsProps> = ({ onOpenFile }) => {
    const dispatch = useDispatch();
    const openFiles = useSelector(selectOpenFrameFiles);
    const activeFilePath = useSelector(selectActiveFrameFilePath);
    const [fileToClose, setFileToClose] = useState<string | null>(null);
    const [showDropdown, setShowDropdown] = useState(false);

    const dropdownRef = useRef<HTMLDivElement>(null);
    const moreButtonRef = useRef<HTMLButtonElement>(null);
    const tabsContainerRef = useRef<HTMLDivElement>(null);
    const activeTabRef = useRef<HTMLDivElement>(null);

    // 右键菜单状态
    const [contextMenu, setContextMenu] = useState<{
        visible: boolean;
        x: number;
        y: number;
        filePath: string;
    }>({ visible: false, x: 0, y: 0, filePath: '' });

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

    // 当活动文件改变时，滚动到可视区域
    useEffect(() => {
        if (activeFilePath) {
            // 延迟执行，确保DOM已更新
            setTimeout(() => {
                scrollActiveTabIntoView();
            }, 50);
        }
    }, [activeFilePath]);

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



    // 在资源管理器中显示
    const showInExplorer = async () => {
        try {
            const path = contextMenu.filePath;
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



    const renderMoreButton = () => (
        <div ref={dropdownRef} className="relative">
            <button
                ref={moreButtonRef}
                className="btn btn-ghost btn-sm p-1 h-8"
                onClick={toggleDropdown}
                title="更多文件"
            >
                <span className="text-xs font-medium">...</span>
            </button>
            {showDropdown && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowDropdown(false)}
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
                                    onMouseDown={() => {
                                        handleTabClick(file.path);
                                        setShowDropdown(false);
                                        // 延迟一点时间确保dropdown关闭后再滚动
                                        setTimeout(() => scrollActiveTabIntoView(), 100);
                                    }}
                                    title={file.path}
                                >
                                    <span className="truncate flex-grow text-sm" title={file.name}>{file.name}</span>
                                    <button
                                        className="flex-shrink-0 rounded-full p-0.5 hover:bg-base-300 hover:text-error opacity-0 group-hover:opacity-100"
                                        onMouseDown={(e) => {
                                            e.stopPropagation();
                                            handleCloseClick(e, file.path);
                                            setShowDropdown(false);
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
    );

    // 渲染单个标签
    const renderTab = (file: FrameFile) => {
        const isActive = file.path === activeFilePath;

        return (
            <div
                key={file.path}
                ref={isActive ? activeTabRef : null}
                data-file-path={file.path}
                className={`
                    group flex items-center gap-2 px-3 py-1 cursor-pointer
                    border-r border-base-300 min-w-[120px] max-w-[300px]
                    ${isActive ? 'bg-primary/10 text-primary' : 'hover:bg-base-200'}
                `}
                onClick={() => handleTabClick(file.path)}
                onContextMenu={(e) => handleContextMenu(e, file.path)}
            >
                <div className="flex items-center w-full overflow-hidden">
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
    };

    const menuItemClass = "px-4 py-2 hover:bg-base-200 flex items-center gap-2 cursor-pointer";

    return (
        <div className="h-9 w-full border-b border-base-300 bg-base-100 relative">
            <div className={`absolute left-0 top-0 bottom-0 ${openFiles.length > 0 ? 'right-[80px]' : 'right-[40px]'} overflow-hidden`}>
                <div
                    ref={tabsContainerRef}
                    className="h-full w-full overflow-x-auto hide-scrollbar"
                >
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

            <div className={`absolute right-0 top-0 bottom-0 ${openFiles.length > 0 ? 'w-[80px]' : 'w-[40px]'} flex items-center justify-center gap-1 border-l border-base-300 bg-base-100`}>
                {openFiles.length > 0 ? (
                    <>
                        <div className="relative">
                            {renderMoreButton()}
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
        </div>
    );
}; 