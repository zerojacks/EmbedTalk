import { SettingService } from '../services/settingService';

/**
 * @deprecated 使用新的设置系统替代
 * 这个 hook 保持向后兼容，但建议使用 useSettings 或直接使用 SettingService
 */
export const useConfig = () => {
  const getConfigValue = async <T = any>(section: string, key: string, defaultValue?: T): Promise<T | null> => {
    try {
      console.warn(`useConfig.getConfigValue is deprecated. Consider using SettingService.getConfigValue or the new settings system for ${section}.${key}`);
      const result = await SettingService.getConfigValue<T>(section, key, defaultValue);
      return result;
    } catch (error) {
      console.error('Failed to get config value:', error);
      return defaultValue ?? null;
    }
  };

  const setConfigValue = async (section: string, key: string, value: any): Promise<void> => {
    try {
      console.warn(`useConfig.setConfigValue is deprecated. Consider using SettingService.setConfigValue or the new settings system for ${section}.${key}`);
      await SettingService.setConfigValue(section, key, value);
    } catch (error) {
      console.error('Failed to set config value:', error);
    }
  };

  return {
    getConfigValue,
    setConfigValue,
  };
};
