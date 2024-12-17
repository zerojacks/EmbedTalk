import React, { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// Dialog 组件属性类型定义
interface DialogProps {
    open: boolean;
    onClose: () => void;
    children: ReactNode;
    className?: string;
    closeOnOverlayClick?: boolean;
}

// DialogHeader 组件属性类型定义
interface DialogHeaderProps {
    children: ReactNode;
    className?: string;
}

// DialogTitle 组件属性类型定义
interface DialogTitleProps {
    children: ReactNode;
    className?: string;
    icon?: ReactNode;
    badge?: ReactNode; // 用于状态徽章
}

// DialogContent 组件属性类型定义
interface DialogContentProps {
    children: ReactNode;
    className?: string;
    maxWidth?: string;
    maxHeight?: string;
}

// Dialog 组件
const Dialog: React.FC<DialogProps> = ({
    open,
    onClose,
    children,
    className = '',
    closeOnOverlayClick = true,
}) => {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        if (open) {
            document.addEventListener('keydown', handleKeyDown);
        }

        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [open, onClose]);

    if (!open) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
            onClick={closeOnOverlayClick ? onClose : undefined}
        >
            <div
                className={`relative bg-white rounded-lg shadow-xl p-6 max-w-full w-full ${className}`}
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                    onClick={onClose}
                >
                    <X size={20} />
                </button>
                {children}
            </div>
        </div>,
        document.body
    );
};

// DialogHeader 组件
const DialogHeader: React.FC<DialogHeaderProps> = ({ children, className = '' }) => (
    <div className={`mb-4 border-b pb-2 ${className}`}>{children}</div>
);

// DialogTitle 组件
const DialogTitle: React.FC<DialogTitleProps> = ({ children, className = '', icon, badge }) => (
    <div className={`flex items-center space-x-2 ${className}`}>
        {icon && <span className="flex-shrink-0">{icon}</span>}
        <h2 className="text-lg font-semibold">{children}</h2>
        {badge && <span className="ml-2">{badge}</span>}
    </div>
);

// DialogContent 组件
const DialogContent: React.FC<DialogContentProps> = ({
    children,
    className = '',
    maxWidth = '100%',
    maxHeight = '80vh',
}) => (
    <div className={`overflow-auto ${className}`} style={{ maxWidth, maxHeight }}>
        {children}
    </div>
);

export { Dialog, DialogHeader, DialogTitle, DialogContent };
