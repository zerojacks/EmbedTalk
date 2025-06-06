import { invoke } from "@tauri-apps/api/core";
import { ThemeOption } from "../store/slices/themeSlice";

/**
 * 设置服务，用于管理应用程序设置
 */
export class SettingService {
  /**
   * 获取主题设置
   * @returns 返回保存的主题设置
   */
  static async getTheme(): Promise<ThemeOption | null> {
    try {
      const themeValue = await this.getConfigValue<string>("MainWindow", "theme");
      
      // 如果值存在，尝试解析 JSON 字符串
      if (themeValue) {
        try {
          // 如果是字符串形式的 JSON，尝试解析
          if (typeof themeValue === 'string' && (themeValue.startsWith('{') || themeValue.startsWith('['))) {
            return JSON.parse(themeValue) as ThemeOption;
          }
          // 否则直接返回值
          return themeValue as ThemeOption;
        } catch (parseError) {
          console.warn("解析主题值失败，使用原始值:", parseError);
          return themeValue as ThemeOption;
        }
      }
      
      return null;
    } catch (error) {
      console.error("获取主题设置失败:", error);
      return null;
    }
  }

  /**
   * 设置主题
   * @param theme 要设置的主题
   * @returns 是否设置成功
   */
  static async setTheme(theme: ThemeOption): Promise<boolean> {
    try {
      // 对于对象类型的值，进行 JSON 序列化
      const themeToStore = typeof theme === 'object' ? JSON.stringify(theme) : theme;
      
      await this.setConfigValue("MainWindow", "theme", themeToStore);
      return true;
    } catch (error) {
      console.error("设置主题失败:", error);
      return false;
    }
  }

  /**
   * 获取配置值
   * @param section 配置区域
   * @param key 配置键
   * @param defaultValue 默认值
   * @returns 配置值
   */
  static async getConfigValue<T>(section: string, key: string, defaultValue?: T): Promise<T | null> {
    try {
      const value = await invoke<string>("get_config_value_async", {
        section,
        key,
      });
      
      if (value) {
        try {
          // 如果是字符串形式的 JSON，尝试解析
          if (value.startsWith('{') || value.startsWith('[')) {
            return JSON.parse(value) as T;
          }
          // 如果期望的是布尔值
          if (defaultValue !== undefined && typeof defaultValue === 'boolean') {
            return (value === 'true') as unknown as T;
          }
          // 否则直接返回值
          return value as unknown as T;
        } catch (parseError) {
          console.warn(`解析配置值 ${key} 失败，使用原始值:`, parseError);
          return value as unknown as T;
        }
      }
      
      return defaultValue || null;
    } catch (error) {
      console.error(`获取配置 ${key} 失败:`, error);
      return defaultValue || null;
    }
  }

  /**
   * 设置配置值
   * @param section 配置区域
   * @param key 配置键
   * @param value 配置值
   * @returns 是否设置成功
   */
  static async setConfigValue<T>(section: string, key: string, value: T): Promise<boolean> {
    try {
      // 确保所有值都转换为字符串
      let valueToStore: string;
      
      if (typeof value === 'object') {
        valueToStore = JSON.stringify(value);
      } else if (typeof value === 'boolean') {
        valueToStore = value ? 'true' : 'false';
      } else {
        valueToStore = String(value);
      }
      
      await invoke("set_config_value_async", {
        section,
        key,
        value: valueToStore,
      });
      return true;
    } catch (error) {
      console.error(`设置配置 ${key} 失败:`, error);
      return false;
    }
  }
}
