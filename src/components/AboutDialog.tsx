import React, { useState, useEffect } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { InfoIcon } from './Icons';
import { useSettingsContext } from '../context/SettingsProvider';
import { getCurrentWindow } from '@tauri-apps/api/window';

interface AboutDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const AboutDialog: React.FC<AboutDialogProps> = ({ isOpen, onClose }) => {
  const [appVersion, setAppVersion] = useState<string>('');
  const { theme } = useSettingsContext();
  
  // 组件挂载时设置窗口层级和焦点
  useEffect(() => {
    if (isOpen) {
      let timeoutId: NodeJS.Timeout;
      
      const setupWindow = async () => {
        try {
          const window = await getCurrentWindow();
          
          // 先确保窗口可见
          await window.show();
          
          // 检查窗口是否最小化，如果是则恢复
          const isMinimized = await window.isMinimized();
          if (isMinimized) {
            await window.unminimize();
          }
          
          // 强制窗口获取焦点
          await window.setFocus();
          
          // 每100ms检查一次是否保持置顶和焦点
          const checkFocusInterval = setInterval(async () => {
            if (!isOpen) {
              clearInterval(checkFocusInterval);
              return;
            }
            
            try {
              // 确保窗口仍然在顶部
              await window.setFocus();
            } catch (error) {
              console.error('保持窗口置顶失败:', error);
              clearInterval(checkFocusInterval);
            }
          }, 100);
          
          // 5秒后停止检查，避免资源占用
          timeoutId = setTimeout(() => {
            clearInterval(checkFocusInterval);
          }, 5000);
          
          return () => {
            clearInterval(checkFocusInterval);
            clearTimeout(timeoutId);
          };
        } catch (error) {
          console.error('设置窗口置顶失败:', error);
        }
      };
      
      setupWindow();
      
      return () => {
        // 对话框关闭时恢复窗口状态
        (async () => {
          try {
            clearTimeout(timeoutId);
            const window = await getCurrentWindow();
          } catch (error) {
            console.error('恢复窗口状态失败:', error);
          }
        })();
      };
    }
  }, [isOpen]);
  
  // 获取应用版本
  useEffect(() => {
    if (isOpen) {
      const fetchData = async () => {
        try {
          const version = await getVersion();
          setAppVersion(version);
        } catch (error) {
          console.error('获取应用信息失败:', error);
        }
      };
      
      fetchData();
    }
  }, [isOpen]);
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm transition-all duration-300 ease-in-out p-4">
      <div className="card max-w-full w-80 bg-base-100 shadow-lg border border-base-300 overflow-hidden">
        <div className="card-body p-4 relative">
          {/* 背景网格装饰 */}
          <div className="absolute inset-0 bg-grid-pattern bg-grid opacity-10 pointer-events-none"></div>
          
          <div className="flex flex-col items-center relative z-10">
            {/* 标题区域 */}
            <div className="flex items-center space-x-2 mb-3">
              <InfoIcon className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold">关于 EmbedTalk</h2>
            </div>
            
            {/* 图标区域 */}
            <div className="mb-3 relative w-16 h-16 flex items-center justify-center">
              <img 
                src="/icon.png"
                alt="EmbedTalk Logo" 
                className="w-full h-auto"
              />
            </div>
            
            {/* 版本信息 */}
            <div className="badge badge-primary mb-3">
              版本: {appVersion}
            </div>
            
            {/* 应用描述 */}
            <p className="text-center text-sm text-base-content mb-3 bg-base-200 p-2 rounded-lg shadow-inner">
              EmbedTalk是一款用于嵌入式设备通信的跨平台桌面应用，支持多种协议解析和调试功能。
            </p>
            
            {/* 技术特性标题 */}
            <div className="divider my-2 before:bg-base-300 after:bg-base-300 text-sm">技术特性</div>
            
            {/* 技术标签 */}
            <div className="grid grid-cols-3 gap-1 w-full mb-3">
              <span className="badge badge-outline badge-xs">Tauri V2</span>
              <span className="badge badge-outline badge-xs">TypeScript</span>
              <span className="badge badge-outline badge-xs">React</span>
              <span className="badge badge-outline badge-xs">TailwindCSS</span>
              <span className="badge badge-outline badge-xs">DaisyUI</span>
              <span className="badge badge-outline badge-xs">跨平台</span>
            </div>
            
            {/* 版权信息 */}
            <div className="text-xs text-center opacity-70 mb-3">
              © {new Date().getFullYear()} zerojack. 保留所有权利。
            </div>
            
            {/* 关闭按钮 */}
            <button 
              className="btn btn-primary btn-sm w-full"
              onClick={onClose}
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutDialog; 