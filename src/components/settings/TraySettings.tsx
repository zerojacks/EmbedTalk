import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
    selectMinimizeToTray,
    selectCloseToTray,
    selectStartMinimized,
    selectShowTrayNotifications,
    setMinimizeToTray,
    setCloseToTray,
    setStartMinimized,
    setShowTrayNotifications
} from '../../store/slices/settingsSlice';

export const TraySettings: React.FC = () => {
    const dispatch = useDispatch();
    
    const minimizeToTray = useSelector(selectMinimizeToTray);
    const closeToTray = useSelector(selectCloseToTray);
    const startMinimized = useSelector(selectStartMinimized);
    const showTrayNotifications = useSelector(selectShowTrayNotifications);

    return (
        <div className="space-y-6">
            {/* 标题 */}
            <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                    <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                </div>
                <h2 className="text-xl font-semibold text-base-content">系统托盘设置</h2>
            </div>

            {/* 说明 */}
            <div className="alert alert-info">
                <svg className="w-6 h-6 stroke-current shrink-0" fill="none" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <div>
                    <h3 className="font-bold">关于系统托盘</h3>
                    <div className="text-xs">配置应用程序在系统托盘中的行为，包括最小化和关闭时的操作。</div>
                </div>
            </div>

            {/* 设置选项 */}
            <div className="space-y-4">
                {/* 最小化到托盘 */}
                <div className="form-control">
                    <label className="label cursor-pointer justify-start space-x-4">
                        <input
                            type="checkbox"
                            className="toggle toggle-primary"
                            checked={minimizeToTray}
                            onChange={(e) => dispatch(setMinimizeToTray(e.target.checked))}
                        />
                        <div className="flex-1">
                            <span className="label-text font-medium">最小化到托盘</span>
                            <div className="text-xs text-base-content/60 mt-1">
                                点击最小化按钮时，将应用程序隐藏到系统托盘而不是任务栏
                            </div>
                        </div>
                    </label>
                </div>

                {/* 关闭到托盘 */}
                <div className="form-control">
                    <label className="label cursor-pointer justify-start space-x-4">
                        <input
                            type="checkbox"
                            className="toggle toggle-primary"
                            checked={closeToTray}
                            onChange={(e) => dispatch(setCloseToTray(e.target.checked))}
                        />
                        <div className="flex-1">
                            <span className="label-text font-medium">关闭到托盘</span>
                            <div className="text-xs text-base-content/60 mt-1">
                                点击关闭按钮时，将应用程序隐藏到系统托盘而不是完全退出
                            </div>
                        </div>
                    </label>
                </div>

                {/* 启动时最小化 */}
                <div className="form-control">
                    <label className="label cursor-pointer justify-start space-x-4">
                        <input
                            type="checkbox"
                            className="toggle toggle-primary"
                            checked={startMinimized}
                            onChange={(e) => dispatch(setStartMinimized(e.target.checked))}
                        />
                        <div className="flex-1">
                            <span className="label-text font-medium">启动时最小化</span>
                            <div className="text-xs text-base-content/60 mt-1">
                                应用程序启动时直接最小化到系统托盘
                            </div>
                        </div>
                    </label>
                </div>

                {/* 显示托盘通知 */}
                <div className="form-control">
                    <label className="label cursor-pointer justify-start space-x-4">
                        <input
                            type="checkbox"
                            className="toggle toggle-primary"
                            checked={showTrayNotifications}
                            onChange={(e) => dispatch(setShowTrayNotifications(e.target.checked))}
                        />
                        <div className="flex-1">
                            <span className="label-text font-medium">显示托盘通知</span>
                            <div className="text-xs text-base-content/60 mt-1">
                                当应用程序最小化到托盘时显示系统通知
                            </div>
                        </div>
                    </label>
                </div>
            </div>

            {/* 托盘操作说明 */}
            <div className="card bg-base-200">
                <div className="card-body p-4">
                    <h3 className="card-title text-sm">托盘操作说明</h3>
                    <div className="space-y-2 text-xs text-base-content/80">
                        <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-primary rounded-full"></div>
                            <span><strong>单击托盘图标</strong> - 显示/隐藏应用程序窗口</span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-secondary rounded-full"></div>
                            <span><strong>双击托盘图标</strong> - 显示应用程序窗口</span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-accent rounded-full"></div>
                            <span><strong>右键托盘图标</strong> - 显示托盘菜单</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 重置按钮 */}
            <div className="flex justify-end">
                <button
                    className="btn btn-outline btn-sm"
                    onClick={() => {
                        dispatch(setMinimizeToTray(true));
                        dispatch(setCloseToTray(true));
                        dispatch(setStartMinimized(false));
                        dispatch(setShowTrayNotifications(true));
                    }}
                >
                    恢复默认设置
                </button>
            </div>
        </div>
    );
};
