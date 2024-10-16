import React from 'react';
import { ListChildComponentProps } from 'react-window';
import { DataItem } from '../stores/useItemConfigStore';

interface SearchListProps extends ListChildComponentProps {
    selectItem: (item: DataItem) => void;
}

const ItemConfigRow: React.FC<SearchListProps> = ({ index, style, data, selectItem }) => {
    const item = data[index] as DataItem;
    const handleClick = React.useCallback((e: React.MouseEvent) => {
        selectItem(item);
    }, [item]);

    return (
        <div
            className="flex items-center px-4 py-2 hover:bg-base-300 cursor-pointer font-sans text-sm"
            style={style}
            onClick={handleClick}
            onMouseDown={handleClick}
        >
            <span className="mr-2 flex-shrink-0 justify-between-text">{item.item}</span>
            {item.name && <span className="mr-2 min-w-10 max-w-60 flex-shrink-0 justify-between-text">{item.name}</span>}
            {item.protocol && (
                <div className="badge badge-success m-2 flex-shrink-0 justify-between-text" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.protocol}
            </div>
            )}
            {item.region && (
                <div className="badge badge-info flex-shrink-0 justify-between-text" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.region}
            </div>)}
        </div>
    );
};

export default React.memo(ItemConfigRow);