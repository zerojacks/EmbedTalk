import React from 'react';
import { FrameEntry } from '../../types/frameTypes';
import { useSelector } from 'react-redux';
import { selectActiveFrameFile } from '../../store/slices/frameParseSlice';
import { open } from '@tauri-apps/plugin-dialog';
import { toast } from '../../context/ToastProvider';
import { exportFrames } from '../../services/frameParser';
import { Filter, Package } from 'lucide-react';

interface FrameContextMenuProps {
    show: boolean;
    x: number;
    y: number;
    onClose: () => void;
    allEntries: FrameEntry[];
    filteredEntries: FrameEntry[];
}

export const FrameContextMenu: React.FC<FrameContextMenuProps> = ({
    show,
    x,
    y,
    onClose,
    allEntries,
    filteredEntries
}) => {
    const activeFile = useSelector(selectActiveFrameFile);

    const handleExport = async (useFiltered: boolean) => {
        try {
            const entries = useFiltered ? filteredEntries : allEntries;
            if (entries.length === 0) {
                toast.error('没有可导出的报文条目');
                return;
            }

            if (!activeFile) {
                toast.error('没有活动的报文文件');
                return;
            }

            // 选择导出目录
            const selectedDir = await open({
                directory: true,
                multiple: false,
                title: '选择导出目录'
            });

            if (!selectedDir) {
                return; // 用户取消了选择
            }

            // 调用导出功能
            await exportFrames({
                sourcePath: activeFile.path,
                exportDir: selectedDir,
                entries
            });

            toast.success(`成功导出 ${entries.length} 个报文条目`);
        } catch (error) {
            console.error('导出失败:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            toast.error(`导出失败: ${errorMessage}`);
        }
    };

    if (!show) return null;

    return (
        <div
            className="fixed z-50 bg-base-100 shadow-xl rounded-lg border border-base-300 backdrop-blur-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            style={{
                left: x,
                top: y,
                minWidth: '240px',
                transformOrigin: 'top left',
            }}
        >
            <div className="py-2">
                <div
                    onClick={() => {
                        handleExport(true);
                        onClose();
                    }}
                    className="group px-4 py-2.5 hover:bg-base-200 active:bg-base-300 flex items-center gap-3 cursor-pointer text-sm transition-all duration-150 select-none hover:pl-5 min-h-[36px]"
                >
                    <Filter className="w-4 h-4 flex-shrink-0 transition-transform duration-150 group-hover:scale-110 text-blue-500" />
                    <span className="flex-1 font-medium whitespace-nowrap">导出已过滤报文</span>
                    <span className="text-xs text-base-content/60 font-mono opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap">Ctrl+Shift+E</span>
                </div>
                <div
                    onClick={() => {
                        handleExport(false);
                        onClose();
                    }}
                    className="group px-4 py-2.5 hover:bg-base-200 active:bg-base-300 flex items-center gap-3 cursor-pointer text-sm transition-all duration-150 select-none hover:pl-5 min-h-[36px]"
                >
                    <Package className="w-4 h-4 flex-shrink-0 transition-transform duration-150 group-hover:scale-110 text-purple-500" />
                    <span className="flex-1 font-medium whitespace-nowrap">导出全部报文</span>
                    <span className="text-xs text-base-content/60 font-mono opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap">Ctrl+E</span>
                </div>
            </div>
        </div>
    );
};
