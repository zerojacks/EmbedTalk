import React from 'react';
import { ChevronDown, ChevronRight, FileDown } from 'lucide-react';

interface ContextMenuProps {
    x: number;
    y: number;
    onClose: () => void;
    onExpandAll: () => void;
    onCollapseAll: () => void;
    onExportSelected: () => void;
    hasSelectedRows: boolean;
}

const ContextMenu: React.FC<ContextMenuProps> = ({
    x,
    y,
    onClose,
    onExpandAll,
    onCollapseAll,
    onExportSelected,
    hasSelectedRows
}) => {
    const menuRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    // 确保菜单不会超出视窗
    const adjustPosition = () => {
        if (!menuRef.current) return { x, y };
        
        const rect = menuRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        let adjustedX = x;
        let adjustedY = y;
        
        if (x + rect.width > viewportWidth) {
            adjustedX = viewportWidth - rect.width;
        }
        
        if (y + rect.height > viewportHeight) {
            adjustedY = viewportHeight - rect.height;
        }
        
        return { x: adjustedX, y: adjustedY };
    };

    const position = adjustPosition();

    return (
        <div
            ref={menuRef}
            className="fixed z-50 min-w-[160px] bg-base-100 shadow-lg rounded-lg border border-base-300 py-1"
            style={{
                left: position.x,
                top: position.y
            }}
        >
            <button
                className="w-full px-4 py-1.5 text-sm hover:bg-base-200 flex items-center gap-2"
                onClick={onExpandAll}
            >
                <ChevronDown className="w-4 h-4" />
                展开全部
            </button>
            <button
                className="w-full px-4 py-1.5 text-sm hover:bg-base-200 flex items-center gap-2"
                onClick={onCollapseAll}
            >
                <ChevronRight className="w-4 h-4" />
                折叠全部
            </button>
            {hasSelectedRows && (
                <>
                    <div className="my-1 border-t border-base-200" />
                    <button
                        className="w-full px-4 py-1.5 text-sm hover:bg-base-200 flex items-center gap-2"
                        onClick={onExportSelected}
                    >
                        <FileDown className="w-4 h-4" />
                        导出选中项
                    </button>
                </>
            )}
        </div>
    );
};

export default ContextMenu; 