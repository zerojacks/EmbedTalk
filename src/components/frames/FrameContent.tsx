import React, { useState, useCallback, useEffect } from 'react';
import { FrameEntry } from '../../services/frameParser';
import { VirtualFrameList } from './VirtualFrameList';
import { FrameContextMenu } from './FrameContextMenu';

interface FrameContentProps {
    entries: FrameEntry[];
    allEntries: FrameEntry[];
    height?: number;
}

export const FrameContent: React.FC<FrameContentProps> = ({
    entries,
    allEntries,
    height = window.innerHeight - 200
}) => {
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
                    <p>没有报文数据</p>
                </div>
            ) : (
                <VirtualFrameList entries={entries} />
            )}
            <FrameContextMenu
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