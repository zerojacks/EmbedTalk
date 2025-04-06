import React, { useState, ChangeEvent, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'react-hot-toast';
import { FiCopy, FiCheck } from 'react-icons/fi';
import { DataItem } from '../../stores/useItemConfigStore';
import { FixedSizeList } from 'react-window';
import { TreeTable, Column } from "../../components/treeview";
import { TreeItemType } from '../../components/TreeItem';

const initialColumns: Column[] = [
    { name: '帧域', width: 30, minWidth: 100 },
    { name: '数据', width: 30, minWidth: 50 },
    { name: '说明', width: 40, minWidth: 50 },
];

const SearchList: React.FC<{
    index: number;
    style: React.CSSProperties;
    data: DataItem[];
    selectItem: (item: DataItem) => void;
}> = ({ index, style, data, selectItem }) => {
    const item = data[index];
    return (
        <div
            style={style}
            className="flex items-center w-full h-full px-2 hover:bg-base-300 cursor-pointer"
            onClick={() => selectItem(item)}
        >
            <span className="mr-2 flex-shrink-0">{item.item}</span>
            {item.name && <span className="mr-2 min-w-10 max-w-60 flex-shrink truncate">{item.name}</span>}
            {item.protocol && (
                <div className="badge badge-success m-2 flex-shrink-0 truncate">
                    {item.protocol}
                </div>
            )}
            {item.region && (
                <div className="badge badge-info flex-shrink-0 truncate">
                    {item.region}
                </div>
            )}
        </div>
    );
};

export const DataItemParserTool: React.FC = () => {
    const [itemId, setItemId] = useState<DataItem | null>(null);
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(false);
    const [parsedData, setParsedData] = useState<TreeItemType[] | null>(null);
    const [copied, setCopied] = useState(false);
    const [itemList, setItemList] = useState<DataItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [filteredData, setFilteredData] = useState<DataItem[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);
    const isSelecting = useRef(false);

    // 加载数据项列表
    useEffect(() => {
        const loadItemList = async () => {
            try {
                const items = await invoke<DataItem[]>('get_all_config_item_lists');
                setItemList(items);
            } catch (err) {
                toast.error('加载数据项列表失败');
            }
        };
        loadItemList();
    }, []);

    const asyncSearch = async (term: string): Promise<DataItem[]> => {
        return new Promise((resolve) => {
            setTimeout(() => {
                const isAllCharacters = /^[a-zA-Z0-9]+$/.test(term);
                const containsChinese = /[\u4e00-\u9fa5]/.test(term);

                const results = itemList.filter(item => {
                    if (isAllCharacters) {
                        const regex = new RegExp(`^${term}`, 'i');
                        return regex.test(item.item);
                    } else if (containsChinese) {
                        return item.name && item.name.toLowerCase().includes(term.toLowerCase());
                    } else {
                        return (
                            item.item.toLowerCase().includes(term.toLowerCase()) ||
                            (item.name && item.name.toLowerCase().includes(term.toLowerCase()))
                        );
                    }
                });

                resolve(results);
            }, 300);
        });
    };

    useEffect(() => {
        if (isSelecting.current) {
            isSelecting.current = false;
            return;
        }

        let debounceTimeout: NodeJS.Timeout;
        const performSearch = async () => {
            if (searchTerm.trim() === '') {
                setFilteredData([]);
                setShowDropdown(false);
                return;
            }

            setIsLoading(true);
            try {
                const results = await asyncSearch(searchTerm);
                setFilteredData(results);
                setShowDropdown(true);
            } catch (error) {
                console.error('Search error:', error);
                setFilteredData([]);
            } finally {
                setIsLoading(false);
            }
        };

        debounceTimeout = setTimeout(performSearch, 300);

        return () => {
            clearTimeout(debounceTimeout);
        };
    }, [searchTerm, itemList]);

    const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if(e.target.value !== searchTerm) {
            setSearchTerm(e.target.value);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            if (inputRef.current) {
                const currentValue = inputRef.current.value;
                const curitem = {} as DataItem;
                curitem.item = currentValue;
                selectItem(curitem);
            }
        }
    };

    const handleInputFocus = async () => {
        if (inputRef.current) {
            const currentValue = inputRef.current.value;
            if (currentValue.trim() !== '') {
                setIsLoading(true);
                try {
                    const results = await asyncSearch(currentValue);
                    setFilteredData(results);
                    setShowDropdown(true);
                } catch (error) {
                    setFilteredData([]);
                } finally {
                    setIsLoading(false);
                }
            }
        }
    };

    const selectItem = useCallback((item: DataItem) => {
        isSelecting.current = true;
        setShowDropdown(false);
        setSearchTerm(item.item);
        setItemId(item);
    }, []);

    const handleParse = async () => {
        if (!itemId) {
            toast.error('请选择数据标识');
            return;
        }
        if (!content.trim()) {
            toast.error('请输入需要解析的数据');
            return;
        }

        setLoading(true);
        setParsedData(null);

        try {
            const result = await invoke<TreeItemType[]>('parse_item_data', {
                item: itemId.item,
                input: content.trim(),
                protocol: itemId.protocol || "CSG13",
                region: itemId.region || "南网"
            });
            console.log("result", result);
            setParsedData(result);
        } catch (err) {
            toast.error((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = async (text: string) => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success('已复制到剪贴板');
        setTimeout(() => setCopied(false), 2000);
    };

    const handleRowClick = (item: TreeItemType) => {
        // 可以在这里处理行点击事件
        console.log('Row clicked:', item);
    };

    return (
        <div className="flex flex-col gap-6 p-6">
            {/* 输入区域 */}
            <div className="flex flex-col gap-4">
                <div className="relative">
                    <label className="input input-bordered flex items-center gap-2 w-full">
                        {itemId ? (
                            <div className="flex items-center flex-1 gap-2 overflow-hidden">
                                <span className="flex-shrink-0">{itemId.item}</span>
                                {itemId.name && (
                                    <span className="text-gray-500 truncate">({itemId.name})</span>
                                )}
                                {itemId.protocol && (
                                    <div className="badge badge-success badge-sm">
                                        {itemId.protocol}
                                    </div>
                                )}
                                {itemId.region && (
                                    <div className="badge badge-info badge-sm">
                                        {itemId.region}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <input
                                ref={inputRef}
                                type="text"
                                className="grow"
                                placeholder="搜索数据标识"
                                value={searchTerm}
                                onChange={handleTextChange}
                                onKeyDown={handleKeyDown}
                                onFocus={handleInputFocus}
                            />
                        )}
                        {itemId ? (
                            <button 
                                className="btn btn-ghost btn-xs"
                                onClick={() => {
                                    setItemId(null);
                                    setSearchTerm('');
                                    if (inputRef.current) {
                                        inputRef.current.focus();
                                    }
                                }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </button>
                        ) : isLoading ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-500 border-t-transparent" />
                        ) : (
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 16 16"
                                fill="currentColor"
                                className="h-4 w-4 opacity-70"
                            >
                                <path
                                    fillRule="evenodd"
                                    d="M9.965 11.026a5 5 0 1 1 1.06-1.06l2.755 2.754a.75.75 0 1 1-1.06 1.06l-2.755-2.754ZM10.5 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z"
                                    clipRule="evenodd"
                                />
                            </svg>
                        )}
                    </label>
                    {showDropdown && filteredData.length > 0 && (
                        <div
                            className="absolute z-10 w-full mt-1 bg-base-200 border select-primary rounded-md shadow-lg textarea-bordered"
                            onMouseLeave={() => setShowDropdown(false)}
                        >
                            <FixedSizeList
                                height={Math.min(200, filteredData.length * 30)}
                                itemCount={filteredData.length}
                                itemSize={30}
                                width="100%"
                                itemData={filteredData}
                            >
                                {(props) => <SearchList {...props} selectItem={selectItem} />}
                            </FixedSizeList>
                        </div>
                    )}
                </div>
                <div>
                    <textarea
                        value={content}
                        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setContent(e.target.value)}
                        placeholder="请输入需要解析的数据内容"
                        className="w-full h-32 p-4 bg-card rounded-xl font-mono text-sm resize-none
                            border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary
                            placeholder:text-muted-foreground"
                    />
                </div>

                {/* 解析按钮 */}
                <button 
                    onClick={handleParse}
                    disabled={loading}
                    className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium
                        disabled:opacity-50 disabled:cursor-not-allowed transition-all
                        hover:bg-primary/90 active:bg-primary/80"
                >
                    {loading ? '解析中...' : '解析'}
                </button>
            </div>

            {/* 解析结果 */}
            {parsedData && (
                <div className="rounded-xl bg-card overflow-hidden border border-border/50">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-card-header">
                        <span className="text-sm text-muted-foreground">
                            {itemId ? `${itemId.item} 解析结果` : '解析结果'}
                        </span>
                        <button 
                            onClick={() => copyToClipboard(JSON.stringify(parsedData, null, 2))}
                            className="btn btn-ghost btn-sm tooltip tooltip-left"
                            title="复制结果"
                        >
                            {copied ? (
                                <FiCheck className="text-success w-4 h-4" />
                            ) : (
                                <FiCopy className="w-4 h-4" />
                            )}
                        </button>
                    </div>
                    <div className="p-4">
                        <TreeTable
                            data={parsedData}
                            tableheads={initialColumns}
                            onRowClick={handleRowClick}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}; 