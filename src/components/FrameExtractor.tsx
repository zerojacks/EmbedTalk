import React, { useState } from 'react';
import { TreeItemType } from './TreeItem';
import { invoke } from "@tauri-apps/api/core";
import { toast } from "../context/ToastProvider";

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
}

const FrameExtractor: React.FC = () => {
    const [input, setInput] = useState('');
    const [extractedData, setExtractedData] = useState<ExtractedData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [sortConfig, setSortConfig] = useState<{
        key: 'da' | 'time';
        direction: 'asc' | 'desc';
    } | null>(null);

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
                                }
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
                                isExpanded: false
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

    const toggleExpand = (index: number) => {
        setExtractedData(prev => {
            const newData = [...prev];
            newData[index] = {
                ...newData[index],
                isExpanded: !newData[index].isExpanded
            };
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
            const formattedValue = input
                .replace(/\s+/g, '')
                .replace(/(.{2})/g, '$1 ')
                .trim()
                .toUpperCase();

            const result = await invoke<{ data: TreeItemType[]; error?: string }>('on_text_change', {
                message: formattedValue,
                region: "南网" // 默认使用南网
            });

            if (result.error) {
                toast.error("解析失败！");
                console.error("错误信息：", result.error);
            } else {
                const extracted = extractData(result.data);
                setExtractedData(extracted);
            }
        } catch (error) {
            console.error("解析失败:", error);
            toast.error("解析失败！");
        } finally {
            setIsLoading(false);
        }
    };

    // 排序处理函数
    const handleSort = (key: 'da' | 'time') => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    // 获取排序后的数据
    const getSortedData = () => {
        if (!sortConfig) return extractedData;

        return [...extractedData].sort((a, b) => {
            if (sortConfig.key === 'da') {
                // 将DA转换为数字进行比较
                const daA = parseInt(a.da) || 0;
                const daB = parseInt(b.da) || 0;
                return sortConfig.direction === 'asc' ? daA - daB : daB - daA;
            } else {
                // 时间排序
                const timeA = a.time || '';
                const timeB = b.time || '';
                return sortConfig.direction === 'asc' 
                    ? timeA.localeCompare(timeB)
                    : timeB.localeCompare(timeA);
            }
        });
    };

    const renderTableRows = () => {
        const sortedData = getSortedData();
        console.log('当前extractedData:', sortedData);
        return sortedData.map((item, index) => {
            console.log(`渲染第${index}项:`, item);
            return (
                <React.Fragment key={index}>
                    <tr className="hover:bg-base-200 transition-colors" onClick={() => toggleExpand(index)}>
                        <td className="font-mono">{item.da}</td>
                        <td>
                            <div className="flex items-center gap-2">
                                {item.children && item.children.length > 0 && (
                                    <span className="text-base-content/70">
                                        {item.isExpanded ? '▼' : '▶'}
                                    </span>
                                )}
                                <span className="font-mono">{item.di}</span>
                            </div>
                        </td>
                        <td className="font-mono">{item.content}</td>
                        <td className="font-mono">{item.time || '-'}</td>
                    </tr>
                    {item.isExpanded && item.children && item.children.map((child, childIndex) => (
                        <tr key={`${index}-${childIndex}`} className="bg-base-100">
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
            <div className="flex gap-4 mb-4">
                <textarea
                    className="textarea textarea-bordered flex-grow font-mono"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="请输入要解析的报文..."
                    rows={4}
                />
                <button
                    className="btn btn-primary"
                    onClick={handleParse}
                    disabled={isLoading}
                >
                    {isLoading ? '解析中...' : '解析'}
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="table table-zebra w-full">
                    <thead>
                        <tr>
                            <th 
                                className="bg-base-200 cursor-pointer hover:bg-base-300"
                                onClick={() => handleSort('da')}
                            >
                                信息点标识(DA)
                                {sortConfig?.key === 'da' && (
                                    <span className="ml-2">
                                        {sortConfig.direction === 'asc' ? '↑' : '↓'}
                                    </span>
                                )}
                            </th>
                            <th className="bg-base-200">数据标识编码(DI)</th>
                            <th className="bg-base-200">内容</th>
                            <th 
                                className="bg-base-200 cursor-pointer hover:bg-base-300"
                                onClick={() => handleSort('time')}
                            >
                                时间
                                {sortConfig?.key === 'time' && (
                                    <span className="ml-2">
                                        {sortConfig.direction === 'asc' ? '↑' : '↓'}
                                    </span>
                                )}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {renderTableRows()}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default FrameExtractor;