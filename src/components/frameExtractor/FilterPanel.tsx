import React from 'react';
import { createPortal } from 'react-dom';
import { FilterValue, FILTER_TYPE_LABELS, FilterType } from '../../store/slices/frameExtractorSlice';

interface FilterPanelProps {
    isOpen: boolean;
    position: { 
        top: number; 
        left: number | 'auto'; 
        right: number | 'auto';
    };
    initialType: FilterType;
    initialValue: string;
    onApply: (type: FilterType, value: string) => void;
    onClose: () => void;
    onReset: () => void;
}

const FilterPanel: React.FC<FilterPanelProps> = ({
    isOpen,
    position,
    initialType,
    initialValue,
    onApply,
    onClose,
    onReset
}) => {
    const [type, setType] = React.useState<FilterType>(initialType);
    const [value, setValue] = React.useState(initialValue);
    const panelRef = React.useRef<HTMLDivElement>(null);

    // 重置为初始值
    React.useEffect(() => {
        setType(initialType);
        setValue(initialValue);
    }, [initialType, initialValue]);

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[1000]">
            {/* 遮罩层 */}
            <div 
                className="absolute inset-0 bg-transparent" 
                onClick={onClose}
            />
            
            {/* 过滤面板 */}
            <div
                ref={panelRef}
                className="absolute z-[1100] bg-base-100 shadow-xl rounded-lg border border-base-300 p-3 w-[300px] max-h-[calc(100vh-8px)] overflow-auto"
                style={{
                    top: position.top,
                    left: position.left,
                    right: position.right,
                    maxHeight: 'calc(100vh - 8px)'
                }}
                onClick={e => e.stopPropagation()}
            >
                <div className="space-y-3">
                    <div className="form-control w-full">
                        <label className="label p-0 pb-1">
                            <span className="label-text text-xs font-medium">过滤方式</span>
                        </label>
                        <select
                            className="select select-bordered select-sm w-full bg-base-100"
                            value={type}
                            onChange={e => setType(e.target.value as FilterType)}
                        >
                            {Object.entries(FILTER_TYPE_LABELS).map(([key, label]) => (
                                <option key={key} value={key}>{label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-control w-full">
                        <label className="label p-0 pb-1">
                            <span className="label-text text-xs font-medium">过滤值</span>
                        </label>
                        <input
                            type="text"
                            className="input input-bordered input-sm w-full bg-base-100"
                            value={value}
                            onChange={e => setValue(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter') {
                                    onApply(type, value);
                                }
                            }}
                            placeholder="输入过滤值..."
                            autoFocus
                        />
                    </div>

                    <div className="flex justify-between items-center gap-2 pt-1">
                        <button
                            className="btn btn-ghost btn-xs hover:bg-base-200"
                            onClick={() => {
                                setType('contains');
                                setValue('');
                                onReset();
                            }}
                        >
                            重置
                        </button>
                        <div className="flex gap-2">
                            <button
                                className="btn btn-ghost btn-xs hover:bg-base-200"
                                onClick={onClose}
                            >
                                取消
                            </button>
                            <button
                                className="btn btn-primary btn-xs"
                                onClick={() => onApply(type, value)}
                            >
                                应用
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default FilterPanel; 