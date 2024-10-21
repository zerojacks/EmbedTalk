import React, { useState, useCallback, useMemo } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';

interface Column {
    name: string;
    width: number;
    minWidth: number;
}

interface TreeItemType {
    frameDomain: string;
    data: string;
    description: string;
    position?: number[];
    color?: string | null;
    children?: TreeItemType[];
    uniqueId?: string;
    depth?: number;
}

interface TreeTableProps {
    className: string;
    data: TreeItemType[];
    columns: Column[];
    onRowClick?: (item: TreeItemType) => void;
}

const generateRowId = (item: TreeItemType, index: number): string => {
    return `${index}-${item.frameDomain}-${item.data}-${item.description}`;
};

const generateUniqueIds = (items: TreeItemType[], level: number = 1): TreeItemType[] => {
    return items.map((item, index) => ({
        ...item,
        uniqueId: generateRowId(item, level * index),
        depth: level,
        children: item.children ? generateUniqueIds(item.children, level + 1) : []
    }));
};

const TreeTable: React.FC<TreeTableProps> = ({ className, data, columns: initialColumns, onRowClick }) => {
    const [columns, setColumns] = useState(initialColumns);
    const [expandedState, setExpandedState] = useState<Record<string, boolean>>({});
    const [selectedRow, setSelectedRow] = useState<string | null>(null);
    const [selectedCell, setSelectedCell] = useState<{ row: string; col: number } | null>(null);

    const handleResize = useCallback((index: number, newWidth: number) => {
        setColumns(prevColumns => {
            const updatedColumns = [...prevColumns];
            const deltaWidth = newWidth - updatedColumns[index].width;

            if (updatedColumns[index].width + deltaWidth < updatedColumns[index].minWidth) {
                return prevColumns;
            }

            updatedColumns[index] = {
                ...updatedColumns[index],
                width: updatedColumns[index].width + deltaWidth
            };

            if (index < updatedColumns.length - 1) {
                const nextColumnNewWidth = Math.max(
                    updatedColumns[index + 1].width - deltaWidth,
                    updatedColumns[index + 1].minWidth
                );
                updatedColumns[index + 1] = {
                    ...updatedColumns[index + 1],
                    width: nextColumnNewWidth
                };
            }

            return updatedColumns;
        });
    }, []);

    const toggleExpand = useCallback((uniqueId: string) => {
        setExpandedState(prev => ({
            ...prev,
            [uniqueId]: !prev[uniqueId]
        }));
    }, []);

    const handleCellClick = useCallback((item: TreeItemType, colIndex: number) => {
        setSelectedRow(item.uniqueId || null);
        setSelectedCell({ row: item.uniqueId || '', col: colIndex });
        if (onRowClick) {
            onRowClick(item);
        }
    }, [onRowClick]);

    const renderCell = useCallback((item: TreeItemType, columnIndex: number, depth: number) => {
        const isSelected = selectedCell?.row === item.uniqueId && selectedCell?.col === columnIndex;
        const className = `p-0 text-sm ${isSelected ? 'bg-red-200' : ''} overflow-hidden`;
        const style = {
            ...(columnIndex === 0 ? { paddingLeft: `${depth * 20}px` } : {}),
            width: `${columns[columnIndex].width}px`,
            maxWidth: `${columns[columnIndex].width}px`,
            height: '24px', // Fixed height
        };

        const content = columnIndex === 0 ? item.frameDomain : columnIndex === 1 ? item.data : item.description;

        return (
            <td
                className={className}
                style={style}
                onClick={() => handleCellClick(item, columnIndex)}
                title={content}
            >
                <div className="flex items-center h-full">
                    {columnIndex === 0 && (
                        <span className="inline-flex items-center justify-center w-4 mr-1">
                            {item.children && item.children.length > 0 ? (
                                <ExpandButton item={item} toggleExpand={toggleExpand} expandedState={expandedState} />
                            ) : (
                                <span className="w-4 h-4 inline-block"></span>
                            )}
                        </span>
                    )}
                    <span className="truncate flex-1 overflow-hidden">
                        {content}
                    </span>
                </div>
            </td>
        );
    }, [selectedCell, handleCellClick, toggleExpand, expandedState, columns]);

    const renderTreeItem = useCallback((item: TreeItemType, depth = 0) => {
        const isExpanded = expandedState[item.uniqueId || ''];
        const isRowSelected = selectedRow === item.uniqueId;

        return (
            <React.Fragment key={item.uniqueId}>
                <tr className={`${isRowSelected ? 'bg-blue-200 text-white' : ''}`}>
                    {[0, 1, 2].map(index => renderCell(item, index, depth))}
                </tr>
                {isExpanded && item.children && item.children.map(child => renderTreeItem(child, depth + 1))}
            </React.Fragment>
        );
    }, [expandedState, selectedRow, renderCell]);

    const renderTableHeader = useCallback(() => (
        <thead className='sticky top-0 bg-white z-10'>
            <tr>
                {columns.map((column, index) => (
                    <th
                        key={column.name}
                        className="relative p-1 font-bold text-center overflow-hidden whitespace-nowrap text-ellipsis"
                        style={{ width: column.width, height: '24px' }}
                    >
                        {column.name}
                        {index < columns.length - 1 && (
                            <ResizeHandle index={index} handleResize={handleResize} />
                        )}
                    </th>
                ))}
            </tr>
        </thead>
    ), [columns, handleResize]);

    const memoizedData = useMemo(() => generateUniqueIds(data), [data]);

    return (
        <div className={`textarea-bordered border rounded overflow-auto ${className}`}>
            <table className="w-full table-fixed">
                {renderTableHeader()}
                <tbody>
                    {memoizedData.map(item => renderTreeItem(item))}
                </tbody>
            </table>
        </div>
    );
};

const ExpandButton: React.FC<{ item: TreeItemType; toggleExpand: (id: string) => void; expandedState: Record<string, boolean> }> = 
    ({ item, toggleExpand, expandedState }) => (
    <button
        onClick={(e) => {
            e.stopPropagation();
            toggleExpand(item.uniqueId || '');
        }}
        className="w-4 h-4 inline-flex items-center justify-center"
    >
        {expandedState[item.uniqueId || ''] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
    </button>
);

const ResizeHandle: React.FC<{ index: number; handleResize: (index: number, newWidth: number) => void }> = 
    ({ index, handleResize }) => (
    <div
        className="absolute top-0 right-0 bottom-0 w-0.5 cursor-col-resize bg-transparent"
        onMouseDown={(e) => {
            e.preventDefault();
            const startX = e.pageX;
            const startWidth = e.currentTarget.parentElement?.offsetWidth || 0;

            const onMouseMove = (e: MouseEvent) => {
                const newWidth = startWidth + e.pageX - startX;
                handleResize(index, newWidth);
            };

            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        }}
    />
);

export default TreeTable;