import React, { useState, useEffect, useMemo } from 'react';
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
    X
} from 'lucide-react';

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
    
    // 选中行状态
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
                        const contentItem = items.find(item => 
                            item.frameDomain.includes('数据内容')
                        );
                        const content = contentItem?.data || '';

                        let time = '';

                        console.log("timeitem", timeitem);
                        if (timeitem && timeitem.frameDomain.includes('数据时间')) {
                            time =  timeitem.data;
                        }
                        // 提取子项
                        const children: ExtractedData['children'] = [];
                        if (contentItem?.children) {
                            contentItem.children.forEach(child => {
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
                                frameDomain: contentItem?.frameDomain || "",
                                data: contentItem?.data || "",
                                description: contentItem?.description || ""
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

    const handleParse = async () => {
        if (!input.trim()) {
            toast.error("请输入要解析的报文");
            return;
        }

        setIsLoading(true);
        try {
            const messages = input.split('\n').filter(msg => msg.trim());
            const allExtractedData: ExtractedData[] = [];

            for (const message of messages) {
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
                    continue;
                }

                const extracted = extractData(result.data);
                allExtractedData.push(...extracted);
            }

            setExtractedData(allExtractedData);
            if (allExtractedData.length === 0) {
                toast.warning("没有成功解析出任何数据");
            } else {
                toast.success(`成功解析 ${allExtractedData.length} 条数据`);
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

    // 过滤面板组件
    const FilterPanel = () => {
        if (!activeFilterPanel || !filterSettings) return null;
        
        return (
            <div className="absolute z-50 top-8 right-0 bg-base-100 shadow-lg rounded-box p-4 border border-base-300 min-w-64">
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
                            value={filterSettings.type}
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
                            value={filterSettings.value}
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
        );
    };

    // 在组件卸载时或点击页面其他区域时关闭过滤面板
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            // 检查是否点击了过滤面板之外的区域
            const target = e.target as HTMLElement;
            if (!target.closest('.filter-panel-container') && !target.closest('.filter-button')) {
                closeFilterPanel();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    return (
        <div className="flex flex-col h-full p-4">
            {/* Input Section */}
            <div className="flex flex-col gap-4 mb-4">
                <div className="flex items-center justify-between">
                    <label className="text-sm text-base-content/70">
                        请输入要解析的报文（每行一条报文）：
                    </label>
                    <span className="text-sm text-base-content/70">
                        {input.split('\n').filter(msg => msg.trim()).length} 条报文
                    </span>
                </div>
                <textarea
                    className="textarea textarea-bordered font-mono"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="请输入要解析的报文，每行一条..."
                    rows={6}
                />
                <button
                    className="btn btn-primary"
                    onClick={handleParse}
                    disabled={isLoading}
                >
                    {isLoading ? '解析中...' : '解析'}
                </button>
            </div>

            {/* Table Section - 使用flex-1让表格填充剩余空间 */}
            <div className="flex-1 flex flex-col min-h-0">
                <div className="relative h-full overflow-auto border border-base-300 rounded-lg">
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
                                                            >
                                                                <FilterIcon 
                                                                    className={`
                                                                        w-4 h-4 
                                                                        ${column.getIsFiltered() ? 'text-primary' : 'text-base-content/50'}
                                                                    `} 
                                                                />
                                                            </button>
                                                            
                                                            {activeFilterPanel === column.id && (
                                                                <FilterPanel />
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
                                                        ? 'bg-info/20 hover:bg-info/30 border-l-4 border-info' 
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
                                                    className="bg-base-100/50 select-none"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <td></td>
                                                    <td className="pl-8 font-mono">{child.frameDomain}</td>
                                                    <td className="font-mono">{child.data}</td>
                                                    <td className="font-mono">{child.description}</td>
                                                </tr>
                                            ))}
                                        </React.Fragment>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={4} className="text-center py-8 text-base-content/70">
                                        {isLoading 
                                            ? '加载中...' 
                                            : extractedData.length > 0 
                                                ? '没有符合过滤条件的数据'
                                                : '没有数据'
                                        }
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                
                {/* Results Summary */}
                {extractedData.length > 0 && (
                    <div className="mt-3 text-sm text-base-content/70">
                        显示 {table.getFilteredRowModel().rows.length} 条结果，共 {extractedData.length} 条
                        {selectedRows.size > 0 && `, 已选择 ${selectedRows.size} 条`}
                    </div>
                )}
            </div>
        </div>
    );
};

export default FrameExtractor;