import { TrayIcon } from '@tauri-apps/api/tray';
import { Menu } from '@tauri-apps/api/menu';
import { defaultWindowIcon } from '@tauri-apps/api/app';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { exit } from '@tauri-apps/plugin-process';

// 单例实现
class TrayService {
    private static instance: TrayService | null = null;
    private trayInstance: any = null;
    private isInitialized = false;
    private initializationPromise: Promise<any> | null = null;

    private constructor() {}

    // 获取单例实例
    public static getInstance(): TrayService {
        if (!TrayService.instance) {
            TrayService.instance = new TrayService();
        }
        return TrayService.instance;
    }

    // 托盘事件处理函数
    private handleTrayEvent = (event: any) => {
        switch (event.type) {
            case 'Click':
                console.log(`鼠标 ${event.button} 按钮被点击，状态: ${event.buttonState}`);
                break;
            case 'DoubleClick':
                // 双击托盘图标时，显示/隐藏主窗口
                this.toggleMainWindow();
                break;
            case 'Enter':
                console.log(`鼠标悬停在托盘上，位置: ${event.rect.position.x}, ${event.rect.position.y}`);
                break;
            case 'Move':
                // 鼠标在托盘图标上移动时不做处理，避免日志过多
                break;
            case 'Leave':
                console.log(`鼠标离开托盘，位置: ${event.rect.position.x}, ${event.rect.position.y}`);
                break;
            default:
                console.log(`未处理的托盘事件: ${event.type}`);
        }
    };

    // 切换主窗口显示/隐藏状态
    public async toggleMainWindow() {
        try {
            const visible = await getCurrentWindow().isVisible();
            if (visible) {
                await getCurrentWindow().hide();
            } else {
                await getCurrentWindow().show();
                await getCurrentWindow().setFocus();
            }
        } catch (error) {
            console.error('切换窗口状态失败:', error);
        }
    }

    // 显示关于对话框
    public async showAboutDialog() {
        try {
            // 获取当前窗口
            const mainWindow = await getCurrentWindow();
            
            // 检查窗口是否最小化
            const isMinimized = await mainWindow.isMinimized();
            if (isMinimized) {
                await mainWindow.unminimize();
            }
            
            // 确保窗口可见
            await mainWindow.show();
            
            // 设置焦点
            await mainWindow.setFocus();
            
            // 使用延迟再次设置置顶，解决某些系统中的问题
            setTimeout(async () => {
                try {
                    await mainWindow.setFocus();
                } catch (error) {
                    console.error('设置窗口置顶失败:', error);
                }
            }, 50);
            
            // 发送事件到主进程，触发关于对话框显示
            await mainWindow.emit('show-about-dialog');
        } catch (error) {
            console.error('显示关于对话框失败:', error);
        }
    }

    // 处理托盘菜单点击事件
    private handleMenuClick = async (itemId: string) => {
        switch (itemId) {
            case 'show_hide':
                await this.toggleMainWindow();
                break;
            case 'about':
                await this.showAboutDialog();
                break;
            case 'quit':
                await exit(0);
                break;
            default:
                console.log(`未处理的菜单项: ${itemId}`);
        }
    };

    // 初始化托盘
    public async initialize() {
        // 已初始化，直接返回托盘实例
        if (this.isInitialized && this.trayInstance) {
            return this.trayInstance;
        }

        // 正在初始化中，返回初始化Promise
        if (this.initializationPromise) {
            return this.initializationPromise;
        }

        // 开始初始化
        this.initializationPromise = this.initializeTray();
        return this.initializationPromise;
    }

    // 托盘初始化逻辑
    private async initializeTray() {
        try {
            // 创建托盘菜单
            const menu = await Menu.new({
                items: [
                    {
                        id: 'show_hide',
                        text: '显示/隐藏',
                        action: () => this.handleMenuClick('show_hide'),
                    },
                    {
                        id: 'about',
                        text: '关于',
                        action: () => this.handleMenuClick('about'),
                    },
                    {
                        id: 'quit',
                        text: '退出',
                        action: () => this.handleMenuClick('quit'),
                    },
                ],
            });

            // 获取应用图标
            const icon = await defaultWindowIcon();

            // 创建托盘图标
            this.trayInstance = await TrayIcon.new({
                menu,
                icon: icon || undefined,
                tooltip: 'EmbedTalk',
                menuOnLeftClick: true,
                action: this.handleTrayEvent,
            });

            this.isInitialized = true;
            console.log('托盘初始化成功');
            
            return this.trayInstance;
        } catch (error) {
            console.error('托盘初始化失败:', error);
            this.initializationPromise = null;
            throw error;
        }
    }
}

// 导出单例方法
export const initTray = async () => {
    return await TrayService.getInstance().initialize();
};

export const toggleMainWindow = async () => {
    return await TrayService.getInstance().toggleMainWindow();
};

export const showAboutDialog = async () => {
    return await TrayService.getInstance().showAboutDialog();
};

// 导出托盘服务
export default {
    initTray,
    toggleMainWindow,
    showAboutDialog,
}; 