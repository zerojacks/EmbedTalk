import React, { createContext, useContext, useEffect, useState } from 'react';
import { isPlatform, initPlatform } from '../utils/platform';

interface PlatformContextType {
  isDesktop: boolean;
  isWeb: boolean;
  platform: 'desktop' | 'web';
  isInitialized: boolean;
}

const PlatformContext = createContext<PlatformContextType>({
  isDesktop: false,
  isWeb: true,
  platform: 'web',
  isInitialized: false
});

export const usePlatform = () => useContext(PlatformContext);

export const PlatformProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [platform, setPlatform] = useState<'desktop' | 'web'>(isPlatform.isDesktop ? 'desktop' : 'web');
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initialize = async () => {
      try {
        // 初始化平台检测
        await initPlatform();
        
        // 更新平台状态
        setPlatform(isPlatform.isDesktop ? 'desktop' : 'web');
        
        // 平台特定初始化
        if (isPlatform.isDesktop) {
          console.log('Running in desktop mode');
        } else {
          console.log('Running in web mode');
        }
        
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize platform:', error);
        // 即使初始化失败，也标记为已初始化，但使用默认的 web 模式
        setIsInitialized(true);
      }
    };

    initialize();
  }, []);

  const value = {
    isDesktop: isPlatform.isDesktop,
    isWeb: !isPlatform.isDesktop,
    platform,
    isInitialized
  };

  // 如果平台还未初始化完成，可以返回一个加载状态
  if (!isInitialized) {
    return null; // 或者返回一个加载指示器
  }

  return (
    <PlatformContext.Provider value={value}>
      {children}
    </PlatformContext.Provider>
  );
}; 