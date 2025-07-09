import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store/index';
import { store } from '../store/index';
import {
    addLogFile,
    removeLogFile,
    setActiveLogFile,
    addLogChunk,
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
import ParseProgress from '../components/ui/ParseProgress';
import { useParseProgress } from '../hooks/useParseProgress';
import { open } from '@tauri-apps/plugin-dialog';
import { lstat, readFile } from '@tauri-apps/plugin-fs';
import { listen } from '@tauri-apps/api/event';
import { UnlistenFn } from '@tauri-apps/api/event';
import { selectEffectiveTheme } from '../store/slices/themeSlice';
import { parseLogChunk } from '../services/logParser';
import { FileText } from 'lucide-react';
import { LogContent } from '../components/logsprase/LogContent';
import { LogFilter } from '../components/logsprase/LogFilter';
import { FileTabs } from '../components/logsprase/FileTabs';
import { normalizePath } from '../lib/utils';

// 常量定义
const CHUNK_SIZE = 64 * 1024; // 64KB 块大小

// 主日志解析组件
export default function LogParse() {
    const [isDragging, setIsDragging] = useState(false);
    const [unlistenFns, setUnlistenFns] = useState<UnlistenFn[]>([]);
    const effectiveTheme = useSelector(selectEffectiveTheme);
    const dragTargetRef = useRef<HTMLDivElement>(null);
    
    const dispatch = useDispatch();
    const openFiles = useSelector(selectOpenLogFiles);
    const activeFilePath = useSelector(selectActiveLogFilePath);
    const activeFile = useSelector(selectActiveLogFile);
    const isLoading = useSelector(selectIsLoading);
    const error = useSelector(selectError);
    const filter = useSelector((state: RootState) => activeFilePath ? selectLogFilter(state, activeFilePath) : {});

    // 进度管理
    const {
        progressItems,
        addProgressItem,
        updateProgressItem,
        removeProgressItem,
        clearProgressItems,
        isFileProcessing,
    } = useParseProgress();

    // 获取所有日志条目 - 使用 useMemo 优化
    const allLogEntries = useMemo(() => {
        if (!activeFilePath) return [];
        
        const state = store.getState() as RootState;
        const fileContents = selectLogFileContents(state, activeFilePath);
        if (!fileContents) return [];
        
        // 使用 reduce 替代多次数组合并
        return Object.values(fileContents.chunks).reduce<LogEntry[]>((acc, chunk) => {
            acc.push(...chunk.content);
            return acc;
        }, []).sort((a, b) => {
            // 首先按时间戳排序
            const timeCompare = new Date(a.timeStamp).getTime() - new Date(b.timeStamp).getTime();
            if (timeCompare !== 0) return timeCompare;
            
            // 如果时间戳相同，按照 PID 排序
            if (a.pid && b.pid) {
                const pidCompare = parseInt(a.pid) - parseInt(b.pid);
                if (pidCompare !== 0) return pidCompare;
            }
            
            // 如果 PID 相同或不存在，按照 TID 排序
            if (a.tid && b.tid) {
                return parseInt(a.tid) - parseInt(b.tid);
            }
            
            return 0;
        });
    }, [activeFilePath]);

    // 获取过滤后的日志条目 - 使用 useMemo 优化
    const filteredLogEntries = useMemo(() => {
        let entries = allLogEntries;
        
        // 使用链式过滤替代多个独立的过滤操作
        return entries
            .filter(entry => !filter.level || entry.level === filter.level)
            .filter(entry => !filter.tag || entry.tag?.toLowerCase().includes(filter.tag.toLowerCase()))
            .filter(entry => !filter.pid || entry.pid === filter.pid)
            .filter(entry => !filter.tid || entry.tid === filter.tid)
            .filter(entry => !filter.keyword || (
                entry.message?.toLowerCase().includes(filter.keyword.toLowerCase()) ||
                entry.rawData?.toLowerCase().includes(filter.keyword.toLowerCase())
            ))
            .filter(entry => {
                if (!filter.startTime && !filter.endTime) return true;
                const entryTime = new Date(entry.timeStamp).getTime();
                
                let startTime = -Infinity;
                let endTime = Infinity;
                
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
                
                return entryTime >= startTime && entryTime <= endTime;
            });
    }, [allLogEntries, filter]);

    // 获取所有唯一的标签 - 使用 useMemo 优化
    const allTags = useMemo(() => {
        const tagSet = new Set<string>();
        allLogEntries.forEach(entry => {
            if (entry.tag) {
                tagSet.add(entry.tag);
            }
        });
        return Array.from(tagSet).sort();
    }, [allLogEntries]);

    // 初始化文件过滤器为默认值
    const initializeFileFilterWithDefaults = useCallback((filePath: string) => {
        const state = store.getState() as RootState;
        const fileContents = selectLogFileContents(state, filePath);
        
        if (!fileContents || Object.keys(fileContents.chunks).length === 0) {
            dispatch(initializeFileFilter({
                path: filePath
            }));
            return;
        }
        
        // 获取所有日志条目
        const allEntries: LogEntry[] = Object.values(fileContents.chunks).reduce<LogEntry[]>((acc, chunk) => {
            acc.push(...chunk.content);
            return acc;
        }, []);
        
        // 找出最小和最大时间
        let minTimeStr: string | undefined = undefined;
        let maxTimeStr: string | undefined = undefined;
        
        // 首先收集所有有效的时间戳
        const validTimestamps = allEntries
            .map(entry => entry.timeStamp)
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
        dispatch(initializeFileFilter({
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
            
            dispatch(setLogFilter({
                path: filePath,
                filter: {
                    startTime: startTimeLocal,
                    endTime: endTimeLocal
                }
            }));
        }
    }, [dispatch]);

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
            const entries = await parseLogChunk(buffer, start, end);
            
            // 将解析的日志条目添加到Redux存储中
            dispatch(addLogChunk({
                path: filePath,
                chunk,
                content: entries,
                startByte: start,
                endByte: end
            }));
            

            // 在加载完第一个块后初始化过滤器
            if (chunk === 0) {
                initializeFileFilterWithDefaults(filePath);
            }
            
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
        const fileName = path.split(/[\/\\]/).pop() || '未命名文件';
        let progressId: string | null = null;

        console.log(`[LOG] 开始加载文件: ${path}`);

        try {
            // 检查文件是否已经在打开列表中
            const existingFile = openFiles.find(file => file.path === path);
            if (existingFile) {
                console.log(`[LOG] 文件已打开，设置为活动文件: ${path}`);
                // 如果文件已经打开，只需要设置为活动文件
                dispatch(setActiveLogFile(path));
                return;
            }

            // 检查是否已经有相同文件正在解析
            if (isFileProcessing(path, 'log')) {
                console.warn(`[LOG] 文件 ${path} 正在解析中，跳过重复请求`);
                return;
            }

            const fileStats = await lstat(path);

            // 添加进度项
            progressId = addProgressItem({
                fileName,
                filePath: path, // 传递完整路径
                type: 'log',
                status: 'parsing',
                progress: 0,
                currentEntries: 0,
                segments: 1,
            });

            // 如果进度项创建失败（重复），直接返回
            if (!progressId) {
                console.warn(`[LOG] 文件 ${path} 进度项创建失败，可能正在处理中`);
                return;
            }

            console.log(`[LOG] 创建进度项成功: ${progressId} for ${path}`);

            // 创建文件对象
            const fileTab: LogFile = {
                path,
                name: fileName,
                size: fileStats.size,
                lastModified: Date.now(),
                isActive: false
            };

            // 添加文件到列表
            dispatch(addLogFile(fileTab));

            // 更新进度
            updateProgressItem(progressId, { progress: 30 });

            // 获取当前的Redux状态中的文件内容缓存
            const state = store.getState() as RootState;
            const cachedContents = selectLogFileContents(state, path);

            // 如果没有缓存内容或内容为空，加载第一个块
            if (!cachedContents || Object.keys(cachedContents.chunks).length === 0) {
                updateProgressItem(progressId, { progress: 50 });
                await loadFileChunk(path, 0);

                // 获取解析后的条目数量
                const updatedState = store.getState() as RootState;
                const updatedContents = selectLogFileContents(updatedState, path);
                const totalEntries = updatedContents ?
                    Object.values(updatedContents.chunks).reduce((sum, chunk) => sum + chunk.content.length, 0) : 0;

                updateProgressItem(progressId, {
                    progress: 100,
                    status: 'completed',
                    totalEntries,
                    currentEntries: totalEntries
                });
            } else {
                // 文件已缓存
                updateProgressItem(progressId, {
                    progress: 100,
                    status: 'completed',
                    totalEntries: Object.values(cachedContents.chunks).reduce((sum, chunk) => sum + chunk.content.length, 0)
                });
            }

            // 确保在内容加载完成后设置活动文件
            dispatch(setActiveLogFile(path));
        } catch (error) {
            console.error('加载文件失败:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            dispatch(setError(errorMessage));

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

    // 打开文件对话框
    const handleOpenFile = async () => {
        try {
            const selected = await open({
                multiple: true,
                filters: [
                    { name: '所有文件', extensions: ['*'] }
                ]
            });
            
            if (selected) {
                // 如果只选择了一个文件，直接加载
                if (typeof selected === 'string') {
                    await loadFile(selected);
                }
                // 如果选择了多个文件，并行加载所有文件，然后设置最后一个为活动文件
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
                const { listen } = await import('@tauri-apps/api/event');
                
                const unlistenDragEnter = await listen('tauri://drag-enter', () => {
                    const currentPath = window.location.pathname;
                    if (currentPath.includes('log-parse')) {
                        setIsDragging(true);
                    }
                });
                
                const unlistenDragLeave = await listen('tauri://drag-leave', () => {
                    const currentPath = window.location.pathname;
                    if (currentPath.includes('log-parse')) {
                        setIsDragging(false);
                    }
                    setIsDragging(false);
                });
                
                const unlistenDrop = await listen('tauri://drag-drop', async (event) => {
                    const currentPath = window.location.pathname;
                    if (currentPath.includes('log-parse')) {
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
                        } catch (error) {
                            const errorMessage = error instanceof Error ? error.message : String(error);
                            console.error('拖放文件读取失败:', errorMessage);
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

    // 组件卸载时清理监听器
    useEffect(() => {
        return () => {
            unlistenFns.forEach(fn => {
                if (fn && typeof fn === 'function') {
                    try {
                        fn();
                    } catch (error) {
                        console.error('清理监听器失败:', error);
                    }
                }
            });
        };
    }, [unlistenFns]);

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
                ) : openFiles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-base-content/50">
                        <div className="text-center flex flex-col items-center">
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
                    </div>
                ) : (
                    <div className="flex flex-col h-full">
                        <LogFilter availableTags={allTags} />
                        <div className="flex-1 overflow-hidden">
                            <LogContent
                                entries={filteredLogEntries}
                                allEntries={allLogEntries}
                            />
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
                            <span>日志条目: {allLogEntries.length}</span>
                            <span className="mx-2">|</span>
                            <span>过滤后: {filteredLogEntries.length}</span>
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
        </div>
    );
}
