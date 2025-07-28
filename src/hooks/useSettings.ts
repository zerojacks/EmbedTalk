import { useSelector } from 'react-redux';
import { useSettingsContext } from '../context/SettingsProvider';
import { 
  selectRegion,
  selectTheme,
  selectLanguage,
  selectMinimizeToTray,
  selectCloseToTray,
  selectStartMinimized,
  selectShowTrayNotifications,
  selectPosition,
  selectSize,
  selectIsLoading,
  selectIsInitialized,
  selectWindowSettings,
  selectAppSettings
} from '../store/slices/settingsSlice';

/**
 * 便捷的设置 hook，提供类型安全的设置访问和更新方法
 */
export function useSettings() {
  const context = useSettingsContext();
  
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  
  return context;
}

/**
 * 只读的设置值 hook，不包含更新方法
 */
export function useSettingsValue() {
  const region = useSelector(selectRegion);
  const theme = useSelector(selectTheme);
  const language = useSelector(selectLanguage);
  const minimizeToTray = useSelector(selectMinimizeToTray);
  const closeToTray = useSelector(selectCloseToTray);
  const startMinimized = useSelector(selectStartMinimized);
  const showTrayNotifications = useSelector(selectShowTrayNotifications);
  const position = useSelector(selectPosition);
  const size = useSelector(selectSize);
  const isLoading = useSelector(selectIsLoading);
  const isInitialized = useSelector(selectIsInitialized);
  
  return {
    region,
    theme,
    language,
    minimizeToTray,
    closeToTray,
    startMinimized,
    showTrayNotifications,
    position,
    size,
    isLoading,
    isInitialized
  };
}

/**
 * 窗口设置 hook
 */
export function useWindowSettings() {
  const windowSettings = useSelector(selectWindowSettings);
  const context = useSettingsContext();
  
  return {
    ...windowSettings,
    updateMinimizeToTray: context.updateMinimizeToTray,
    updateCloseToTray: context.updateCloseToTray,
    updateStartMinimized: context.updateStartMinimized,
    updateShowTrayNotifications: context.updateShowTrayNotifications,
    updatePosition: context.updatePosition,
    updateSize: context.updateSize
  };
}

/**
 * 应用设置 hook
 */
export function useAppSettings() {
  const appSettings = useSelector(selectAppSettings);
  const context = useSettingsContext();
  
  return {
    ...appSettings,
    updateRegion: context.updateRegion,
    updateLanguage: context.updateLanguage,
    // 主题通过 themeSlice 管理，保持向后兼容
    setTheme: context.setTheme
  };
}

/**
 * 托盘设置 hook
 */
export function useTraySettings() {
  const minimizeToTray = useSelector(selectMinimizeToTray);
  const closeToTray = useSelector(selectCloseToTray);
  const showTrayNotifications = useSelector(selectShowTrayNotifications);
  const context = useSettingsContext();
  
  return {
    minimizeToTray,
    closeToTray,
    showTrayNotifications,
    updateMinimizeToTray: context.updateMinimizeToTray,
    updateCloseToTray: context.updateCloseToTray,
    updateShowTrayNotifications: context.updateShowTrayNotifications
  };
}

/**
 * 设置初始化状态 hook
 */
export function useSettingsInitialization() {
  const isLoading = useSelector(selectIsLoading);
  const isInitialized = useSelector(selectIsInitialized);
  
  return {
    isLoading,
    isInitialized,
    isReady: isInitialized && !isLoading
  };
}
