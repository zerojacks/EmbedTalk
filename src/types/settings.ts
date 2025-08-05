/**
 * 应用设置类型定义
 * 这个文件定义了所有应用设置的类型和默认值
 */

// 地区选项
export type RegionOption = "南网" | "云南" | "广东" | "深圳" | "广西" | "贵州" | "海南" | "topo";

// 主题选项
export type ThemeOption = 'light' | 'dark' | 'system';

// 窗口设置
export interface WindowSettings {
  /** 最小化到托盘 */
  minimizeToTray: boolean;
  /** 关闭到托盘 */
  closeToTray: boolean | null; // null表示用户还未选择
  /** 启动时最小化 */
  startMinimized: boolean;
  /** 显示托盘通知 */
  showTrayNotifications: boolean;
  /** 窗口位置 */
  position?: {
    x: number;
    y: number;
  };
  /** 窗口大小 */
  size?: {
    width: number;
    height: number;
  };
}

// 应用设置
export interface AppSettings {
  /** 主题设置 */
  theme: ThemeOption;
  /** 语言设置 */
  language: 'zh-CN' | 'en-US';
}

// 快捷键设置
export interface ShortcutSettings {
  /** 解析文本 */
  parseText: string;
  /** 快速解析 */
  quickParse: string;
  /** 切换历史 */
  toggleHistory: string;
  /** 切换窗口 */
  toggleWindow: string;
}

// 解析设置
export interface ParseSettings {
  /** 自动解析 */
  autoParseEnabled: boolean;
  /** 解析超时时间（毫秒） */
  parseTimeout: number;
  /** 最大文件大小（MB） */
  maxFileSize: number;
  /** 支持的文件类型 */
  supportedFileTypes: string[];
}

// 通道设置
export interface ChannelSettings {
  /** 通道配置 */
  channels: any; // 这里使用 any 因为通道配置结构复杂
}

// 连接桥设置
export interface ConnectBridgeSettings {
  /** 连接桥配置 */
  connectcfg: any; // 这里使用 any 因为连接桥配置结构复杂
}

// 更新设置
export interface UpdateSettings {
  /** 自动检查更新 */
  autoCheck: boolean;
}

// 历史记录设置
export interface HistorySettings {
  /** 历史记录限制 */
  historyLimit: number;
}

export interface ProtocolSettings {
  /** 地区设置 */
  region: RegionOption;
}

// 完整的应用配置
export interface AppConfig {
  app: AppSettings;
  window: WindowSettings;
  shortcuts: ShortcutSettings;
  parse: ParseSettings;
  channels: ChannelSettings;
  connectcfg: ConnectBridgeSettings;
  updates: UpdateSettings;
  settings: HistorySettings;
  protocolsetting: ProtocolSettings;
}

// 配置键的映射，用于类型安全的配置访问
export interface ConfigKeyMap {
  'protocolsetting.region': RegionOption;
  'app.theme': ThemeOption;
  'app.language': 'zh-CN' | 'en-US';
  'window.minimizeToTray': boolean;
  'window.closeToTray': boolean | null;
  'window.startMinimized': boolean;
  'window.showTrayNotifications': boolean;
  'window.position': { x: number; y: number };
  'window.size': { width: number; height: number };
  'shortcuts.parseText': string;
  'shortcuts.quickParse': string;
  'shortcuts.toggleHistory': string;
  'shortcuts.toggleWindow': string;
  'parse.autoParseEnabled': boolean;
  'parse.parseTimeout': number;
  'parse.maxFileSize': number;
  'parse.supportedFileTypes': string[];
  'channels.channels': any;
  'connectcfg.connectcfg': any;
  'updates.autoCheck': boolean;
  'settings.historyLimit': number;
}

// 配置键类型
export type ConfigKey = keyof ConfigKeyMap;

// 默认配置
export const DEFAULT_CONFIG: AppConfig = {
  app: {
    theme: 'system',
    language: 'zh-CN'
  },
  window: {
    minimizeToTray: true,
    closeToTray: null, // 用户首次使用时需要选择
    startMinimized: false,
    showTrayNotifications: true,
    position: { x: 100, y: 100 },
    size: { width: 1200, height: 800 }
  },
  shortcuts: {
    parseText: 'Alt+Shift+P',
    quickParse: 'CommandOrControl+Shift+P',
    toggleHistory: 'Alt+Shift+H',
    toggleWindow: 'Alt+Shift+E'
  },
  parse: {
    autoParseEnabled: true,
    parseTimeout: 30000, // 30秒
    maxFileSize: 100, // 100MB
    supportedFileTypes: ['.txt', '.log', '.json', '.xml', '.csv']
  },
  channels: {
    channels: null // 通道配置将从后端加载
  },
  connectcfg: {
    connectcfg: null // 连接桥配置将从后端加载
  },
  updates: {
    autoCheck: false
  },
  settings: {
    historyLimit: 100
  },
  protocolsetting: {
    region: '南网',
  }
};

// 配置节名称
export const CONFIG_SECTIONS = {
  APP: 'app',
  WINDOW: 'window',
  SHORTCUTS: 'shortcuts',
  PARSE: 'parse'
} as const;

// 辅助函数：从配置键获取节和键名
export function parseConfigKey(configKey: ConfigKey): { section: string; key: string } {
  const [section, key] = configKey.split('.', 2);
  return { section, key };
}

// 辅助函数：从配置键获取默认值
export function getDefaultValue<K extends ConfigKey>(configKey: K): ConfigKeyMap[K] {
  const { section, key } = parseConfigKey(configKey);
  const sectionConfig = DEFAULT_CONFIG[section as keyof AppConfig] as any;
  return sectionConfig[key];
}
