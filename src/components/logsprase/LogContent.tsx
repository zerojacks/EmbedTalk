import React, { useState, useCallback, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { LogEntry } from '../../store/slices/logParseSlice';
import { VirtualLogList } from './VirtualLogList';
import { LogContextMenu } from './LogContextMenu';

interface LogContentProps {
    entries: LogEntry[];
    allEntries: LogEntry[];
}

export const LogContent: React.FC<LogContentProps> = ({ entries, allEntries }) => {
    const [contextMenu, setContextMenu] = useState<{
        show: boolean;
        x: number;
        y: number;
    }>({
        show: false,
        x: 0,
        y: 0
    });

    const handleContextMenu = useCallback((event: React.MouseEvent) => {
        event.preventDefault();
        setContextMenu({
            show: true,
            x: event.clientX,
            y: event.clientY
        });
    }, []);

    const handleCloseContextMenu = useCallback(() => {
        setContextMenu(prev => ({ ...prev, show: false }));
    }, []);

    // 点击其他地方关闭右键菜单
    useEffect(() => {
        const handleClick = () => handleCloseContextMenu();
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, [handleCloseContextMenu]);

    return (
        <div 
            className="h-full overflow-hidden relative"
            onContextMenu={handleContextMenu}
        >
            {entries.length === 0 ? (
                <div className="flex items-center justify-center h-full text-base-content/50">
                    <p>没有日志内容</p>
                </div>
            ) : (
                <VirtualLogList entries={entries} />
            )}
            <LogContextMenu
                show={contextMenu.show}
                x={contextMenu.x}
                y={contextMenu.y}
                onClose={handleCloseContextMenu}
                allEntries={allEntries}
                filteredEntries={entries}
            />
        </div>
    );
}; 