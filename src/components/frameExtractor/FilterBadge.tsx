// src/components/frameExtractor/FilterBadge.tsx
import React from 'react';
import { X } from 'lucide-react';
import { FilterValue, FILTER_TYPE_LABELS } from '../../store/slices/frameExtractorSlice';
import { useAppDispatch } from '../../store/hooks';
import { clearFilter } from '../../store/slices/frameExtractorSlice';

interface FilterBadgeProps {
    column: string;
    filter: {
        value: FilterValue;
    };
}

const FilterBadge: React.FC<FilterBadgeProps> = ({ column, filter }) => {
    const dispatch = useAppDispatch();
    const { type, value } = filter.value as FilterValue;

    return (
        <div className="badge badge-sm badge-primary gap-1">
            {FILTER_TYPE_LABELS[type]}: {value}
            <button
                className="ml-1"
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