import React, { useState } from 'react';
import { ListChildComponentProps } from 'react-window';
import { DataItem } from '../stores/useItemConfigStore';
import { Save, Trash2 } from 'lucide-react';

interface SearchListProps extends ListChildComponentProps {
    selectItem: (item: DataItem) => void;
    onSave: (item: DataItem) => void;
    onDelete: (item: DataItem) => void;
}

const ItemConfigRow: React.FC<SearchListProps> = ({ index, style, data, selectItem, onSave, onDelete }) => {
    const [isHovered, setIsHovered] = useState(false);
    const item = data[index] as DataItem;

    const handleClick = React.useCallback((e: React.MouseEvent) => {
        selectItem(item);
    }, [item, selectItem]);

    const handleSave = (e: React.MouseEvent) => {
        e.stopPropagation();
        onSave(item);
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete(item);
    };

    return (
        <div
            className="cursor-pointer h-9 flex items-center px-4 py-2 font-sans text-sm relative hover:bg-base-300"
            style={{ ...style, width: '100%' }}
            onMouseDown={handleClick}
        >
            <div className='w-full flex items-center h-9' onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
                <div className='flex items-center w-full h-full'>
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

                {isHovered && (
                    <div className="right-2 flex items-center h-full w-full">
                        <button
                            className="btn btn-sm btn-circle btn-ghost mr-1"
                            onMouseDown={handleSave}
                        >
                            <Save size={16} />
                        </button>
                        <button
                            className="btn btn-sm btn-circle btn-ghost text-error"
                            onMouseDown={handleDelete}
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                )}

            </div>
        </div>
    );
};

export default React.memo(ItemConfigRow);