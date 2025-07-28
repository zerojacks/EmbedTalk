import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { setLogFilter, selectActiveLogFilePath, selectLogFilter, selectLogFileContents } from '../../store/slices/logParseSlice';

interface LogFilterProps {
    availableTags: string[];
}

export const LogFilter: React.FC<LogFilterProps> = ({ availableTags }) => {
    const dispatch = useDispatch();
    const activeFilePath = useSelector(selectActiveLogFilePath);

    // 使用useSelector正确订阅Redux状态变化
    const filter = useSelector((state: RootState) =>
        activeFilePath ? selectLogFilter(state, activeFilePath) : {}
    );

    // 获取文件内容以获取minTime和maxTime
    const fileContents = useSelector((state: RootState) =>
        activeFilePath ? selectLogFileContents(state, activeFilePath) : null
    );

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

    // 重置时间范围到文件的最小和最大时间
    const handleResetTimeRange = () => {
        if (!activeFilePath || !fileContents) return;

        const { minTime, maxTime } = fileContents;
        if (minTime && maxTime) {
            dispatch(setLogFilter({
                path: activeFilePath,
                filter: {
                    ...filter,
                    startTime: minTime,
                    endTime: maxTime
                }
            }));
        }
    };

    // 清除所有过滤器，但保持时间范围为文件的最小和最大时间
    const handleResetAllFilters = () => {
        if (!activeFilePath || !fileContents) return;

        const { minTime, maxTime } = fileContents;

        dispatch(setLogFilter({
            path: activeFilePath,
            filter: {
                level: undefined,
                tag: undefined,
                pid: undefined,
                tid: undefined,
                keyword: undefined,
                startTime: minTime || undefined,
                endTime: maxTime || undefined
            }
        }));
    };

    if (!activeFilePath) return null;

    return (
        <div className="p-2 bg-base-200/50 border-b border-base-300">
            {/* 第一行：基本过滤条件 */}
            <div className="flex flex-wrap gap-2 items-center mb-2">
                <div className="flex items-center gap-1">
                    <label className="text-xs font-medium whitespace-nowrap">级别:</label>
                    <select
                        className="select select-xs select-bordered w-20"
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

                <div className="flex items-center gap-1">
                    <label className="text-xs font-medium whitespace-nowrap">标签:</label>
                    <select
                        className="select select-xs select-bordered w-28"
                        value={filter.tag || ''}
                        onChange={(e) => handleFilterChange('tag', e.target.value)}
                    >
                        <option value="">全部</option>
                        {availableTags.map(tag => (
                            <option key={tag} value={tag}>{tag}</option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-1">
                    <label className="text-xs font-medium whitespace-nowrap">PID:</label>
                    <input
                        type="text"
                        className="input input-xs input-bordered w-20"
                        value={filter.pid || ''}
                        onChange={(e) => handleFilterChange('pid', e.target.value)}
                        placeholder="进程ID"
                    />
                </div>

                <div className="flex items-center gap-1">
                    <label className="text-xs font-medium whitespace-nowrap">TID:</label>
                    <input
                        type="text"
                        className="input input-xs input-bordered w-20"
                        value={filter.tid || ''}
                        onChange={(e) => handleFilterChange('tid', e.target.value)}
                        placeholder="线程ID"
                    />
                </div>

                <div className="flex items-center gap-1">
                    <label className="text-xs font-medium whitespace-nowrap">关键字:</label>
                    <input
                        type="text"
                        className="input input-xs input-bordered w-96"
                        value={filter.keyword || ''}
                        onChange={(e) => handleFilterChange('keyword', e.target.value)}
                        placeholder="搜索关键字"
                    />
                </div>
            </div>

            {/* 第二行：时间范围和操作按钮 */}
            <div className="flex flex-wrap gap-2 items-center">
                <div className="flex items-center gap-1">
                    <label className="text-xs font-medium whitespace-nowrap">时间范围:</label>
                    <input
                        type="datetime-local"
                        className="input input-xs input-bordered w-44"
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
                    <span className="text-xs text-base-content/60">至</span>
                    <input
                        type="datetime-local"
                        className="input input-xs input-bordered w-44"
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

                    <button
                        className="btn btn-xs btn-outline ml-2"
                        onClick={handleResetTimeRange}
                        title="重置时间范围到文件的最小和最大时间"
                    >
                        重置时间范围
                    </button>
                    <button
                        className="btn btn-xs btn-outline btn-warning"
                        onClick={handleResetAllFilters}
                        title="清除所有过滤器并重置时间范围"
                    >
                        清除所有过滤器
                    </button>
                </div>
            </div>
        </div>
    );
}; 