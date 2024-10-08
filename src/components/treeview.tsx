import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import TreeItem, { TreeItem as TreeItemType, generateRowId } from './TreeItem';
import domtoimage from 'dom-to-image';// Add this for image export
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import {toast} from '../context/ToastProvider';// Add this for toast
import Progress from './progress';
import {ExportImage, CopyImage, CancelIcon, ExpandAll} from './Icons'

export interface Column {
  name: string;
  width: number;
  minWidth: number;
}

interface TreeTableViewProps {
  data: TreeItemType[];
  initialColumns: Column[];
  onRowClick: (item: TreeItemType) => void;
}

export const TreeTableView: React.FC<TreeTableViewProps> = ({ data, initialColumns, onRowClick }) => {
  const [columns, setColumns] = useState<Column[]>(initialColumns);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [tabledata, setTableData] = useState<TreeItemType[]>([]);
  const [selectedCell, setSelectedCell] = useState<{ row: number | null; column: number | null }>({ row: null, column: null });
  const tableRef = useRef<HTMLTableElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0 });
  const [progress, setProgress] = useState({ type: '', position: 'end', visible: false });
  const [expandedAll, setExpandedAll] = useState(true);
  
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY });
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

  const loadSavedState = useCallback(() => {
    const savedExpandedRows = localStorage.getItem('expandedRows');
    const savedSelectedRowId = localStorage.getItem('selectedRowId');
    const savedSelectedCell = localStorage.getItem('selectedCell');

    if (savedSelectedCell) {
      setSelectedCell(JSON.parse(savedSelectedCell));
    }
    if (savedExpandedRows) {
      setExpandedRows(new Set(JSON.parse(savedExpandedRows)));
    }
    if (savedSelectedRowId) {
      setSelectedRowId(savedSelectedRowId);
    }

    const savedColumns = localStorage.getItem('treeTableColumns');
    if (savedColumns) {
      setColumns(JSON.parse(savedColumns));
    }
  }, []);

  useEffect(() => {
    const dataWithIds = generateUniqueIds(data);
    console.log('dataWithIds:', dataWithIds);
    setTableData(dataWithIds);
    loadSavedState();
    handleExpandAll(dataWithIds);

    setIsDataLoaded(true);
  }, [data, loadSavedState]);

  useLayoutEffect(() => {
    if (isDataLoaded) {
      const savedScrollPosition = localStorage.getItem('scrollPosition');
      if (savedScrollPosition && containerRef.current) {
        setTimeout(() => {
          if (containerRef.current) {
            containerRef.current.scrollTop = parseInt(savedScrollPosition, 10);
          }
        }, 0);
      }
    }
  }, [isDataLoaded]);

  // 保存列宽到 localStorage
  useEffect(() => {
    localStorage.setItem('treeTableColumns', JSON.stringify(columns));
  }, [columns]);

  const generateUniqueIds = (items: TreeItemType[], level: number = 1): TreeItemType[] => {
    return items.map((item, index) => ({
      ...item,
      uniqueId: generateRowId(item, level * index),  // 传递深度给 generateRowId
      depth: level,  // 添加深度信息到 item
      children: item.children ? generateUniqueIds(item.children, level + 1) : []  // 递归调用时增加 level
    }));
  };


  useEffect(() => {
    localStorage.setItem('expandedRows', JSON.stringify(Array.from(expandedRows)));
  }, [expandedRows]);

  useEffect(() => {
    console.log('selectedRowId:', selectedRowId);
    if (selectedRowId) {
      localStorage.setItem('selectedRowId', selectedRowId || '');
    }
  }, [selectedRowId]);

  useEffect(() => {
    if (selectedCell.column && selectedCell.row) {
      localStorage.setItem('selectedCell', JSON.stringify(selectedCell));
    }
  }, [selectedCell]);

  useEffect(() => {
    const handleScroll = () => {
      if (containerRef.current) {
        localStorage.setItem('scrollPosition', containerRef.current.scrollTop.toString());
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

  useLayoutEffect(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const width = rect.width;
      setContainerWidth(width);
    }
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
    setExpandedRows((prevExpandedRows) => {
      const newExpandedRows = new Set(prevExpandedRows);
      if (newExpandedRows.has(rowId)) {
        newExpandedRows.delete(rowId);
      } else {
        newExpandedRows.add(rowId);
      }
      return newExpandedRows;
    });
  };

  // 调整列宽
  // 调整列宽
  const handleResize = (index: number, mouseDownEvent: React.MouseEvent) => {
    mouseDownEvent.preventDefault();
    const startX = mouseDownEvent.pageX;
    const startWidths = columns.map(col => col.width);

    const handleMouseMove = (mouseMoveEvent: MouseEvent) => {
      const difference = mouseMoveEvent.pageX - startX;
      let newWidth = Math.max(columns[index].minWidth, startWidths[index] + difference);

      // setColumns(prevColumns => {
      //   const newColumns = [...prevColumns];

      //   // Ensure the new width does not go below the minimum width
      //   if (newWidth < newColumns[index].minWidth) {
      //     newWidth = newColumns[index].minWidth;
      //   }

      //   // Set the new width for the current column
      //   newColumns[index] = { ...newColumns[index], width: newWidth };

      //   // Adjust the next column's width if applicable
      //   if (index < newColumns.length - 1) {
      //     let nextColumnWidth = Math.max(
      //       newColumns[index + 1].minWidth,
      //       newColumns[index + 1].width - (newWidth - prevColumns[index].width)
      //     );

      //     if (nextColumnWidth < newColumns[index + 1].minWidth) {
      //       nextColumnWidth = newColumns[index + 1].minWidth;
      //     }

      //     newColumns[index + 1] = { ...newColumns[index + 1], width: nextColumnWidth };
      //   }

      //   return newColumns;
      // });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
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
  const ExpandAllHandler= () => {
    console.log(expandedAll);
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
  // 确保表格填满容器宽度
  // useLayoutEffect(() => {
  //   if (containerRef.current && tableRef.current) {
  //     const tableWidth = columns.reduce((sum, col) => sum + col.width, 0);
  //     const difference = containerWidth - tableWidth;

  //     if (difference > 0) {
  //       setColumns(prevColumns => {
  //         const lastColumnIndex = prevColumns.length - 1;
  //         const newLastColumnWidth = prevColumns[lastColumnIndex].width + difference;
  //         console.log(newLastColumnWidth, prevColumns[lastColumnIndex].minWidth);
  //         if (newLastColumnWidth < prevColumns[lastColumnIndex].minWidth) {
  //           return prevColumns; // 如果宽度没有变化，不更新状态
  //         }


  //         if (newLastColumnWidth === prevColumns[lastColumnIndex].width) {
  //           return prevColumns; // 如果宽度没有变化，不更新状态
  //         }
  //         const newColumns = [...prevColumns];
  //         newColumns[lastColumnIndex] = {
  //           ...newColumns[lastColumnIndex],
  //           width: newLastColumnWidth
  //         };
  //         return newColumns;
  //       });
  //     }
  //   }
  // }, []);  // 只在组件挂载时运行一次

  // useLayoutEffect(() => {
  //   // 在组件挂载和 columns 变化时调整最后一列宽度
  //   const adjustLastColumnWidth = () => {
  //     if (containerRef.current && tableRef.current) {
  //       // const containerWidth = containerRef.current.offsetWidth;
  //       const tableWidth = columns.reduce((sum, col) => sum + col.width, 0);
  //       const difference = containerWidth - tableWidth;

  //       if (difference > 0) {
  //         setColumns(prevColumns => {
  //           const lastColumnIndex = prevColumns.length - 1;
  //           let newLastColumnWidth = prevColumns[lastColumnIndex].width + difference;
  //           if (newLastColumnWidth === prevColumns[lastColumnIndex].width) {
  //             return prevColumns; // 如果宽度没有变化，不更新状态
  //           }
  //           if (newLastColumnWidth < prevColumns[lastColumnIndex].minWidth) {
  //             newLastColumnWidth = prevColumns[lastColumnIndex].minWidth;
  //           }

  //           const newColumns = [...prevColumns];
  //           newColumns[lastColumnIndex] = {
  //             ...newColumns[lastColumnIndex],
  //             width: newLastColumnWidth
  //           };
  //           return newColumns;
  //         });
  //       }
  //     }
  //   };

  //   adjustLastColumnWidth();

  //   window.addEventListener('resize', adjustLastColumnWidth);
  //   return () => window.removeEventListener('resize', adjustLastColumnWidth);
  // }, [columns]);

  return (
    <div className="w-full h-full overflow-auto textarea-bordered treetableview rounded" ref={containerRef} onContextMenu={handleContextMenu}>
      {progress.visible && <Progress type={progress.type} xlevel={progress.position} />}
      <table className="w-full table-fixed border-collapse" ref={tableRef}>
        <colgroup>
          {columns.map((column, index) => (
            <col key={index} style={{ width: `${column.width}px` }} />
          ))}
        </colgroup>
        <thead className="sticky top-0 bg-gray-100 z-10">
          <tr>
            {columns.map((column, index) => (
              <th key={index} style={{ position: 'relative', width: `${column.width}px` }}>
                {column.name}
                {/* {index < columns.length - 1 && (
                  <div
                    className="absolute top-0 right-0 bottom-0 w-1 cursor-col-resize"
                    onMouseDown={(e) => handleResize(index, e)}
                  />
                )} */}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tabledata.map((item, index) => (
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
          className="absolute bg-white border shadow-lg rounded-box"
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
            <li className="cursor-pointer" onClick={ExpandAllHandler}>
              <a>
                <ExpandAll className="h-5 w-5"></ExpandAll> {expandedAll? "折叠所有节点":"展开所有节点"}
              </a>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};
