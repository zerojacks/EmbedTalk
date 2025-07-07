import React from 'react';
import { Download } from 'lucide-react';

interface ExportDialogProps {
    onCancel: () => void;
    onConfirm: (exportAll: boolean) => void;
}

export const ExportDialog: React.FC<ExportDialogProps> = ({
    onCancel,
    onConfirm
}) => {
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
                    <h3 className="text-lg font-medium">导出报文数据</h3>
                </div>
                
                <p className="text-base-content/70 mb-6">
                    请选择要导出的数据范围：
                </p>

                <div className="flex justify-end space-x-3">
                    <button
                        className="btn btn-sm btn-ghost min-w-[5rem] hover:bg-base-200 active:scale-95 transition-all duration-200"
                        onClick={onCancel}
                    >
                        取消
                    </button>
                    <button
                        className="btn btn-sm btn-primary min-w-[5rem] hover:bg-primary/90 active:scale-95 transition-all duration-200"
                        onClick={() => onConfirm(false)}
                    >
                        导出当前
                    </button>
                    {/* <button
                        className="btn btn-sm btn-primary min-w-[5rem] hover:bg-primary/90 active:scale-95 transition-all duration-200"
                        onClick={() => onConfirm(true)}
                    >
                        导出全部
                    </button> */}
                </div>
            </div>
        </div>
    );
}; 