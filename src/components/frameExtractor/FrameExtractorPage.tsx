// src/components/frameExtractor/FrameExtractorPage.tsx
import React, { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
    clearExtractedData,
    setExportLoading,
    setDialogOpen
} from '../../store/slices/frameExtractorSlice';
import { MessageSquarePlus, Trash2, DownloadIcon } from 'lucide-react';
import { toast } from "../../context/ToastProvider";
import { FrameExtractorService } from '../../services/frameExtractorService';
import FrameTable from './FrameTable';
import MessageDialog from './MessageDialog';

const FrameExtractorPage: React.FC = () => {
    const dispatch = useAppDispatch();
    const { extractedData, ui } = useAppSelector(state => state.frameExtractor);
    const workerRef = useRef<Worker | null>(null);

    // 初始化和清理Web Worker
    useEffect(() => {
        // 创建Worker
        workerRef.current = new Worker(new URL('../../workers/excelWorker.ts', import.meta.url), { type: 'module' });

        // 设置Worker消息处理函数
        workerRef.current.onmessage = async (e) => {
            const { success, data, error } = e.data;

            if (success) {
                try {
                    // 使用服务导出Excel
                    await FrameExtractorService.exportToExcel(data);
                    toast.success("数据导出成功");
                } catch (error) {
                    console.error("保存Excel文件失败:", error);
                    toast.error(`保存Excel文件失败: ${error instanceof Error ? error.message : '未知错误'}`);
                }
            } else {
                console.error("导出Excel失败:", error);
                toast.error(`导出Excel失败: ${error}`);
            }

            dispatch(setExportLoading(false));
        };

        // 在组件卸载时终止Worker
        return () => {
            if (workerRef.current) {
                workerRef.current.terminate();
                workerRef.current = null;
            }
        };
    }, [dispatch]);

    // 导出Excel功能
    const exportToExcel = () => {
        // 判断是否有数据可供导出
        if (extractedData.length === 0) {
            toast.warning("没有数据可供导出");
            return;
        }

        // 避免重复点击
        if (ui.exportLoading) {
            return;
        }

        try {
            dispatch(setExportLoading(true));

            // 发送数据到Worker处理
            workerRef.current?.postMessage({
                rows: extractedData,
                includeChildren: true // 包含子项内容
            });

        } catch (error) {
            console.error("导出Excel失败:", error);
            toast.error("导出Excel失败");
            dispatch(setExportLoading(false));
        }
    };

    return (
        <div className="flex-1 flex flex-col min-w-0 min-h-0 p-4 bg-base-100 w-full h-full">
            {/* 顶部工具栏 */}
            <div className="flex-none flex justify-between items-center mb-4 bg-base-100 rounded-lg px-3 py-2 shadow-sm border border-base-200">
                <h1 className="text-base font-semibold">报文数据提取</h1>
                <div className="flex gap-2">
                    <button
                        className="btn btn-primary btn-sm h-8 min-h-0"
                        onClick={() => dispatch(setDialogOpen(true))}
                    >
                        <MessageSquarePlus className="w-4 h-4 mr-1" />
                        报文管理
                    </button>
                    {extractedData.length > 0 && (
                        <>
                            <button
                                className="btn btn-outline btn-error btn-sm h-8 min-h-0"
                                onClick={() => dispatch(clearExtractedData())}
                                title="清空当前解析结果"
                            >
                                <Trash2 className="w-3.5 h-3.5 mr-1" />
                                清空数据
                            </button>
                            <button
                                className={`btn btn-sm h-8 min-h-0 ${ui.exportLoading ? 'btn-disabled' : 'btn-outline'}`}
                                onClick={exportToExcel}
                                disabled={ui.exportLoading}
                            >
                                {ui.exportLoading ? (
                                    <>
                                        <span className="loading loading-spinner loading-xs mr-1"></span>
                                        导出中...
                                    </>
                                ) : (
                                    <>
                                        <DownloadIcon className="w-3.5 h-3.5 mr-1" />
                                        导出Excel
                                    </>
                                )}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* 表格部分 */}
            <div className="flex-1 min-h-0 min-w-0 w-full">
                <FrameTable />
            </div>

            {/* 报文管理对话框 */}
            <MessageDialog />
        </div>
    );
};

export default FrameExtractorPage;