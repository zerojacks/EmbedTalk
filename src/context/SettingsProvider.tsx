import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  ReactNode,
} from "react";
import { useSelector, useDispatch } from 'react-redux';
import { selectTheme, setTheme, getEffectiveTheme, selectEffectiveTheme, ThemeOption } from '../store/slices/themeSlice';
import { AppDispatch } from '../store';
import {
  loadSettings,
  saveSetting,
  selectIsInitialized,
  selectIsLoading,
  selectRegion,
  selectLanguage,
  selectMinimizeToTray,
  selectCloseToTray,
  selectStartMinimized,
  selectShowTrayNotifications,
  selectPosition,
  selectSize,
  setRegion,
  setLanguage,
  setMinimizeToTray,
  setCloseToTray,
  setStartMinimized,
  setShowTrayNotifications,
  setPosition,
  setSize
} from '../store/slices/settingsSlice';
import { RegionOption, ConfigKey } from '../types/settings';

interface SettingsContextInterface {
  // 主题相关（保持向后兼容）
  theme: ThemeOption;
  effectiveTheme: 'light' | 'dark';
  setTheme: (theme: ThemeOption) => void;

  // 新的设置管理
  isInitialized: boolean;
  isLoading: boolean;

  // 应用设置
  region: RegionOption;
  language: 'zh-CN' | 'en-US';

  // 窗口设置
  minimizeToTray: boolean;
  closeToTray: boolean | null;
  startMinimized: boolean;
  showTrayNotifications: boolean;
  position?: { x: number; y: number };
  size?: { width: number; height: number };

  // 更新方法
  updateRegion: (value: RegionOption) => Promise<void>;
  updateLanguage: (value: 'zh-CN' | 'en-US') => Promise<void>;
  updateMinimizeToTray: (value: boolean) => Promise<void>;
  updateCloseToTray: (value: boolean | null) => Promise<void>;
  updateStartMinimized: (value: boolean) => Promise<void>;
  updateShowTrayNotifications: (value: boolean) => Promise<void>;
  updatePosition: (value: { x: number; y: number }) => Promise<void>;
  updateSize: (value: { width: number; height: number }) => Promise<void>;
}

export const SettingsContext = createContext<SettingsContextInterface>({
  theme: 'system',
  effectiveTheme: 'light',
  setTheme: () => { },
  isInitialized: false,
  isLoading: false,
  region: '南网',
  language: 'zh-CN',
  minimizeToTray: true,
  closeToTray: null,
  startMinimized: false,
  showTrayNotifications: true,
  position: { x: 100, y: 100 },
  size: { width: 1200, height: 800 },
  updateRegion: async () => {},
  updateLanguage: async () => {},
  updateMinimizeToTray: async () => {},
  updateCloseToTray: async () => {},
  updateStartMinimized: async () => {},
  updateShowTrayNotifications: async () => {},
  updatePosition: async () => {},
  updateSize: async () => {}
});

export const useSettingsContext = () => useContext(SettingsContext);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const dispatch = useDispatch<AppDispatch>();

  // 主题相关（保持向后兼容）
  const theme = useSelector(selectTheme);
  const curtheme = useSelector(selectEffectiveTheme);
  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>(curtheme);

  // 新的设置状态
  const isInitialized = useSelector(selectIsInitialized);
  const isLoading = useSelector(selectIsLoading);
  const region = useSelector(selectRegion);
  const language = useSelector(selectLanguage);
  const minimizeToTray = useSelector(selectMinimizeToTray);
  const closeToTray = useSelector(selectCloseToTray);
  const startMinimized = useSelector(selectStartMinimized);
  const showTrayNotifications = useSelector(selectShowTrayNotifications);
  const position = useSelector(selectPosition);
  const size = useSelector(selectSize);

  const [hasStartedInitialization, setHasStartedInitialization] = useState(false);

  // 初始化设置
  useEffect(() => {
    if (!hasStartedInitialization && !isInitialized) {
      setHasStartedInitialization(true);
      console.log('开始加载应用设置...');
      dispatch(loadSettings())
        .unwrap()
        .then(() => {
          console.log('应用设置加载完成');
        })
        .catch((error) => {
          console.error('应用设置加载失败:', error);
        });
    }
  }, [dispatch, hasStartedInitialization, isInitialized]);

  // 主题效果更新
  useEffect(() => {
    console.log("current theme ", curtheme);
    setEffectiveTheme(curtheme);
  }, [curtheme]);

  // 创建便捷的更新方法
  const createUpdateMethod = <T,>(
    configKey: ConfigKey,
    actionCreator: (value: T) => any
  ) => {
    return async (value: T) => {
      try {
        // 先更新 Redux 状态
        dispatch(actionCreator(value));

        // 然后异步保存到配置
        await dispatch(saveSetting({ key: configKey, value })).unwrap();
      } catch (error) {
        console.error(`更新设置 ${configKey} 失败:`, error);
        throw error;
      }
    };
  };

  const changeTheme = (newTheme: ThemeOption) => {
    dispatch(setTheme(newTheme));
  };

  const contextValue: SettingsContextInterface = {
    // 主题相关（保持向后兼容）
    theme,
    effectiveTheme,
    setTheme: changeTheme,

    // 新的设置管理
    isInitialized,
    isLoading,
    region,
    language,
    minimizeToTray,
    closeToTray,
    startMinimized,
    showTrayNotifications,
    position,
    size,

    // 更新方法
    updateRegion: createUpdateMethod('protocolsetting.region', setRegion),
    updateLanguage: createUpdateMethod('app.language', setLanguage),
    updateMinimizeToTray: createUpdateMethod('window.minimizeToTray', setMinimizeToTray),
    updateCloseToTray: createUpdateMethod('window.closeToTray', setCloseToTray),
    updateStartMinimized: createUpdateMethod('window.startMinimized', setStartMinimized),
    updateShowTrayNotifications: createUpdateMethod('window.showTrayNotifications', setShowTrayNotifications),
    updatePosition: createUpdateMethod('window.position', setPosition),
    updateSize: createUpdateMethod('window.size', setSize)
  };

  return (
    <SettingsContext.Provider value={contextValue}>
      {children}
    </SettingsContext.Provider>
  );
};