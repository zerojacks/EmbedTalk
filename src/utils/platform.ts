import { getVersion } from '@tauri-apps/api/app';

export const isPlatform = {
    isDesktop: false,
    isWeb: false,
    initialized: false,
};

export async function initPlatform() {
    if (isPlatform.initialized) return;

    try {
        // 尝试获取Tauri版本，如果成功则说明是桌面版
        await getVersion();
        isPlatform.isDesktop = true;
    } catch (e) {
        // 如果失败则说明是Web版
        isPlatform.isWeb = true;
    }
    
    isPlatform.initialized = true;
    console.log('Platform detected:', isPlatform.isDesktop ? 'Desktop' : 'Web');
} 