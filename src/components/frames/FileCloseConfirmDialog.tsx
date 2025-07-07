import React from 'react';
import { X } from 'lucide-react';

interface FileCloseConfirmDialogProps {
    fileName: string;
    onCancel: () => void;
    onConfirm: () => void;
}

export const FileCloseConfirmDialog: React.FC<FileCloseConfirmDialogProps> = ({
    fileName,
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
                    <div className="p-2 bg-error/10 rounded-lg">
                        <X className="w-6 h-6 text-error" />
                    </div>
                    <h3 className="text-lg font-medium">确认关闭文件</h3>
                </div>

                <p className="text-base-content/70 mb-6 ml-10">
                    是否要关闭文件 "{fileName}"？
                </p>

                <div className="flex justify-end space-x-3">
                    <button
                        className="btn btn-sm btn-ghost min-w-[5rem] hover:bg-base-200 active:scale-95 transition-all duration-200"
                        onClick={onCancel}
                    >
                        取消
                    </button>
                    <button
                        className="btn btn-sm btn-error min-w-[5rem] hover:bg-error/90 active:scale-95 transition-all duration-200"
                        onClick={onConfirm}
                    >
                        关闭
                    </button>
                </div>
            </div>
        </div>
    );
}; 