import React from 'react';
import { FrameEntry } from '../../services/frameParser';
import { useSelector } from 'react-redux';
import { selectActiveFrameFile } from '../../store/slices/frameParseSlice';
import { open } from '@tauri-apps/plugin-dialog';
import { toast } from '../../context/ToastProvider';
import { exportFrames } from '../../services/frameParser';

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
            className="fixed z-50 bg-base-100 shadow-lg rounded-lg border border-base-300"
            style={{
                left: x,
                top: y,
                minWidth: '200px'
            }}
        >
            <ul className="menu p-2">
                <li>
                    <button
                        onClick={() => {
                            handleExport(true);
                            onClose();
                        }}
                        className="flex items-center px-4 py-2 hover:bg-base-200"
                    >
                        导出已过滤报文
                    </button>
                </li>
                <li>
                    <button
                        onClick={() => {
                            handleExport(false);
                            onClose();
                        }}
                        className="flex items-center px-4 py-2 hover:bg-base-200"
                    >
                        导出全部报文
                    </button>
                </li>
            </ul>
        </div>
    );
};
