import { createContext, useContext, useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { initTray } from '../services/trayService';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useTrayManager } from '../hooks/useTrayManager';
import { useWindowCloseHandler } from '../hooks/useWindowCloseHandler';
import { CloseConfirmDialog } from '../components/ui/CloseConfirmDialog';
import { selectShowCloseDialog, setShowCloseDialog } from '../store/slices/settingsSlice';

interface TrayContextType {
  isInitialized: boolean;
}

const TrayContext = createContext<TrayContextType>({ isInitialized: false });

// 使用模块级变量，确保跨组件渲染保持状态
let hasStartedInitialization = false;

export function TrayProvider({ children }: { children: React.ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);
  const dispatch = useDispatch();
  const showCloseDialog = useSelector(selectShowCloseDialog);
  const {
    handleMinimizeToTray,
    handleExitApp
  } = useTrayManager();

  // 设置窗口关闭处理器
  useWindowCloseHandler();

  useEffect(() => {
    // 确保只初始化一次
    if (hasStartedInitialization) {
      return;
    }

    // 标记已开始初始化
    hasStartedInitialization = true;

    // 初始化流程
    const initialize = async () => {
      try {
        // 获取当前窗口以确保窗口已经准备好
        getCurrentWindow();

        // 初始化托盘，由于trayService内部已实现单例，无需担心重复初始化
        await initTray();
        setIsInitialized(true);
      } catch (err) {
        console.error('托盘初始化失败:', err);
        // 初始化失败时重置标志，允许后续重试
        // 通常不会发生，因为trayService会处理重试逻辑
        hasStartedInitialization = false;
      }
    };

    // 启动初始化
    initialize();

    // 清理函数（如果需要的话）
    return () => {
      // 托盘清理由trayService内部处理
    };
  }, []);

  return (
    <TrayContext.Provider value={{ isInitialized }}>
      {children}
      <CloseConfirmDialog
        isOpen={showCloseDialog}
        onClose={() => dispatch(setShowCloseDialog(false))}
        onMinimizeToTray={handleMinimizeToTray}
        onExitApp={handleExitApp}
      />
    </TrayContext.Provider>
  );
}

export const useTray = () => useContext(TrayContext); 