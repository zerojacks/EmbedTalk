import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '../index';

export interface SettingsState {
    region:  "南网" | "云南" | "广东" | "深圳" | "广西" | "贵州" | "海南" | "topo";
    theme: 'light' | 'dark' | 'system';
}

// 从localStorage获取初始状态，如果没有则使用默认值
const getInitialState = (): SettingsState => {
    const savedRegion = localStorage.getItem('region');
    const savedTheme = localStorage.getItem('theme');

    return {
        region: (savedRegion as SettingsState['region']) || '南网',
        theme: (savedTheme as SettingsState['theme']) || 'system'
    };
};

export const settingsSlice = createSlice({
    name: 'settings',
    initialState: getInitialState(),
    reducers: {
        setRegion: (state, action: PayloadAction<SettingsState['region']>) => {
            state.region = action.payload;
            localStorage.setItem('region', action.payload);
        },
        setTheme: (state, action: PayloadAction<SettingsState['theme']>) => {
            state.theme = action.payload;
            localStorage.setItem('theme', action.payload);
        }
    }
});

// 导出 actions
export const { setRegion, setTheme } = settingsSlice.actions;

// 导出 selectors
export const selectRegion = (state: RootState) => state.settings.region;
export const selectTheme = (state: RootState) => state.settings.theme;

export default settingsSlice.reducer; 