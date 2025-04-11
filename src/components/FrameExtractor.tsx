import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    createColumnHelper,
    flexRender,
    getCoreRowModel, 
    getFilteredRowModel, 
    getSortedRowModel, 
    useReactTable,
    SortingState,
    ColumnFiltersState
} from '@tanstack/react-table';
import { TreeItemType } from './TreeItem';
import { invoke } from "@tauri-apps/api/core";
import { toast } from "../context/ToastProvider";
import { 
    ChevronRight, 
    ChevronDown, 
    ArrowUp, 
    ArrowDown,
    FilterIcon,
    SortAsc,
    SortDesc,
    ArrowUpDown,
    X,
    DownloadIcon,
    PlusIcon,
    Trash2,
    Edit,
    Save,
    MessageSquarePlus,
    Copy,
    ArrowRight
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';

// Types
interface ExtractedData {
    id: string;
    da: string;
    di: string;
    content: string;
    time?: string;
    children?: {
        frameDomain: string;
        data: string;
        description: string;
    }[];
    isExpanded?: boolean;
    uniqueId: string;
    level?: number;
}

interface FrameMessage {
    id: string;
    message: string;
    createdAt: Date;
    selected?: boolean;
}

type FilterType = 'contains' | 'startsWith' | 'endsWith' | 'equals';

interface FilterValue {
    type: FilterType;
    value: string;
}

// Constants
const FILTER_TYPE_LABELS: Record<FilterType, string> = {
    'contains': '包含',
    'startsWith': '开头是',
    'endsWith': '结尾是',
    'equals': '等于'
};

const FrameExtractor: React.FC = () => {
    const [input, setInput] = useState('');
    const [extractedData, setExtractedData] = useState<ExtractedData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    
    // 报文管理相关状态
    const [messages, setMessages] = useState<FrameMessage[]>([]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [currentMessage, setCurrentMessage] = useState<string>('');
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    
    // 选中报文的状态
    const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());
    
    // 选中表格行状态
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [lastSelectedRow, setLastSelectedRow] = useState<string | null>(null);
    
    // Table state
    const [sorting, setSorting] = useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    
    // Filter UI state - 修改为两个独立状态，一个用于UI显示，一个用于实际应用
    const [activeFilterPanel, setActiveFilterPanel] = useState<string | null>(null);
    const [filterSettings, setFilterSettings] = useState<{
        column: string;
        type: FilterType;
        value: string;
    } | null>(null);

    const [exportLoading, setExportLoading] = useState(false);
    const workerRef = useRef<Worker | null>(null);

    // 过滤面板参考元素
    const filterButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
    // 检测面板是否应该向左对齐
    const [shouldAlignRight, setShouldAlignRight] = useState<Record<string, boolean>>({});

    // 从本地存储加载报文
    useEffect(() => {
        const savedMessages = localStorage.getItem('frameMessages');
        if (savedMessages) {
            try {
                const parsedMessages = JSON.parse(savedMessages);
                // 转换日期字符串为Date对象
                const messages = parsedMessages.map((msg: any) => ({
                    ...msg,
                    createdAt: new Date(msg.createdAt)
                }));
                setMessages(messages);
            } catch (error) {
                console.error('加载保存的报文失败:', error);
            }
        }
    }, []);

    // 保存报文到本地存储
    useEffect(() => {
        if (messages.length > 0) {
            localStorage.setItem('frameMessages', JSON.stringify(messages));
        } else {
            // 如果没有报文，清除本地存储
            localStorage.removeItem('frameMessages');
        }
    }, [messages]);

    const columnHelper = createColumnHelper<ExtractedData>();

    // Column definitions
    const columns = [
        columnHelper.accessor('da', {
            header: '信息点标识(DA)',
            cell: info => info.getValue(),
            enableSorting: true,
            enableColumnFilter: true,
            filterFn: (row, columnId, filterValue: FilterValue) => {
                const value = row.getValue(columnId) as string;
                const { type, value: filterText } = filterValue;
                
                if (!filterText) return true;
                
                switch (type) {
                    case 'contains':
                        return value.includes(filterText);
                    case 'startsWith':
                        return value.startsWith(filterText);
                    case 'endsWith':
                        return value.endsWith(filterText);
                    case 'equals':
                        return value === filterText;
                    default:
                        return true;
                }
            }
        }),
        columnHelper.accessor('di', {
            header: '数据标识编码(DI)',
            cell: info => info.getValue(),
            enableSorting: true,
            enableColumnFilter: true,
            filterFn: (row, columnId, filterValue: FilterValue) => {
                const value = row.getValue(columnId) as string;
                const { type, value: filterText } = filterValue;
                
                if (!filterText) return true;
                
                switch (type) {
                    case 'contains':
                        return value.includes(filterText);
                    case 'startsWith':
                        return value.startsWith(filterText);
                    case 'endsWith':
                        return value.endsWith(filterText);
                    case 'equals':
                        return value === filterText;
                    default:
                        return true;
                }
            }
        }),
        columnHelper.accessor('content', {
            header: '内容',
            cell: info => info.getValue(),
            enableSorting: false,
            enableColumnFilter: false,
        }),
        columnHelper.accessor('time', {
            header: '时间',
            cell: info => info.getValue() || '-',
            enableSorting: true,
            enableColumnFilter: true,
            filterFn: (row, columnId, filterValue: FilterValue) => {
                const value = (row.getValue(columnId) as string) || '';
                const { type, value: filterText } = filterValue;
                
                if (!filterText) return true;
                
                switch (type) {
                    case 'contains':
                        return value.includes(filterText);
                    case 'startsWith':
                        return value.startsWith(filterText);
                    case 'endsWith':
                        return value.endsWith(filterText);
                    case 'equals':
                        return value === filterText;
                    default:
                        return true;
                }
            }
        }),
    ];

    // 自定义排序处理
    const handleSortingChange = (updaterOrValue: SortingState | ((old: SortingState) => SortingState)) => {
        setSorting(old => {
            // 如果传入的是函数，执行它获取新值
            const newValue = typeof updaterOrValue === 'function' ? updaterOrValue(old) : updaterOrValue;
            
            // 如果新值为空数组，则清除所有排序
            if (newValue.length === 0) {
                return [];
            }
            
            // 检查是否是取消某列的排序
            if (newValue.length < old.length) {
                // 找出被移除的列
                const oldIds = old.map(col => col.id);
                const newIds = newValue.map(col => col.id);
                const removedIds = oldIds.filter(id => !newIds.includes(id));
                
                if (removedIds.length > 0) {
                    // 如果有列被移除，从旧排序中删除该列的排序
                    return old.filter(col => !removedIds.includes(col.id));
                }
            }
            
            // 检查是否是修改某列的排序方向
            const modifiedColumns = newValue.filter(newCol => {
                const oldCol = old.find(o => o.id === newCol.id);
                return oldCol && oldCol.desc !== newCol.desc;
            });
            
            if (modifiedColumns.length > 0) {
                // 如果只是修改了排序方向，保留修改后的结果
                return newValue;
            }
            
            // 如果是新增列排序，保留旧的排序并添加新列
            const existingColumnIds = old.map(col => col.id);
            const newColumns = newValue.filter(col => !existingColumnIds.includes(col.id));
            
            if (newColumns.length > 0) {
                // 添加新列到已有排序的末尾
                return [...old, ...newColumns];
            }
            
            // 默认返回新值
            return newValue;
        });
    };

    // Table instance
    const table = useReactTable({
        data: extractedData,
        columns,
        state: {
            sorting,
            columnFilters,
        },
        onSortingChange: handleSortingChange,
        onColumnFiltersChange: setColumnFilters,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        enableMultiSort: true,
    });

    // Data extraction and parsing
    const extractData = (items: TreeItemType[]): ExtractedData[] => {
        const result: ExtractedData[] = [];
        console.log('原始解析数据:', JSON.stringify(items));

        // 递归遍历函数
        const traverseItems = (items: TreeItemType[]) => {
            for (let i = 0; i < items.length; i++) {
                const currentItem = items[i];
                const nextItem = items[i + 1];
                const dataitem = items[i + 2];
                const timeitem = items[i + 3];

                // 检查当前项是否包含信息点标识DA
                if (currentItem.frameDomain.includes('信息点标识DA')) {
                    let da = '';
                    
                    // 情况1：Pn=测量点：0(终端)
                    if (currentItem.description.includes('Pn=测量点：0(终端)')) {
                        da = '0';
                    }
                    // 情况2：Pn=第X测量点
                    else {
                        const daMatch = currentItem.description.match(/Pn=第(\d+)测量点/);
                        da = daMatch ? daMatch[1] : currentItem.data || '';
                    }

                    // 检查下一项是否包含数据标识编码DI
                    if (nextItem && nextItem.frameDomain.includes('数据标识编码DI')) {
                        // 检查DI的data格式，如果是XX 03 00 E0这种格式则跳过（XX为任意值）
                        const diData = nextItem.data || '';
                        if (diData.match(/^[0-9A-F]{2} 03 00 E0$/i)) {
                            console.log('跳过特殊格式的DI数据:', diData);
                            continue; // 跳过当前循环，继续遍历
                        }

                        const diMatch = nextItem.description.match(/数据标识编码：\[(.*?)\]/);
                        const di = diMatch ? diMatch[1] : nextItem.frameDomain || '';

                        // 查找数据内容
                        console.log("dataitem", dataitem);
                        let content = '';
                        if (dataitem && dataitem.frameDomain.includes('数据内容')) {
                            content = dataitem.data;
                        }

                        let time = '';

                        console.log("timeitem", timeitem);
                        if (timeitem && timeitem.frameDomain.includes('数据时间')) {
                            time =  timeitem.data;
                        }
                        // 提取子项
                        const children: ExtractedData['children'] = [];
                        if (dataitem?.children) {
                            dataitem.children.forEach(child => {
                                if (child.children) {
                                    child.children.forEach(grandChild => {
                                        if (grandChild.children) {
                                            grandChild.children.forEach(greatGrandChild => {
                                                children.push({
                                                    frameDomain: greatGrandChild.frameDomain,
                                                    data: greatGrandChild.data,
                                                    description: greatGrandChild.description
                                                });
                                            });
                                        } else {
                                            children.push({
                                                frameDomain: grandChild.frameDomain,
                                                data: grandChild.data,
                                                description: grandChild.description
                                            });
                                        }
                                    });
                                } else {
                                    children.push({
                                        frameDomain: child?.frameDomain || "",
                                        data: child?.data || "",
                                        description: child?.description || ""
                                    });
                                }
                            });
                        } else {
                            children.push({
                                frameDomain: dataitem?.frameDomain || "",
                                data: dataitem?.data || "",
                                description: dataitem?.description || ""
                            });
                        }

                        // 只有当DA和DI存在时才添加数据
                        if (da && di) {
                            const extractedItem: ExtractedData = {
                                id: `${da}-${di}-${content}-${time}-${Math.random().toString(36).substr(2, 9)}`,
                                da,
                                di,
                                content,
                                time,
                                children,
                                isExpanded: false,
                                uniqueId: `${da}-${di}-${content}-${time}-${Math.random().toString(36).substr(2, 9)}`
                            };
                            result.push(extractedItem);
                            console.log(`添加数据组:`, extractedItem);
                        }
                    }
                }

                // 递归处理子项
                if (currentItem.children) {
                    traverseItems(currentItem.children);
                }
            }
        };

        // 开始遍历
        traverseItems(items);

        console.log('解析结果:', result);
        return result;
    };

    const toggleExpand = (uniqueId: string) => {
        setExtractedData(prev => {
            const newData = [...prev];
            const index = newData.findIndex(item => item.uniqueId === uniqueId);
            if (index !== -1) {
                newData[index] = {
                    ...newData[index],
                    isExpanded: !newData[index].isExpanded
                };
            }
            return newData;
        });
    };

    // 处理行选择
    const handleRowSelect = (uniqueId: string, event: React.MouseEvent) => {
        // 阻止事件传播，防止影响其他事件处理
        event.stopPropagation();
        
        if (event.shiftKey && lastSelectedRow) {
            // Shift + 点击进行范围选择
            // 获取表格中所有主行（不包括展开的子项行）
            const visibleRows = table.getRowModel().rows;
            const visibleRowsMap = new Map();
            
            // 创建可见行索引映射
            visibleRows.forEach((row, index) => {
                visibleRowsMap.set(row.original.uniqueId, index);
            });
            
            // 确定选择范围
            const startIndex = visibleRowsMap.get(lastSelectedRow);
            const endIndex = visibleRowsMap.get(uniqueId);
            
            if (startIndex !== undefined && endIndex !== undefined) {
                // 确保起始和结束索引的顺序正确
                const minIndex = Math.min(startIndex, endIndex);
                const maxIndex = Math.max(startIndex, endIndex);
                
                // 创建新的选中集合
                const newSelected = new Set<string>();
                
                // 只选择范围内的实际行，不包括子项行
                for (let i = minIndex; i <= maxIndex; i++) {
                    const rowId = visibleRows[i].original.uniqueId;
                    newSelected.add(rowId);
                }
                
                setSelectedRows(newSelected);
            }
        } else if (event.ctrlKey || event.metaKey) {
            // Ctrl/Cmd + 点击切换单个行的选中状态
            setSelectedRows(prev => {
                const newSelected = new Set(prev);
                if (newSelected.has(uniqueId)) {
                    newSelected.delete(uniqueId);
                } else {
                    newSelected.add(uniqueId);
                }
                return newSelected;
            });
        } else {
            // 普通点击，清除其他选中并选中当前行
            setSelectedRows(new Set([uniqueId]));
        }
        
        // 记录最后选中的行，用于后续的Shift选择
        setLastSelectedRow(uniqueId);
    };

    // 处理双击展开
    const handleRowDoubleClick = (uniqueId: string, event: React.MouseEvent) => {
        // 阻止事件传播
        event.stopPropagation();
        // 双击展开/收起子项
        toggleExpand(uniqueId);
    };

    // 格式化报文内容
    const formatMessageContent = (message: string): string => {
        // 移除所有空格和换行符，并转为大写
        const cleanedMessage = message.replace(/\s+/g, '').toUpperCase();
        
        // 验证是否只包含有效的十六进制字符 (0-9, A-F)
        const isValidHex = /^[0-9A-F]+$/.test(cleanedMessage);
        
        if (!isValidHex) {
            toast.warning("报文包含非十六进制字符，已自动过滤");
            // 过滤掉非十六进制字符
            return cleanedMessage.replace(/[^0-9A-F]/g, '');
        }
        
        return cleanedMessage;
    };

    // 添加新报文
    const handleAddMessage = () => {
        if (!currentMessage.trim()) {
            toast.error("请输入报文内容");
            return;
        }

        // 格式化报文内容
        const formattedMessage = formatMessageContent(currentMessage.trim());

        // 添加新报文到列表
        const newMessage: FrameMessage = {
            id: Date.now().toString(),
            message: formattedMessage,
            createdAt: new Date(),
            selected: false
        };

        setMessages(prev => [...prev, newMessage]);
        setCurrentMessage(''); // 清空输入框
        setIsAddDialogOpen(false); // 关闭添加对话框
        toast.success("报文添加成功");
    };

    // 更新编辑中的报文
    const handleUpdateMessage = () => {
        if (!editingMessageId || !currentMessage.trim()) {
            toast.error("请输入报文内容");
            return;
        }

        // 格式化报文内容
        const formattedMessage = formatMessageContent(currentMessage.trim());

        setMessages(prev => prev.map(msg => 
            msg.id === editingMessageId 
                ? { ...msg, message: formattedMessage } 
                : msg
        ));

        setEditingMessageId(null);
        setCurrentMessage('');
        setIsAddDialogOpen(false); // 关闭添加对话框
        toast.success("报文更新成功");
    };

    // 选择/取消选择单个报文
    const toggleMessageSelection = (id: string) => {
        setMessages(prev => prev.map(msg => 
            msg.id === id ? { ...msg, selected: !msg.selected } : msg
        ));
    };

    // 全选/取消全选报文
    const toggleSelectAll = () => {
        const allSelected = messages.every(msg => msg.selected);
        
        // 如果全部选中，则取消全选；否则全选
        setMessages(prev => prev.map(msg => ({ ...msg, selected: !allSelected })));
    };
    
    // 获取选中状态
    // 0: 未选中, 1: 部分选中, 2: 全部选中
    const getSelectAllState = (): number => {
        if (messages.length === 0) return 0;
        
        const selectedCount = messages.filter(msg => msg.selected).length;
        
        if (selectedCount === 0) return 0;
        if (selectedCount === messages.length) return 2;
        return 1;
    };
    
    // 解析选中的报文（并行执行）
    const parseSelectedMessages = async () => {
        const selectedMessages = messages.filter(msg => msg.selected);
        
        if (selectedMessages.length === 0) {
            toast.warning("请先选择要解析的报文");
            return;
        }

        setIsLoading(true);
        try {
            // 清空现有解析结果
            setExtractedData([]);
            
            const allExtractedData: ExtractedData[] = [];
            
            // 创建所有解析任务的Promise数组
            const parsePromises = selectedMessages.map(async (messageItem) => {
                // 用于发送到后端的格式化报文（添加空格）
                const formattedValue = messageItem.message
                    .replace(/\s+/g, '')
                    .replace(/(.{2})/g, '$1 ')
                    .trim()
                    .toUpperCase();

                try {
                    const result = await invoke<{ data: TreeItemType[]; error?: string }>('on_text_change', {
                        message: formattedValue,
                        region: "南网"
                    });

                    if (result.error) {
                        toast.error(`解析报文失败：${result.error}`);
                        return [];
                    }

                    return extractData(result.data);
                } catch (error) {
                    console.error(`解析报文失败:`, error);
                    toast.error(`解析报文失败: ${error instanceof Error ? error.message : '未知错误'}`);
                    return [];
                }
            });
            
            // 并行执行所有解析任务
            const results = await Promise.all(parsePromises);
            
            // 合并所有解析结果
            for (const extracted of results) {
                allExtractedData.push(...extracted);
            }

            setExtractedData(allExtractedData);
            
            if (allExtractedData.length === 0) {
                toast.warning("没有成功解析出任何数据");
            } else {
                toast.success(`成功解析 ${allExtractedData.length} 条数据`);
                // 关闭对话框
                setIsDialogOpen(false);
            }
        } catch (error) {
            console.error("解析失败:", error);
            toast.error("解析失败！");
        } finally {
            setIsLoading(false);
        }
    };

    // 编辑报文
    const handleEditMessage = (message: FrameMessage) => {
        setEditingMessageId(message.id);
        setCurrentMessage(message.message);
        setIsAddDialogOpen(true); // 打开添加对话框进行编辑
    };

    // 删除报文
    const handleDeleteMessage = (id: string) => {
        setMessages(prev => prev.filter(msg => msg.id !== id));
        
        // 如果删除的是正在编辑的报文，清空编辑状态
        if (editingMessageId === id) {
            setEditingMessageId(null);
            setCurrentMessage('');
        }
        
        toast.success("报文已删除");
    };

    // 解析单条报文
    const parseMessage = async (message: string) => {
        if (!message.trim()) {
            toast.error("报文内容为空");
            return;
        }

        setIsLoading(true);
        try {
            // 清空现有解析结果
            setExtractedData([]);
            
            // 先确保报文已格式化
            const formattedValue = message
                .replace(/\s+/g, '')
                .replace(/(.{2})/g, '$1 ')
                .trim()
                .toUpperCase();

            const result = await invoke<{ data: TreeItemType[]; error?: string }>('on_text_change', {
                message: formattedValue,
                region: "南网"
            });

            if (result.error) {
                toast.error(`解析失败：${result.error}`);
                return;
            }

            const extracted = extractData(result.data);
            
            // 直接设置新的解析结果，不再追加
            setExtractedData(extracted);
            
            if (extracted.length === 0) {
                toast.warning("没有成功解析出任何数据");
            } else {
                toast.success(`成功解析 ${extracted.length} 条数据`);
                // 解析成功后关闭对话框
                setIsDialogOpen(false);
            }
        } catch (error) {
            console.error("解析失败:", error);
            toast.error("解析失败！");
        } finally {
            setIsLoading(false);
        }
    };

    // 解析所有报文
    const parseAllMessages = async () => {
        if (messages.length === 0) {
            toast.warning("没有报文可解析");
            return;
        }

        setIsLoading(true);
        try {
            // 清空现有解析结果
            setExtractedData([]);
            
            const allExtractedData: ExtractedData[] = [];
            
            for (const messageItem of messages) {
                // 用于发送到后端的格式化报文（添加空格）
                const formattedValue = messageItem.message
                    .replace(/\s+/g, '')
                    .replace(/(.{2})/g, '$1 ')
                    .trim()
                    .toUpperCase();

                const result = await invoke<{ data: TreeItemType[]; error?: string }>('on_text_change', {
                    message: formattedValue,
                    region: "南网"
                });

                if (result.error) {
                    toast.error(`解析失败：${result.error}`);
                    continue;
                }

                const extracted = extractData(result.data);
                allExtractedData.push(...extracted);
            }

            // 直接设置新的解析结果，不再追加
            setExtractedData(allExtractedData);
            
            if (allExtractedData.length === 0) {
                toast.warning("没有成功解析出任何数据");
            } else {
                toast.success(`成功解析 ${allExtractedData.length} 条数据`);
                // 关闭对话框
                setIsDialogOpen(false);
            }
        } catch (error) {
            console.error("解析失败:", error);
            toast.error("解析失败！");
        } finally {
            setIsLoading(false);
        }
    };

    // 更新过滤状态但不立即应用
    const updateFilterSetting = (update: Partial<typeof filterSettings>) => {
        if (!filterSettings) return;
        setFilterSettings({
            ...filterSettings,
            ...update
        });
    };

    // 打开过滤面板时初始化过滤设置
    const openFilterPanel = (columnId: string) => {
        // 查找现有过滤器
        const existingFilter = columnFilters.find(f => f.id === columnId);
        
        // 设置过滤面板状态
        setActiveFilterPanel(columnId);
        
        // 设置过滤器设置，用于UI展示
        setFilterSettings({
            column: columnId,
            type: existingFilter 
                ? (existingFilter.value as FilterValue).type 
                : 'contains',
            value: existingFilter 
                ? (existingFilter.value as FilterValue).value 
                : ''
        });

        // 检查过滤面板是否靠近右边界和底部边界
        setTimeout(() => {
            const buttonEl = filterButtonRefs.current[columnId];
            if (buttonEl) {
                const buttonRect = buttonEl.getBoundingClientRect();
                const windowWidth = window.innerWidth;
                const windowHeight = window.innerHeight;
                const panelWidth = 300; // 面板宽度
                const panelHeight = 260; // 预估的面板高度
                
                // 判断面板放在按钮右侧是否会超出窗口
                const shouldAlign = buttonRect.right + panelWidth > windowWidth;
                setShouldAlignRight(prev => ({...prev, [columnId]: shouldAlign}));
                
                // 检查是否会超出底部
                if (buttonRect.bottom + panelHeight > windowHeight) {
                    // 如果会超出底部，尝试让表格容器滚动，使按钮上移
                    const tableContainer = document.querySelector('.relative.flex-1.overflow-auto');
                    if (tableContainer) {
                        const scrollAmount = Math.min(
                            buttonRect.bottom + panelHeight - windowHeight + 20,
                            (tableContainer as HTMLElement).scrollTop + 300
                        );
                        (tableContainer as HTMLElement).scrollBy({
                            top: -scrollAmount,
                            behavior: 'smooth'
                        });
                    }
                }
            }
        }, 0);
    };

    // 仅在用户确认时应用过滤器
    const applyFilter = () => {
        if (!filterSettings) return;
        
        const { column, type, value } = filterSettings;
        
        if (!value.trim()) {
            // 如果值为空，则删除此列的过滤器
            setColumnFilters(prev => prev.filter(filter => filter.id !== column));
        } else {
            // 否则应用过滤器
            setColumnFilters(prev => [
                ...prev.filter(filter => filter.id !== column),
                {
                    id: column,
                    value: { type, value },
                }
            ]);
        }
        
        // 关闭过滤面板
        setActiveFilterPanel(null);
        setFilterSettings(null);
    };

    // 关闭过滤面板
    const closeFilterPanel = () => {
        setActiveFilterPanel(null);
        setFilterSettings(null);
    };

    // 清除指定列的过滤器
    const clearFilter = (columnId: string) => {
        setColumnFilters(prev => prev.filter(filter => filter.id !== columnId));
    };

    // 清除所有过滤器
    const clearAllFilters = () => {
        setColumnFilters([]);
    };

    // 重置当前列的过滤条件，但不关闭面板
    const resetFilterSetting = () => {
        if (!filterSettings) return;
        
        // 重置过滤设置为默认值
        setFilterSettings({
            ...filterSettings,
            type: 'contains',
            value: ''
        });
    };

    // 过滤指示器徽章组件
    const FilterBadge = ({ column }: { column: string }) => {
        const filter = columnFilters.find(f => f.id === column);
        if (!filter) return null;
        
        const { type, value } = filter.value as FilterValue;
        
        return (
            <div className="badge badge-sm badge-primary gap-1">
                {FILTER_TYPE_LABELS[type]}: {value}
                <button 
                    className="ml-1" 
                    onClick={(e) => {
                        e.stopPropagation();
                        clearFilter(column);
                    }}
                >
                    <X className="w-3 h-3" />
                </button>
            </div>
        );
    };

    // 在组件卸载时或点击页面其他区域时关闭过滤面板
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            // 检查是否点击了过滤面板之外的区域
            const target = e.target as HTMLElement;
            if (
                activeFilterPanel &&
                !target.closest('.filter-panel-content') && 
                !target.closest('.filter-button')
            ) {
                closeFilterPanel();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [activeFilterPanel]);

    // 创建并销毁Worker
    useEffect(() => {
        // 创建Worker
        workerRef.current = new Worker(new URL('../workers/excelWorker.ts', import.meta.url), { type: 'module' });
        
        // 设置Worker消息处理函数
        workerRef.current.onmessage = async (e) => {
            const { success, data, error } = e.data;
            
            if (success) {
                try {
                    // 使用Tauri v2的fs API保存文件
                    const now = new Date();
                    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
                    const fileName = `数据导出_${timestamp}.xlsx`;
                    
                    // 打开保存文件对话框
                    const filePath = await save({
                        title: '保存Excel文件',
                        defaultPath: fileName,
                        filters: [{
                            name: 'Excel文件',
                            extensions: ['xlsx']
                        }]
                    });
                    
                    if (filePath) {
                        // 将Uint8Array转换为ArrayBuffer
                        const arrayBuffer = data.buffer;
                        // 写入文件
                        await writeFile(filePath, arrayBuffer);
                        toast.success("数据导出成功");
                    }
                } catch (error) {
                    console.error("保存Excel文件失败:", error);
                    toast.error(`保存Excel文件失败: ${error instanceof Error ? error.message : '未知错误'}`);
                }
            } else {
                console.error("导出Excel失败:", error);
                toast.error(`导出Excel失败: ${error}`);
            }
            
            setExportLoading(false);
        };
        
        // 在组件卸载时终止Worker
        return () => {
            if (workerRef.current) {
                workerRef.current.terminate();
                workerRef.current = null;
            }
        };
    }, []);
    
    // 导出Excel功能
    const exportToExcel = () => {
        // 判断是否有数据可供导出
        if (extractedData.length === 0) {
            toast.warning("没有数据可供导出");
            return;
        }
        
        // 避免重复点击
        if (exportLoading) {
            return;
        }
        
        try {
            setExportLoading(true);
            
            // 准备要发送给Worker的数据
            const rowsToExport = table.getFilteredRowModel().rows.map(row => row.original);
            
            // 发送数据到Worker处理
            workerRef.current?.postMessage({
                rows: rowsToExport,
                includeChildren: true // 包含子项内容
            });
            
        } catch (error) {
            console.error("导出Excel失败:", error);
            toast.error("导出Excel失败");
            setExportLoading(false);
        }
    };

    // 关闭报文对话框时重置状态
    const closeMessageDialog = () => {
        setIsDialogOpen(false);
    };

    // 关闭添加/编辑对话框时重置状态
    const closeAddDialog = () => {
        setIsAddDialogOpen(false);
        if (editingMessageId) {
            setEditingMessageId(null);
            setCurrentMessage('');
        }
    };

    // 复制报文内容到剪贴板
    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
            .then(() => {
                toast.success('报文已复制到剪贴板');
            })
            .catch((err) => {
                console.error('复制失败:', err);
                toast.error('复制失败');
            });
    };

    return (
        <div className="flex flex-col h-full p-4 bg-base-100">
            {/* 顶部工具栏 */}
            <div className="flex justify-between items-center mb-6 bg-base-100 rounded-lg p-3 shadow-sm border border-base-200">
                <h1 className="text-xl font-semibold">报文解析工具</h1>
                <div className="flex gap-2">
                    <button 
                        className="btn btn-primary"
                        onClick={() => setIsDialogOpen(true)}
                    >
                        <MessageSquarePlus className="w-5 h-5 mr-1" />
                        报文管理
                    </button>
                    {extractedData.length > 0 && (
                        <>
                            <button
                                className="btn btn-outline btn-error"
                                onClick={() => setExtractedData([])}
                                title="清空当前解析结果"
                            >
                                <Trash2 className="w-4 h-4 mr-1" />
                                清空数据
                            </button>
                            <button
                                className={`btn ${exportLoading ? 'btn-disabled' : 'btn-outline'}`}
                                onClick={exportToExcel}
                                disabled={exportLoading}
                            >
                                {exportLoading ? (
                                    <>
                                        <span className="loading loading-spinner loading-xs mr-1"></span>
                                        导出中...
                                    </>
                                ) : (
                                    <>
                                        <DownloadIcon className="w-4 h-4 mr-1" />
                                        导出Excel
                                    </>
                                )}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Table Section - 使用flex-1让表格填充剩余空间 */}
            <div className="flex-1 flex flex-col min-h-0 bg-base-100 rounded-lg shadow-sm border border-base-200 overflow-hidden">
                {/* 表格工具栏 */}
                {extractedData.length > 0 && (
                    <div className="flex justify-between items-center p-3 bg-base-200/50 border-b border-base-200">
                        <div className="text-sm">
                            显示 <span className="font-semibold">{table.getFilteredRowModel().rows.length}</span> 条结果，共 <span className="font-semibold">{extractedData.length}</span> 条
                            {selectedRows.size > 0 && <span>，已选择 <span className="font-semibold text-primary">{selectedRows.size}</span> 条</span>}
                        </div>
                        <div className="flex gap-2">
                            {selectedRows.size > 0 && (
                                <button
                                    className="btn btn-sm btn-outline btn-error"
                                    onClick={() => setSelectedRows(new Set())}
                                >
                                    清除选择
                                </button>
                            )}
                        </div>
                    </div>
                )}
                
                <div className="relative flex-1 overflow-auto">
                    <table className="table table-zebra w-full">
                        <thead className="sticky top-0 z-10 bg-base-200">
                            {table.getHeaderGroups().map(headerGroup => (
                                <tr key={headerGroup.id}>
                                    {headerGroup.headers.map(header => {
                                        const column = header.column;
                                        
                                        return (
                                            <th key={header.id} className="bg-base-200">
                                                <div className="flex items-center justify-between">
                                                    <div 
                                                        className={`
                                                            flex items-center gap-2
                                                            ${column.getCanSort() ? 'cursor-pointer select-none' : ''}
                                                        `}
                                                        onClick={(e) => {
                                                            if (!column.getCanSort()) return;
                                                            
                                                            // 获取当前排序状态
                                                            const currentSortDir = column.getIsSorted();
                                                            let nextSortDir: boolean | undefined;
                                                            
                                                            // 循环切换：未排序 -> 升序 -> 降序 -> 未排序
                                                            if (currentSortDir === 'asc') {
                                                                // 当前是升序，下一个是降序
                                                                nextSortDir = true;
                                                            } else if (currentSortDir === 'desc') {
                                                                // 当前是降序，下一个是移除排序
                                                                nextSortDir = undefined;
                                                            } else {
                                                                // 当前未排序，下一个是升序
                                                                nextSortDir = false;
                                                            }
                                                            
                                                            // 根据下一个排序方向，更新排序状态
                                                            if (nextSortDir === undefined) {
                                                                // 移除此列排序
                                                                setSorting(prev => prev.filter(s => s.id !== column.id));
                                                            } else {
                                                                // 更新或添加此列排序
                                                                setSorting(prev => {
                                                                    // 检查此列是否已有排序
                                                                    const existingIndex = prev.findIndex(s => s.id === column.id);
                                                                    if (existingIndex !== -1) {
                                                                        // 更新现有排序方向
                                                                        const updated = [...prev];
                                                                        updated[existingIndex] = {
                                                                            id: column.id,
                                                                            desc: nextSortDir
                                                                        };
                                                                        return updated;
                                                                    } else {
                                                                        // 添加新排序
                                                                        return [...prev, {
                                                                            id: column.id,
                                                                            desc: nextSortDir
                                                                        }];
                                                                    }
                                                                });
                                                            }
                                                        }}
                                                    >
                                                        <span>{flexRender(column.columnDef.header, header.getContext())}</span>
                                                        
                                                        {column.getCanSort() && (
                                                            <span className="text-base-content/70">
                                                                {column.getIsSorted() === 'asc' ? (
                                                                    <SortAsc className="w-4 h-4" />
                                                                ) : column.getIsSorted() === 'desc' ? (
                                                                    <SortDesc className="w-4 h-4" />
                                                                ) : (
                                                                    <ArrowUpDown className="w-4 h-4 opacity-30" />
                                                                )}
                                                            </span>
                                                        )}
                                                    </div>
                                                    
                                                    {column.getCanFilter() && (
                                                        <div className="relative filter-panel-container">
                                                            <button 
                                                                className="btn btn-ghost btn-circle btn-xs filter-button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    openFilterPanel(column.id);
                                                                }}
                                                                title="过滤"
                                                                ref={el => filterButtonRefs.current[column.id] = el}
                                                            >
                                                                <FilterIcon 
                                                                    className={`
                                                                        w-4 h-4 
                                                                        ${column.getIsFiltered() ? 'text-primary' : 'text-base-content/50'}
                                                                    `} 
                                                                />
                                                            </button>
                                                            
                                                            {activeFilterPanel === column.id && (
                                                                <div className="absolute z-[200] mt-2 shadow-xl rounded-lg border border-base-300 bg-base-100" 
                                                                    style={{ 
                                                                        minWidth: '300px',
                                                                        maxWidth: '350px',
                                                                        ...(shouldAlignRight[column.id] 
                                                                            ? { right: '0px' } 
                                                                            : { left: '0px' }),
                                                                        top: 'calc(100% + 5px)',
                                                                    }}
                                                                >
                                                                    <div className="p-4 filter-panel-content">
                                                                        <div className="flex justify-between items-center mb-3">
                                                                            <h3 className="text-sm font-semibold">过滤选项</h3>
                                                                            <button 
                                                                                className="btn btn-ghost btn-xs" 
                                                                                onClick={closeFilterPanel}
                                                                            >
                                                                                <X className="w-4 h-4" />
                                                                            </button>
                                                                        </div>
                                                                        
                                                                        <div className="space-y-3">
                                                                            <div className="form-control w-full">
                                                                                <label className="label">
                                                                                    <span className="label-text">过滤方式</span>
                                                                                </label>
                                                                                <select 
                                                                                    className="select select-bordered select-sm w-full"
                                                                                    value={filterSettings?.type}
                                                                                    onChange={(e) => updateFilterSetting({
                                                                                        type: e.target.value as FilterType
                                                                                    })}
                                                                                >
                                                                                    {Object.entries(FILTER_TYPE_LABELS).map(([type, label]) => (
                                                                                        <option key={type} value={type}>{label}</option>
                                                                                    ))}
                                                                                </select>
                                                                            </div>
                                                                            
                                                                            <div className="form-control w-full">
                                                                                <label className="label">
                                                                                    <span className="label-text">过滤值</span>
                                                                                </label>
                                                                                <input 
                                                                                    type="text"
                                                                                    className="input input-bordered input-sm w-full"
                                                                                    value={filterSettings?.value || ''}
                                                                                    onChange={(e) => updateFilterSetting({
                                                                                        value: e.target.value
                                                                                    })}
                                                                                    onKeyDown={(e) => {
                                                                                        if (e.key === 'Enter') {
                                                                                            applyFilter();
                                                                                        }
                                                                                    }}
                                                                                    placeholder="输入过滤值..."
                                                                                    autoFocus
                                                                                />
                                                                            </div>
                                                                            
                                                                            <div className="flex justify-between items-center gap-2 mt-3">
                                                                                <button 
                                                                                    className="btn btn-ghost btn-sm"
                                                                                    onClick={resetFilterSetting}
                                                                                >
                                                                                    重置
                                                                                </button>
                                                                                <div className="flex gap-2">
                                                                                    <button 
                                                                                        className="btn btn-ghost btn-sm"
                                                                                        onClick={closeFilterPanel}
                                                                                    >
                                                                                        取消
                                                                                    </button>
                                                                                    <button 
                                                                                        className="btn btn-primary btn-sm"
                                                                                        onClick={applyFilter}
                                                                                    >
                                                                                        应用
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </th>
                                        );
                                    })}
                                </tr>
                            ))}
                        </thead>
                        
                        <tbody>
                            {table.getRowModel().rows.length ? (
                                table.getRowModel().rows.map(row => {
                                    const item = row.original;
                                    const isSelected = selectedRows.has(item.uniqueId);
                                    
                                    return (
                                        <React.Fragment key={item.uniqueId}>
                                            <tr 
                                                className={`
                                                    transition-colors cursor-pointer select-none
                                                    ${isSelected 
                                                        ? 'bg-primary/10 hover:bg-primary/20 border-l-4 border-primary' 
                                                        : 'hover:bg-base-200'
                                                    }
                                                `}
                                                onClick={(e) => handleRowSelect(item.uniqueId, e)}
                                                onDoubleClick={(e) => handleRowDoubleClick(item.uniqueId, e)}
                                            >
                                                {row.getVisibleCells().map((cell, cellIndex) => {
                                                    return (
                                                        <td key={cell.id} className="font-mono">
                                                            {cellIndex === 1 && item.children && item.children.length > 0 ? (
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-base-content/70">
                                                                        {item.isExpanded 
                                                                            ? <ChevronDown className="w-4 h-4" /> 
                                                                            : <ChevronRight className="w-4 h-4" />
                                                                        }
                                                                    </span>
                                                                    {flexRender(
                                                                        cell.column.columnDef.cell, 
                                                                        cell.getContext()
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                flexRender(
                                                                    cell.column.columnDef.cell, 
                                                                    cell.getContext()
                                                                )
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                            
                                            {/* Expandable Detail Rows */}
                                            {item.isExpanded && item.children && item.children.map((child, childIndex) => (
                                                <tr 
                                                    key={`${item.uniqueId}-${childIndex}`} 
                                                    className={`
                                                        select-none border-t border-base-200/30
                                                        ${isSelected 
                                                            ? 'bg-primary/5 border-l-4 border-l-primary' 
                                                            : 'bg-base-100/50'
                                                        }
                                                    `}
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <td className="w-8">
                                                        <div className="w-4 h-4 ml-4 border-l-2 border-b-2 border-base-300 rounded-bl-lg"></div>
                                                    </td>
                                                    <td className="pl-6 font-mono text-xs">{child.frameDomain}</td>
                                                    <td className="font-mono text-xs">{child.data}</td>
                                                    <td className="font-mono text-xs">{child.description}</td>
                                                </tr>
                                            ))}
                                        </React.Fragment>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={4} className="text-center py-12">
                                        {isLoading ? (
                                            <div className="flex flex-col items-center gap-2">
                                                <span className="loading loading-spinner loading-md"></span>
                                                <span className="text-base-content/70">正在加载数据...</span>
                                            </div>
                                        ) : extractedData.length > 0 ? (
                                            <div className="flex flex-col items-center gap-2 text-base-content/70">
                                                <FilterIcon className="w-12 h-12 opacity-30" />
                                                <p>没有符合过滤条件的数据</p>
                                                <button 
                                                    className="btn btn-sm btn-ghost mt-2"
                                                    onClick={clearAllFilters}
                                                >
                                                    清除所有过滤器
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center gap-2 text-base-content/70">
                                                <MessageSquarePlus className="w-12 h-12 opacity-30" />
                                                <p>暂无数据，请添加并解析报文</p>
                                                <button 
                                                    className="btn btn-sm btn-primary mt-2"
                                                    onClick={() => setIsDialogOpen(true)}
                                                >
                                                    <PlusIcon className="w-4 h-4 mr-1" />
                                                    添加报文
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 报文管理对话框 */}
            <dialog className={`modal z-40 ${isDialogOpen ? 'modal-open' : ''}`}>
                <div className="modal-box w-11/12 max-w-3xl bg-base-100">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-semibold">报文管理</h2>
                            <div className="flex items-center">
                                <span className="badge badge-ghost badge-sm mr-1">已添加 {messages.length}</span>
                                {messages.some(msg => msg.selected) && (
                                    <span className="badge badge-primary badge-sm">已选中 {messages.filter(msg => msg.selected).length}</span>
                                )}
                            </div>
                        </div>
                        <button 
                            className="btn btn-sm btn-circle btn-ghost"
                            onClick={closeMessageDialog}
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    
                    {/* 报文列表 */}
                    <div className="mb-4">
                        <div className="border border-base-200 rounded-lg bg-base-100 overflow-hidden">
                            <div className="bg-base-200/50 p-3 border-b border-base-200 flex justify-between items-center">
                                <div className="flex items-center">
                                    <span className="text-sm font-medium">已选中 {messages.filter(msg => msg.selected).length} / {messages.length}</span>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        className="btn btn-circle btn-sm btn-primary"
                                        onClick={() => setIsAddDialogOpen(true)}
                                        title="添加报文"
                                    >
                                        <PlusIcon className="w-4 h-4" />
                                    </button>
                                    {messages.some(msg => msg.selected) && (
                                        <button 
                                            className="btn btn-circle btn-sm btn-primary"
                                            onClick={parseSelectedMessages}
                                            disabled={isLoading}
                                            title="解析选中的报文"
                                        >
                                            {isLoading ? (
                                                <span className="loading loading-spinner loading-xs"></span>
                                            ) : (
                                                <ArrowRight className="w-4 h-4" />
                                            )}
                                        </button>
                                    )}
                                </div>
                            </div>
                            
                            {messages.length === 0 ? (
                                <div className="text-center py-6 text-base-content/70">
                                    暂无报文，请点击 <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-white text-xs">+</span> 添加
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="table table-compact w-full table-fixed">
                                        <colgroup>
                                            <col className="w-10" />
                                            <col className="w-12" />
                                            <col /> {/* 自动占用剩余宽度 */}
                                            <col className="w-28" />
                                        </colgroup>
                                        <thead>
                                            <tr className="bg-base-200/30">
                                                <th className="text-center p-0 pl-1">
                                                    <label className="cursor-pointer flex justify-center">
                                                        <input 
                                                            type="checkbox" 
                                                            className="checkbox checkbox-xs checkbox-primary"
                                                            checked={getSelectAllState() === 2}
                                                            ref={input => {
                                                                if (input) {
                                                                    // 设置indeterminate状态
                                                                    input.indeterminate = getSelectAllState() === 1;
                                                                }
                                                            }}
                                                            onChange={toggleSelectAll}
                                                        />
                                                    </label>
                                                </th>
                                                <th className="text-center text-xs">序号</th>
                                                <th className="text-xs">报文信息</th>
                                                <th className="text-center text-xs">操作</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {messages.map((msg, index) => (
                                                <tr 
                                                    key={msg.id} 
                                                    className={`group hover:bg-base-200 ${msg.selected ? 'bg-primary/10 border-l-4 border-l-primary' : ''}`}
                                                >
                                                    <td className="p-0 pl-1">
                                                        <label className="cursor-pointer flex justify-center">
                                                            <input 
                                                                type="checkbox" 
                                                                className="checkbox checkbox-xs checkbox-primary"
                                                                checked={msg.selected || false}
                                                                onChange={() => toggleMessageSelection(msg.id)}
                                                            />
                                                        </label>
                                                    </td>
                                                    <td className="text-center text-xs">{index + 1}</td>
                                                    <td className="p-0">
                                                        <div className="flex items-center w-full">
                                                            <div className="flex-grow truncate font-mono text-xs py-2 px-2 hover:bg-base-200/50 transition-colors" title={msg.message}>
                                                                {msg.message}
                                                            </div>
                                                            <div className="flex-none w-8 h-full flex items-center justify-center border-l border-base-200">
                                                                <button 
                                                                    className="btn btn-xs btn-square btn-ghost"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        copyToClipboard(msg.message);
                                                                    }}
                                                                    title="复制报文"
                                                                >
                                                                    <Copy className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="flex justify-center items-center gap-1">
                                                            <button 
                                                                className="btn btn-ghost btn-xs btn-square"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleEditMessage(msg);
                                                                }}
                                                                title="编辑"
                                                            >
                                                                <Edit className="w-3 h-3" />
                                                            </button>
                                                            <button 
                                                                className="btn btn-ghost btn-xs btn-square text-error"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDeleteMessage(msg.id);
                                                                }}
                                                                title="删除"
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                            </button>
                                                            <button 
                                                                className="btn btn-ghost btn-xs btn-square text-success"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    parseMessage(msg.message);
                                                                }}
                                                                disabled={isLoading}
                                                                title="解析"
                                                            >
                                                                {isLoading ? (
                                                                    <span className="loading loading-spinner loading-xs"></span>
                                                                ) : <ArrowRight className="w-3 h-3" />}
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <form method="dialog" className="modal-backdrop">
                    <button onClick={closeMessageDialog}>关闭</button>
                </form>
            </dialog>

            {/* 添加/编辑报文对话框 - 使用ReactDOM.createPortal确保在最顶层 */}
            {isAddDialogOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]" 
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            closeAddDialog();
                        }
                    }}
                >
                    <div className="bg-base-100 rounded-lg shadow-xl w-11/12 max-w-xl p-6" 
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold">
                                {editingMessageId ? '编辑报文' : '添加新报文'}
                            </h2>
                            <button 
                                className="btn btn-sm btn-circle btn-ghost"
                                onClick={closeAddDialog}
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        
                        <div className="form-control">
                            <textarea
                                className="textarea textarea-bordered font-mono w-full mb-4"
                                value={currentMessage}
                                onChange={(e) => setCurrentMessage(e.target.value)}
                                placeholder="请输入报文内容..."
                                rows={4}
                                autoFocus
                            />
                            
                            <div className="flex justify-between gap-2">
                                <button 
                                    className="btn btn-outline"
                                    onClick={() => setCurrentMessage(formatMessageContent(currentMessage))}
                                >
                                    格式化
                                </button>
                                
                                <div className="flex gap-2">
                                    <button 
                                        className="btn"
                                        onClick={closeAddDialog}
                                    >
                                        取消
                                    </button>
                                    <button 
                                        className="btn btn-primary"
                                        onClick={editingMessageId ? handleUpdateMessage : handleAddMessage}
                                    >
                                        {editingMessageId ? '保存' : '添加'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FrameExtractor;