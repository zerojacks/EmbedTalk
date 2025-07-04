import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { setLogFilter, selectActiveLogFilePath, selectLogFilter } from '../store/slices/logParseSlice';

interface LogFilterProps {
    availableTags: string[];
}

export const LogFilter: React.FC<LogFilterProps> = ({ availableTags }) => {
    const dispatch = useDispatch();
    const activeFilePath = useSelector(selectActiveLogFilePath);
    const filter = useSelector((state: RootState) => 
        activeFilePath ? selectLogFilter(state, activeFilePath) : {});

    // 格式化时间为本地datetime-local格式
    const formatDateTimeLocal = (isoString?: string) => {
        if (!isoString) return '';
        const date = new Date(isoString);
        return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 19);
    };

    const handleFilterChange = (field: string, value: string) => {
        if (!activeFilePath) return;
        
        dispatch(setLogFilter({
            path: activeFilePath,
            filter: {
                ...filter,
                [field]: value || undefined
            }
        }));
    };

    if (!activeFilePath) return null;

    return (
        <div className="p-2 bg-base-200/50 border-b border-base-300 flex flex-wrap gap-2 items-center">
            <div className="flex items-center gap-2">
                <label className="text-xs font-medium">级别:</label>
                <select
                    className="select select-sm select-bordered w-24"
                    value={filter.level || ''}
                    onChange={(e) => handleFilterChange('level', e.target.value)}
                >
                    <option value="">全部</option>
                    <option value="ERROR">ERROR</option>
                    <option value="WARN">WARN</option>
                    <option value="INFO">INFO</option>
                    <option value="DEBUG">DEBUG</option>
                </select>
            </div>

            <div className="flex items-center gap-2">
                <label className="text-xs font-medium">标签:</label>
                <select
                    className="select select-sm select-bordered w-32"
                    value={filter.tag || ''}
                    onChange={(e) => handleFilterChange('tag', e.target.value)}
                >
                    <option value="">全部</option>
                    {availableTags.map(tag => (
                        <option key={tag} value={tag}>{tag}</option>
                    ))}
                </select>
            </div>

            <div className="flex items-center gap-2">
                <label className="text-xs font-medium">PID:</label>
                <input
                    type="text"
                    className="input input-sm input-bordered w-24"
                    value={filter.pid || ''}
                    onChange={(e) => handleFilterChange('pid', e.target.value)}
                    placeholder="进程ID"
                />
            </div>

            <div className="flex items-center gap-2">
                <label className="text-xs font-medium">TID:</label>
                <input
                    type="text"
                    className="input input-sm input-bordered w-24"
                    value={filter.tid || ''}
                    onChange={(e) => handleFilterChange('tid', e.target.value)}
                    placeholder="线程ID"
                />
            </div>

            <div className="flex items-center gap-2">
                <label className="text-xs font-medium">关键字:</label>
                <input
                    type="text"
                    className="input input-sm input-bordered w-40"
                    value={filter.keyword || ''}
                    onChange={(e) => handleFilterChange('keyword', e.target.value)}
                    placeholder="搜索关键字"
                />
            </div>

            <div className="flex items-center gap-2">
                <label className="text-xs font-medium">时间范围:</label>
                <input
                    type="datetime-local"
                    className="input input-sm input-bordered w-52"
                    value={formatDateTimeLocal(filter.startTime)}
                    onChange={(e) => {
                        const date = e.target.value;
                        if (date) {
                            handleFilterChange('startTime', new Date(date).toISOString());
                        } else {
                            handleFilterChange('startTime', '');
                        }
                    }}
                />
                <span className="text-xs">至</span>
                <input
                    type="datetime-local"
                    className="input input-sm input-bordered w-52"
                    value={formatDateTimeLocal(filter.endTime)}
                    onChange={(e) => {
                        const date = e.target.value;
                        if (date) {
                            handleFilterChange('endTime', new Date(date).toISOString());
                        } else {
                            handleFilterChange('endTime', '');
                        }
                    }}
                />
            </div>
        </div>
    );
}; 