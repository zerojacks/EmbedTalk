// src/components/frameExtractor/FilterBadge.tsx
import React from 'react';
import { X } from 'lucide-react';
import { FilterValue, FILTER_TYPE_LABELS } from '../../store/slices/frameExtractorSlice';
import { useAppDispatch } from '../../store/hooks';
import { clearFilter } from '../../store/slices/frameExtractorSlice';

interface FilterBadgeProps {
    column: string;
    columnName: string;
    filter: {
        value: FilterValue;
    };
}

const FilterBadge: React.FC<FilterBadgeProps> = ({ column, columnName, filter }) => {
    const dispatch = useAppDispatch();
    const { type, value } = filter.value as FilterValue;

    return (
        <div className="badge badge-sm badge-primary gap-1 px-2">
            <span className="font-medium">{columnName}:</span>
            <span className="opacity-75">{FILTER_TYPE_LABELS[type]}</span>
            <span className="font-mono">{value}</span>
            <button
                className="ml-1 hover:bg-primary-focus rounded-full p-0.5"
                onClick={(e) => {
                    e.stopPropagation();
                    dispatch(clearFilter(column));
                }}
            >
                <X className="w-3 h-3" />
            </button>
        </div>
    );
};

export default FilterBadge;