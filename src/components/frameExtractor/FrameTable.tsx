// src/components/frameExtractor/FrameTable.tsx
import React, { useRef } from 'react';
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
    setDialogOpen
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
import { ExtractedData, FilterValue, FILTER_TYPE_LABELS } from '../../store/slices/frameExtractorSlice';
import FilterBadge from './FilterBadge';
import clsx from 'clsx';

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
    };

    // 打开过滤面板
    const openFilterPanel = (columnId: string) => {
        // 查找现有过滤器
        const existingFilter = columnFilters.find(f => f.id === columnId);

        // 设置过滤面板状态
        dispatch(setActiveFilterPanel(columnId));

        // 设置过滤器设置，用于UI展示
        dispatch(setFilterSettings({
            column: columnId,
            type: existingFilter
                ? (existingFilter.value as FilterValue).type
                : 'contains',
            value: existingFilter
                ? (existingFilter.value as FilterValue).value
                : ''
        }));

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
                dispatch(setShouldAlignRight({
                    columnId,
                    value: shouldAlign
                }));

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

    // 更新过滤设置
    const updateFilterSetting = (update: Partial<typeof filterSettings>) => {
        if (!filterSettings) return;
        dispatch(setFilterSettings({
            ...filterSettings,
            ...update
        }));
    };

    // 应用过滤器
    const applyFilter = () => {
        if (!filterSettings) return;

        const { column, type, value } = filterSettings;

        if (!value.trim()) {
            // 如果值为空，则删除此列的过滤器
            dispatch(clearFilter(column));
        } else {
            // 否则应用过滤器
            dispatch(setColumnFilters([
                ...columnFilters.filter(filter => filter.id !== column),
                {
                    id: column,
                    value: { type, value },
                }
            ]));
        }

        // 关闭过滤面板
        dispatch(setActiveFilterPanel(null));
        dispatch(setFilterSettings(null));
    };

    // 关闭过滤面板
    const closeFilterPanel = () => {
        dispatch(setActiveFilterPanel(null));
        dispatch(setFilterSettings(null));
    };

    // 重置当前列的过滤条件，但不关闭面板
    const resetFilterSetting = () => {
        if (!filterSettings) return;

        // 重置过滤设置为默认值
        dispatch(setFilterSettings({
            ...filterSettings,
            type: 'contains',
            value: ''
        }));
    };

    // 在 return 语句前添加 FilterPopover 组件
    const FilterPopover = ({ column, header }: { column: string; header: string }) => {
        if (!filterSettings || filterSettings.column !== column) return null;

        return (
            <div className="absolute left-0 right-0 top-full mt-1 z-[1000] bg-base-100 shadow-xl rounded-lg border border-base-300 p-3">
                <div className="space-y-3">
                    <div className="form-control w-full">
                        <label className="label">
                            <span className="label-text">过滤方式</span>
                        </label>
                        <select
                            className="select select-bordered select-sm w-full"
                            value={filterSettings.type}
                            onChange={(e) => updateFilterSetting({
                                type: e.target.value as any
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

                    <div className="flex justify-between items-center gap-2">
                        <button
                            className="btn btn-ghost btn-xs"
                            onClick={resetFilterSetting}
                        >
                            重置
                        </button>
                        <div className="flex gap-2">
                            <button
                                className="btn btn-ghost btn-xs"
                                onClick={closeFilterPanel}
                            >
                                取消
                            </button>
                            <button
                                className="btn btn-primary btn-xs"
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

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-base-100 rounded-lg shadow-sm border border-base-200 overflow-hidden">
            {/* 表格工具栏 */}
            <div className="flex justify-between items-center p-3 bg-base-200/50 border-b border-base-200">
                <div className="flex items-center gap-4">
                    <div className="text-sm">
                        显示 <span className="font-semibold">{table.getFilteredRowModel().rows.length}</span> 条结果
                        {selectedRows.length > 0 && <span>，已选择 <span className="font-semibold text-primary">{selectedRows.length}</span> 条</span>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {columnFilters.map(filter => (
                            <FilterBadge
                                key={filter.id}
                                column={filter.id}
                                filter={filter}
                            />
                        ))}
                        {columnFilters.length > 0 && (
                            <button
                                className="btn btn-ghost btn-xs gap-1"
                                onClick={() => dispatch(clearAllFilters())}
                            >
                                <X className="w-3 h-3" />
                                清除全部
                            </button>
                        )}
                    </div>
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

            <div className="relative flex-1 overflow-auto">
                <div className="overflow-x-auto">
                    <table className="table table-zebra w-full">
                        <colgroup>
                            <col style={{ width: '20%' }} />
                            <col style={{ width: '20%' }} />
                            <col style={{ width: '40%' }} />
                            <col style={{ width: '20%' }} />
                        </colgroup>
                        <thead className="sticky top-0 z-20 bg-base-200">
                            <tr>
                                {table.getHeaderGroups().map(headerGroup => (
                                    headerGroup.headers.map(header => (
                                        <th key={header.id} className="relative bg-base-200">
                                            <div className="flex items-center justify-between gap-2 select-none">
                                                <div
                                                    className={clsx(
                                                        "flex items-center gap-1",
                                                        header.column.getCanSort() && "cursor-pointer hover:bg-base-300"
                                                    )}
                                                    onClick={header.column.getToggleSortingHandler()}
                                                >
                                                    {flexRender(
                                                        header.column.columnDef.header,
                                                        header.getContext()
                                                    )}
                                                    {{
                                                        asc: <SortAsc className="w-4 h-4" />,
                                                        desc: <SortDesc className="w-4 h-4" />,
                                                    }[header.column.getIsSorted() as string] ?? (
                                                        header.column.getCanSort() ? (
                                                            <ArrowUpDown className="w-4 h-4 opacity-30" />
                                                        ) : null
                                                    )}
                                                </div>

                                                {header.column.getCanFilter() && (
                                                    <button
                                                        className={clsx(
                                                            "btn btn-ghost btn-xs btn-circle",
                                                            header.column.getIsFiltered() && "text-primary",
                                                            activeFilterPanel === header.column.id && "bg-base-300"
                                                        )}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            openFilterPanel(header.column.id);
                                                        }}
                                                        title="过滤"
                                                    >
                                                        <FilterIcon className="w-3 h-3" />
                                                    </button>
                                                )}
                                            </div>

                                            {header.column.getCanFilter() && (
                                                <FilterPopover
                                                    column={header.column.id}
                                                    header={header.column.columnDef.header as string}
                                                />
                                            )}
                                        </th>
                                    ))
                                ))}
                            </tr>
                        </thead>

                        <tbody>
                            {table.getRowModel().rows.length ? (
                                table.getRowModel().rows.map(row => {
                                    const item = row.original;
                                    const isSelected = selectedRows.includes(item.uniqueId);

                                    return (
                                        <React.Fragment key={item.uniqueId}>
                                            <tr
                                                className={`transition-colors cursor-pointer select-none
                                                        ${isSelected ? 'bg-primary/10 hover:bg-primary/20 border-l-4 border-primary'
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

                                            {/* 展开的详情行 */}
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
                                                    onClick={() => dispatch(clearAllFilters())}
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
                                                    onClick={() => dispatch(setDialogOpen(true))}
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

            {/* 点击其他区域关闭过滤面板的遮罩层 */}
            {activeFilterPanel && (
                <div 
                    className="fixed inset-0 z-[900]" 
                    onClick={closeFilterPanel}
                />
            )}
        </div>
    );
};

export default FrameTable;