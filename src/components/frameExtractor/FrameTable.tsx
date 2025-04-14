// src/components/frameExtractor/FrameTable.tsx
import React, { useRef, useCallback, memo } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
    setActiveFilterPanel,
    setFilterSettings,
    toggleRowExpand,
    clearFilter,
    clearAllFilters,
    setShouldAlignRight,
    selectRows,
    setLastSelectedRow,
    clearSelectedRows,
    setSorting,
    setColumnFilters,
    setDialogOpen,
    FilterType
} from '../../store/slices/frameExtractorSlice';
import { MessageSquarePlus, FilterIcon, X, ChevronDown, ChevronRight, SortAsc, SortDesc, ArrowUpDown, PlusIcon } from 'lucide-react';
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
import { useVirtualizer, type VirtualItem } from '@tanstack/react-virtual';
import { ExtractedData, FilterValue, FILTER_TYPE_LABELS } from '../../store/slices/frameExtractorSlice';
import FilterBadge from './FilterBadge';
import clsx from 'clsx';
import FilterPanel from './FilterPanel';
import ContextMenu from './ContextMenu';
import { toast } from 'react-hot-toast';
import { FrameExtractorService } from '../../services/frameExtractorService';

// 表格行组件
const TableRow = memo(({ 
    row, 
    isSelected, 
    onSelect, 
    onDoubleClick, 
    isLoading,
    style 
}: { 
    row: ExtractedData;
    isSelected: boolean;
    onSelect: (uniqueId: string, event: React.MouseEvent) => void;
    onDoubleClick: (uniqueId: string, event: React.MouseEvent) => void;
    isLoading: boolean;
    style?: React.CSSProperties;
}) => {
    return (
        <div className="contents" style={style}>
            <tr
                className={`transition-colors cursor-pointer select-none
                    ${isSelected ? 'bg-primary/10 hover:bg-primary/20 border-l-4 border-l-primary'
                    : 'hover:bg-base-200'
                    }
                `}
                onClick={(e) => onSelect(row.uniqueId, e)}
                onDoubleClick={(e) => onDoubleClick(row.uniqueId, e)}
            >
                <td className="font-mono">{row.da}</td>
                <td className="font-mono">
                    <div className="flex items-center gap-2">
                        {row.children && row.children.length > 0 && (
                            <span className="text-base-content/70">
                                {row.isExpanded
                                    ? <ChevronDown className="w-4 h-4" />
                                    : <ChevronRight className="w-4 h-4" />
                                }
                            </span>
                        )}
                        {row.di}
                    </div>
                </td>
                <td className="font-mono">{row.content}</td>
                <td className="font-mono">{row.time || '-'}</td>
            </tr>

            {/* 展开的详情行 */}
            {row.isExpanded && row.children && row.children.map((child, childIndex) => (
                <tr
                    key={`${row.uniqueId}-${childIndex}`}
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
        </div>
    );
});

TableRow.displayName = 'TableRow';

// 修改 FilterPanel 的 position 类型定义
type FilterPanelPosition = {
    top: number;
    left: number | 'auto';
    right: number | 'auto';
};

const FrameTable: React.FC = () => {
    const dispatch = useAppDispatch();
    const {
        extractedData,
        isLoading,
        ui: {
            selectedRows,
            lastSelectedRow,
            activeFilterPanel,
            filterSettings,
            columnFilters,
            sorting,
            shouldAlignRight
        }
    } = useAppSelector(state => state.frameExtractor);

    // 过滤面板引用
    const filterButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

    const columnHelper = createColumnHelper<ExtractedData>();

    // 列定义
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
        const newSorting = typeof updaterOrValue === 'function'
            ? updaterOrValue(sorting)
            : updaterOrValue;

        dispatch(setSorting(newSorting));
    };

    // 表格实例
    const table = useReactTable({
        data: extractedData,
        columns,
        state: {
            sorting,
            columnFilters: columnFilters as ColumnFiltersState,
        },
        onSortingChange: handleSortingChange,
        onColumnFiltersChange: (filters) => {
            dispatch(setColumnFilters(filters as any));
        },
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        enableMultiSort: true,
    });

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
                const newSelected: string[] = [];

                // 只选择范围内的实际行，不包括子项行
                for (let i = minIndex; i <= maxIndex; i++) {
                    const rowId = visibleRows[i].original.uniqueId;
                    newSelected.push(rowId);
                }

                dispatch(selectRows(newSelected));
            }
        } else if (event.ctrlKey || event.metaKey) {
            // Ctrl/Cmd + 点击切换单个行的选中状态
            const currentSelection = new Set(selectedRows);
            if (currentSelection.has(uniqueId)) {
                currentSelection.delete(uniqueId);
            } else {
                currentSelection.add(uniqueId);
            }
            dispatch(selectRows(Array.from(currentSelection)));
        } else {
            // 普通点击，清除其他选中并选中当前行
            dispatch(selectRows([uniqueId]));
        }

        // 记录最后选中的行，用于后续的Shift选择
        dispatch(setLastSelectedRow(uniqueId));
    };

    // 处理双击展开
    const handleRowDoubleClick = (uniqueId: string, event: React.MouseEvent) => {
        // 阻止事件传播
        event.stopPropagation();
        // 双击展开/收起子项
        dispatch(toggleRowExpand(uniqueId));
        // 强制重新计算虚拟滚动
        setTimeout(() => {
            rowVirtualizer.measure();
        }, 0);
    };

    // 修改 filterPanelPosition 的类型定义
    const [filterPanelPosition, setFilterPanelPosition] = React.useState<FilterPanelPosition | null>(null);

    // 打开过滤面板
    const openFilterPanel = (columnId: string, buttonElement: HTMLElement) => {
        // 查找现有过滤器
        const existingFilter = columnFilters.find(f => f.id === columnId);

        // 计算面板位置
        const buttonRect = buttonElement.getBoundingClientRect();
                const windowWidth = window.innerWidth;
                const windowHeight = window.innerHeight;
        const panelWidth = 300;
                const panelHeight = 260; // 预估的面板高度

        // 计算水平位置
        let left: number | 'auto' = buttonRect.left;
        let right: number | 'auto' = 'auto';

        // 如果面板会超出右边界，则从右侧对齐
        if (buttonRect.left + panelWidth > windowWidth) {
            left = 'auto';
            right = windowWidth - buttonRect.right;
        }

        // 计算垂直位置
        let top = buttonRect.bottom + 4;

        // 如果面板会超出底部，则显示在按钮上方
        if (buttonRect.bottom + panelHeight + 4 > windowHeight) {
            top = Math.max(4, buttonRect.top - panelHeight - 4);
        }

        setFilterPanelPosition({
            top,
            left,
            right
        });

        // 设置过滤器设置
        dispatch(setFilterSettings({
            column: columnId,
            type: existingFilter ? (existingFilter.value as FilterValue).type : 'contains',
            value: existingFilter ? (existingFilter.value as FilterValue).value : ''
        }));

        // 设置活动面板
        dispatch(setActiveFilterPanel(columnId));
    };

    // 应用过滤器
    const handleApplyFilter = (type: FilterType, value: string) => {
        if (!filterSettings) return;

        const { column } = filterSettings;

        if (!value.trim()) {
            // 如果值为空，则删除此列的过滤器
            dispatch(clearFilter(column));
        } else {
            // 否则应用过滤器
            dispatch(setColumnFilters([
                ...columnFilters.filter(filter => filter.id !== column),
                {
                    id: column,
                    value: { type, value: value.trim() } as FilterValue
                }
            ]));
        }

        // 关闭过滤面板
        dispatch(setActiveFilterPanel(null));
        dispatch(setFilterSettings(null));
        setFilterPanelPosition(null);
    };

    // 关闭过滤面板
    const closeFilterPanel = () => {
        dispatch(setActiveFilterPanel(null));
        dispatch(setFilterSettings(null));
        setFilterPanelPosition(null);
    };

    // 计算每行的实际高度（包括可能的子行）
    const getRowHeight = useCallback((row: ExtractedData) => {
        const baseHeight = 44; // 基础行高
        const childHeight = 36; // 子行高度
        if (row.isExpanded && row.children) {
            return baseHeight + (row.children.length * childHeight);
        }
        return baseHeight;
    }, []);

    // 表格容器引用
    const tableContainerRef = useRef<HTMLDivElement>(null);

    // 创建虚拟滚动实例
    const rowVirtualizer = useVirtualizer({
        count: table.getRowModel().rows.length,
        getScrollElement: () => tableContainerRef.current,
        estimateSize: useCallback((index: number) => {
            const row = table.getRowModel().rows[index]?.original;
            if (!row) return 44;
            return row.isExpanded && row.children ? 
                44 + (row.children.length * 36) : 44;
        }, [table]),
        overscan: 5,
        paddingStart: 0,
        paddingEnd: 0,
        scrollPaddingStart: 0,
        scrollPaddingEnd: 0,
        getItemKey: useCallback((index: number) => {
            const row = table.getRowModel().rows[index]?.original;
            return row?.uniqueId || index;
        }, [table])
    });

    const paddingTop = rowVirtualizer.getVirtualItems().length > 0 ? rowVirtualizer.getVirtualItems()?.[0]?.start || 0 : 0;
    const paddingBottom = rowVirtualizer.getVirtualItems().length > 0
        ? rowVirtualizer.getTotalSize() - (rowVirtualizer.getVirtualItems()?.[rowVirtualizer.getVirtualItems().length - 1]?.end || 0)
        : 0;

    const [contextMenu, setContextMenu] = React.useState<{ x: number; y: number } | null>(null);

    // 处理右键菜单
    const handleContextMenu = (event: React.MouseEvent) => {
        event.preventDefault();
        setContextMenu({ x: event.clientX, y: event.clientY });
    };

    // 展开全部
    const handleExpandAll = () => {
        const collapsedIds = extractedData
            .filter(row => row.children && row.children.length > 0 && !row.isExpanded)
            .map(row => row.uniqueId);
        
        if (collapsedIds.length > 0) {
            collapsedIds.forEach(id => {
                dispatch(toggleRowExpand(id));
            });
            
            // 强制重新计算虚拟滚动
            setTimeout(() => {
                rowVirtualizer.measure();
            }, 0);
        }
        setContextMenu(null);
    };

    // 折叠全部
    const handleCollapseAll = () => {
        const expandedIds = extractedData
            .filter(row => row.isExpanded)
            .map(row => row.uniqueId);
        
        if (expandedIds.length > 0) {
            expandedIds.forEach(id => {
                dispatch(toggleRowExpand(id));
            });
            
            // 强制重新计算虚拟滚动
            setTimeout(() => {
                rowVirtualizer.measure();
            }, 0);
        }
        setContextMenu(null);
    };

    // 导出选中项
    const handleExportSelected = () => {
        const selectedData = extractedData.filter(row => selectedRows.includes(row.uniqueId));
        if (selectedData.length === 0) return;

        // 发送数据到 Worker 处理
        const worker = new Worker(new URL('../../workers/excelWorker.ts', import.meta.url), { type: 'module' });
        
        worker.onmessage = async (e) => {
            const { success, data, error } = e.data;

            if (success) {
                try {
                    await FrameExtractorService.exportToExcel(data);
                    toast.success("选中数据导出成功");
                } catch (error) {
                    console.error("保存Excel文件失败:", error);
                    toast.error(`保存Excel文件失败: ${error instanceof Error ? error.message : '未知错误'}`);
                }
            } else {
                console.error("导出Excel失败:", error);
                toast.error(`导出Excel失败: ${error}`);
            }

            worker.terminate();
        };

        worker.postMessage({
            rows: selectedData,
            includeChildren: true
        });

        setContextMenu(null);
    };

    return (
        <div 
            className="h-full w-full flex flex-col bg-base-100 rounded-lg shadow-sm border border-base-200"
            onContextMenu={handleContextMenu}
        >
            {/* 固定表头 */}
            <div className="flex-none sticky top-0 z-20 bg-base-200 border-b border-base-200 w-full">
                <div className="overflow-auto w-full">
                    <div className="grid w-full" style={{ gridTemplateColumns: '15% 20% minmax(45%, 1fr) 20%' }}>
                        {table.getHeaderGroups().map(headerGroup => (
                            headerGroup.headers.map(header => (
                                <div key={header.id} className="px-2 py-2 text-xs font-medium">
                                    <div className="flex items-center justify-between gap-1 select-none">
                                        <div
                                            className={clsx(
                                                "flex items-center gap-1 truncate",
                                                header.column.getCanSort() && "cursor-pointer hover:bg-base-300"
                                            )}
                                            onClick={header.column.getToggleSortingHandler()}
                                        >
                                            <span className="truncate">
                                                {flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
                                            </span>
                                            <span className="flex-shrink-0">
                                                {{
                                                    asc: <SortAsc className="w-3 h-3" />,
                                                    desc: <SortDesc className="w-3 h-3" />,
                                                }[header.column.getIsSorted() as string] ?? (
                                                    header.column.getCanSort() ? (
                                                        <ArrowUpDown className="w-3 h-3 opacity-30" />
                                                    ) : null
                                                )}
                                            </span>
                                        </div>

                                        {header.column.getCanFilter() && (
                                            <button
                                                ref={el => filterButtonRefs.current[header.column.id] = el}
                                                className={clsx(
                                                    "btn btn-ghost btn-xs btn-circle flex-shrink-0 w-5 h-5 min-h-0",
                                                    header.column.getIsFiltered() && "text-primary",
                                                    activeFilterPanel === header.column.id && "bg-base-300"
                                                )}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const buttonEl = filterButtonRefs.current[header.column.id];
                                                    if (buttonEl) {
                                                        openFilterPanel(header.column.id, buttonEl);
                                                    }
                                                }}
                                                title="过滤"
                                            >
                                                <FilterIcon className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        ))}
                    </div>
                </div>
            </div>

            {/* 表格内容区域 */}
            <div 
                ref={tableContainerRef}
                className="flex-1 overflow-auto w-full"
            >
                <div 
                    className="relative w-full"
                    style={{
                        height: `${rowVirtualizer.getTotalSize()}px`,
                        gridTemplateColumns: '15% 20% minmax(45%, 1fr) 20%'
                    }}
                >
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                        const row = table.getRowModel().rows[virtualRow.index].original;
                        const isSelected = selectedRows.includes(row.uniqueId);
                        const rowHeight = row.isExpanded && row.children ? 
                            44 + (row.children.length * 36) : 44;

                        return (
                            <div 
                                key={row.uniqueId} 
                                data-index={virtualRow.index}
                                className="absolute w-full"
                                style={{
                                    height: `${rowHeight}px`,
                                    transform: `translateY(${virtualRow.start}px)`,
                                }}
                            >
                                <div
                                    className={clsx(
                                        'grid w-full h-[44px]',
                                        isSelected ? 'bg-primary/10 hover:bg-primary/20 border-l-4 border-l-primary' : 'border-l-4 border-l-transparent hover:bg-base-200'
                                    )}
                                    style={{ gridTemplateColumns: '15% 20% minmax(45%, 1fr) 20%' }}
                                    onClick={(e) => handleRowSelect(row.uniqueId, e)}
                                    onDoubleClick={(e) => handleRowDoubleClick(row.uniqueId, e)}
                                >
                                    <div className="px-3 py-1.5 font-mono flex items-center select-none truncate">{row.da}</div>
                                    <div className="px-3 py-1.5 font-mono flex items-center select-none truncate">
                                        <div className="flex items-center gap-2 min-w-0 w-full">
                                            {row.children && row.children.length > 0 && (
                                                <span className="text-base-content/70 flex-shrink-0">
                                                    {row.isExpanded
                                                        ? <ChevronDown className="w-4 h-4" />
                                                        : <ChevronRight className="w-4 h-4" />
                                                    }
                                                </span>
                                            )}
                                            <span className="truncate">{row.di}</span>
                                        </div>
                                    </div>
                                    <div className="px-3 py-1.5 font-mono flex items-center select-none truncate">{row.content}</div>
                                    <div className="px-3 py-1.5 font-mono flex items-center select-none truncate">{row.time || '-'}</div>
                                </div>

                                {row.isExpanded && row.children && (
                                    <div className="border-t border-base-200/30">
                                        {row.children.map((child, childIndex) => (
                                            <div
                                                key={`${row.uniqueId}-${childIndex}`}
                                                className={clsx(
                                                    'grid w-full h-[36px]',
                                                    isSelected ? 'bg-primary/5 border-l-4 border-l-primary' : 'border-l-4 border-l-transparent bg-base-100/50'
                                                )}
                                                style={{ gridTemplateColumns: '15% 20% minmax(45%, 1fr) 20%' }}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <div className="px-3 py-1 flex items-center select-none truncate">
                                                    <div className="w-3 h-3 ml-4 border-l-2 border-b-2 border-base-300 rounded-bl-lg flex-shrink-0"></div>
                                                </div>
                                                <div className="px-3 py-1 pl-6 font-mono text-xs flex items-center select-none truncate">{child.frameDomain}</div>
                                                <div className="px-3 py-1 font-mono text-xs flex items-center select-none truncate">{child.data}</div>
                                                <div className="px-3 py-1 font-mono text-xs flex items-center select-none truncate">{child.description}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* 底部状态栏 */}
            <div className="flex-none border-t border-base-200 bg-base-200/50 px-3 py-2">
                <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-4">
                        <div>
                            显示 <span className="font-semibold">{table.getFilteredRowModel().rows.length}</span> 条结果
                        {selectedRows.length > 0 && <span>，已选择 <span className="font-semibold text-primary">{selectedRows.length}</span> 条</span>}
                        </div>
                        {columnFilters.length > 0 && (
                            <div className="flex items-center gap-2">
                                <span className="opacity-75">过滤条件：</span>
                                <div className="flex items-center flex-wrap gap-2">
                                    {columnFilters.map(filter => {
                                        const column = table.getColumn(filter.id);
                                        const columnName = column?.columnDef?.header as string;
                                        return (
                                            <FilterBadge
                                                key={filter.id}
                                                column={filter.id}
                                                columnName={columnName}
                                                filter={filter}
                                            />
                                        );
                                    })}
                                    <button
                                        className="btn btn-ghost btn-xs gap-1 hover:bg-base-300 h-6"
                                        onClick={() => dispatch(clearAllFilters())}
                                    >
                                        <X className="w-3 h-3" />
                                        清除全部
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="flex gap-2">
                        {selectedRows.length > 0 && (
                            <button
                                className="btn btn-sm btn-outline btn-error"
                                onClick={() => dispatch(clearSelectedRows())}
                            >
                                清除选择
                            </button>
                        )}
                    </div>
                </div>
                                                </div>

            {/* 过滤面板 */}
            {activeFilterPanel && filterSettings && filterPanelPosition && (
                <FilterPanel
                    isOpen={true}
                    position={filterPanelPosition}
                    initialType={filterSettings?.type || 'contains'}
                    initialValue={filterSettings?.value || ''}
                    onApply={handleApplyFilter}
                    onClose={closeFilterPanel}
                    onReset={() => {
                        if (filterSettings) {
                            dispatch(clearFilter(filterSettings.column));
                            closeFilterPanel();
                        }
                    }}
                />
            )}

            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onClose={() => setContextMenu(null)}
                    onExpandAll={handleExpandAll}
                    onCollapseAll={handleCollapseAll}
                    onExportSelected={handleExportSelected}
                    hasSelectedRows={selectedRows.length > 0}
                />
            )}
        </div>
    );
};

export default memo(FrameTable);