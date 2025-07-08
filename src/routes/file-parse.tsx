import React, { useRef, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { TreeTable } from '../components/treeview';
import { TreeItemType } from '../components/TreeItem';
import { Column } from '../components/treeview';
import { toast } from '../context/ToastProvider';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store/index';
import { selectSplitSize, setSplitSize } from '../store/slices/splitSizeSlice';
import {
    addFile,
    removeFile,
    updateFileContent,
    setActiveTab,
    setLoading,
    setError,
    selectOpenFiles,
    selectActiveTabPath,
    selectActiveFile,
    selectFileContents,
    selectIsLoading,
    selectError,
    FileTab,
    addFileChunk,
    clearOldChunks,
    setViewMode
} from '../store/slices/fileParseSlice';
import Editor, { Monaco, OnMount, Theme, loader  } from '@monaco-editor/react';
import { editor } from 'monaco-editor';
import * as monaco from 'monaco-editor';
import { open } from '@tauri-apps/plugin-dialog';
import { lstat, readFile, readTextFile } from '@tauri-apps/plugin-fs';
import { listen } from '@tauri-apps/api/event';
import { UnlistenFn } from '@tauri-apps/api/event';
import * as os from '@tauri-apps/plugin-os';
import { useSettingsContext } from "../context/SettingsProvider";
import { selectEffectiveTheme } from '../store/slices/themeSlice';

interface Response {
    data: TreeItemType[];
    error?: string;
}

const initialColumns: Column[] = [
    { name: '帧域', width: 30, minWidth: 100 },
    { name: '数据', width: 30, minWidth: 50 },
    { name: '说明', width: 40, minWidth: 50 },
];

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
                        <svg className="w-6 h-6 text-error" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-medium">确认关闭文件</h3>
                </div>
                
                <p className="text-base-content/70 mb-6 ml-10">
                    文件 "{fileName}" 已被修改。是否要关闭并放弃更改？
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

export default function FileParse() {
    const [tableData, setTableData] = React.useState<TreeItemType[]>([]);
    const [isDragging, setIsDragging] = React.useState(false);
    const [unlistenFns, setUnlistenFns] = React.useState<UnlistenFn[]>([]);
    const [selectedContent, setSelectedContent] = React.useState<string>('');
    const [selectedframe, setSelectedFrame] = React.useState<number[]>([0, 0]);
    const [frameScroll, setFrameScroll] = React.useState<number[]>([0, 0]);
    const effectiveTheme = useSelector(selectEffectiveTheme);
    const [edtheme, setEdtheme] = useState<Theme>(effectiveTheme === 'dark' ? 'vs-dark' : 'light');
    // 移除dragCounter状态，避免计数错误
    const dragTargetRef = useRef<HTMLDivElement>(null);
    const [systemInfo, setSystemInfo] = useState<{platform?: string, version?: string, arch?: string}>({});
    const [fileToClose, setFileToClose] = useState<string | null>(null);

    const dispatch = useDispatch();
    const splitSize = useSelector(selectSplitSize);
    const openFiles = useSelector(selectOpenFiles);
    const activeTabPath = useSelector(selectActiveTabPath);
    const activeFile = useSelector(selectActiveFile);
    const activeFileContents = useSelector((state: RootState) => activeFile ? selectFileContents(state, activeFile.path) : null);
    const isLoading = useSelector(selectIsLoading);
    const error = useSelector(selectError);
    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const [value, setValue] = React.useState('');
    
    const handlePanelResize = (sizes: number[]) => {
        dispatch(setSplitSize(sizes));
    };

    useEffect(()=>{
        loader.config({
            paths: {
                vs: "./vs",
            },
            'vs/nls': {
                availableLanguages: ["css", "html", "json", "typescript"],
              },
        })
    },[])
    const getFileContent = (file: FileTab): string => {
        if (!activeFileContents) return '';

        // 合并所有已加载的块
        const sortedChunks = Object.entries(activeFileContents.chunks)
            .sort(([a], [b]) => parseInt(a) - parseInt(b))
            .map(([_, chunk]) => chunk.content);

        return sortedChunks.join('');
    };

    function uint8ArrayToString(array: Uint8Array): string {
        const decoder = new TextDecoder();
        return decoder.decode(array);
    }

    const loadFileChunk = async (filePath: string, chunk: number) => {
        const start = chunk * CHUNK_SIZE;
        const buffer = await readFile(filePath);
        const slice = buffer.slice(start, start + CHUNK_SIZE);
        let content = uint8ArrayToString(slice);
        setValue(content);
        dispatch(addFileChunk({
            path: filePath,
            chunk: chunk,
            content: content,
            chunkSize: CHUNK_SIZE,
            startByte: start,
            endByte: start + slice.length
        }));
    };

    const loadFileContent = async (path: string) => {
        try {
            const fileStats = await lstat(path);
            
            // 创建FileTab对象，但不包含content
            const fileTab: FileTab = {
                path,
                name: path.split(/[/\\]/).pop() || '未命名文件',
                encoding: 'text',
                viewMode: 'auto',
                size: fileStats.size,
                lastModified: Date.now(),
                isModified: false,
                totalLines: Math.ceil(fileStats.size / CHUNK_SIZE)
            };
            
            // 先添加文件选项卡
            dispatch(addFile(fileTab));
            dispatch(setActiveTab(path));
            
            // 然后单独读取并存储文件内容
            try {
                const fileContent = await readFile(path);
                const fileContentString = uint8ArrayToString(fileContent);
                
                // 将文件内容作为单个块存储
                dispatch(addFileChunk({
                    path,
                    chunk: 0,
                    content: fileContentString,
                    chunkSize: fileStats.size,
                    startByte: 0,
                    endByte: fileStats.size
                }));
            } catch (error) {
                console.warn('读取文件内容失败:', error);
                const errorMessage = error instanceof Error ? error.message : String(error);
                dispatch(setError(`读取文件内容失败: ${errorMessage}`));
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            toast.error(`文件 ${path} 加载失败`);
            dispatch(setError(errorMessage));
        }
    };

    // 定期清理旧的缓存块
    useEffect(() => {
        const cleanupInterval = setInterval(() => {
            dispatch(clearOldChunks(CACHE_MAX_AGE));
        }, CACHE_MAX_AGE);

        return () => clearInterval(cleanupInterval);
    }, [dispatch]);


    useEffect(() => {
        setEdtheme(effectiveTheme === 'dark' ? 'vs-dark' : 'light');
    }, [effectiveTheme]);

    // 处理编辑器内容变化
    const handleEditorChange = (value: string | undefined, path: string) => {
        if (value !== undefined) {
            // 将整个内容作为单个块存储
            dispatch(addFileChunk({
                path,
                chunk: 0,
                content: value,
                chunkSize: value.length,
                startByte: 0,
                endByte: value.length
            }));

            // 标记文件为已修改
            const file = openFiles.find(f => f.path === path);
            if (file && !file.isModified) {
                dispatch(updateFileContent({ path, isModified: true }));
            }
        }
    };

    const handleEditorMouseUp = async () => {
        if (!editorRef.current) return;
        const editor = editorRef.current;
        const selection = editor.getSelection();
        const model = editor.getModel();
        if (!selection || !model) return;

        // 如果用户已经选择了内容，则直接使用该选择
        if (!selection.isEmpty()) {
            const selectedText = model.getValueInRange(selection).trim();
            processSelectedText(selectedText);
            return;
        }

        // 获取光标所在位置
        const position = editor.getPosition();
        if (!position) return;

        // 获取当前行文本
        const lineContent = model.getLineContent(position.lineNumber);
        if (!lineContent) return;

        // 查找特定的协议指示器后跟着的16进制数据块
        const protocolRegex = /(Port:.*Protocol:\d+\s*>{3,})\s*((?:[0-9A-Fa-f]{2}\s*)+)(?:={3,})?/;
        const fullMatch = lineContent.match(protocolRegex);
        
        if (fullMatch && fullMatch[2]) {
            // 检查光标是否在16进制数据块内
            const hexStart = fullMatch.index! + fullMatch[1].length;
            const hexEnd = hexStart + fullMatch[2].length;
            
            if (position.column >= hexStart && position.column <= hexEnd) {
                // 创建新的选择范围并应用
                const selectionRange = {
                    startLineNumber: position.lineNumber,
                    startColumn: hexStart,
                    endLineNumber: position.lineNumber,
                    endColumn: hexEnd
                };
                
                editor.setSelection(selectionRange);
                processSelectedText(fullMatch[2]);
                return;
            }
        }

        // 通用16进制数据块匹配（备选方案）
        const hexDataRegex = /(?:[0-9A-Fa-f]{2}\s+){3,}[0-9A-Fa-f]{2}/g;
        let match;
        let closestMatch = null;
        let minDistance = Infinity;
        let matchStartCol = 0;
        let matchEndCol = 0;

        // 查找距离光标最近的16进制数据块
        while ((match = hexDataRegex.exec(lineContent)) !== null) {
            const matchStart = match.index + 1; // 添加1是因为editor列是1-based
            const matchEnd = matchStart + match[0].length;
            
            // 检查光标是否在匹配内
            if (position.column >= matchStart && position.column <= matchEnd) {
                closestMatch = match[0];
                matchStartCol = matchStart;
                matchEndCol = matchEnd;
                break;
            }
            
            // 找最近的16进制块
            const distanceToStart = Math.abs(position.column - matchStart);
            const distanceToEnd = Math.abs(position.column - matchEnd);
            const minMatchDistance = Math.min(distanceToStart, distanceToEnd);
            
            if (minMatchDistance < minDistance) {
                minDistance = minMatchDistance;
                closestMatch = match[0];
                matchStartCol = matchStart;
                matchEndCol = matchEnd;
            }
        }

        // 如果找到了16进制数据块
        if (closestMatch) {
            // 创建新的选择范围并应用
            const selectionRange = {
                startLineNumber: position.lineNumber,
                startColumn: matchStartCol,
                endLineNumber: position.lineNumber,
                endColumn: matchEndCol
            };
            
            editor.setSelection(selectionRange);
            processSelectedText(closestMatch);
        }
    };

    // 处理选中的文本
    const processSelectedText = async (selectedText: string) => {
        // 格式化16进制文本
        const formattedValue = selectedText
            .replace(/\s+/g, '')
            .replace(/(.{2})/g, '$1 ')
            .trim()
            .toUpperCase();
        
        setSelectedContent(formattedValue);
        
        // 检查是否为16进制数据
        const hexRegex = /^[0-9A-Fa-f\s]+$/;
        if (hexRegex.test(formattedValue)) {
            const hexData = formattedValue.replace(/\s+/g, '');
            await parseHexData(hexData);
        }
    };

    const parseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const parseHexData = async (hexData: string) => {
        try {
            if (!hexData) return;
            
            dispatch(setLoading(true));
            
            // 将16进制字符串转换为字节数组
            const bytes = new Uint8Array(hexData.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []);
            
            // 调用Rust解析函数
            const result = await invoke<Response>('on_text_change', {
                message: hexData,
                region: '南网'
            });

            if (result.error) {
                dispatch(setError(result.error));
                toast.error('解析失败: ' + result.error);
                return;
            }
            
            if (result.data) {
                setTableData(result.data);
            } else {
                setTableData([]);
                toast.info('未发现可解析的数据结构');
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('解析数据错误:', error);
            dispatch(setError(errorMessage));
            toast.error('解析失败');
        } finally {
            dispatch(setLoading(false));
        }
    };

    const handleSelectedContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        
        // 格式化16进制文本
        const formattedValue = value
            .replace(/\s+/g, '')
            .replace(/(.{2})/g, '$1 ')
            .trim()
            .toUpperCase();
        
        setSelectedContent(formattedValue);
        
        // 检查是否为16进制数据
        const hexRegex = /^[0-9A-Fa-f\s]+$/;
        if (hexRegex.test(formattedValue) && formattedValue.replace(/\s+/g, '').length > 0) {
            // 设置自动解析延迟，避免频繁解析
            if (parseTimeoutRef.current !== null) {
                clearTimeout(parseTimeoutRef.current);
            }
            parseTimeoutRef.current = setTimeout(() => {
                const hexData = formattedValue.replace(/\s+/g, '');
                parseHexData(hexData);
            }, 1000); // 1秒延迟
        }
    };

    const handleRowClick = (item: TreeItemType) => {
        if (item.position && item.position.length === 2) {
            let start = item.position[0];
            let end = item.position[1];
            let length = end - start;
            length = length * 2 + (length - 1);
            start = start * 2 + start;
            end = start + length;
            setSelectedFrame([start, end]);
        }
    };

    useEffect(() => {
        const start = selectedframe[0];
        const end = selectedframe[1];
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.setSelectionRange(start, end);
            textarea.focus();

            const computedStyle = getComputedStyle(textarea);
            const charWidth = parseInt(computedStyle.fontSize, 10);
            const lineHeight = parseInt(computedStyle.lineHeight, 10);
            const lineSpacing = lineHeight - parseInt(computedStyle.fontSize, 10);
            const lineCount = Math.floor(textarea.clientWidth / charWidth) * 2;
            const startLine = Math.floor(start / lineCount);
            const scrollTop = (startLine - 1) * (lineHeight + lineSpacing);
            const startCharIndex = start % lineCount;
            const scrollLeft = startCharIndex * charWidth;
            setFrameScroll([scrollTop, scrollLeft]);
        }

    }, [selectedframe]);

    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            const scrollTop = frameScroll[0];
            const scrollLeft = frameScroll[1];
            textarea.scrollTop = scrollTop;
            textarea.scrollLeft = scrollLeft;
        }

    }, [frameScroll]);

    // 添加 Tauri 窗口拖放事件监听
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
                            await Promise.all(paths.map(path => loadFileContent(path)));
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

    const handleFileSelect = async () => {
        try {
            const filePaths = await open({
                multiple: true,
                filters: [{
                    name: 'Text Files',
                    extensions: ['*']
                }]
            });

            if (filePaths) {
                dispatch(setLoading(true));
                const paths = Array.isArray(filePaths) ? filePaths : [filePaths];
                await Promise.all(paths.map(path => loadFileContent(path)));
                
                if (paths.length > 0) {
                    toast.success('文件加载成功');
                }
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            toast.error('文件选择失败');
            dispatch(setError(errorMessage));
        } finally {
            dispatch(setLoading(false));
        }
    };

    const closeTab = (path: string) => {
        const fileToClose = openFiles.find(file => file.path === path);
        if (fileToClose?.isModified) {
            setFileToClose(path);
        } else {
            dispatch(removeFile(path));
        }
    };

    const confirmCloseFile = () => {
        if (fileToClose) {
            dispatch(removeFile(fileToClose));
            setFileToClose(null);
        }
    };

    const cancelCloseFile = () => {
        setFileToClose(null);
    };

    const parseHexContent = async () => {
        try {
            const hexData = selectedContent.replace(/\s+/g, '');
            if (!hexData) {
                toast.error('请先选择或输入16进制数据');
                return;
            }
            
            await parseHexData(hexData);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            toast.error('解析失败');
            dispatch(setError(errorMessage));
        }
    };

    useEffect(() => {
        return () => {
            if (parseTimeoutRef.current !== null) {
                clearTimeout(parseTimeoutRef.current);
            }
        };
    }, []);

    // 创建空白文件
    const createEmptyFile = () => {
        const newFileName = `新建文件_${openFiles.length + 1}.txt`;
        
        // 创建FileTab对象
        const fileTab: FileTab = {
            path: `memory://${Date.now()}_${newFileName}`,
            name: newFileName,
            encoding: 'text',
            viewMode: 'auto',
            size: 0,
            lastModified: Date.now(),
            isModified: true,
            totalLines: 1
        };
        
        // 添加文件选项卡
        dispatch(addFile(fileTab));
        dispatch(setActiveTab(fileTab.path));
        
        // 添加空白内容
        dispatch(addFileChunk({
            path: fileTab.path,
            chunk: 0,
            content: '',
            chunkSize: 0,
            startByte: 0,
            endByte: 0
        }));
        
        toast.success('已创建新文件');
    };

    return (
        <>
            <div className="flex flex-col h-full bg-base-100 text-base-content relative">
                {/* VSCode 风格的文件标签 - 支持双击打开文件 */}
                <div 
                    className="flex bg-base-300 border-b border-base-content/10 overflow-x-auto scrollbar-thin scrollbar-thumb-base-content/20 scrollbar-track-transparent relative"
                    onDoubleClick={createEmptyFile}
                >
                    {openFiles.map(file => (
                        <div
                            key={file.path}
                            className={`
                                group flex items-center h-9 px-3 border-r border-base-content/10 cursor-pointer
                                ${activeTabPath === file.path
                                    ? 'bg-base-100 text-base-content'
                                    : 'bg-base-300 text-base-content/70 hover:bg-base-200'
                                }
                                transition-colors
                            `}
                            onClick={() => dispatch(setActiveTab(file.path))}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 opacity-60" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                            </svg>
                            <span className={`text-sm ${file.isModified ? 'italic' : ''} select-none`}>
                                {file.name}
                                {file.isModified && <span className="ml-1">*</span>}
                            </span>
                            <button
                                className="ml-2 w-5 h-5 rounded opacity-0 group-hover:opacity-100 hover:bg-base-content/10 hover:text-error flex items-center justify-center transition-opacity select-none"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    closeTab(file.path);
                                }}
                            >
                                <span className="text-xs select-none">×</span>
                            </button>
                        </div>
                    ))}
                    
                    {/* 空标签栏提示 */}
                    {openFiles.length === 0 && (
                        <div className="h-9 px-4 flex items-center justify-center text-sm text-base-content/40 italic flex-grow">
                            双击此处创建新文件
                        </div>
                    )}
                    
                    {/* 新增"+" 按钮用于添加新文件，放在最右侧 */}
                    <div className="flex ml-auto border-l border-base-content/10">
                        <div 
                            className="h-9 px-3 flex items-center text-base-content/60 hover:text-base-content hover:bg-base-200 cursor-pointer transition-colors"
                            onClick={createEmptyFile}
                            title="新建文件"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                        </div>
                        <div 
                            className="h-9 px-3 flex items-center text-base-content/60 hover:text-base-content hover:bg-base-200 cursor-pointer transition-colors"
                            onClick={handleFileSelect}
                            title="打开文件"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* 错误显示 - 使用DaisyUI类 */}
                {error && (
                    <div className="relative">
                        <div className="absolute inset-x-0 top-0 z-30 transform transition-all duration-300">
                            <div className="flex items-center justify-between bg-error/90 text-error-content p-3 border-l-4 border-error shadow-lg">
                                <div className="flex items-center gap-3">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    <div>
                                        <p className="font-medium">错误</p>
                                        <p className="text-sm opacity-90">{error}</p>
                                    </div>
                                </div>
                                <button
                                    className="h-6 w-6 rounded hover:bg-base-content/20 flex items-center justify-center"
                                    onClick={() => dispatch(setError(null))}
                                >
                                    <span className="text-sm">×</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <PanelGroup direction="horizontal" className="flex-grow" onLayout={handlePanelResize}>
                    <Panel defaultSize={splitSize[0]} minSize={30}>
                        <div
                            ref={dragTargetRef}
                            className={`h-full relative border border-base-content/10 ${
                                isDragging 
                                ? 'bg-primary/5 border-2 border-dashed border-primary' 
                                : ''
                            }`}
                        >
                            {isLoading && (
                                <div className="absolute inset-0 bg-base-100/80 backdrop-blur-sm flex flex-col items-center justify-center z-20">
                                    <div className="w-8 h-8 border-2 border-r-transparent border-primary rounded-full animate-spin"></div>
                                    <p className="mt-4 text-sm text-base-content/70">加载中...</p>
                                </div>
                            )}
                            
                            {/* 拖拽提示 */}
                            {isDragging && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none bg-base-100/80">
                                    <div className="rounded-lg border border-primary p-8 bg-base-200 shadow-lg flex flex-col items-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-primary mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        <p className="text-sm font-medium text-base-content">释放文件以打开</p>
                                    </div>
                                </div>
                            )}
                            
                            {/* 文件内容为空提示 */}
                            {!activeFile && !isLoading && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-base-100">
                                    <div className="p-6 rounded-lg max-w-sm">
                                        <div className="flex flex-col items-center mb-6">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-base-content/40 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            <h3 className="text-base font-medium text-center mb-2 text-base-content">无打开的文件</h3>
                                            <p className="text-sm text-center text-base-content/60 mb-4">
                                                拖放文件到此窗口，或者使用下方按钮选择文件
                                            </p>
                                        </div>
                                        <div className="flex justify-center">
                                            <button 
                                                className="px-4 py-2 bg-primary hover:bg-primary-focus text-primary-content rounded text-sm"
                                                onClick={handleFileSelect}
                                            >
                                                选择文件
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeFile && (
                                <div 
                                    className="w-full h-full"
                                >
                                    <Editor
                                        height="100%"
                                        defaultLanguage="plaintext"
                                        theme={edtheme}
                                        value={getFileContent(activeFile)}
                                        onChange={(value) => handleEditorChange(value, activeFile.path)}
                                        options={{
                                            wordWrap: 'on',
                                            minimap: { enabled: true },
                                            lineNumbers: 'on',
                                            scrollBeyondLastLine: false,
                                            fontSize: 14,
                                            fontFamily: "'JetBrains Mono', 'SF Mono', Consolas, Monaco, monospace",
                                            renderLineHighlight: 'all',
                                            smoothScrolling: true,
                                            cursorBlinking: 'phase',
                                        }}
                                        onMount={(editor) => {
                                            editorRef.current = editor;
                                            loader.config({
                                                paths: { vs: "./vs" },
                                                monaco: monaco
                                            });
                                            if ((window as any).require) {
                                                (window as any).require.config({ paths: { vs: "./vs" } });
                                            }
                                            editor.onMouseUp(() => handleEditorMouseUp());
                                            
                                            // 给编辑器添加拖放事件支持
                                            const editorDomNode = editor.getDomNode();
                                            if (editorDomNode) {
                                                // 阻止编辑器自身的拖放处理，让事件冒泡到父元素
                                                editorDomNode.addEventListener('dragover', (e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                });
                                                
                                                editorDomNode.addEventListener('drop', (e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    // 手动触发父元素的handleDrop
                                                    if (dragTargetRef.current) {
                                                        const dropEvent = new DragEvent('drop', {
                                                            bubbles: true,
                                                            cancelable: true,
                                                            dataTransfer: e.dataTransfer
                                                        });
                                                        dragTargetRef.current.dispatchEvent(dropEvent);
                                                    }
                                                });
                                            }
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    </Panel>
                    <PanelResizeHandle className="w-1 bg-base-content/10 hover:bg-primary transition-colors" />
                    <Panel defaultSize={splitSize[1]} minSize={30}>
                        <div className="flex flex-col h-full border border-base-content/10 overflow-hidden">
                            {/* 解析输入区域 */}
                            <div className="bg-base-200 text-base-content flex flex-col p-3 border-b border-base-content/10">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-sm font-medium flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                                        </svg>
                                        数据解析器
                                    </h3>
                                    {selectedContent && (
                                        <div className="px-2 py-0.5 text-xs bg-primary/20 text-primary rounded border border-primary/30">
                                            {selectedContent.replace(/\s+/g, '').length / 2} 字节
                                        </div>
                                    )}
                                </div>
                                <textarea
                                    ref={textareaRef}
                                    className="w-full p-2 text-sm font-mono bg-base-100 border border-base-content/20 focus:border-primary outline-none rounded text-base-content resize-none"
                                    rows={3}
                                    value={selectedContent}
                                    onChange={handleSelectedContentChange}
                                    placeholder="左侧选中内容后显示在此处，也可以直接编辑后自动解析"
                                />
                                <div className="flex justify-end mt-2">
                                    <button 
                                        onClick={parseHexContent}
                                        disabled={!selectedContent || isLoading}
                                        className="px-3 py-1 bg-primary hover:bg-primary-focus disabled:bg-primary/50 text-primary-content rounded text-xs flex items-center gap-1 transition-colors"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                                        </svg>
                                        解析
                                    </button>
                                </div>
                            </div>

                            {/* 解析结果展示 */}
                            <div className="flex-grow flex flex-col overflow-hidden bg-base-100">
                                <div className="px-4 py-2 bg-base-200 flex items-center justify-between">
                                    <h3 className="text-sm font-medium flex items-center gap-2 text-base-content">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                        </svg>
                                        解析结果
                                    </h3>
                                </div>
                                <div className="flex-grow overflow-auto m-2 bg-base-100 rounded border border-base-content/20">
                                    {tableData.length > 0 ? (
                                        <TreeTable
                                            data={tableData}
                                            tableheads={initialColumns}
                                            onRowClick={handleRowClick}
                                        />
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-sm text-base-content/50">
                                            {selectedContent ? '未找到可解析数据' : '选中或输入数据以解析'}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </Panel>
                </PanelGroup>
            </div>

            {/* 文件关闭确认对话框 */}
            {fileToClose && (
                <FileCloseConfirmDialog
                    fileName={openFiles.find(f => f.path === fileToClose)?.name || '未命名文件'}
                    onCancel={cancelCloseFile}
                    onConfirm={confirmCloseFile}
                />
            )}
        </>
    );
}