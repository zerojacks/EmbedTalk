import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import TreeItem, { TreeItemType, generateRowId } from './TreeItem';
import domtoimage from 'dom-to-image';// Add this for image export
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { toast } from '../context/ToastProvider';// Add this for toast
import Progress from './progress';
import { ExportImage, CopyImage, CancelIcon, ExpandAll } from './Icons'
import { useFrameTreeStore } from '../stores/useFrameAnalysicStore';

export interface Column {
  name: string;
  width: number;
  minWidth: number;
}

interface TreeTableViewProps {
  data: TreeItemType[];
  tableheads: Column[];
  onRowClick: (item: TreeItemType) => void;
}

export const TreeTableView: React.FC<TreeTableViewProps> = ({ data, tableheads, onRowClick }) => {

  const {
    selectedRowId,
    expandedRows,
    selectedCell,
    expandedAll,
    isLoading,
    treeScrollPosition,
    setSelectedRowId,
    setExpandedRows,
    setSelectedCell,
    setExpandedAll,
    setIsLoading,
    setTreeScrollPosition
  } = useFrameTreeStore();
  const tableRef = useRef<HTMLTableElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0 });
  const [progress, setProgress] = useState({ type: '', position: 'end', visible: false });
  const [treedata, setTreeData] = useState<TreeItemType[]>(data);

  const is_expand = selectedRowId ? expandedRows.has(selectedRowId) : false;

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    // 需要判断设置的位置是否在当前视口内，每一个方向都需要判断
    let x = e.clientX;
    let y = e.clientY;
    if (x + 200 > window.innerWidth) {
      x = e.clientX - 200;
    }
    if (y + 150 > window.innerHeight) {
      y = e.clientY - 150;
    }
    setContextMenu({ visible: true, x: x, y: y });
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


  useEffect(() => {
    const dataWithIds = generateUniqueIds(data);
    setTreeData(dataWithIds);
    handleExpandAll(dataWithIds);

    setIsLoading(true);
  }, [data]);

  useLayoutEffect(() => {
    if (isLoading) {
      if (treeScrollPosition && containerRef.current) {
        setTimeout(() => {
          if (containerRef.current) {
            containerRef.current.scrollTop = treeScrollPosition;
          }
        }, 0);
      }
    }
  }, [isLoading]);

  const generateUniqueIds = (items: TreeItemType[], level: number = 1): TreeItemType[] => {
    return items.map((item, index) => ({
      ...item,
      uniqueId: generateRowId(item, level * index),  // 传递深度给 generateRowId
      depth: level,  // 添加深度信息到 item
      children: item.children ? generateUniqueIds(item.children, level + 1) : []  // 递归调用时增加 level
    }));
  };

  useEffect(() => {
    const handleScroll = () => {
      if (containerRef.current) {
        setTreeScrollPosition(containerRef.current.scrollTop);
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
    }

    return () => {
      if (container) {
        container.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  const handleRowClick = (item: TreeItemType) => {
    setSelectedRowId(item.uniqueId || '');
    onRowClick(item);
  };

  const handleRowDoubleClick = (item: TreeItemType, hasChildren: boolean | undefined) => {
    if (hasChildren) {
      toggleRowExpansion(item.uniqueId || '');
    }
  };

  const toggleRowExpansion = (rowId: string) => {
    const newExpandedRows = new Set(expandedRows);
    if (newExpandedRows.has(rowId)) {
      newExpandedRows.delete(rowId);
    } else {
      newExpandedRows.add(rowId);
    }
    setExpandedRows(newExpandedRows);
  };

  const handleExpandAll = (data: TreeItemType[]) => {
    const allExpanded = new Set<string>();
    // 遍历data，添加所有的 uniqueId
    const traverse = (items: TreeItemType[]) => {
      items.forEach(item => {
        allExpanded.add(item.uniqueId || '');
        if (item.children) {
          traverse(item.children);
        }
      });
    };
    traverse(data);
    setExpandedRows(allExpanded);
    setExpandedAll(true);
  };
  const ExpandCurHandler = () => {
    if (selectedRowId) {
      toggleRowExpansion(selectedRowId)
    }
  };

  const ExpandAllHandler = () => {
    if (expandedAll) {
      handleCollapseAll()
    } else {
      handleExpandAll(generateUniqueIds(data));
    }
  };
  const handleCollapseAll = () => {
    setExpandedRows(new Set());
    setExpandedAll(false);
  };

  return (
    <div className="w-full h-full overflow-auto textarea-bordered treetableview rounded" ref={containerRef} onContextMenu={handleContextMenu}>
      {progress.visible && <Progress type={progress.type} xlevel={progress.position} />}
      <table className="w-full table-fixed border-collapse" ref={tableRef}>
        <colgroup>
          {tableheads.map((column, index) => (
            <col key={index} style={{ width: `${column.width}px` }} />
          ))}
        </colgroup>
        <thead className="sticky top-0 dark:bg-gray-100 z-10">
          <tr>
            {tableheads.map((column, index) => (
              <th key={index} style={{ position: 'relative', width: `${column.width}px` }}>
                {column.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {treedata.map((item, index) => (
            <TreeItem
              key={item.uniqueId || generateRowId(item, index)}
              data={item}
              level={item.depth || 0}
              onRowClick={handleRowClick}
              onRowDoubleClick={handleRowDoubleClick}
              selectedRowId={selectedRowId}
              selectedCell={selectedCell}
              setSelectedCell={setSelectedCell}
              rowIndex={index}
              expandedRows={expandedRows}
            />
          ))}
        </tbody>
      </table>
      {contextMenu.visible && (
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
                <ExpandAll className="h-5 w-5"></ExpandAll> {is_expand ? "折叠当前节点" : "展开当前节点"}
              </a>
            </li>
            <li className="cursor-pointer" onClick={ExpandAllHandler}>
              <a>
                <ExpandAll className="h-5 w-5"></ExpandAll> {expandedAll ? "折叠所有节点" : "展开所有节点"}
              </a>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};