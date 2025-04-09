import React, { useState } from 'react';
import { TreeItemType } from './TreeItem';
import { invoke } from "@tauri-apps/api/core";
import { toast } from "../context/ToastProvider";
import { 
    ChevronRight, 
    ChevronDown, 
    ArrowUp, 
    ArrowDown,
    ArrowUpDown,
    FilterIcon
} from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

interface ExtractedData {
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
}

const FrameExtractor: React.FC = () => {
    const [input, setInput] = useState('');
    const [extractedData, setExtractedData] = useState<ExtractedData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [sortConfig, setSortConfig] = useState<{
        sortColumns: Array<{
            key: 'da' | 'di' | 'time';
            direction: 'asc' | 'desc';
        }>;
    }>({
        sortColumns: []
    });
    const [filterConfig, setFilterConfig] = useState<{
        [key in 'da' | 'di' | 'time']?: {
            type: 'contains' | 'startsWith' | 'endsWith' | 'equals';
            value: string;
        }
    }>({});

    const extractData = (items: TreeItemType[]): ExtractedData[] => {
        const result: ExtractedData[] = [];
        console.log('原始解析数据:', JSON.stringify(items));

        // 递归遍历函数
        const traverseItems = (items: TreeItemType[]) => {
            for (let i = 0; i < items.length; i++) {
                const currentItem = items[i];
                const nextItem = items[i + 1];

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

                        // 查找数据时间
                        const timeItem = items.find(item => 
                            item.frameDomain.includes('数据时间')
                        );
                        const time = timeItem?.data || '';

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

    const handleParse = async () => {
        if (!input.trim()) {
            toast.error("请输入要解析的报文");
            return;
        }

        setIsLoading(true);
        try {
            // 分割多条报文
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

    // 排序处理函数
    const handleSort = (key: 'da' | 'di' | 'time', direction: 'asc' | 'desc' | '') => {
        setSortConfig(prev => {
            // 创建新的排序列数组
            const newSortColumns = [...prev.sortColumns];

            // 查找当前列的排序配置
            const existingColumnIndex = newSortColumns.findIndex(col => col.key === key);

            if (direction === '') {
                // 如果选择了不排序，移除该列
                if (existingColumnIndex !== -1) {
                    newSortColumns.splice(existingColumnIndex, 1);
                }
            } else {
                if (existingColumnIndex !== -1) {
                    // 如果列已存在，更新其排序方向
                    newSortColumns[existingColumnIndex] = { key, direction };
                } else {
                    // 如果列不存在，添加新的排序列
                    newSortColumns.push({ key, direction });
                }
            }

            return {
                sortColumns: newSortColumns
            };
        });
    };

    // 获取排序后的数据
    const getSortedData = () => {
        if (sortConfig.sortColumns.length === 0) return extractedData;

        return [...extractedData].sort((a, b) => {
            for (const sortColumn of sortConfig.sortColumns) {
                let result = 0;
                switch (sortColumn.key) {
                    case 'da':
                        const daA = parseInt(a.da) || 0;
                        const daB = parseInt(b.da) || 0;
                        result = daA - daB;
                        break;
                    case 'di':
                        result = a.di.localeCompare(b.di);
                        break;
                    case 'time':
                        const timeA = a.time || '';
                        const timeB = b.time || '';
                        result = timeA.localeCompare(timeB);
                        break;
                }

                // 应用排序方向
                result = sortColumn.direction === 'asc' ? result : -result;

                // 如果结果不为0，立即返回
                if (result !== 0) return result;
            }

            return 0;
        });
    };

    // 过滤处理函数
    const handleFilter = (
        key: 'da' | 'di' | 'time', 
        type: 'contains' | 'startsWith' | 'endsWith' | 'equals', 
        value: string
    ) => {
        setFilterConfig(prev => {
            const newFilterConfig = { ...prev };
            
            // 如果值为空，移除该列的过滤
            if (!value.trim()) {
                delete newFilterConfig[key];
            } else {
                newFilterConfig[key] = { type, value };
            }
            
            return newFilterConfig;
        });
    };

    // 获取过滤后的数据
    const getFilteredData = () => {
        let filteredData = getSortedData();

        Object.entries(filterConfig).forEach(([key, filter]) => {
            if (!filter) return;

            filteredData = filteredData.filter(item => {
                const value = item[key as keyof ExtractedData] as string;
                
                switch (filter.type) {
                    case 'contains':
                        return value.includes(filter.value);
                    case 'startsWith':
                        return value.startsWith(filter.value);
                    case 'endsWith':
                        return value.endsWith(filter.value);
                    case 'equals':
                        return value === filter.value;
                    default:
                        return true;
                }
            });
        });

        return filteredData;
    };

    // 渲染表头排序图标
    const renderSortIcon = (key: 'da' | 'di' | 'time') => {
        if (!sortConfig) return null;

        const columnSorts = sortConfig.sortColumns.filter(col => col.key === key);
        
        if (columnSorts.length === 0) return null;

        // 显示最后一个排序列的图标
        const lastSort = columnSorts[columnSorts.length - 1];
        
        // 显示排序优先级
        const sortPriority = sortConfig.sortColumns.findIndex(col => col.key === key);
        
        return (
            <div className="flex items-center">
                {sortPriority > 0 && (
                    <span className="mr-1 text-xs text-base-content/50 bg-base-300 rounded-full w-4 h-4 flex items-center justify-center">
                        {sortPriority + 1}
                    </span>
                )}
                <span className="text-base-content/70">
                    {lastSort.direction === 'asc' 
                        ? <ArrowUp className="w-3 h-3" /> 
                        : <ArrowDown className="w-3 h-3" />
                    }
                </span>
            </div>
        );
    };

    // 渲染过滤下拉菜单
    const renderFilterMenu = (
        key: 'da' | 'di' | 'time', 
        label: string
    ) => {
        const currentFilter = filterConfig[key];

        return (
            <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                    <button 
                        className={`
                            btn btn-ghost btn-xs btn-circle 
                            ${currentFilter ? 'text-primary' : ''}
                        `}
                    >
                        <FilterIcon className="w-4 h-4" />
                    </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                    <DropdownMenu.Content 
                        className="
                            z-50 
                            bg-base-100 
                            rounded-box 
                            p-2 
                            shadow-lg 
                            w-64 
                            border 
                            border-base-300
                        "
                        sideOffset={5}
                        align="end"
                    >
                        <div className="card-body">
                            <h3 className="card-title text-sm">过滤 {label}</h3>
                            <select 
                                className="select select-bordered select-xs w-full"
                                value={currentFilter?.type || 'contains'}
                                onChange={(e) => {
                                    const type = e.target.value as 'contains' | 'startsWith' | 'endsWith' | 'equals';
                                    handleFilter(
                                        key, 
                                        type, 
                                        currentFilter?.value || ''
                                    );
                                }}
                            >
                                <option value="contains">包含</option>
                                <option value="startsWith">开头是</option>
                                <option value="endsWith">结尾是</option>
                                <option value="equals">等于</option>
                            </select>
                            <input 
                                type="text" 
                                placeholder={`输入${label}过滤值`}
                                className="input input-bordered input-xs w-full"
                                value={currentFilter?.value || ''}
                                onChange={(e) => {
                                    handleFilter(
                                        key, 
                                        currentFilter?.type || 'contains', 
                                        e.target.value
                                    );
                                }}
                            />
                            {currentFilter && (
                                <button 
                                    className="btn btn-xs btn-ghost"
                                    onClick={() => handleFilter(key, 'contains', '')}
                                >
                                    清除过滤
                                </button>
                            )}
                        </div>
                    </DropdownMenu.Content>
                </DropdownMenu.Portal>
            </DropdownMenu.Root>
        );
    };

    // 渲染排序下拉菜单
    const renderSortMenu = (
        key: 'da' | 'di' | 'time', 
        label: string
    ) => {
        const currentSort = sortConfig.sortColumns.find(col => col.key === key);

        return (
            <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                    <button 
                        className={`
                            btn btn-ghost btn-xs btn-circle 
                            ${currentSort ? 'text-primary' : ''}
                        `}
                    >
                        {currentSort ? (
                            currentSort.direction === 'asc' ? (
                                <ArrowUp className="w-4 h-4" />
                            ) : (
                                <ArrowDown className="w-4 h-4" />
                            )
                        ) : (
                            <ArrowUpDown className="w-4 h-4" />
                        )}
                    </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                    <DropdownMenu.Content 
                        className="
                            z-50 
                            bg-base-100 
                            rounded-box 
                            p-2 
                            shadow-lg 
                            w-32 
                            border 
                            border-base-300
                        "
                        sideOffset={5}
                        align="end"
                    >
                        <DropdownMenu.Item 
                            className={`
                                px-2 py-1 
                                rounded 
                                cursor-pointer 
                                hover:bg-base-200 
                                flex items-center gap-2
                                ${currentSort?.direction === 'asc' ? 'bg-base-200' : ''}
                            `}
                            onSelect={() => handleSort(key, 'asc')}
                        >
                            <ArrowUp className="w-4 h-4" />
                            升序
                        </DropdownMenu.Item>
                        <DropdownMenu.Item 
                            className={`
                                px-2 py-1 
                                rounded 
                                cursor-pointer 
                                hover:bg-base-200 
                                flex items-center gap-2
                                ${currentSort?.direction === 'desc' ? 'bg-base-200' : ''}
                            `}
                            onSelect={() => handleSort(key, 'desc')}
                        >
                            <ArrowDown className="w-4 h-4" />
                            降序
                        </DropdownMenu.Item>
                        <DropdownMenu.Item 
                            className={`
                                px-2 py-1 
                                rounded 
                                cursor-pointer 
                                hover:bg-base-200 
                                flex items-center gap-2
                                ${!currentSort ? 'bg-base-200' : ''}
                            `}
                            onSelect={() => handleSort(key, '')}
                        >
                            <ArrowUpDown className="w-4 h-4" />
                            不排序
                        </DropdownMenu.Item>
                    </DropdownMenu.Content>
                </DropdownMenu.Portal>
            </DropdownMenu.Root>
        );
    };

    // 渲染表头单元格
    const renderFilterableHeader = (
        key: 'da' | 'di' | 'time', 
        label: string, 
        className?: string
    ) => {
        const currentSort = sortConfig.sortColumns.find(col => col.key === key);
        const currentFilter = filterConfig[key];

        return (
            <th 
                className={`
                    bg-base-200 
                    relative 
                    ${className || ''} 
                    ${(currentSort || currentFilter) ? 'bg-base-300' : ''}
                    transition-colors
                `}
            >
                <div className="flex items-center justify-between">
                    <span>{label}</span>
                    <div className="flex items-center gap-1">
                        {renderSortMenu(key, label)}
                        {renderFilterMenu(key, label)}
                    </div>
                </div>
                {(currentSort || currentFilter) && (
                    <div 
                        className="absolute bottom-0 left-0 right-0 h-1 bg-primary transition-colors"
                    />
                )}
            </th>
        );
    };

    const renderTableRows = () => {
        const filteredData = getFilteredData();
        console.log('当前extractedData:', filteredData);
        return filteredData.map((item, index) => {
            console.log(`渲染第${index}项:`, item);
            return (
                <React.Fragment key={item.uniqueId}>
                    <tr 
                        className="hover:bg-base-200 transition-colors" 
                        onClick={() => toggleExpand(item.uniqueId)}
                    >
                        <td className="font-mono">{item.da}</td>
                        <td>
                            <div className="flex items-center gap-2">
                                {item.children && item.children.length > 0 && (
                                    <span className="text-base-content/70">
                                        {item.isExpanded 
                                            ? <ChevronDown className="w-4 h-4" /> 
                                            : <ChevronRight className="w-4 h-4" />
                                        }
                                    </span>
                                )}
                                <span className="font-mono">{item.di}</span>
                            </div>
                        </td>
                        <td className="font-mono">{item.content}</td>
                        <td className="font-mono">{item.time || '-'}</td>
                    </tr>
                    {item.isExpanded && item.children && item.children.map((child, childIndex) => (
                        <tr 
                            key={`${item.uniqueId}-${childIndex}`} 
                            className="bg-base-100"
                        >
                            <td></td>
                            <td className="pl-8 font-mono">{child.frameDomain}</td>
                            <td className="font-mono">{child.data}</td>
                            <td className="font-mono">{child.description}</td>
                        </tr>
                    ))}
                </React.Fragment>
            );
        });
    };

    return (
        <div className="flex flex-col h-full p-4">
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
                    className="textarea textarea-bordered flex-grow font-mono"
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

            <div className="overflow-x-auto border border-base-300 rounded-lg">
                <table className="table table-zebra w-full table-pin-rows">
                    <thead className="sticky top-0 z-10 bg-base-200">
                        <tr>
                            {renderFilterableHeader('da', '信息点标识(DA)')}
                            {renderFilterableHeader('di', '数据标识编码(DI)', 'w-1/4')}
                            <th className="bg-base-200 w-1/4">内容</th>
                            {renderFilterableHeader('time', '时间', 'w-1/4')}
                        </tr>
                    </thead>
                    <tbody className="max-h-[500px] overflow-y-auto">
                        {renderTableRows()}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default FrameExtractor;