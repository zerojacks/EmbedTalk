import React, { useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { TreeTable } from '../components/treeview';
import { TreeItemType } from '../components/TreeItem';
import { Column } from '../components/treeview';
import { toast } from '../context/ToastProvider';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
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
import Editor, { Monaco, OnMount } from '@monaco-editor/react';
import { editor } from 'monaco-editor';
import { open } from '@tauri-apps/plugin-dialog';
import { lstat, readFile, readTextFile, readTextFileLines } from '@tauri-apps/plugin-fs';
import { listen } from '@tauri-apps/api/event';
import { UnlistenFn } from '@tauri-apps/api/event';

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

export default function FileParse() {
    const [tableData, setTableData] = React.useState<TreeItemType[]>([]);
    const [isDragging, setIsDragging] = React.useState(false);
    const [unlistenFns, setUnlistenFns] = React.useState<UnlistenFn[]>([]);
    const [selectedContent, setSelectedContent] = React.useState<string>('');
    const [selectedframe, setSelectedFrame] = React.useState<number[]>([0, 0]);
    const [frameScroll, setFrameScroll] = React.useState<number[]>([0, 0]);

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

    const loadFileContent = async (filePath: string) => {
        try {
            // 如果文件已打开，直接激活该标签
            if (openFiles.some(file => file.path === filePath)) {
                dispatch(setActiveTab(filePath));
                return;
            }

            // 获取文件信息
            const stats = await lstat(filePath);
            const fileName = filePath.split(/[/\\]/).pop() || 'Untitled';

            // 添加文件到 Redux
            const fileTab: FileTab = {
                path: filePath,
                name: fileName,
                encoding: 'text',
                viewMode: 'auto',
                size: stats.size,
                lastModified: Date.now(),
                isModified: false,
                totalLines: Math.ceil(stats.size / CHUNK_SIZE)
            };
            dispatch(addFile(fileTab));

            // 加载第一个块
            await loadFileChunk(filePath, 0);
            dispatch(setActiveTab(filePath));

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('文件读取错误：', error);
            toast.error(`无法读取文件: ${errorMessage}`);
            throw error;
        }
    };

    // 定期清理旧的缓存块
    useEffect(() => {
        const cleanupInterval = setInterval(() => {
            dispatch(clearOldChunks(CACHE_MAX_AGE));
        }, CACHE_MAX_AGE);

        return () => clearInterval(cleanupInterval);
    }, [dispatch]);

    const handleViewModeChange = (path: string, mode: 'text' | 'hex' | 'auto') => {
        dispatch(setViewMode({ path, mode }));
    };

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

    const handleEditorMount: OnMount = (editor) => {
        editorRef.current = editor;
        editor.onMouseUp(() => handleEditorMouseUp());
    };

    const handleEditorMouseUp = async () => {
        if (!editorRef.current) return;
        const editor = editorRef.current;
        const selection = editor.getSelection();
        const model = editor.getModel();
        if (!selection || !model) return;

        const selectedText = model.getValueInRange(selection).trim();
        const formattedValue = selectedText
        .replace(/\s+/g, '')
        .replace(/(.{2})/g, '$1 ')
        .trim()
        .toUpperCase();
        
        setSelectedContent(formattedValue);
        const hexRegex = /^[0-9A-Fa-f\s]+$/;
        if (hexRegex.test(formattedValue)) {
            const hexData = formattedValue.replace(/\s+/g, '');
            await parseHexData(hexData);
        }
    };

    const parseHexData = async (hexData: string) => {
        try {
            dispatch(setLoading(true));
            const result = await invoke<Response>('on_text_change', {
                message: hexData,
                region: '南网'
            });

            if (result.error) {
                toast.error('解析失败！');
                console.error('错误信息：', result.error);
                dispatch(setError(result.error));
                setTableData([]);
            } else {
                setTableData(result.data);
                dispatch(setError(null));
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('调用后端函数出错：', error);
            toast.error('解析失败！');
            dispatch(setError(errorMessage));
            setTableData([]);
        } finally {
            dispatch(setLoading(false));
        }
    };

    const handleSelectedContentChange = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const selectedText = e.target.value;
        const formattedValue = selectedText
        .replace(/\s+/g, '')
        .replace(/(.{2})/g, '$1 ')
        .trim()
        .toUpperCase();

        setSelectedContent(formattedValue);
        const hexRegex = /^[0-9A-Fa-f\s]+$/;
        if (hexRegex.test(formattedValue)) {
            const hexData = formattedValue.replace(/\s+/g, '');
            await parseHexData(hexData);
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

    }, [frameScroll])

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        dispatch(setLoading(true));

        try {
            const files = Array.from(e.dataTransfer.files);
            await Promise.all(files.map(async (file) => {
                try {
                    // 使用 FileReader 读取文件内容为文本
                    const content = await readFileAsText(file);

                    const filePath = file.webkitRelativePath || file.name;

                    // 添加文件到 Redux
                    dispatch(addFile({
                        path: filePath,
                        name: file.name,
                        encoding: 'text',
                        viewMode: 'auto',
                        size: file.size,
                        lastModified: file.lastModified,
                        isModified: false
                    }));
                } catch (err) {
                    console.error(`无法读取文件 ${file.name}:`, err);
                    toast.error(`无法读取文件 ${file.name}`);
                }
            }));

            if (files.length > 0) {
                toast.success('文件加载成功');
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('文件读取错误：', error);
            toast.error('文件读取失败');
            dispatch(setError(errorMessage));
        } finally {
            dispatch(setLoading(false));
        }
    };

    // 辅助函数：读取文件为文本
    const readFileAsText = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                if (typeof reader.result === 'string') {
                    resolve(reader.result);
                } else if (reader.result instanceof ArrayBuffer) {
                    // 如果返回的是ArrayBuffer，转换为文本
                    try {
                        const decoder = new TextDecoder('utf-8');
                        resolve(decoder.decode(reader.result));
                    } catch (e) {
                        // 如果UTF-8解码失败，尝试其他编码或将二进制数据转换为十六进制字符串
                        const hexString = Array.from(new Uint8Array(reader.result))
                            .map(b => b.toString(16).padStart(2, '0'))
                            .join(' ');
                        resolve(hexString);
                    }
                } else {
                    reject(new Error('无法读取文件内容'));
                }
            };
            reader.onerror = () => reject(reader.error || new Error('读取文件出错'));
            reader.readAsText(file);
        });
    };

    const handleFileSelect = async () => {
        try {
            const filePaths = await open({
                multiple: true,
                filters: [{
                    name: 'Text Files',
                    extensions: ['txt', 'log']
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
            console.error('文件选择错误：', error);
            toast.error('文件选择失败');
            dispatch(setError(errorMessage));
        } finally {
            dispatch(setLoading(false));
        }
    };

    const closeTab = (path: string) => {
        // 检查文件是否已修改但未保存
        const fileToClose = openFiles.find(file => file.path === path);
        if (fileToClose?.isModified) {
            // 这里可以添加确认对话框
            if (!window.confirm('文件已修改，确定要关闭吗？')) {
                return;
            }
        }

        dispatch(removeFile(path));
    };

    return (
        <div className="flex flex-col h-full">
            {/* 顶部操作栏 */}
            <div className="flex items-center justify-between bg-base-200 p-2 border-b border-base-300">
                <div className="flex items-center space-x-2">
                    <button
                        className="btn btn-sm btn-primary"
                        onClick={handleFileSelect}
                        disabled={isLoading}
                    >
                        选择文件
                    </button>

                    {activeFile && (
                        <select
                            className="select select-sm select-bordered"
                            value={activeFile.viewMode}
                            onChange={(e) => handleViewModeChange(activeFile.path, e.target.value as 'text' | 'hex' | 'auto')}
                        >
                            <option value="auto">自动</option>
                            <option value="text">文本</option>
                            <option value="hex">十六进制</option>
                        </select>
                    )}
                </div>
            </div>

            {/* VS Code 样式的文件标签 */}
            <div className="flex bg-base-300 overflow-x-auto">
                {openFiles.map(file => (
                    <div
                        key={file.path}
                        className={`
                            flex items-center h-9 px-3 py-1 border-r border-base-300
                            ${activeTabPath === file.path
                                ? 'bg-base-100 text-primary font-medium'
                                : 'bg-base-200 hover:bg-base-100'
                            }
                            transition-colors cursor-pointer
                        `}
                        onClick={() => dispatch(setActiveTab(file.path))}
                    >
                        <span className={`${file.isModified ? 'font-bold' : ''}`}>
                            {file.name}{file.isModified ? ' •' : ''}
                        </span>
                        <button
                            className="ml-2 opacity-60 hover:opacity-100"
                            onClick={(e) => {
                                e.stopPropagation();
                                closeTab(file.path);
                            }}
                        >
                            ×
                        </button>
                    </div>
                ))}
            </div>

            {error && (
                <div className="bg-error text-error-content p-2 text-sm">
                    错误: {error}
                    <button
                        className="btn btn-xs btn-ghost ml-2"
                        onClick={() => dispatch(setError(null))}
                    >
                        ×
                    </button>
                </div>
            )}

            <PanelGroup direction="horizontal" className="flex-grow" onLayout={handlePanelResize}>
                <Panel defaultSize={splitSize[0]} minSize={30}>
                    <div
                        className={`h-full relative border border-base-300 ${isDragging ? 'border-2 border-dashed border-primary' : ''}`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                        {isLoading && (
                            <div className="absolute inset-0 bg-base-100/50 flex items-center justify-center z-20">
                                <span className="loading loading-spinner loading-lg"></span>
                            </div>
                        )}
                        {activeFile && (
                            <Editor
                                height="100%"
                                defaultLanguage="plaintext"
                                value={getFileContent(activeFile)}
                                onChange={(value) => handleEditorChange(value, activeFile.path)}
                                options={{
                                    readOnly: activeFile.viewMode === 'hex',
                                    wordWrap: 'on',
                                    minimap: { enabled: true },
                                    lineNumbers: 'on',
                                    scrollBeyondLastLine: false,
                                    fontSize: 14,
                                }}
                                onMount={handleEditorMount}
                            />
                        )}
                    </div>
                </Panel>
                <PanelResizeHandle className="w-0.5 bg-base-200 hover:bg-primary hover:w-0.5 mx-1" />
                <Panel defaultSize={splitSize[1]} minSize={30}>
                    <div className="flex flex-col h-full border border-base-300">
                        {/* 解析输入区域 */}
                        <div className="border-b border-base-300 p-2">
                            <textarea
                                ref={textareaRef}
                                className="textarea textarea-bordered w-full text-sm font-mono"
                                rows={3}
                                value={selectedContent}
                                onChange={handleSelectedContentChange}
                                placeholder="左侧选中内容后显示在此处，也可以直接编辑后点击重新解析"
                            />
                        </div>

                        {/* 解析结果展示 */}
                        <div className="flex-grow overflow-auto m-2">
                            <TreeTable
                                data={tableData}
                                tableheads={initialColumns}
                                onRowClick={handleRowClick}
                            />
                        </div>
                    </div>
                </Panel>
            </PanelGroup>
        </div>
    );
}