import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store/index';
import { store } from '../store/index';
import {
    addFrameFile,
    removeFrameFile,
    setActiveFrameFile,
    addFrameEntries,
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
import { parseFrameFile } from '../services/frameParser';
import { FrameEntry } from '../types/frameTypes';
import { toast } from '../context/ToastProvider';
import ParseProgress from '../components/ui/ParseProgress';
import { useParseProgress } from '../hooks/useParseProgress';
import { useFrameParseWindows } from '../hooks/useFrameParseWindows';
import { open } from '@tauri-apps/plugin-dialog';
import { lstat, readFile } from '@tauri-apps/plugin-fs';
import { listen } from '@tauri-apps/api/event';
import { UnlistenFn } from '@tauri-apps/api/event';

import { FileText, XCircle } from 'lucide-react';
import { FileTabs } from '../components/frames/FileTabs';
import { FrameFilter } from '../components/frames/FrameFilter';
import { FrameContent } from '../components/frames/FrameContent';












// 主组件
const FrameView: React.FC = () => {
    const [isDragging, setIsDragging] = useState(false);
    const [unlistenFns, setUnlistenFns] = useState<UnlistenFn[]>([]);
    const dragTargetRef = useRef<HTMLDivElement>(null);

    const dispatch = useDispatch();

    // 进度管理
    const {
        progressItems,
        addProgressItem,
        updateProgressItem,
        removeProgressItem,
        clearProgressItems,
        isFileProcessing,
    } = useParseProgress();

    // 窗口管理
    const { openWindow } = useFrameParseWindows();

    // 处理报文内容点击
    const handleContentClick = (frameId: string, frameContent: string) => {
        openWindow(frameId, frameContent);
    };
    const openFiles = useSelector(selectOpenFrameFiles);
    const activeFilePath = useSelector(selectActiveFrameFilePath);
    const activeFile = useSelector(selectActiveFrameFile);
    const isLoading = useSelector(selectIsLoading);
    const error = useSelector(selectError);
    const filter = useSelector(selectFrameFilter);

    // 获取文件内容 - 直接从 Redux 获取，确保响应状态变化
    const fileContents = useSelector((state: RootState) =>
        activeFilePath ? selectFrameFileContents(state, activeFilePath) : null
    );



    // 获取所有报文条目 - 数据已在解析时按时间戳排序，无需UI层排序
    const allFrameEntries = useMemo(() => {
        if (!activeFilePath || !fileContents || !fileContents.entries) {
            console.log(`[FrameView] allFrameEntries为空: activeFilePath=${activeFilePath}, fileContents=${!!fileContents}, entries=${fileContents?.entries?.length || 0}`);
            return [];
        }

        console.log(`[FrameView] 返回 ${fileContents.entries.length} 个报文条目`);
        // 直接返回entries数组，数据已在worker中排序
        return fileContents.entries;
    }, [activeFilePath, fileContents?.entries]);

    // 获取过滤后的报文条目 - 使用 useMemo 优化
    const filteredFrameEntries = useMemo(() => {
        // 如果没有任何过滤条件，直接返回原数组
        const hasFilters = filter.pid || filter.tag || filter.port || filter.protocol ||
                          (filter.direction !== undefined && filter.direction !== null) ||
                          filter.startTime || filter.endTime || filter.contentKeyword;

        if (!hasFilters) {
            return allFrameEntries;
        }

        let entries = allFrameEntries;

        // 预计算时间过滤的边界值，避免在每个条目中重复计算
        let startTime = -Infinity;
        let endTime = Infinity;
        const hasTimeFilter = filter.startTime || filter.endTime;

        if (hasTimeFilter) {
            if (filter.startTime) {
                const startDate = new Date(filter.startTime);
                startDate.setMilliseconds(0);
                startTime = startDate.getTime();
            }

            if (filter.endTime) {
                const endDate = new Date(filter.endTime);
                endDate.setMilliseconds(999);
                endTime = endDate.getTime();
            }
        }

        // 使用单次遍历进行所有过滤，提高性能
        const filtered = entries.filter(entry => {
            // PID过滤
            if (filter.pid && entry.pid !== filter.pid) return false;

            // 标签过滤
            if (filter.tag && entry.tag !== filter.tag) return false;

            // 端口过滤
            if (filter.port && entry.port !== filter.port) return false;

            // 协议过滤
            if (filter.protocol && entry.protocol !== filter.protocol) return false;

            // 方向过滤（注意：0 是有效值）
            if ((filter.direction !== undefined && filter.direction !== null) &&
                entry.direction !== filter.direction) return false;

            // 内容关键字过滤
            if (filter.contentKeyword) {
                const keyword = filter.contentKeyword.toLowerCase();
                const content = entry.content.toLowerCase();
                if (!content.includes(keyword)) return false;
            }

            // 时间过滤
            if (hasTimeFilter) {
                const entryTime = new Date(entry.timestamp).getTime();
                if (entryTime < startTime || entryTime > endTime) return false;
            }

            return true;
        });

        return filtered;
    }, [allFrameEntries, filter]);

    // 获取可用的PID、标签、端口和协议列表 - 优化版本，避免频繁重计算
    const { availablePids, availableTags, availablePorts, availableProtocols } = useMemo(() => {
        // 对于大量数据，限制计算范围以提高性能
        const sampleSize = Math.min(allFrameEntries.length, 5000);
        const sampleEntries = allFrameEntries.slice(0, sampleSize);

        const pids = new Set<number>();
        const tags = new Set<number>();
        const ports = new Set<number>();
        const protocols = new Set<number>();

        sampleEntries.forEach(entry => {
            pids.add(entry.pid);
            tags.add(entry.tag);
            ports.add(entry.port);
            protocols.add(entry.protocol);
        });

        return {
            availablePids: Array.from(pids).sort((a, b) => a - b),
            availableTags: Array.from(tags).sort((a, b) => a - b),
            availablePorts: Array.from(ports).sort((a, b) => a - b),
            availableProtocols: Array.from(protocols).sort((a, b) => a - b)
        };
    }, [allFrameEntries]);

    // 初始化文件过滤器为默认值
    const initializeFileFilterWithDefaults = useCallback((filePath: string) => {
        const state = store.getState() as RootState;
        const fileContents = selectFrameFileContents(state, filePath);
        
        if (!fileContents || !fileContents.entries || fileContents.entries.length === 0) {
            dispatch(initializeFrameFilter({
                path: filePath
            }));
            return;
        }

        // 获取所有报文条目
        const allEntries = fileContents.entries;
        
        // 找出最小和最大时间
        let minTimeStr: string | undefined = undefined;
        let maxTimeStr: string | undefined = undefined;
        
        // 首先收集所有有效的时间戳
        const validTimestamps = allEntries
            .map(entry => entry.timestamp)
            .filter(timestamp => {
                try {
                    const time = new Date(timestamp);
                    return !isNaN(time.getTime());
                } catch {
                    return false;
                }
            });
        
        // 如果有有效的时间戳，找出最小和最大值
        if (validTimestamps.length > 0) {
            // 按时间戳排序
            const times = validTimestamps.map(ts => new Date(ts).getTime());
            const minTime = new Date(Math.min(...times));
            const maxTime = new Date(Math.max(...times));
            
            // 设置最小时间的毫秒为0，最大时间的毫秒为999
            minTime.setMilliseconds(0);
            maxTime.setMilliseconds(999);
            
            minTimeStr = minTime.toISOString();
            maxTimeStr = maxTime.toISOString();
        }
        
        // 初始化过滤器，保存完整的时间范围（包含毫秒）
        dispatch(initializeFrameFilter({
            path: filePath,
            minTime: minTimeStr,
            maxTime: maxTimeStr
        }));

        // 同时设置当前的筛选时间范围，但移除毫秒部分
        if (minTimeStr && maxTimeStr) {
            const startTime = new Date(minTimeStr);
            const endTime = new Date(maxTimeStr);

            // 将时间转换为本地时间字符串，去掉毫秒部分
            const startTimeLocal = new Date(startTime.getTime() - startTime.getTimezoneOffset() * 60000)
                .toISOString()
                .slice(0, 19);
            const endTimeLocal = new Date(endTime.getTime() - endTime.getTimezoneOffset() * 60000)
                .toISOString()
                .slice(0, 19);

            dispatch(setFrameFilter({
                path: filePath,
                filter: {
                    startTime: startTimeLocal,
                    endTime: endTimeLocal
                }
            }));
        }
    }, [dispatch]);

    // 确保活动文件切换时过滤器已初始化
    useEffect(() => {
        console.log(`[FrameView] 活动文件切换检查: ${activeFilePath}`);
        console.log(`[FrameView] 文件内容状态:`, {
            hasFileContents: !!fileContents,
            hasEntries: !!fileContents?.entries,
            entriesLength: fileContents?.entries?.length || 0,
            hasFilter: !!filter,
            filterKeys: filter ? Object.keys(filter).length : 0
        });

        if (activeFilePath && fileContents && fileContents.entries && fileContents.entries.length > 0) {
            // 检查过滤器是否已初始化
            if (!filter || Object.keys(filter).length === 0) {
                console.log(`[FrameView] 初始化过滤器: ${activeFilePath}`);
                initializeFileFilterWithDefaults(activeFilePath);
            }
        }
    }, [activeFilePath, fileContents, filter, initializeFileFilterWithDefaults]);

    // 监控Redux状态变化，调试数据丢失问题
    useEffect(() => {
        const state = store.getState() as RootState;
        const allFileContents = state.frameParse?.fileContents || {};
        const fileCount = Object.keys(allFileContents).length;
        const filesWithData = Object.entries(allFileContents)
            .filter(([_, content]) => content?.entries?.length > 0)
            .map(([path, content]) => ({ path: path.split(/[\/\\]/).pop(), count: content.entries.length }));

        console.log(`[FrameView] Redux状态监控:`, {
            totalFiles: fileCount,
            filesWithData: filesWithData.length,
            activeFile: activeFilePath?.split(/[\/\\]/).pop(),
            details: filesWithData
        });
    }, [openFiles, activeFilePath]);

    // 加载整个文件 - 使用并行多线程解析
    const loadFileContent = async (filePath: string) => {
        const fileName = filePath.split(/[\/\\]/).pop() || '未命名文件';
        let progressId: string | null = null;

        console.log(`[FRAME] 开始加载文件: ${filePath}`);

        try {
            // 首先检查文件是否已经在缓存中
            const state = store.getState() as RootState;
            const fileContents = selectFrameFileContents(state, filePath);

            // 如果文件内容已经存在于缓存中，则直接返回
            if (fileContents && fileContents.entries && fileContents.entries.length > 0) {
                console.log(`[FRAME] 使用缓存的文件内容: ${filePath}`);
                return;
            }

            // 检查是否已经有相同文件正在解析
            if (isFileProcessing(filePath, 'frame')) {
                console.warn(`[FRAME] 文件 ${filePath} 正在解析中，跳过重复请求`);
                return;
            }

            // 添加进度项
            progressId = addProgressItem({
                fileName,
                filePath: filePath, // 传递完整路径
                type: 'frame',
                status: 'parsing',
                progress: 0,
                currentEntries: 0,
                segments: 1,
            });

            // 如果进度项创建失败（重复），直接返回
            if (!progressId) {
                console.warn(`[FRAME] 文件 ${filePath} 进度项创建失败，可能正在处理中`);
                return;
            }

            console.log(`[FRAME] 创建进度项成功: ${progressId} for ${filePath}`);

            dispatch(setLoading(true));

            // 读取整个文件
            updateProgressItem(progressId, { progress: 20 });
            const buffer = await readFile(filePath);

            // 性能监控
            const startTime = performance.now();

            // 更新进度
            updateProgressItem(progressId, { progress: 30 });

            // 解析整个报文文件
            const entries = await parseFrameFile(buffer);

            // 计算解析时间
            const endTime = performance.now();
            const parseTime = ((endTime - startTime) / 1000).toFixed(2);
            console.log(`[FrameView] 解析完成，耗时 ${parseTime}s，找到 ${entries.length} 个条目`);

            // 更新进度
            updateProgressItem(progressId, {
                progress: 80,
                currentEntries: entries.length,
                segments: 1
            });

            // 存储解析的报文条目
            dispatch(addFrameEntries({
                path: filePath,
                entries: entries
            }));

            // 初始化过滤器
            initializeFileFilterWithDefaults(filePath);

            dispatch(setLoading(false));

            // 完成进度
            updateProgressItem(progressId, {
                progress: 100,
                status: 'completed',
                totalEntries: entries.length,
                currentEntries: entries.length,
                segments: 1
            });

        } catch (error) {
            console.error('加载文件失败:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            dispatch(setError(errorMessage));
            dispatch(setLoading(false));

            if (progressId) {
                updateProgressItem(progressId, {
                    status: 'error',
                    progress: 0,
                    errorMessage
                });
            }

            // 只在严重错误时显示 toast
            if (errorMessage.includes('权限') || errorMessage.includes('不存在')) {
                toast.error(`文件 ${fileName} 加载失败: ${errorMessage}`);
            }
        }
    };

    // 加载文件 - 优化版本，避免重复解析
    const loadFile = async (path: string) => {
        try {
            // 检查文件是否已经在打开列表中
            const existingFile = openFiles.find(file => file.path === path);
            if (existingFile) {
                // 如果文件已经打开，设置为活动文件并确保过滤器已初始化
                dispatch(setActiveFrameFile(path));

                // 检查过滤器是否已初始化，如果没有则初始化
                const state = store.getState() as RootState;
                const currentFilter = selectFrameFilter(state);
                if (!currentFilter || Object.keys(currentFilter).length === 0) {
                    initializeFileFilterWithDefaults(path);
                }
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
            
            // 添加文件到列表
            dispatch(addFrameFile(fileTab));
            
            // 获取当前的Redux状态中的文件内容缓存
            const state = store.getState() as RootState;
            const cachedContents = selectFrameFileContents(state, path);
            
            // 如果没有缓存内容或内容为空，加载整个文件内容
            if (!cachedContents || !cachedContents.entries || cachedContents.entries.length === 0) {
                await loadFileContent(path);
            }

            // 确保在内容加载完成后设置活动文件
            dispatch(setActiveFrameFile(path));
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
                multiple: true, // 支持多文件选择
                filters: [
                    { name: '所有文件', extensions: ['*'] }
                ]
            });

            if (selected) {
                if (typeof selected === 'string') {
                    await loadFile(selected);
                }
                // 如果选择了多个文件，并行加载所有文件
                else if (Array.isArray(selected)) {
                    await Promise.all(selected.map(path => loadFile(path as string)));
                }
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
                });

                const unlistenDragLeave = await listen('tauri://drag-leave', () => {
                    const currentPath = window.location.pathname;
                    if (currentPath.includes('frame-view')) {
                        setIsDragging(false);
                    }
                });

                const unlistenDrop = await listen('tauri://drag-drop', async (event) => {
                    const currentPath = window.location.pathname;
                    console.log(`[FrameView] 拖放事件触发，当前路径: ${currentPath}`);

                    // 只有在报文解析页面才处理拖放事件
                    if (!currentPath.includes('frame-view')) {
                        console.log(`[FrameView] 不在报文解析页面，忽略拖放事件`);
                        return;
                    }

                    setIsDragging(false);

                    if (typeof event.payload === 'object' && event.payload !== null && 'paths' in event.payload) {
                        const paths = event.payload.paths as string[];
                        if (!paths || !Array.isArray(paths) || paths.length === 0) {
                            console.log(`[FrameView] 无效的文件路径`);
                            return;
                        }

                        console.log(`[FrameView] 处理拖放文件:`, paths);
                        try {
                            await Promise.all(paths.map(path => loadFile(path)));
                            toast.success(`成功加载 ${paths.length} 个报文文件`);
                        } catch (error) {
                            const errorMessage = error instanceof Error ? error.message : String(error);
                            toast.error('报文文件读取失败');
                            dispatch(setError(errorMessage));
                        }
                    }
                });

                // 使用函数式更新确保获取最新状态
                setUnlistenFns(prev => {
                    console.log(`[FrameView] 添加 3 个新的监听器`);
                    return [
                        ...prev,
                        unlistenDragEnter,
                        unlistenDragLeave,
                        unlistenDrop
                    ];
                });
            } catch (err) {
                console.warn('设置拖放事件失败:', err);
            }
        };

        // 设置事件监听器并返回清理函数
        setupTauriEvents();

        // 这个effect不需要返回清理函数，因为监听器会在组件卸载时的专门effect中处理
        // 如果在这里返回清理函数，可能会导致监听器被过早清理
    }, []);



    // 组件卸载时清理监听器 - 只在组件卸载时执行，不依赖于unlistenFns的变化
    useEffect(() => {
        // 这个effect只负责清理，不做其他操作
        return () => {
            console.log('FrameView组件卸载，清理所有监听器...');
            // 使用当前的unlistenFns引用，而不是依赖项中的旧值
            const currentFns = [...unlistenFns];
            currentFns.forEach(fn => {
                if (fn && typeof fn === 'function') {
                    try {
                        console.log('正在清理监听器...');
                        fn();
                    } catch (error) {
                        console.error('清理监听器失败:', error);
                    }
                }
            });
            // 清空监听器列表
            setUnlistenFns([]);
        };
    }, []); // 空依赖数组，确保只在组件卸载时执行清理

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

        return (
            <FrameContent
                entries={filteredFrameEntries}
                allEntries={allFrameEntries}
                onContentClick={handleContentClick}
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
                        <FrameFilter
                            availablePids={availablePids}
                            availableTags={availableTags}
                            availablePorts={availablePorts}
                            availableProtocols={availableProtocols}
                        />
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
                            <span>报文条目: {allFrameEntries.length}</span>
                            <span className="mx-2">|</span>
                            <span>过滤后: {filteredFrameEntries.length}</span>
                        </>
                    )}
                </div>
            </div>

            {/* 进度展示组件 */}
            <ParseProgress
                items={progressItems}
                onRemove={removeProgressItem}
                onClear={clearProgressItems}
            />

            {/* 注意：现在使用真正的Tauri窗口，不需要在这里渲染窗口组件 */}
        </div>
    );
};

export default FrameView;