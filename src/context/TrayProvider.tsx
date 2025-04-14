import { createContext, useContext, useEffect, useState } from 'react';
import { initTray } from '../services/trayService';
import { getCurrentWindow } from '@tauri-apps/api/window';

interface TrayContextType {
  isInitialized: boolean;
}

const TrayContext = createContext<TrayContextType>({ isInitialized: false });

// 使用模块级变量，确保跨组件渲染保持状态
let hasStartedInitialization = false;

export function TrayProvider({ children }: { children: React.ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);
  
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
    
    // 如果需要清理，在这里返回清理函数
    // 但通常托盘会随应用关闭而销毁，无需手动清理
  }, []);
  
  return (
    <TrayContext.Provider value={{ isInitialized }}>
      {children}
    </TrayContext.Provider>
  );
}

export const useTray = () => useContext(TrayContext); 