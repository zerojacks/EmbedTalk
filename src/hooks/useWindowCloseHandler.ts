import { useEffect, useRef } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useTrayManager } from './useTrayManager';
import { store } from '../store';
import { setShowCloseDialog } from '../store/slices/settingsSlice';

export const useWindowCloseHandler = () => {
    const { handleMinimizeToTray, handleExitApp } = useTrayManager();

    // 使用 ref 来存储最新的函数引用，避免重复设置处理器
    const handlersRef = useRef({ handleMinimizeToTray, handleExitApp });

    // 更新 ref 中的函数引用
    handlersRef.current = { handleMinimizeToTray, handleExitApp };

    useEffect(() => {
        let unlistenFn: (() => void) | null = null;

        const setupCloseHandler = async () => {
            try {
                const window = getCurrentWindow();

                // 使用Tauri v2的onCloseRequested API
                unlistenFn = await window.onCloseRequested(async (event) => {
                    // 如果不是主窗口，直接允许关闭
                    if (window.label !== "main") {
                        return;
                    }
                    // 在事件处理时获取最新的设置值
                    const state = store.getState().settings;
                    const currentCloseToTray = state.closeToTray;
                    const isExiting = state.isExiting;

                    console.log('窗口关闭请求，closeToTray设置:', currentCloseToTray, 'isExiting:', isExiting);

                    // 如果应用正在退出，不拦截关闭事件
                    if (isExiting) {
                        console.log('应用正在退出，允许关闭');
                        return;
                    }

                    // 阻止默认关闭行为
                    event.preventDefault();

                    // 使用最新的函数引用
                    const { handleMinimizeToTray, handleExitApp } = handlersRef.current;

                    if (currentCloseToTray === null || currentCloseToTray === undefined) {
                        // 如果用户还没有设置偏好，显示对话框
                        console.log('显示关闭确认对话框');
                        store.dispatch(setShowCloseDialog(true));
                    } else if (currentCloseToTray) {
                        // 用户选择了最小化到托盘
                        console.log('最小化到托盘');
                        await handleMinimizeToTray();
                    } else {
                        // 用户选择了完全退出
                        console.log('完全退出应用');
                        await handleExitApp();
                    }
                });

                console.log('窗口关闭处理器设置成功');
            } catch (error) {
                console.error('设置窗口关闭处理器失败:', error);
            }
        };

        setupCloseHandler();

        // 清理函数
        return () => {
            if (unlistenFn) {
                unlistenFn();
                console.log('窗口关闭处理器已清理');
            }
        };
    }, []); // 空依赖数组，只在组件挂载时设置一次
};
