import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import {
    setFrameFilter,
    selectActiveFrameFilePath,
    selectFrameFileContents
} from '../../store/slices/frameParseSlice';
import { FrameDirection } from '../../types/frameTypes';
import { getDirectionName, getRecordTypeName, getPortName, getProtocolName } from '../../utils/frameUtils';

interface FrameFilterProps {
    availablePids: number[];
    availableTags: number[];
    availablePorts: number[];
    availableProtocols: number[];
}

export const FrameFilter: React.FC<FrameFilterProps> = ({
    availablePids,
    availableTags,
    availablePorts,
    availableProtocols
}) => {
    const dispatch = useDispatch();
    const activeFilePath = useSelector(selectActiveFrameFilePath);

    // 为当前活动文件获取过滤器
    const filter = useSelector((state: RootState) => {
        if (!activeFilePath || !state.frameParse?.fileContents?.[activeFilePath]) {
            return {
                pid: null,
                tag: null,
                port: null,
                protocol: null,
                direction: null,
                startTime: null,
                endTime: null,
                contentKeyword: null
            };
        }
        return state.frameParse.fileContents[activeFilePath].filters || {
            pid: null,
            tag: null,
            port: null,
            protocol: null,
            direction: null,
            startTime: null,
            endTime: null,
            contentKeyword: null
        };
    });
    const fileContents = useSelector((state: RootState) =>
        activeFilePath ? selectFrameFileContents(state, activeFilePath) : null);

    // 格式化时间为本地datetime-local格式（去掉毫秒）
    const formatDateTimeLocal = (isoString?: string) => {
        if (!isoString) return '';
        const date = new Date(isoString);
        return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 19);
    };

    // 初始化时间范围 - 当文件内容加载完成且过滤器的时间范围为空时
    useEffect(() => {
        if (!activeFilePath || !fileContents || !fileContents.filters || filter.startTime || filter.endTime) {
            return;
        }

        const { minTime, maxTime } = fileContents.filters;
        if (minTime && maxTime) {
            // 设置初始时间范围，将ISO时间转换为本地datetime-local格式
            const startTimeLocal = formatDateTimeLocal(minTime);
            const endTimeLocal = formatDateTimeLocal(maxTime);

            dispatch(setFrameFilter({
                path: activeFilePath,
                filter: {
                    startTime: startTimeLocal,
                    endTime: endTimeLocal
                }
            }));
        }
    }, [fileContents, filter.startTime, filter.endTime, activeFilePath, dispatch]);

    // 如果没有活动文件路径，在所有hooks调用之后再返回null
    if (!activeFilePath) return null;

    const handlePidChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const pid = e.target.value ? parseInt(e.target.value) : null;
        dispatch(setFrameFilter({
            path: activeFilePath,
            filter: { pid }
        }));
    };

    const handleTagChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const tag = e.target.value ? parseInt(e.target.value) : null;
        dispatch(setFrameFilter({
            path: activeFilePath,
            filter: { tag }
        }));
    };

    const handlePortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const port = e.target.value ? parseInt(e.target.value) : null;
        dispatch(setFrameFilter({
            path: activeFilePath,
            filter: { port }
        }));
    };

    const handleProtocolChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const protocol = e.target.value ? parseInt(e.target.value) : null;
        dispatch(setFrameFilter({
            path: activeFilePath,
            filter: { protocol }
        }));
    };

    const handleDirectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const direction = e.target.value ? parseInt(e.target.value) : null;
        dispatch(setFrameFilter({
            path: activeFilePath,
            filter: { direction }
        }));
    };

    const handleStartTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const date = e.target.value;
        if (date) {
            // 将本地时间转换为ISO字符串，但保持为本地时间格式用于显示
            dispatch(setFrameFilter({
                path: activeFilePath,
                filter: { startTime: date }
            }));
        } else {
            dispatch(setFrameFilter({
                path: activeFilePath,
                filter: { startTime: null }
            }));
        }
    };

    const handleEndTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const date = e.target.value;
        if (date) {
            // 将本地时间转换为ISO字符串，但保持为本地时间格式用于显示
            dispatch(setFrameFilter({
                path: activeFilePath,
                filter: { endTime: date }
            }));
        } else {
            dispatch(setFrameFilter({
                path: activeFilePath,
                filter: { endTime: null }
            }));
        }
    };

    const handleContentKeywordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const contentKeyword = e.target.value || null;
        dispatch(setFrameFilter({
            path: activeFilePath,
            filter: { contentKeyword }
        }));
    };

    const handleResetTimeRange = () => {
        if (fileContents && fileContents.filters) {
            const { minTime, maxTime } = fileContents.filters;
            if (minTime && maxTime) {
                const startTimeLocal = formatDateTimeLocal(minTime);
                const endTimeLocal = formatDateTimeLocal(maxTime);

                dispatch(setFrameFilter({
                    path: activeFilePath,
                    filter: {
                        startTime: startTimeLocal,
                        endTime: endTimeLocal
                    }
                }));
            }
        }
    };

    const handleResetAllFilters = () => {
        if (fileContents && fileContents.filters) {
            const { minTime, maxTime } = fileContents.filters;
            const startTimeLocal = minTime ? formatDateTimeLocal(minTime) : null;
            const endTimeLocal = maxTime ? formatDateTimeLocal(maxTime) : null;

            dispatch(setFrameFilter({
                path: activeFilePath,
                filter: {
                    pid: null,
                    tag: null,
                    port: null,
                    protocol: null,
                    direction: null,
                    contentKeyword: null,
                    startTime: startTimeLocal,
                    endTime: endTimeLocal
                }
            }));
        }
    };

    return (
        <div className="flex flex-wrap gap-2 p-2 bg-base-200/50 border-b border-base-300">
            <div className="w-full flex flex-wrap gap-2">
                <div className="flex-none w-[120px] flex items-center">
                    <label className="text-xs mr-1 whitespace-nowrap">PID:</label>
                    <select
                        className="select select-xs select-bordered w-full"
                        value={filter.pid?.toString() || ''}
                        onChange={handlePidChange}
                    >
                        <option value="">全部</option>
                        {availablePids.map(pid => (
                            <option key={pid} value={pid}>{pid}</option>
                        ))}
                    </select>
                </div>

                <div className="flex-none w-[120px] flex items-center">
                    <label className="text-xs mr-1 whitespace-nowrap">标签:</label>
                    <select
                        className="select select-xs select-bordered w-full"
                        value={filter.tag?.toString() || ''}
                        onChange={handleTagChange}
                    >
                        <option value="">全部</option>
                        {availableTags.map(tag => (
                            <option key={tag} value={tag}>{tag} - {getRecordTypeName(tag)}</option>
                        ))}
                    </select>
                </div>

                <div className="flex-none w-[120px] flex items-center">
                    <label className="text-xs mr-1 whitespace-nowrap">端口:</label>
                    <select
                        className="select select-xs select-bordered w-full"
                        value={filter.port?.toString() || ''}
                        onChange={handlePortChange}
                    >
                        <option value="">全部</option>
                        {availablePorts.map(port => (
                            <option key={port} value={port}>{port} - {getPortName(port)}</option>
                        ))}
                    </select>
                </div>

                <div className="flex-none w-[120px] flex items-center">
                    <label className="text-xs mr-1 whitespace-nowrap">协议:</label>
                    <select
                        className="select select-xs select-bordered w-full"
                        value={filter.protocol?.toString() || ''}
                        onChange={handleProtocolChange}
                    >
                        <option value="">全部</option>
                        {availableProtocols.map(protocol => (
                            <option key={protocol} value={protocol}>{protocol} - {getProtocolName(protocol)}</option>
                        ))}
                    </select>
                </div>

                <div className="flex-none w-[150px] flex items-center">
                    <label className="text-xs mr-1 whitespace-nowrap">方向:</label>
                    <select
                        className="select select-xs select-bordered w-full"
                        value={filter.direction?.toString() || ''}
                        onChange={handleDirectionChange}
                    >
                        <option value="">全部</option>
                        <option value={FrameDirection.IN}>{getDirectionName(FrameDirection.IN)}</option>
                        <option value={FrameDirection.OUT}>{getDirectionName(FrameDirection.OUT)}</option>
                    </select>
                </div>

                <div className="flex-1 min-w-[200px] max-w-[300px] flex items-center">
                    <label className="text-xs mr-1 whitespace-nowrap">内容:</label>
                    <input
                        type="text"
                        className="input input-xs input-bordered w-full"
                        placeholder="搜索内容关键字..."
                        value={filter.contentKeyword || ''}
                        onChange={handleContentKeywordChange}
                    />
                </div>
            </div>

            <div className="w-full flex flex-wrap gap-2 items-center">
                <div className="flex-1 min-w-[250px] max-w-[400px] flex items-center">
                    <label className="text-xs mr-1 whitespace-nowrap">开始时间:</label>
                    <input
                        type="datetime-local"
                        className="input input-xs input-bordered w-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50"
                        value={filter.startTime || ''}
                        onChange={handleStartTimeChange}
                        min={fileContents?.filters?.minTime ? formatDateTimeLocal(fileContents.filters.minTime) : undefined}
                        max={fileContents?.filters?.maxTime ? formatDateTimeLocal(fileContents.filters.maxTime) : undefined}
                        step="1"
                        style={{
                            padding: '0.25rem',
                            fontSize: '12px',
                            lineHeight: '1.5',
                        }}
                    />
                </div>

                <div className="flex-1 min-w-[250px] max-w-[400px] flex items-center">
                    <label className="text-xs mr-1 whitespace-nowrap">结束时间:</label>
                    <input
                        type="datetime-local"
                        className="input input-xs input-bordered w-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50"
                        value={filter.endTime || ''}
                        onChange={handleEndTimeChange}
                        min={fileContents?.filters?.minTime ? formatDateTimeLocal(fileContents.filters.minTime) : undefined}
                        max={fileContents?.filters?.maxTime ? formatDateTimeLocal(fileContents.filters.maxTime) : undefined}
                        step="1"
                        style={{
                            padding: '0.25rem',
                            fontSize: '12px',
                            lineHeight: '1.5',
                        }}
                    />
                </div>

                <div className="flex items-center space-x-2">
                    <button
                        className="btn btn-xs btn-outline"
                        onClick={handleResetTimeRange}
                    >
                        重置时间范围
                    </button>
                    <button
                        className="btn btn-xs btn-outline btn-warning"
                        onClick={handleResetAllFilters}
                    >
                        清除所有过滤器
                    </button>
                </div>
            </div>
        </div>
    );
}; 