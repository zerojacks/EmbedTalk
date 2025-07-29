import React, { useState } from 'react';
import { setCloseToTrayAsync } from '../../store/slices/settingsSlice';
import { X } from 'lucide-react';
import { useAppDispatch } from '../../store/hooks';

interface CloseConfirmDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onMinimizeToTray: () => void;
    onExitApp: () => void;
}

export const CloseConfirmDialog: React.FC<CloseConfirmDialogProps> = ({
    isOpen,
    onClose,
    onMinimizeToTray,
    onExitApp
}) => {
    const dispatch = useAppDispatch();
    const [rememberChoice, setRememberChoice] = useState(false);

    const handleMinimizeToTray = () => {
        if (rememberChoice) {
            dispatch(setCloseToTrayAsync(true));
        }
        onMinimizeToTray();
        onClose();
    };

    const handleExitApp = () => {
        if (rememberChoice) {
            dispatch(setCloseToTrayAsync(false));
        }
        // 先关闭对话框，然后退出应用
        onClose();
        onExitApp();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* 背景遮罩 */}
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose}></div>
            
            {/* 对话框 */}
            <div className="relative bg-base-100 rounded-xl shadow-xl p-5 w-80 max-w-sm mx-4">
                {/* 关闭按钮 */}
                <button
                    className="absolute right-2 top-2 p-2 hover:bg-base-200 rounded-lg"
                    onClick={onClose}
                >
                    <X className="w-5 h-5 text-base-content/60 hover:text-base-content" />
                </button>
                <div className="flex flex-col space-y-4">
                    {/* 标题 */}
                    <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                            <svg className="w-6 h-6 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-base-content">
                            关闭应用程序
                        </h3>
                    </div>

                    {/* 内容 */}
                    <div className="text-base-content">
                        <p className="mb-6 text-center text-base text-base-content/70">
                            您希望如何关闭应用程序？
                        </p>
                    </div>

                    {/* 记住选择 */}
                    <div className="flex items-center justify-center space-x-2 py-3 border-t border-base-300">
                        <input
                            type="checkbox"
                            className="checkbox checkbox-sm checkbox-primary"
                            checked={rememberChoice}
                            onChange={(e) => setRememberChoice(e.target.checked)}
                        />
                        <span className="text-sm text-base-content/70">记住我的选择，下次不再询问</span>
                    </div>

                    {/* 按钮组 - 水平排列 */}
                    <div className="flex justify-center gap-3 pt-4">
                        <button
                            className="btn btn-info btn-sm w-36 h-10 min-h-10"
                            onClick={handleMinimizeToTray}
                        >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                            </svg>
                            最小化到托盘
                        </button>

                        <button
                            className="btn btn-error btn-sm w-36 h-10 min-h-10"
                            onClick={handleExitApp}
                        >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            完全退出
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
