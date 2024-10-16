import React from 'react';
import { ListChildComponentProps } from 'react-window';
import { DataItem } from '../stores/useItemConfigStore';

interface SearchListProps extends ListChildComponentProps {
    selectItem: (item: DataItem) => void;
}

const ItemConfigRow: React.FC<SearchListProps> = ({ index, style, data, selectItem }) => {
    const item = data[index] as DataItem;
    console.log(data);
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
            <span className="mr-2">{item.item}</span>
            {item.name && <span className="mr-2">{item.name}</span>}
            {item.protocol && <span className="mr-2">{item.protocol}</span>}
            {item.region && <span>{item.region}</span>}
        </div>
    );
};

export default React.memo(ItemConfigRow);