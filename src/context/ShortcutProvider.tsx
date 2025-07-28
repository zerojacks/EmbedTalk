import React, { createContext, useContext, useEffect, useState } from 'react';
import { register, unregister, isRegistered } from '@tauri-apps/plugin-global-shortcut';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { Window } from "@tauri-apps/api/window";
import { SettingService } from '../services/settingService';

// 定义默认快捷键
const DEFAULT_SHORTCUTS = {
  toggleWindow: 'Alt+Shift+E',
  parseText: 'Alt+Shift+P',
  toggleHistory: 'Alt+Shift+H',
  quickParse: 'CommandOrControl+Shift+P',
} as const;

export type ShortcutKey = keyof typeof DEFAULT_SHORTCUTS;

interface ShortcutContextType {
  shortcuts: typeof DEFAULT_SHORTCUTS;
  updateShortcut: (key: ShortcutKey, newShortcut: string) => Promise<{ success: boolean; message: string }>;
  historyVisible: boolean;
  setHistoryVisible: (visible: boolean) => void;
}

const ShortcutContext = createContext<ShortcutContextType | undefined>(undefined);

export const useShortcuts = () => {
  const context = useContext(ShortcutContext);
  if (!context) {
    throw new Error('useShortcuts must be used within a ShortcutProvider');
  }
  return context;
};

export const ShortcutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [shortcuts, setShortcuts] = useState(DEFAULT_SHORTCUTS);
  const [historyVisible, setHistoryVisible] = useState(false);

  // 用于防抖的时间戳记录
  const lastTriggerTime = React.useRef<{ [key: string]: number }>({});
  const DEBOUNCE_DELAY = 300; // 300ms 内的重复触发将被忽略

  const show_quick_parse_window = async () => {
    try {
      await invoke<void>('open_window');
    } catch (e) {
      console.error(e);
    }
  }
  // 注册快捷键
  const registerShortcut = async (key: ShortcutKey, shortcut: string): Promise<{ success: boolean; message: string }> => {

    try {
      console.log(`[Start] Registering shortcut for ${key}: ${shortcut}`);
      // 检查新快捷键是否已被其他功能注册
      const isAlreadyRegistered = await isRegistered(shortcut);
      console.log(`Shortcut ${shortcut} isAlreadyRegistered:`, isAlreadyRegistered);
      
      if (isAlreadyRegistered) {
        // 如果是当前功能的快捷键，先注销再重新注册
        if (shortcuts[key] === shortcut) {
          console.log(`Unregistering existing shortcut for ${key}: ${shortcut}`);
          await unregister(shortcut);
        } else {
          return { success: false, message: `快捷键 ${shortcut} 已被其他功能注册` };
        }
      }

      // 检查是否与其他设置的快捷键冲突
      const conflictKey = Object.entries(shortcuts).find(([k, v]) => v === shortcut && k !== key);
      if (conflictKey) {
        return {
          success: false,
          message: `快捷键 ${shortcut} 已被 ${conflictKey[0] === 'toggleWindow' ? '显示/隐藏窗口' : conflictKey[0] === 'parseText' ? '解析选中文本' : '历史记录'} 功能使用`
        };
      }

      // 如果当前key已经注册了其他快捷键，先注销
      const currentShortcut = shortcuts[key];
      if (currentShortcut && currentShortcut !== shortcut) {
        console.log(`Unregistering old shortcut for ${key}: ${currentShortcut}`);
        if (await isRegistered(currentShortcut)) {
          await unregister(currentShortcut);
        }
      }

      // 注册新快捷键
      try {
        console.log(`[Register] Registering new shortcut for ${key}: ${shortcut}`);
        await register(shortcut, async () => {
          // 检查是否在防抖时间内
          const now = Date.now();
          const lastTrigger = lastTriggerTime.current[key] || 0;
          if (now - lastTrigger < DEBOUNCE_DELAY) {
            console.log(`[Debounce] Ignoring repeated trigger for ${key}: ${shortcut}`);
            return;
          }
          lastTriggerTime.current[key] = now;

          console.log(`[Triggered] Shortcut triggered for ${key}: ${shortcut}`);
          const window = getCurrentWindow();
          
          if (key === 'toggleWindow') {
            const visible = await window.isVisible();
            console.log("Window visible state:", visible);
            if (visible) {
              await window.hide();
            } else {
              await window.show();
              await window.setFocus();
            }
          } else if (key === 'parseText') {
            setHistoryVisible(true);
          } else if (key === 'toggleHistory') {
            setHistoryVisible(prev => !prev);
          }
          else if (key === 'quickParse') {
            show_quick_parse_window();
          }
        });
        console.log(`[Success] Successfully registered shortcut for ${key}: ${shortcut}`);
      } catch (error) {
        console.error(`[Error] Failed to register shortcut for ${key}: ${shortcut}`, error);
        if (error instanceof Error) {
          return { success: false, message: `注册快捷键失败: ${error.message}` };
        }
        return { success: false, message: '注册快捷键失败' };
      }

      // 更新状态
      setShortcuts(prev => ({
        ...prev,
        [key]: shortcut
      }));

      // 保存到设置
      try {
        await invoke('set_config_value_async', {
          section: 'MainWindow',
          key: 'shortcuts',
          value: JSON.stringify({
            ...shortcuts,
            [key]: shortcut
          })
        });
        return { success: true, message: '快捷键设置成功' };
      } catch (error) {
        return { success: false, message: '保存快捷键设置失败' };
      }
      
    } catch (error) {
      console.error(`[Error] Error in registerShortcut for ${key}: ${shortcut}:`, error);
      return {
        success: false,
        message: error instanceof Error ? error.message : '快捷键设置失败'
      };
    }
  };

  // 更新快捷键
  const updateShortcut = async (key: ShortcutKey, newShortcut: string): Promise<{ success: boolean; message: string }> => {
    return registerShortcut(key, newShortcut);
  };

  // 初始化快捷键
  useEffect(() => {
    let mounted = true;
    const registeredShortcuts = new Set<string>();

    const initShortcuts = async () => {
      try {
        console.log('[Init] Starting shortcuts initialization');
        
        // 从设置中加载快捷键
        const savedShortcuts = await SettingService.getShortcutSettings();
        console.log("[Init] Loaded saved shortcuts:", savedShortcuts);
        
        if (!mounted) return;

        // 注销所有已注册的快捷键
        for (const shortcut of registeredShortcuts) {
          console.log(`[Init] Unregistering existing shortcut: ${shortcut}`);
          await unregister(shortcut).catch(console.error);
          registeredShortcuts.delete(shortcut);
        }
        
        // 合并默认快捷键和保存的快捷键
        const mergedShortcuts = {
          ...DEFAULT_SHORTCUTS,
          ...(savedShortcuts || {})
        } as typeof DEFAULT_SHORTCUTS;

        // 更新状态
        setShortcuts(mergedShortcuts);
        
        // 注册所有快捷键
        for (const [key, shortcut] of Object.entries(mergedShortcuts) as [ShortcutKey, string][]) {
          if (!mounted) return;
          console.log(`[Init] Registering shortcut for ${key}: ${shortcut}`);
          const result = await registerShortcut(key, shortcut);
          if (result.success) {
            registeredShortcuts.add(shortcut);
          }
        }
        
        console.log('[Init] Shortcuts initialization completed');
      } catch (error) {
        console.error('[Init] Error initializing shortcuts:', error);
      }
    };

    initShortcuts();

    // 清理函数
    return () => {
      mounted = false;
      // 注销所有快捷键
      for (const shortcut of registeredShortcuts) {
        console.log(`[Cleanup] Unregistering shortcut: ${shortcut}`);
        unregister(shortcut).catch(console.error);
      }
    };
  }, []);  

  return (
    <ShortcutContext.Provider value={{ 
      shortcuts, 
      updateShortcut,
      historyVisible,
      setHistoryVisible
    }}>
      {children}
    </ShortcutContext.Provider>
  );
};

export default ShortcutProvider;
