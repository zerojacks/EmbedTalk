import React, { createContext, useContext, useEffect } from 'react';
import { SettingService } from '../services/settingService';
import { UpdaterService } from '../services/updaterService';

interface UpdateContextType {
    checkForUpdates: () => Promise<void>;
}

const UpdateContext = createContext<UpdateContextType | null>(null);

export const useUpdate = () => {
    const context = useContext(UpdateContext);
    if (!context) {
        throw new Error('useUpdate must be used within an UpdateProvider');
    }
    return context;
};

export const UpdateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // 检查更新的主要逻辑
    const checkForUpdates = async (silent: boolean = false) => {
        await UpdaterService.checkForUpdates(silent);
    };

    // 初始化自动检查功能
    useEffect(() => {
        let checkInterval: NodeJS.Timeout | null = null;

        const initAutoCheck = async () => {
            try {
                const autoCheck = await SettingService.getConfigValue<boolean>("Updates", "autoCheck", false);
                if (autoCheck) {
                    // 启动时延迟3秒检查
                    const initialCheck = setTimeout(() => {
                        checkForUpdates(true);
                    }, 3000);

                    // 每24小时检查一次
                    checkInterval = setInterval(() => {
                        checkForUpdates(true);
                    }, 24 * 60 * 60 * 1000);

                    return () => {
                        clearTimeout(initialCheck);
                        if (checkInterval) {
                            clearInterval(checkInterval);
                        }
                    };
                }
            } catch (error) {
                console.error('初始化自动更新检查失败:', error);
            }
        };

        initAutoCheck();

        // 监听设置变化
        const handleSettingChange = async () => {
            if (checkInterval) {
                clearInterval(checkInterval);
                checkInterval = null;
            }
            await initAutoCheck();
        };

        // 创建自定义事件来处理设置变化
        window.addEventListener('update-setting-changed', handleSettingChange);

        return () => {
            if (checkInterval) {
                clearInterval(checkInterval);
            }
            window.removeEventListener('update-setting-changed', handleSettingChange);
        };
    }, []);

    return (
        <UpdateContext.Provider value={{ checkForUpdates: () => checkForUpdates(false) }}>
            {children}
        </UpdateContext.Provider>
    );
}; 