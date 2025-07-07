import React, { useState, useEffect } from 'react';
import { Download } from 'lucide-react';
import { listen } from '@tauri-apps/api/event';

export interface ExportProgressDialogProps {
    onCancel: () => void;
}

export const ExportProgressDialog: React.FC<ExportProgressDialogProps> = ({ onCancel }) => {
    const [progress, setProgress] = useState<{
        total_entries: number;
        processed_entries: number;
        current_tag: string;
        percentage: number;
    } | null>(null);

    useEffect(() => {
        const unsubscribe = listen('export-progress', (event) => {
            setProgress(event.payload as any);
        });

        return () => {
            unsubscribe.then(fn => fn());
        };
    }, []);

    return (
        <div 
            className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200"
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    onCancel();
                }
            }}
        >
            <div 
                className="bg-base-100/95 backdrop-blur-sm p-6 max-w-sm w-full mx-4 rounded-xl shadow-xl border border-base-200/50 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center space-x-3 mb-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <Download className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-medium">导出进度</h3>
                </div>
                
                {progress && (
                    <div className="space-y-4">
                        <div className="w-full bg-base-200 rounded-full h-2.5">
                            <div 
                                className="bg-primary h-2.5 rounded-full transition-all duration-300" 
                                style={{ width: `${progress.percentage}%` }}
                            ></div>
                        </div>
                        <div className="text-sm space-y-1">
                            <p>当前处理: {progress.current_tag}</p>
                            <p>进度: {progress.processed_entries} / {progress.total_entries} ({progress.percentage.toFixed(1)}%)</p>
                        </div>
                    </div>
                )}
                
                <div className="mt-6 flex justify-end">
                    <button
                        className="btn btn-sm btn-ghost min-w-[5rem] hover:bg-base-200 active:scale-95 transition-all duration-200"
                        onClick={onCancel}
                    >
                        取消
                    </button>
                </div>
            </div>
        </div>
    );
}; 