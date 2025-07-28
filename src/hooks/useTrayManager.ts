import { useSelector } from 'react-redux';
import { selectShowTrayNotifications } from '../store/slices/settingsSlice';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { exit } from '@tauri-apps/plugin-process';
import { store } from '../store';
import { setIsExiting } from '../store/slices/settingsSlice';

export interface TrayManager {
    handleMinimizeToTray: () => Promise<void>;
    handleExitApp: () => Promise<void>;
    showWindow: () => Promise<void>;
    hideWindow: () => Promise<void>;
}

export const useTrayManager = (): TrayManager => {
    const showTrayNotifications = useSelector(selectShowTrayNotifications);

    // 托盘初始化由TrayProvider处理，这里不需要重复初始化

    // handleWindowClose函数已移动到useWindowCloseHandler hook中

    // 最小化到托盘
    const handleMinimizeToTray = async () => {
        try {
            const window = getCurrentWindow();
            await window.hide();

            if (showTrayNotifications) {
                // 简单的控制台通知，可以后续扩展为系统通知
                console.log('EmbedTalk - 应用程序已最小化到系统托盘');
            }

            console.log('窗口已隐藏到托盘');
        } catch (error) {
            console.error('隐藏窗口失败:', error);
        }
    };

    // 完全退出应用
    const handleExitApp = async () => {
        try {
            console.log('开始退出应用');
            // 设置退出标志，这样窗口关闭处理器就不会拦截关闭事件
            store.dispatch(setIsExiting(true));

            // 稍微延迟一下，确保状态更新
            await new Promise(resolve => setTimeout(resolve, 100));

            const window = getCurrentWindow();
            await window.close();
        } catch (error) {
            console.error('退出应用失败:', error);
            // 如果window.close()失败，使用备用方法
            try {
                await exit(0);
            } catch (exitError) {
                console.error('备用退出方法也失败:', exitError);
                // 重置退出标志
                store.dispatch(setIsExiting(false));
            }
        }
    };

    // 显示窗口
    const showWindow = async () => {
        try {
            const window = getCurrentWindow();
            await window.show();
            await window.setFocus();
            console.log('窗口已显示');
        } catch (error) {
            console.error('显示窗口失败:', error);
        }
    };

    // 隐藏窗口
    const hideWindow = async () => {
        try {
            const window = getCurrentWindow();
            await window.hide();
            console.log('窗口已隐藏');
        } catch (error) {
            console.error('隐藏窗口失败:', error);
        }
    };

    return {
        handleMinimizeToTray,
        handleExitApp,
        showWindow,
        hideWindow
    };
};
