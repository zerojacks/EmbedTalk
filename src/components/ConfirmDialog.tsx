import React from 'react';

type DialogType = 'info' | 'warning' | 'error' | 'success' | 'confirm';

interface ConfirmDialogProps {
    title: string;
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    type?: DialogType;
    confirmText?: string;
    cancelText?: string;
}

const DialogIcons = {
    info: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
    ),
    warning: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
    ),
    error: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
    ),
    success: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
    ),
    confirm: (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
    )
};

const DialogStyles = {
    info: {
        icon: 'text-primary bg-primary/10',
        button: 'btn-primary'
    },
    warning: {
        icon: 'text-warning bg-warning/10',
        button: 'btn-warning'
    },
    error: {
        icon: 'text-error bg-error/10',
        button: 'btn-error'
    },
    success: {
        icon: 'text-success bg-success/10',
        button: 'btn-success'
    },
    confirm: {
        icon: 'text-primary bg-primary/10',
        button: 'btn-primary'
    }
};

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    title,
    isOpen,
    onClose,
    onConfirm,
    type = 'confirm',
    confirmText = '确定',
    cancelText = '取消'
}) => {
    if (!isOpen) return null;

    const style = DialogStyles[type];

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[3000]">
            <div className="bg-base-100 rounded-lg shadow-xl p-6 w-[400px] max-w-[90vw]">
                <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${style.icon}`}>
                        {DialogIcons[type]}
                    </div>
                    <h3 className="text-lg font-medium flex-1">{title}</h3>
                </div>

                <div className="flex justify-end gap-2 mt-6">
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={onClose}
                    >
                        {cancelText}
                    </button>
                    <button
                        className={`btn btn-sm ${style.button}`}
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDialog; 