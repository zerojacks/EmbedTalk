import { invoke } from "@tauri-apps/api/core";
import {
  AppConfig,
  ConfigKey,
  ConfigKeyMap,
  parseConfigKey,
  getDefaultValue,
  ThemeOption
} from "../types/settings";

/**
 * 类型安全的设置服务，用于管理应用程序设置
 * 使用 Tauri 的配置系统替代 localStorage
 */
export class SettingService {
  private static configCache = new Map<string, any>();
  private static isInitialized = false;
  private static initializationPromise: Promise<void> | null = null;

  /**
   * 初始化设置服务
   * 加载所有配置到缓存中
   */
  static async initialize(): Promise<void> {
    // 如果已经初始化，直接返回
    if (this.isInitialized) {
      return;
    }

    // 如果正在初始化，返回现有的 Promise
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // 开始初始化
    this.initializationPromise = this.doInitialize();
    return this.initializationPromise;
  }

  /**
   * 实际的初始化逻辑
   */
  private static async doInitialize(): Promise<void> {
    try {
      console.log('初始化设置服务...');

      // 预加载所有配置
      await this.loadAllConfigs();

      this.isInitialized = true;
      console.log('设置服务初始化完成');
    } catch (error) {
      console.error('设置服务初始化失败:', error);
      // 重置初始化 Promise，允许重试
      this.initializationPromise = null;
      throw error;
    }
  }

  /**
   * 加载所有配置到缓存
   */
  private static async loadAllConfigs(): Promise<void> {
    const configKeys: ConfigKey[] = [
      'protocolsetting.region', 'app.theme', 'app.language',
      'window.minimizeToTray', 'window.closeToTray', 'window.startMinimized',
      'window.showTrayNotifications', 'window.position', 'window.size',
      'shortcuts.parseText', 'shortcuts.quickParse', 'shortcuts.toggleHistory', 'shortcuts.toggleWindow',
      'parse.autoParseEnabled', 'parse.parseTimeout', 'parse.maxFileSize', 'parse.supportedFileTypes',
      'channels.channels', 'connectcfg.connectcfg', 'updates.autoCheck', 'settings.historyLimit'
    ];

    for (const configKey of configKeys) {
      try {
        const { section, key } = parseConfigKey(configKey);
        const value = await this.getConfigValueRaw(section, key);

        if (value !== null) {
          this.configCache.set(configKey, value);
        } else {
          // 如果配置不存在，只在缓存中使用默认值，不自动保存到文件
          const defaultValue = getDefaultValue(configKey);
          this.configCache.set(configKey, defaultValue);
          console.log(`配置 ${configKey} 不存在，使用默认值:`, defaultValue);
        }
      } catch (error) {
        console.warn(`加载配置 ${configKey} 失败:`, error);
        // 使用默认值
        const defaultValue = getDefaultValue(configKey);
        this.configCache.set(configKey, defaultValue);
      }
    }
  }

  /**
   * 类型安全地获取配置值
   * @param configKey 配置键
   * @returns 配置值
   */
  static async getConfig<K extends ConfigKey>(configKey: K): Promise<ConfigKeyMap[K]> {
    await this.ensureInitialized();

    if (this.configCache.has(configKey)) {
      return this.configCache.get(configKey);
    }

    // 如果缓存中没有，返回默认值
    const defaultValue = getDefaultValue(configKey);
    this.configCache.set(configKey, defaultValue);
    return defaultValue;
  }

  /**
   * 类型安全地设置配置值
   * @param configKey 配置键
   * @param value 配置值
   * @returns 是否设置成功
   */
  static async setConfig<K extends ConfigKey>(configKey: K, value: ConfigKeyMap[K]): Promise<boolean> {
    await this.ensureInitialized();

    try {
      const { section, key } = parseConfigKey(configKey);
      const success = await this.setConfigValueRaw(section, key, value);

      if (success) {
        // 更新缓存
        this.configCache.set(configKey, value);
      }

      return success;
    } catch (error) {
      console.error(`设置配置 ${configKey} 失败:`, error);
      return false;
    }
  }

  /**
   * 获取完整的配置对象
   * @returns 完整的应用配置
   */
  static async getAllConfig(): Promise<AppConfig> {
    await this.ensureInitialized();

    return {
      app: {
        theme: await this.getConfig('app.theme'),
        language: await this.getConfig('app.language')
      },
      window: {
        minimizeToTray: await this.getConfig('window.minimizeToTray'),
        closeToTray: await this.getConfig('window.closeToTray'),
        startMinimized: await this.getConfig('window.startMinimized'),
        showTrayNotifications: await this.getConfig('window.showTrayNotifications'),
        position: await this.getConfig('window.position'),
        size: await this.getConfig('window.size')
      },
      shortcuts: {
        parseText: await this.getConfig('shortcuts.parseText'),
        quickParse: await this.getConfig('shortcuts.quickParse'),
        toggleHistory: await this.getConfig('shortcuts.toggleHistory'),
        toggleWindow: await this.getConfig('shortcuts.toggleWindow')
      },
      parse: {
        autoParseEnabled: await this.getConfig('parse.autoParseEnabled'),
        parseTimeout: await this.getConfig('parse.parseTimeout'),
        maxFileSize: await this.getConfig('parse.maxFileSize'),
        supportedFileTypes: await this.getConfig('parse.supportedFileTypes')
      },
      channels: {
        channels: await this.getConfig('channels.channels')
      },
      connectcfg: {
        connectcfg: await this.getConfig('connectcfg.connectcfg')
      },
      updates: {
        autoCheck: await this.getConfig('updates.autoCheck')
      },
      settings: {
        historyLimit: await this.getConfig('settings.historyLimit')
      },
      protocolsetting: {
         region: await this.getConfig('protocolsetting.region'),
      }
    };
  }

  /**
   * 确保服务已初始化
   */
  private static async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  /**
   * 原始的获取配置值方法（内部使用）
   * @param section 配置区域
   * @param key 配置键
   * @returns 配置值
   */
  private static async getConfigValueRaw<T>(section: string, key: string): Promise<T | null> {
    try {
      const value = await invoke<any>("get_config_value_async", {
        section,
        key,
      });

      if (value !== null && value !== undefined) {
        try {
          // 如果是字符串，尝试解析 JSON
          if (typeof value === 'string') {
            if (value.startsWith('{') || value.startsWith('[')) {
              return JSON.parse(value) as T;
            }
            // 如果是布尔值字符串
            if (value === 'true' || value === 'false') {
              return (value === 'true') as unknown as T;
            }
            // 否则直接返回字符串值
            return value as unknown as T;
          }

          // 如果已经是对象或其他类型，直接返回
          return value as unknown as T;
        } catch (parseError) {
          console.warn(`解析配置值 ${key} 失败，使用原始值:`, parseError);
          return value as unknown as T;
        }
      }

      return null;
    } catch (error) {
      console.error(`获取配置 ${key} 失败:`, error);
      return null;
    }
  }

  /**
   * 原始的设置配置值方法（内部使用）
   * @param section 配置区域
   * @param key 配置键
   * @param value 配置值
   * @returns 是否设置成功
   */
  private static async setConfigValueRaw<T>(section: string, key: string, value: T): Promise<boolean> {
    try {
      // 将所有值序列化为JSON字符串，以便后端能够正确解析
      const valueToStore = JSON.stringify(value);

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

  // 便捷方法
  /**
   * 获取主题设置
   * @returns 返回保存的主题设置
   */
  static async getTheme(): Promise<ThemeOption> {
    return this.getConfig('app.theme');
  }

  /**
   * 设置主题
   * @param theme 要设置的主题
   * @returns 是否设置成功
   */
  static async setTheme(theme: ThemeOption): Promise<boolean> {
    return this.setConfig('app.theme', theme);
  }

  /**
   * 获取窗口设置
   */
  static async getWindowSettings() {
    return {
      minimizeToTray: await this.getConfig('window.minimizeToTray'),
      closeToTray: await this.getConfig('window.closeToTray'),
      startMinimized: await this.getConfig('window.startMinimized'),
      showTrayNotifications: await this.getConfig('window.showTrayNotifications'),
      position: await this.getConfig('window.position'),
      size: await this.getConfig('window.size')
    };
  }

  /**
   * 获取快捷键设置
   */
  static async getShortcutSettings() {
    return {
      parseText: await this.getConfig('shortcuts.parseText'),
      quickParse: await this.getConfig('shortcuts.quickParse'),
      toggleHistory: await this.getConfig('shortcuts.toggleHistory'),
      toggleWindow: await this.getConfig('shortcuts.toggleWindow')
    };
  }

  // 兼容性方法，保持向后兼容
  /**
   * @deprecated 使用 getConfig 替代
   */
  static async getConfigValue<T>(section: string, key: string, defaultValue?: T): Promise<T | null> {
    const result = await this.getConfigValueRaw<T>(section, key);
    return result !== null ? result : (defaultValue || null);
  }

  /**
   * @deprecated 使用 setConfig 替代
   */
  static async setConfigValue<T>(section: string, key: string, value: T): Promise<boolean> {
    return this.setConfigValueRaw(section, key, value);
  }
}
