import { invoke } from '@tauri-apps/api/core';

export const useConfig = () => {
  const getConfigValue = async <T = any>(section: string, key: string, defaultValue?: T): Promise<T | null> => {
    try {
      const result = await invoke('get_config_value_async', { section, key });

      if (result === null || result === undefined) {
        return defaultValue ?? null;
      }

      // 后端返回的是JSON值，需要直接返回
      return result as T;
    } catch (error) {
      console.error('Failed to get config value:', error);
      return defaultValue ?? null;
    }
  };

  const setConfigValue = async (section: string, key: string, value: any): Promise<void> => {
    try {
      // 将值序列化为JSON字符串，以便后端能够正确解析
      let jsonValue: string;

      if (typeof value === 'string') {
        // 如果是字符串，需要将其作为JSON字符串值
        jsonValue = JSON.stringify(value);
      } else if (typeof value === 'object') {
        // 如果是对象，直接序列化
        jsonValue = JSON.stringify(value);
      } else {
        // 其他类型（number, boolean等）也序列化为JSON
        jsonValue = JSON.stringify(value);
      }

      await invoke('set_config_value_async', { section, key, value: jsonValue });
    } catch (error) {
      console.error('Failed to set config value:', error);
    }
  };

  return {
    getConfigValue,
    setConfigValue,
  };
};
