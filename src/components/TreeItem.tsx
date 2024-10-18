//TreeItem.tsx

import React, { useState } from 'react';
import { ChevronRight, ChevronDown } from './Icons';

export interface TreeItem {
  frameDomain: string;
  data: string;
  description: string;
  position?: number[];
  color?: string | null;
  children?: TreeItem[];
  uniqueId?: string; // 添加唯一标识符
  depth?: number;
}

interface TreeItemProps {
  data: TreeItem;
  level: number;
  onRowClick: (item: TreeItem) => void;
  onRowDoubleClick: (item: TreeItem, hasChildren: boolean | undefined) => void;
  selectedRowId: string | null; // 修改为 string 类型
  selectedCell: { row: number | null; column: number | null }; // 新增选中单元格的状态
  setSelectedCell: (cell: { row: number | null; column: number | null }) => void; // 设置选中单元格的状态
  rowIndex: number; // 当前行的索引
  expandedRows: Set<string>; // 传递 expandedRows
}

const ItemTreeView: React.FC<TreeItemProps> = ({
  data,
  level,
  onRowClick,
  onRowDoubleClick,
  selectedRowId,
  selectedCell,
  setSelectedCell,
  rowIndex,
  expandedRows // 传递 expandedRows
}) => {
  const hasChildren = data.children && data.children.length > 0;

  const rowId = data.uniqueId || ''; // 确保 rowId 存在
  const isSelected = (selectedRowId === rowId) && (selectedCell.row === rowIndex); // 使用 uniqueId 作为比较标识符
  // 判断当前行是否展开
  const isRowExpanded = expandedRows.has(rowId);
  const isRed = data.color?.toLowerCase() === '#ff0000';

  const handleClick = () => {
    onRowClick(data);
  };

  const handleDoubleClick = () => {
    onRowDoubleClick(data, hasChildren);
  };

  const handleToggleExpand = (e: React.MouseEvent) => {
    console.log('handleToggleExpand', data);
    e.stopPropagation();
    handleDoubleClick();
  };

  const handleCellClick = (columnIndex: number) => {
    setSelectedCell({ row: rowIndex, column: columnIndex });
  };

  return (
    <>
      <tr
        className={`cursor-pointer ${isSelected ? 'bg-blue-500' : 'bg-transparent'} text-sm`}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        <td
          style={{
            paddingLeft: `${level * 20}px`,
            backgroundColor: selectedCell.row === rowIndex && selectedCell.column === 0 ? 'red' : 'transparent'
          }}
          onClick={() => handleCellClick(0)}
        >
          <div className="flex items-center">
            {/* 添加占位符 */}
            <span
              className="mr-2 flex-shrink-0 flex items-center justify-center focus:outline-none text-base-content dark:text-gray-300 transition-colors"
              onClick={hasChildren ? handleToggleExpand : undefined}
            >
              {hasChildren ? (
                isRowExpanded ? (
                  <ChevronDown className="w-5 h-5"/>
                ) : (
                  <ChevronRight className="w-5 h-5" />
                )
              ) : (
                // 空白占位符，确保布局一致
                <span className="w-5 h-5" />
              )}
            </span>
            <span className="flex-grow truncate">{data.frameDomain}</span>
          </div>
        </td>
        <td
          style={{
            backgroundColor: selectedCell.row === rowIndex && selectedCell.column === 1 ? 'red' : 'transparent'
          }}
          onClick={() => handleCellClick(1)}
          className="truncate"
        >
          {data.data}
        </td>
        <td
          style={{
            backgroundColor: selectedCell.row === rowIndex && selectedCell.column === 2 ? 'red' : 'transparent',
            color: (isRed && (selectedCell.row === rowIndex && selectedCell.column === 2)) ? 'white' : data.color?.toLowerCase() || ''
          }}
          onClick={() => handleCellClick(2)}
          className="truncate"
        >
          {data.description}
        </td>
      </tr>
      {isRowExpanded && hasChildren && data.children && (
        <>
          {data.children.map((child, index) => (
            <ItemTreeView
              key={child.uniqueId || generateRowId(child, (level + 1) * index)}
              data={child}
              level={level + 1}
              onRowClick={onRowClick}
              onRowDoubleClick={onRowDoubleClick}
              selectedRowId={selectedRowId}
              selectedCell={selectedCell}
              setSelectedCell={setSelectedCell}
              rowIndex={rowIndex * 100 + index}
              expandedRows={expandedRows} // 传递 expandedRows
            />
          ))}
        </>
      )}
    </>
  );
};

export const generateRowId = (item: TreeItem, index: number): string => {
  return `${index}-${item.frameDomain}-${item.data}-${item.description}`;
};

export default ItemTreeView;
