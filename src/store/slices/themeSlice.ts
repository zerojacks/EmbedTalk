import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { setTheme as setThemeTauri } from '@tauri-apps/api/app';
import { RootState } from '..';
import { SettingService } from '../../services/settingService';

export type ThemeOption = 'light' | 'dark' | 'system';

interface ThemeState {
  current: ThemeOption;
  isLoaded: boolean;
}

const initialState: ThemeState = {
  current: 'system',
  isLoaded: false
};

// 创建异步 thunk 用于加载主题配置
export const loadThemeConfig = createAsyncThunk(
  'theme/loadConfig',
  async (_, { dispatch }) => {
    try {
      console.log('Loading theme configuration from settings...');
      const savedTheme = await SettingService.getTheme();
      
      if (savedTheme) {
        console.log(`Loaded theme from settings: ${savedTheme}`);
        // 使用 saveToDb=false 避免循环写入
        dispatch(setTheme(savedTheme, false));
        return savedTheme;
      } else {
        console.log('No saved theme found, using default: system');
        return initialState.current;
      }
    } catch (error) {
      console.error('Failed to load theme configuration:', error);
      return initialState.current;
    }
  }
);

const themeSlice = createSlice({
  name: 'theme',
  initialState,
  reducers: {
    setTheme: {
      reducer: (state, action: PayloadAction<{ theme: ThemeOption; saveToDb?: boolean }>) => {
        state.current = action.payload.theme;
        if (action.payload.theme === 'system') {
          setThemeTauri(null);
        } else {
          setThemeTauri(action.payload.theme);
        }
        if (action.payload.saveToDb !== false) {
          SettingService.setTheme(action.payload.theme)
            .then(success => {
              if (!success) {
                console.warn('Failed to save theme to settings');
              }
            })
            .catch(error => {
              console.error('Error saving theme to settings:', error);
            });
        }
      },
      prepare: (theme: ThemeOption, saveToDb: boolean = true) => {
        return { payload: { theme, saveToDb } };
      }
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadThemeConfig.fulfilled, (state, action) => {
        state.isLoaded = true;
      })
      .addCase(loadThemeConfig.rejected, (state) => {
        state.isLoaded = true; // 即使加载失败，也标记为已加载
        console.error('Theme configuration loading failed');
      });
  }
});

export const { setTheme } = themeSlice.actions;
export const selectTheme = (state: RootState) => state.theme.current;
export const selectThemeLoaded = (state: RootState) => state.theme.isLoaded;

// 使用闭包避免循环依赖
let storeRef: any = null;
export const initTheme = (store: any) => {
  storeRef = store;
  // 初始化主题配置
  store.dispatch(loadThemeConfig());
};

export const getEffectiveTheme = (): 'light' | 'dark' => {
  if (!storeRef) {
    return 'light'; // 默认值
  }
  const currentTheme = storeRef.getState().theme.current;
  if (currentTheme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return currentTheme as 'light' | 'dark';
};

export const getTheme = (): ThemeOption => {
  if (!storeRef) {
    return initialState.current; // 默认值
  }
  return storeRef.getState().theme.current;
};

export default themeSlice.reducer;
