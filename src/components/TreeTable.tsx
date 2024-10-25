import React, { useEffect, useState, useRef } from 'react';
import { TreeTable, TreeTableToggleEvent, TreeTableEvent } from 'primereact/treetable';
import { Column } from 'primereact/column';
import { TreeNode } from 'primereact/treenode';
import { useTreeTableStore } from '../stores/useTreeViewStore';
import { ContextMenu } from 'primereact/contextmenu';
import { ExportImage, CopyImage, CancelIcon, ExpandAll } from './Icons'
import { toast } from '../context/ToastProvider';// Add this for toast
import Progress from './progress';
import domtoimage from 'dom-to-image';// Add this for image export
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';

export interface TreeItemType {
    frameDomain: string;
    data: string;
    description: string;
    uniqueId?: string;
    position?: number[];
    color?: string | null;
    children?: TreeItemType[];
}

interface TreeTableViewProps {
    data: TreeItemType[];
    onRowClick: (item: TreeItemType) => void;
}

export interface ExtendedTreeNode extends TreeNode {
    originalData?: TreeItemType;
}

export const generateRowId = (item: TreeItemType, strfix: string): string => {
    return `${strfix}-${item.frameDomain}-${item.data}-${item.description}`;
};

const convertToTreeNode = (items: TreeItemType[], level = 0): ExtendedTreeNode[] => {
    return items.map((item, index) => {
        const node: ExtendedTreeNode = {
            key: index.toString(),
            data: {
                frameDomain: item.frameDomain,
                data: item.data,
                description: item.description.length > 0 ? item.description : '',
                uniqueId: generateRowId(item, `${level}-${index}`),
                color: item.color,
            },
            originalData: item,
            children: item.children ? convertToTreeNode(item.children, level + 1) : undefined
        };
        return node;
    });
};

// 新增：生成所有节点的展开状态
const generateExpandedKeys = (nodes: ExtendedTreeNode[]): { [key: string]: boolean } => {
    const expandedKeys: { [key: string]: boolean } = {};

    const processNode = (node: ExtendedTreeNode) => {
        if (node.children) {
            expandedKeys[node.key!] = true;
            node.children.forEach(processNode);
        }
    };

    nodes.forEach(processNode);
    return expandedKeys;
};

export const TreeTableView: React.FC<TreeTableViewProps> = ({ data, onRowClick }) => {
    const bgCellSelectColor = 'bg-red-500 text-white';
    const [treeTable, setTreeTable] = useState<ExtendedTreeNode[]>([]);
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0 });
    const [progress, setProgress] = useState({ type: '', position: 'end', visible: false });
    const [isexpand, setIsExpand] = useState(false);

    const isExpand = (node: ExtendedTreeNode): boolean => {
        return node.key! in expandedKeys;
    }
    const tableRef = useRef(null);

    // 新增：展开状态管理
    const {
        selectedCell,
        selectNode,
        columnWidths,
        expandedKeys,
        expandAll,
        setSelectedCell,
        setSelectNode,
        setColumnWidth,
        setExpandedKeys,
        setExpandAll,
        resetState,
    } = useTreeTableStore();

    const handleRowClick = (e: any) => {
        const node = e.node;
        if (node?.originalData) {
            onRowClick(node.originalData);
        }
    };

    const getRowClassName = (node: TreeNode) => {
        if(!selectNode) return {};
        return {
            "bg-blue-500 text-white": node.data.uniqueId === selectNode?.data.uniqueId,
            "bg-transparent": node.data.uniqueId !== selectNode?.data.uniqueId,
        };
    };

    useEffect(() => {
        const newdata = convertToTreeNode(data);
        setTreeTable(newdata.length > 0 ? newdata : [{
            key: 'empty',
            data: { frameDomain: '', data: '', description: '' },
        }]);

        // 新增：设置默认展开状态
        if (newdata.length > 0) {
            if (Object.keys(expandedKeys).length === 0) {
                console.log("newdata", newdata)
                setExpandedKeys(generateExpandedKeys(newdata));
                setExpandAll(true);
            }
        }
        else {
            setExpandedKeys({});
            resetState(); // 清空状态
        }
    }, [data]);

    const renderCell = (field: string, value: string, node: ExtendedTreeNode) => (
        <div
            className={`ml-1 cursor-pointer truncate flex items-center w-full h-full`}
            onClick={() => {
                setSelectNode(node);
                setSelectedCell(`${field}-${node.data.uniqueId}`);
            }}
        >
            {value}
        </div>
    );

    // 新增：处理节点展开/折叠
    const handleToggle = (e: TreeTableToggleEvent) => {
        setExpandedKeys(e.value);
    };

    // 单独的异步函数来处理图片生成
    const generateImage = async (element: HTMLElement, extensions: string[] = ['svg']): Promise<string> => {
        return new Promise<string>((resolve, reject) => {
            // 使用 requestAnimationFrame 来避免 UI 卡顿
            requestAnimationFrame(async () => {
                try {
                    const computedStyle = window.getComputedStyle(element);
                    if (extensions.includes('svg')) {
                        let dataUrl = await domtoimage.toSvg(element, {
                            quality: 1,
                            bgcolor: computedStyle.backgroundColor || '#ffff', // 使用元素背景颜色
                            style: {
                                'font-size': '16px',
                                'letter-spacing': '0.05em',
                                'line-height': '1.5',
                                'fill': 'black',
                            },
                        });
                        resolve(dataUrl);
                    } else if (extensions.includes('png')) {
                        let dataUrl = await domtoimage.toPng(element, {
                            quality: 1,
                            bgcolor: computedStyle.backgroundColor || '#ffff', // 使用元素背景颜色
                            style: {
                                'font-size': '16px',
                                'letter-spacing': '0.05em',
                                'line-height': '1.5',
                                'fill': 'black',
                            },
                        });
                        resolve(dataUrl);
                    }
                    reject('Unsupported format');
                } catch (error) {
                    reject(error);
                }
            });
        });
    };

    const handleExportImage = async () => {
        const element = tableRef.current;
        setProgress(prevProgress => ({ ...prevProgress, visible: true }));

        if (element) {
            try {
                // 强制React检查是否需要更新UI
                await new Promise(resolve => setTimeout(resolve, 0));

                // 生成图片
                const dataUrl = await generateImage(element);

                if (dataUrl) {
                    // 将 data URL 转换为 Blob
                    const response = await fetch(dataUrl);
                    const blob = await response.blob();

                    // 将 Blob 转换为 ArrayBuffer
                    const buffer = await blob.arrayBuffer();

                    // 使用 Tauri 的 save API 来选择保存位置
                    const filePath = await save({
                        filters: [{ name: 'SVG Images', extensions: ['svg'] }],
                    });

                    if (filePath) {
                        console.log('Saving image...');
                        const uint8Array = new Uint8Array(buffer);
                        await writeFile(filePath, uint8Array);
                        console.log('Image saved successfully!');
                        setProgress(prevProgress => ({ ...prevProgress, visible: false }));
                        setContextMenu({ visible: false, x: 0, y: 0 });
                        toast.success("图片导出成功", 'end', 'bottom', 3000);
                    }
                } else {
                    throw new Error('Failed to generate image');
                }
            } catch (error) {
                console.error('Error saving file:', error);
                setProgress(prevProgress => ({ ...prevProgress, visible: false }));
                toast.error("图片导出失败", 'end', 'bottom', 3000);
            }
        }
    };

    const handleCopyImage = async () => {
        closeContextMenu();
        requestAnimationFrame(async () => {
            toast.info('复制中，请勿操作', 'end', 'bottom', 3000)
            setProgress(prevProgress => ({ ...prevProgress, visible: true }));
            document.body.focus();
            document.body.classList.add('no-pointer-events'); // 禁用鼠标事件
            const element = tableRef.current;

            if (element) {
                try {
                    await new Promise(resolve => setTimeout(resolve, 0));

                    const dataUrl = await generateImage(element, ['png']);
                    if (dataUrl) {
                        const response = await fetch(dataUrl);
                        const blob = await response.blob();
                        const file = new File([blob], 'image.png', { type: 'image/png' });

                        const clipboardItem = new ClipboardItem({
                            'image/png': file,
                        });
                        await navigator.clipboard.write([clipboardItem]);

                        setProgress(prevProgress => ({ ...prevProgress, visible: false }));
                        toast.success("图片复制成功", 'end', 'bottom', 3000);
                    } else {
                        throw new Error('Failed to generate image');
                    }
                } catch (error) {
                    console.error('Error saving file:', error);
                    setProgress(prevProgress => ({ ...prevProgress, visible: false }));
                    toast.error("图片复制失败", 'end', 'bottom', 3000);
                } finally {
                    document.body.classList.remove('no-pointer-events'); // 恢复鼠标事件
                }
            }
        });
    };

    const closeContextMenu = () => {
        setContextMenu({ visible: false, x: 0, y: 0 });
    };

    const ExpandCurHandler = () => {
        if (!selectNode) return; // 确保 selectNode 存在

        const newExpandedKeys = { ...expandedKeys };
        if (isexpand) {
            // 删除指定的键值对
            delete newExpandedKeys[selectNode.key!];
            setIsExpand(false);
        } else {
            // 添加指定的键值对，并设置为 true
            newExpandedKeys[selectNode.key!] = true;
            setIsExpand(true);
        }

        setExpandedKeys(newExpandedKeys);
    };

    useEffect(() => {
        if(selectNode) {
            setIsExpand(isExpand(selectNode))
        }
    }, [selectNode])

    const ExpandAllHandler = () => {
        if (expandAll) {
            handleCollapseAll()
        } else {
            setExpandedKeys(generateExpandedKeys(treeTable));
            setExpandAll(true);
        }
    };
    const handleCollapseAll = () => {
        setExpandedKeys({});
        setExpandAll(false);
    };

    const handleContextMenu = (e: any) => {
        e.originalEvent.preventDefault();
        // 需要判断设置的位置是否在当前视口内，每一个方向都需要判断
        let x = e.originalEvent.clientX;
        let y = e.originalEvent.clientY;
        if (x + 200 > window.innerWidth) {
            x = e.originalEvent.clientX - 200;
        }
        if (y + 150 > window.innerHeight) {
            y = e.originalEvent.clientY - 150;
        }

        const is_expand = isExpand(e.node);
        setIsExpand(is_expand);
        setContextMenu({ visible: true, x: x, y: y });
    };

    return (
        <div className="border textarea-bordered rounded w-full h-full overflow-hidden">
            <TreeTable
                ref={tableRef}
                value={treeTable}
                tableStyle={{ minWidth: '50rem' }}
                scrollable={true}
                scrollHeight="100%"
                resizableColumns={true}
                columnResizeMode="fit"
                onRowClick={handleRowClick}
                rowClassName={getRowClassName}
                showGridlines={true}
                loading={false}
                emptyMessage=""
                expandedKeys={expandedKeys}
                onToggle={handleToggle}
                onContextMenu={handleContextMenu}
            >
                <Column
                    key="frameDomain"
                    field="frameDomain"
                    header="帧域"
                    expander={true}
                    bodyClassName={(node: TreeItemType) =>
                        `cursor-pointer truncate flex items-center ${selectedCell === `frameDomain-${node.uniqueId}` ? bgCellSelectColor : ''
                        }`
                    }
                    className="truncate ml-1"
                    body={(node: ExtendedTreeNode) =>
                        renderCell('frameDomain', node.data.frameDomain, node)
                    }
                />
                <Column
                    key="data"
                    field="data"
                    header="数据"
                    className="truncate"
                    bodyClassName={(node: TreeItemType) =>
                        `cursor-pointer truncate ${selectedCell === `data-${node.uniqueId}` ? bgCellSelectColor : ''
                        }`
                    }
                    body={(node: ExtendedTreeNode) =>
                        renderCell('data', node.data.data, node)
                    }
                />
                <Column
                    key="description"
                    field="description"
                    header="说明"
                    className="truncate"
                    bodyClassName={(node: TreeItemType) =>
                        `cursor-pointer truncate ${selectedCell === `description-${node.uniqueId}` ? bgCellSelectColor : ''
                        }`
                    }
                    body={(node: ExtendedTreeNode) =>
                        renderCell('description', node.data.description || '', node)
                    }
                />
            </TreeTable>
            {/* {contextMenu.visible && (
                <div
                    className="fixed  bg-white border shadow-lg rounded-box"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onMouseLeave={closeContextMenu}
                >
                    <ul tabIndex={0} className="menu bg-base-100 rounded-box z-[1] w-52 p-2 shadow">
                        <li className="cursor-pointer" onClick={handleExportImage}>
                            <a>
                                <ExportImage className="h-5 w-5"></ExportImage>导出图片
                            </a>
                        </li>
                        <li className="cursor-pointer" onClick={handleCopyImage}>
                            <a>
                                <CopyImage className="h-5 w-5"></CopyImage>复制图片
                            </a>
                        </li>
                        <li className="cursor-pointer" onClick={ExpandCurHandler}>
                            <a>
                                <ExpandAll className="h-5 w-5"></ExpandAll> {isexpand ? "折叠当前节点" : "展开当前节点"}
                            </a>
                        </li>
                        <li className="cursor-pointer" onClick={ExpandAllHandler}>
                            <a>
                                <ExpandAll className="h-5 w-5"></ExpandAll> {expandAll ? "折叠所有节点" : "展开所有节点"}
                            </a>
                        </li>
                    </ul>
                </div>
            )} */}
        </div>
    );
};