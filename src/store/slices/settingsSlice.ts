import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import type { RootState } from '../index';
import { SettingService } from '../../services/settingService';
import { RegionOption, ThemeOption } from '../../types/settings';

export interface SettingsState {
    region: RegionOption;
    theme: ThemeOption;
    language: 'zh-CN' | 'en-US';
    // 托盘设置
    minimizeToTray: boolean;
    closeToTray: boolean | null; // null表示用户还未选择
    startMinimized: boolean;
    showTrayNotifications: boolean;
    // 窗口设置
    position?: { x: number; y: number };
    size?: { width: number; height: number };
    // UI 状态
    showCloseDialog: boolean;
    isExiting: boolean; // 标记应用是否正在退出
    isUpdating: boolean; // 标记应用是否正在更新
    // 加载状态
    isLoading: boolean;
    isInitialized: boolean;
}

// 异步加载设置
export const loadSettings = createAsyncThunk(
    'settings/loadSettings',
    async () => {
        await SettingService.initialize();
        const config = await SettingService.getAllConfig();
        return config;
    }
);

// 异步保存单个设置
export const saveSetting = createAsyncThunk(
    'settings/saveSetting',
    async ({ key, value }: { key: string; value: any }) => {
        const success = await SettingService.setConfig(key as any, value);
        if (!success) {
            throw new Error(`Failed to save setting: ${key}`);
        }
        return { key, value };
    }
);

// 异步设置操作
export const setRegionAsync = createAsyncThunk(
    'settings/setRegionAsync',
    async (region: RegionOption, { dispatch }) => {
        await dispatch(saveSetting({ key: 'protocolsetting.region', value: region }));
        dispatch(settingsSlice.actions.updateRegion(region));
    }
);

export const setThemeAsync = createAsyncThunk(
    'settings/setThemeAsync',
    async (theme: ThemeOption, { dispatch }) => {
        await dispatch(saveSetting({ key: 'app.theme', value: theme }));
        dispatch(settingsSlice.actions.updateTheme(theme));
    }
);

export const setLanguageAsync = createAsyncThunk(
    'settings/setLanguageAsync',
    async (language: 'zh-CN' | 'en-US', { dispatch }) => {
        await dispatch(saveSetting({ key: 'app.language', value: language }));
        dispatch(settingsSlice.actions.updateLanguage(language));
    }
);

export const setCloseToTrayAsync = createAsyncThunk(
    'settings/setCloseToTrayAsync',
    async (closeToTray: boolean | null, { dispatch }) => {
        await dispatch(saveSetting({ key: 'window.closeToTray', value: closeToTray }));
        dispatch(settingsSlice.actions.updateCloseToTray(closeToTray));
    }
);

// 获取初始状态（使用默认值）
const getInitialState = (): SettingsState => {
    return {
        region: '南网',
        theme: 'system',
        language: 'zh-CN',
        minimizeToTray: true,
        closeToTray: null, // 用户首次使用时需要选择
        startMinimized: false,
        showTrayNotifications: true,
        position: { x: 100, y: 100 },
        size: { width: 1200, height: 800 },
        showCloseDialog: false,
        isExiting: false,
        isUpdating: false,
        isLoading: false,
        isInitialized: false
    };
};

export const settingsSlice = createSlice({
    name: 'settings',
    initialState: getInitialState(),
    reducers: {
        // 同步更新状态（不保存到配置）
        updateRegion: (state, action: PayloadAction<RegionOption>) => {
            state.region = action.payload;
        },
        updateTheme: (state, action: PayloadAction<ThemeOption>) => {
            state.theme = action.payload;
        },
        updateLanguage: (state, action: PayloadAction<'zh-CN' | 'en-US'>) => {
            state.language = action.payload;
        },
        updateMinimizeToTray: (state, action: PayloadAction<boolean>) => {
            state.minimizeToTray = action.payload;
        },
        updateCloseToTray: (state, action: PayloadAction<boolean | null>) => {
            state.closeToTray = action.payload;
        },
        updateStartMinimized: (state, action: PayloadAction<boolean>) => {
            state.startMinimized = action.payload;
        },
        updateShowTrayNotifications: (state, action: PayloadAction<boolean>) => {
            state.showTrayNotifications = action.payload;
        },
        updatePosition: (state, action: PayloadAction<{ x: number; y: number }>) => {
            state.position = action.payload;
        },
        updateSize: (state, action: PayloadAction<{ width: number; height: number }>) => {
            state.size = action.payload;
        },
        // 对话框状态
        setShowCloseDialog: (state, action: PayloadAction<boolean>) => {
            state.showCloseDialog = action.payload;
        },
        setIsExiting: (state, action: PayloadAction<boolean>) => {
            state.isExiting = action.payload;
        },
        setIsUpdating: (state, action: PayloadAction<boolean>) => {
            state.isUpdating = action.payload;
        },
        // 直接更新状态的方法（不包含保存到配置）
        setRegion: (state, action: PayloadAction<RegionOption>) => {
            state.region = action.payload;
        },
        setTheme: (state, action: PayloadAction<ThemeOption>) => {
            state.theme = action.payload;
        },
        setLanguage: (state, action: PayloadAction<'zh-CN' | 'en-US'>) => {
            state.language = action.payload;
        },
        setMinimizeToTray: (state, action: PayloadAction<boolean>) => {
            state.minimizeToTray = action.payload;
        },
        setCloseToTray: (state, action: PayloadAction<boolean | null>) => {
            state.closeToTray = action.payload;
        },
        setStartMinimized: (state, action: PayloadAction<boolean>) => {
            state.startMinimized = action.payload;
        },
        setShowTrayNotifications: (state, action: PayloadAction<boolean>) => {
            state.showTrayNotifications = action.payload;
        },
        setPosition: (state, action: PayloadAction<{ x: number; y: number }>) => {
            state.position = action.payload;
        },
        setSize: (state, action: PayloadAction<{ width: number; height: number }>) => {
            state.size = action.payload;
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(loadSettings.pending, (state) => {
                state.isLoading = true;
            })
            .addCase(loadSettings.fulfilled, (state, action) => {
                state.isLoading = false;
                state.isInitialized = true;
                // 更新所有设置
                state.region = action.payload.protocolsetting.region;
                state.theme = action.payload.app.theme;
                state.language = action.payload.app.language;
                state.minimizeToTray = action.payload.window.minimizeToTray;
                state.closeToTray = action.payload.window.closeToTray;
                state.startMinimized = action.payload.window.startMinimized;
                state.showTrayNotifications = action.payload.window.showTrayNotifications;
                state.position = action.payload.window.position;
                state.size = action.payload.window.size;
            })
            .addCase(loadSettings.rejected, (state, action) => {
                state.isLoading = false;
                console.error('加载设置失败:', action.error);
            })
            .addCase(saveSetting.fulfilled, (state, action) => {
                // 设置已成功保存，状态已在对应的 reducer 中更新
                console.log(`设置 ${action.payload.key} 已保存`);
            })
            .addCase(saveSetting.rejected, (state, action) => {
                console.error('保存设置失败:', action.error);
            });
    }
});

// 导出 actions
export const {
    // 同步更新方法
    updateRegion,
    updateTheme,
    updateLanguage,
    updateMinimizeToTray,
    updateCloseToTray,
    updateStartMinimized,
    updateShowTrayNotifications,
    updatePosition,
    updateSize,
    // 对话框状态
    setShowCloseDialog,
    setIsExiting,
    setIsUpdating,
    // 设置方法（需要配合异步保存）
    setRegion,
    setTheme,
    setLanguage,
    setMinimizeToTray,
    setCloseToTray,
    setStartMinimized,
    setShowTrayNotifications,
    setPosition,
    setSize
} = settingsSlice.actions;

// 异步 actions 已在上面导出

// 导出 selectors
export const selectRegion = (state: RootState) => state.settings.region;
export const selectTheme = (state: RootState) => state.settings.theme;
export const selectLanguage = (state: RootState) => state.settings.language;
export const selectMinimizeToTray = (state: RootState) => state.settings.minimizeToTray;
export const selectCloseToTray = (state: RootState) => state.settings.closeToTray;
export const selectStartMinimized = (state: RootState) => state.settings.startMinimized;
export const selectShowTrayNotifications = (state: RootState) => state.settings.showTrayNotifications;
export const selectPosition = (state: RootState) => state.settings.position;
export const selectSize = (state: RootState) => state.settings.size;
export const selectShowCloseDialog = (state: RootState) => state.settings.showCloseDialog;
export const selectIsExiting = (state: RootState) => state.settings.isExiting;
export const selectIsUpdating = (state: RootState) => state.settings.isUpdating;
export const selectIsLoading = (state: RootState) => state.settings.isLoading;
export const selectIsInitialized = (state: RootState) => state.settings.isInitialized;

// 便捷的复合 selectors
export const selectWindowSettings = (state: RootState) => ({
    minimizeToTray: state.settings.minimizeToTray,
    closeToTray: state.settings.closeToTray,
    startMinimized: state.settings.startMinimized,
    showTrayNotifications: state.settings.showTrayNotifications,
    position: state.settings.position,
    size: state.settings.size
});

export const selectAppSettings = (state: RootState) => ({
    region: state.settings.region,
    theme: state.settings.theme,
    language: state.settings.language
});

export default settingsSlice.reducer;