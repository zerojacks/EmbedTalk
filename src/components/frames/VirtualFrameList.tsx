import React, { useEffect, useRef, useState, useMemo } from 'react';
import { FrameEntry } from '../../services/frameParser';
import { useVirtualizer } from '@tanstack/react-virtual';

interface VirtualFrameListProps {
    entries: FrameEntry[];
}

export const VirtualFrameList: React.FC<VirtualFrameListProps> = ({ entries }) => {
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

    // 根据容器宽度计算列宽 - 优化版本，减少列间距
    const columnWidths = useMemo(() => {
        const minTimeWidth = 160;  // 减少时间列宽度
        const minPidWidth = 40;    // 减少PID列宽度
        const minTagWidth = 80;    // 减少标签列宽度
        const minPortWidth = 90;   // 减少端口列宽度
        const minProtocolWidth = 60; // 减少协议列宽度
        const minDirectionWidth = 50; // 减少方向列宽度
        const padding = 24;        // 减少总体padding

        if (parentWidth < 800) {
            return {
                time: minTimeWidth,
                pid: minPidWidth,
                tag: 0,
                port: 0,
                protocol: 0,
                direction: minDirectionWidth,
                content: Math.max(200, parentWidth - minTimeWidth - minPidWidth - minDirectionWidth - padding)
            };
        }

        // 使用更紧凑的列宽分配
        const timeWidth = Math.min(170, Math.max(minTimeWidth, parentWidth * 0.15));  // 减少时间列比例
        const pidWidth = Math.min(45, Math.max(minPidWidth, parentWidth * 0.04));     // 减少PID列比例
        const tagWidth = Math.min(100, Math.max(minTagWidth, parentWidth * 0.08));    // 减少标签列比例
        const portWidth = Math.min(110, Math.max(minPortWidth, parentWidth * 0.09));  // 减少端口列比例
        const protocolWidth = Math.min(80, Math.max(minProtocolWidth, parentWidth * 0.06)); // 减少协议列比例
        const directionWidth = Math.min(60, Math.max(minDirectionWidth, parentWidth * 0.05)); // 减少方向列比例
        const contentWidth = Math.max(300, parentWidth - timeWidth - pidWidth - tagWidth - portWidth - protocolWidth - directionWidth - padding);

        return {
            time: timeWidth,
            pid: pidWidth,
            tag: tagWidth,
            port: portWidth,
            protocol: protocolWidth,
            direction: directionWidth,
            content: contentWidth
        };
    }, [parentWidth]);

    // 估算行高
    const estimateSize = (index: number) => {
        const cachedHeight = rowHeights.get(index);
        if (cachedHeight) return cachedHeight;

        const entry = entries[index];
        if (!entry) return 32;

        const contentLength = (entry.content || '').length;
        const charsPerLine = Math.floor(columnWidths.content / 8); // 假设每个字符平均8px宽（等宽字体）
        const estimatedLines = Math.ceil(contentLength / charsPerLine);
        
        return Math.max(32, estimatedLines * 20 + 12); // 每行20px，加上padding
    };

    const rowVirtualizer = useVirtualizer({
        count: entries.length,
        getScrollElement: () => parentRef.current,
        estimateSize,
        overscan: 10,
        measureElement: (element: Element) => {
            const height = element.getBoundingClientRect().height;
            const index = Number((element as HTMLElement).getAttribute('data-index'));
            if (!rowHeights.has(index) || rowHeights.get(index) !== height) {
                setRowHeights(prev => new Map(prev).set(index, height));
            }
            return height;
        },
    });

    // 表头组件
    const TableHeader = () => (
        <div className="sticky top-0 z-10 bg-base-100 border-b border-base-300 flex items-center min-h-[36px] px-1 text-xs font-medium text-base-content/80">
            <div
                className="flex-shrink-0 text-left pr-2"
                style={{ width: columnWidths.time }}
            >
                时间戳
            </div>
            <div
                className="flex-shrink-0 text-center pr-2"
                style={{ width: columnWidths.pid }}
            >
                PID
            </div>
            {columnWidths.tag > 0 && (
                <div
                    className="flex-shrink-0 text-center pr-2"
                    style={{ width: columnWidths.tag }}
                >
                    标签
                </div>
            )}
            {columnWidths.port > 0 && (
                <div
                    className="flex-shrink-0 text-center pr-2"
                    style={{ width: columnWidths.port }}
                >
                    端口
                </div>
            )}
            {columnWidths.protocol > 0 && (
                <div
                    className="flex-shrink-0 text-center pr-2"
                    style={{ width: columnWidths.protocol }}
                >
                    协议
                </div>
            )}
            <div
                className="flex-shrink-0 text-center pr-2"
                style={{ width: columnWidths.direction }}
            >
                方向
            </div>
            <div className="flex-1 text-left">
                内容
            </div>
        </div>
    );

    return (
        <div 
            ref={parentRef}
            className="h-full overflow-auto"
            style={{ contain: 'strict' }}
        >
            <TableHeader />
            <div
                style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative'
                }}
            >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const entry = entries[virtualRow.index];
                    const tagName = entry.tag_name ? `${entry.tag}:${entry.tag_name}` : entry.tag.toString();
                    const portName = entry.port_name ? `${entry.port}:${entry.port_name}` : entry.port.toString();
                    const protocolName = entry.protocol_name ? `${entry.protocol}:${entry.protocol_name}` : entry.protocol.toString();
                    const directionName = entry.direction_name || entry.direction.toString();

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
                            className="flex items-center min-h-[30px] px-1 hover:bg-base-200/30 border-b border-base-200/50 min-w-0"
                        >
                            <div
                                className="flex-shrink-0 text-xs font-mono text-base-content/70 truncate pr-2"
                                style={{ width: columnWidths.time }}
                                title={entry.timestamp}
                            >
                                {entry.timestamp}
                            </div>
                            <div
                                className="flex-shrink-0 text-xs text-center text-base-content/70 pr-2"
                                style={{ width: columnWidths.pid }}
                            >
                                {entry.pid}
                            </div>
                            {columnWidths.tag > 0 && (
                                <div
                                    className="flex-shrink-0 text-xs text-center text-base-content/70 truncate pr-2"
                                    style={{ width: columnWidths.tag }}
                                    title={tagName}
                                >
                                    {tagName}
                                </div>
                            )}
                            {columnWidths.port > 0 && (
                                <div
                                    className="flex-shrink-0 text-xs text-center text-base-content/70 truncate pr-2"
                                    style={{ width: columnWidths.port }}
                                    title={portName}
                                >
                                    {portName}
                                </div>
                            )}
                            {columnWidths.protocol > 0 && (
                                <div
                                    className="flex-shrink-0 text-xs text-center text-base-content/70 truncate pr-2"
                                    style={{ width: columnWidths.protocol }}
                                    title={protocolName}
                                >
                                    {protocolName}
                                </div>
                            )}
                            <div
                                className={`flex-shrink-0 text-xs text-center pr-2 ${entry.direction === 0 ? 'text-info' : 'text-success'}`}
                                style={{ width: columnWidths.direction }}
                            >
                                {directionName}
                            </div>
                            <div 
                                className="flex-1 text-xs text-base-content min-w-0 font-mono"
                                style={{ 
                                    maxWidth: columnWidths.content,
                                    wordBreak: 'break-all',
                                    whiteSpace: 'pre-wrap',
                                    overflowWrap: 'break-word'
                                }}
                                title={entry.content}
                            >
                                <div className="pl-2 py-1">
                                    {entry.content}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
