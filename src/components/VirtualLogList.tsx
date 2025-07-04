import React, { useEffect, useRef, useState, useMemo } from 'react';
import { LogEntry } from '../store/slices/logParseSlice';
import { useVirtualizer } from '@tanstack/react-virtual';

interface VirtualLogListProps {
    entries: LogEntry[];
}

export const VirtualLogList: React.FC<VirtualLogListProps> = ({ entries }) => {
    const parentRef = useRef<HTMLDivElement>(null);
    const [parentWidth, setParentWidth] = useState(0);
    const [rowHeights, setRowHeights] = useState<Map<number, number>>(new Map());
    
    // 创建一个 ResizeObserver 来监听容器大小变化
    useEffect(() => {
        if (!parentRef.current) return;
        
        const resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
                const { width } = entry.contentRect;
                if (width !== parentWidth) {
                    setParentWidth(width);
                    // 当宽度改变时，清除已缓存的行高
                    setRowHeights(new Map());
                }
            }
        });
        
        resizeObserver.observe(parentRef.current);
        return () => resizeObserver.disconnect();
    }, [parentWidth]);

    // 根据容器宽度计算列宽
    const columnWidths = useMemo(() => {
        const minTimeWidth = 120;
        const minLevelWidth = 60;
        const minTagWidth = 80;
        const minPidTidWidth = 120;
        const padding = 32;
        
        if (parentWidth < 500) {
            return {
                time: minTimeWidth,
                level: minLevelWidth,
                tag: 0,
                pidTid: 0,
                message: Math.max(200, parentWidth - minTimeWidth - minLevelWidth - padding)
            };
        }
        
        const timeWidth = Math.min(176, Math.max(minTimeWidth, parentWidth * 0.15));
        const levelWidth = Math.min(64, Math.max(minLevelWidth, parentWidth * 0.08));
        const tagWidth = Math.min(128, Math.max(minTagWidth, parentWidth * 0.12));
        const pidTidWidth = Math.min(140, Math.max(minPidTidWidth, parentWidth * 0.12));
        const messageWidth = Math.max(300, parentWidth - timeWidth - levelWidth - tagWidth - pidTidWidth - padding);
        
        return {
            time: timeWidth,
            level: levelWidth,
            tag: tagWidth,
            pidTid: pidTidWidth,
            message: messageWidth
        };
    }, [parentWidth]);

    // 估算行高
    const estimateSize = (index: number) => {
        const cachedHeight = rowHeights.get(index);
        if (cachedHeight) return cachedHeight;

        const entry = entries[index];
        if (!entry) return 24;

        const messageLength = (entry.message || entry.rawData || '').length;
        const charsPerLine = Math.floor(columnWidths.message / 6); // 假设每个字符平均6px宽
        const estimatedLines = Math.ceil(messageLength / charsPerLine);
        
        return Math.max(24, estimatedLines * 20); // 每行20px，最小高度24px
    };

    const rowVirtualizer = useVirtualizer({
        count: entries.length,
        getScrollElement: () => parentRef.current,
        estimateSize,
        overscan: 5,
        measureElement: (element: Element) => {
            const height = element.getBoundingClientRect().height;
            const index = Number((element as HTMLElement).getAttribute('data-index'));
            if (!rowHeights.has(index) || rowHeights.get(index) !== height) {
                setRowHeights(prev => new Map(prev).set(index, height));
            }
            return height;
        },
    });

    return (
        <div 
            ref={parentRef}
            className="h-full overflow-auto"
            style={{ contain: 'strict' }}
        >
            <div
                style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative'
                }}
            >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const entry = entries[virtualRow.index];
                    const pidTid = (entry.pid || entry.tid) ? `[pid:${entry.pid || '-'} tid:${entry.tid || '-'}]` : '';
                    const funcLine = (entry.func && entry.line) ? `${entry.func}:${entry.line}` : '';
                    const message = entry.message || entry.rawData;
                    const fullMessage = funcLine ? `${funcLine} ${message}` : message;

                    return (
                        <div
                            key={virtualRow.index}
                            data-index={virtualRow.index}
                            ref={rowVirtualizer.measureElement}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                transform: `translateY(${virtualRow.start}px)`,
                            }}
                            className="flex items-center min-h-[32px] px-2 hover:bg-base-200 min-w-0"
                        >
                            <div 
                                className="flex-shrink-0 text-xs font-mono text-base-content/70 truncate"
                                style={{ width: columnWidths.time }}
                                title={entry.timeStamp}
                            >
                                {entry.timeStamp}
                            </div>
                            <div 
                                className="flex-shrink-0 text-xs px-1 flex items-center"
                                style={{ width: columnWidths.level }}
                            >
                                <span className={`
                                    inline-block px-1.5 py-0.5 rounded-full text-center w-full
                                    ${entry.level === 'ERROR' ? 'bg-error/10 text-error' :
                                      entry.level === 'WARN' ? 'bg-warning/10 text-warning' :
                                      entry.level === 'INFO' ? 'bg-info/10 text-info' :
                                      'bg-base-200 text-base-content/70'}
                                `}>
                                    {entry.level}
                                </span>
                            </div>
                            {columnWidths.tag > 0 && (
                                <div 
                                    className="flex-shrink-0 text-xs text-base-content/70 truncate px-1"
                                    style={{ width: columnWidths.tag }}
                                    title={entry.tag}
                                >
                                    {entry.tag}
                                </div>
                            )}
                            {columnWidths.pidTid > 0 && (
                                <div 
                                    className="flex-shrink-0 text-xs text-base-content/70 truncate px-1"
                                    style={{ width: columnWidths.pidTid }}
                                    title={pidTid}
                                >
                                    {pidTid}
                                </div>
                            )}
                            <div 
                                className="flex-1 text-xs text-base-content min-w-0 pl-0"
                                style={{ 
                                    maxWidth: columnWidths.message,
                                    wordBreak: 'break-all',
                                    whiteSpace: 'pre-wrap',
                                    overflowWrap: 'break-word',
                                    paddingLeft: '0'
                                }}
                                title={fullMessage}
                            >
                                <div className="pl-2 py-1">
                                    {fullMessage}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}; 