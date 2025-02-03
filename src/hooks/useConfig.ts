import { invoke } from '@tauri-apps/api/core';

export const useConfig = () => {
  const getConfigValue = async (key: string): Promise<string> => {
    try {
      return await invoke('get_config_value_async', { key });
    } catch (error) {
      console.error('Failed to get config value:', error);
      return '';
    }
  };

  const setConfigValue = async (key: string, value: string): Promise<void> => {
    try {
      await invoke('set_config_value_async', { key, value });
    } catch (error) {
      console.error('Failed to set config value:', error);
    }
  };

  return {
    getConfigValue,
    setConfigValue,
  };
};
