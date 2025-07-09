import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { ChannelType, ConnectionState, ChannelMessage, ConnectionParams, TcpServerConfig, MqttConfig } from '../types/channel';
import { ThunkDispatch, AnyAction } from '@reduxjs/toolkit';
import { RootState } from '../store/index';
import { updateChannelState, updateMessageStats, updateTcpServerClient } from '../store/slices/channelSlice';
import { SettingService } from './settingService';

// 配置键常量
const CHANNEL_SECTION = "Channel";
const CHANNEL_CONFIG_KEY = "config";

// 默认通道配置
const DEFAULT_CHANNEL_CONFIGS: Record<ChannelType, ConnectionParams> = {
  tcpclient: {
    type: 'tcpclient',
    ip: '127.0.0.1',
    port: 8080
  },
  tcpserver: {
    type: 'tcpserver',
    ip: '0.0.0.0',
    port: 8080,
    children: []
  },
  serial: {
    type: 'serial',
    comname: 'COM1',
    baurdate: 9600,
    databit: 8,
    flowctrl: 0,
    parity: '无校验',
    stopbit: 1
  },
  mqtt: {
    type: 'mqtt',
    ip: '127.0.0.1',
    port: 1883,
    clientid: `mqtt-${Date.now()}`,
    username: '',
    password: '',
    qos: 2,
    topic: '#'
  },
  bluetooth: {
    type: 'bluetooth',
    bluetoothname: ''
  }
};

/**
 * 服务层 - 处理与 Tauri 后端的通信
 */
export class ChannelService {
  // 存储全局监听器的解绑函数
  private static channelStateUnlistener: UnlistenFn | null = null;
  private static messageUnlistener: UnlistenFn | null = null;
  private static tcpClientEventUnlistener: UnlistenFn | null = null;
  private static dispatch: ThunkDispatch<RootState, undefined, AnyAction> | null = null;

  /**
   * 清理连接参数，移除所有状态相关的属性
   * @param params 连接参数
   * @returns 清理后的连接参数
   */
  private static cleanConnectionParams(params: ConnectionParams): ConnectionParams {
    const cleanParams = { ...params };
    // 移除所有可能的状态相关属性
    delete (cleanParams as any).state;
    delete (cleanParams as any).channelId;
    delete (cleanParams as any).connected;
    delete (cleanParams as any).connecting;
    return cleanParams;
  }

  /**
   * 初始化通道服务，设置全局监听器
   * @param dispatch Redux dispatch 函数
   */
  static async initializeChannelService(dispatch: ThunkDispatch<RootState, undefined, AnyAction>): Promise<void> {
    this.dispatch = dispatch;

    // 监听通道状态变化事件
    this.channelStateUnlistener = await listen('channel-state', (event: any) => {
      try {
        const payload = JSON.parse(event.payload);
        const { channeltype, state } = payload;
        
        if (this.dispatch) {
          this.dispatch(updateChannelState({
            channelType: channeltype as ChannelType,
            state: state.toLowerCase() as ConnectionState
          }));
          console.log(`Channel state updated: ${channeltype} -> ${state}`);
        }
      } catch (error) {
        console.error('Error handling channel state event:', error);
      }
    });

    // 监听消息事件
    this.messageUnlistener = await listen('message-event', (event: any) => {
      try {
        const message: ChannelMessage = JSON.parse(event.payload);
        console.log('收到消息事件:', message);
        console.log('消息通道类型:', message.channeltype);
        console.log('消息通道ID:', message.channelId);
        console.log('消息方向:', message.direction);
        console.log('消息内容:', message.content);
        console.log('消息元数据:', message.metadata);
        
        if (this.dispatch) {
          this.dispatch(updateMessageStats(message));
          console.log(`Message stats updated for ${message.channelId}: ${message.direction}`);
        }
      } catch (error) {
        console.error('Error handling message event:', error);
        console.error('Error details:', error instanceof Error ? error.message : String(error));
        console.error('Event payload:', event.payload);
      }
    });

    // 监听TCP客户端连接/断开事件
    this.tcpClientEventUnlistener = await listen('tcp-client-event', (event: any) => {
      try {
        console.log('收到TCP客户端原始事件:', event.payload);
        const eventData = JSON.parse(event.payload);
        console.log('TCP客户端事件解析结果:', eventData);
        
        if (this.dispatch && eventData.channel === 'tcpserver') {
          if (eventData.eventType === 'clientConnected') {
            console.log(`处理TCP客户端连接事件: ${eventData.ip}:${eventData.port}, ID: ${eventData.clientId}`);
            this.dispatch(updateTcpServerClient({
              channelId: eventData.clientId,
              ip: eventData.ip,
              port: eventData.port,
              state: 'connected'
            }));
            console.log(`已更新Redux状态: TCP客户端已连接: ${eventData.ip}:${eventData.port}`);
          } else if (eventData.eventType === 'clientDisconnected') {
            console.log(`处理TCP客户端断开事件: ${eventData.ip}:${eventData.port}, ID: ${eventData.clientId}`);
            this.dispatch(updateTcpServerClient({
              channelId: eventData.clientId,
              ip: eventData.ip,
              port: eventData.port,
              state: 'disconnected'
            }));
            console.log(`已更新Redux状态: TCP客户端已断开: ${eventData.ip}:${eventData.port}`);
          }
        } else {
          console.warn('无法处理TCP客户端事件:', this.dispatch ? 'dispatch可用但事件类型/通道不匹配' : 'dispatch不可用', eventData);
        }
      } catch (error) {
        console.error('处理TCP客户端事件错误:', error);
        console.error('错误详情:', error instanceof Error ? error.message : String(error));
        console.error('事件内容:', event.payload);
        // 尝试重新解析并处理
        try {
          const retryEventData = JSON.parse(event.payload);
          console.log('重试解析TCP客户端事件:', retryEventData);
          if (this.dispatch && retryEventData.channel === 'tcpserver' && 
              (retryEventData.eventType === 'clientConnected' || retryEventData.eventType === 'clientDisconnected')) {
            console.log('尝试强制更新客户端状态:', retryEventData);
            this.dispatch(updateTcpServerClient({
              channelId: retryEventData.clientId,
              ip: retryEventData.ip,
              port: retryEventData.port,
              state: retryEventData.eventType === 'clientConnected' ? 'connected' : 'disconnected'
            }));
          }
        } catch (retryError) {
          console.error('重试处理TCP客户端事件失败:', retryError);
        }
      }
    });

    console.log('Channel service initialized with global listeners');
  }

  /**
   * 清理所有监听器
   */
  static async cleanupListeners(): Promise<void> {
    if (this.channelStateUnlistener && typeof this.channelStateUnlistener === 'function') {
      try {
        await this.channelStateUnlistener();
      } catch (error) {
        console.error('清理channelStateUnlistener失败:', error);
      }
      this.channelStateUnlistener = null;
    }
    if (this.messageUnlistener && typeof this.messageUnlistener === 'function') {
      try {
        await this.messageUnlistener();
      } catch (error) {
        console.error('清理messageUnlistener失败:', error);
      }
      this.messageUnlistener = null;
    }
    if (this.tcpClientEventUnlistener && typeof this.tcpClientEventUnlistener === 'function') {
      try {
        await this.tcpClientEventUnlistener();
      } catch (error) {
        console.error('清理tcpClientEventUnlistener失败:', error);
      }
      this.tcpClientEventUnlistener = null;
    }
    this.dispatch = null;
  }

  /**
   * 加载保存的通道配置
   * @returns 保存的通道配置
   */
  static async loadChannelConfigs(): Promise<Record<ChannelType, ConnectionParams>> {
    try {
      // 从配置文件加载参数
      const rawValue = await invoke<string>("get_config_value_async", {
        section: CHANNEL_SECTION,
        key: CHANNEL_CONFIG_KEY,
      });

      let configs: Record<ChannelType, ConnectionParams>;
      
      if (rawValue) {
        try {
          // 尝试解析配置
          configs = typeof rawValue === 'string' ? 
            JSON.parse(rawValue) : 
            rawValue as Record<ChannelType, ConnectionParams>;
        } catch (error) {
          console.warn('解析通道配置失败，使用默认配置:', error);
          configs = DEFAULT_CHANNEL_CONFIGS;
        }
      } else {
        configs = DEFAULT_CHANNEL_CONFIGS;
      }

      // 确保返回的配置不包含任何状态信息
      Object.keys(configs).forEach((key) => {
        const channelType = key as ChannelType;
        const cleanConfig = this.cleanConnectionParams(configs[channelType] || {});
        
        // 检查配置是否为空或缺少必要参数，如果是则使用默认值
        switch (channelType) {
          case 'tcpclient':
            configs[channelType] = {
              ...DEFAULT_CHANNEL_CONFIGS.tcpclient,
              ...cleanConfig
            };
            break;
          case 'tcpserver':
            configs[channelType] = {
              ...DEFAULT_CHANNEL_CONFIGS.tcpserver,
              ...cleanConfig,
              children: (cleanConfig as TcpServerConfig).children || []
            } as TcpServerConfig;
            break;
          case 'serial':
            configs[channelType] = {
              ...DEFAULT_CHANNEL_CONFIGS.serial,
              ...cleanConfig
            };
            break;
          case 'mqtt':
            configs[channelType] = {
              ...DEFAULT_CHANNEL_CONFIGS.mqtt,
              ...cleanConfig,
              clientid: (cleanConfig as MqttConfig).clientid || `mqtt-${Date.now()}`
            } as MqttConfig;
            break;
          case 'bluetooth':
            configs[channelType] = {
              ...DEFAULT_CHANNEL_CONFIGS.bluetooth,
              ...cleanConfig
            };
            break;
        }
      });

      // 确保所有通道类型都存在
      Object.keys(DEFAULT_CHANNEL_CONFIGS).forEach((key) => {
        const channelType = key as ChannelType;
        if (!configs[channelType]) {
          configs[channelType] = {};
        }
      });

      return configs;
    } catch (error) {
      console.error('加载通道配置失败:', error);
      return DEFAULT_CHANNEL_CONFIGS;
    }
  }

  /**
   * 连接通道
   * @param channelType 通道类型
   * @param params 连接参数
   * @returns 通道ID
   */
  static async connectChannel(channelType: ChannelType, params: ConnectionParams): Promise<string> {
    try {
      console.log('连接通道:', channelType, params);

      // 调用后端连接
      const channelId = await invoke<string>('connect_channel', { 
        channel: channelType,
        params: JSON.stringify(params)
      });

      // 保存配置到文件
      const configs = await this.loadChannelConfigs();
      
      // 只保存必要的连接参数
      configs[channelType] = this.cleanConnectionParams(params);

      
      // 保存到配置文件
      await invoke("set_config_value_async", {
        section: CHANNEL_SECTION,
        key: CHANNEL_CONFIG_KEY,
        value: JSON.stringify(configs)
      });

      return channelId;
    } catch (error) {
      console.error(`连接通道失败: ${channelType}`, error);
      throw error;
    }
  }

  /**
   * 断开通道连接
   * @param channelId 通道ID
   */
  static async disconnectChannel(channelId: string): Promise<void> {
    try {
      await invoke('disconnect_channel', { channelid:channelId });
    } catch (error) {
      console.error(`断开通道失败: ${channelId}`, error);
      throw error;
    }
  }

  /**
   * 检查通道连接状态
   * @param channelType 通道类型
   * @param connectionParams 连接参数
   */
  static async checkChannelConnection(channelType: ChannelType, connectionParams: any): Promise<boolean> {
    try {
      const result = await invoke<boolean>('check_channel_connection', {
        channel: channelType,
        values: JSON.stringify(connectionParams)
      });
      return result;
    } catch (error) {
      console.error(`Error checking connection for ${channelType}:`, error);
      return false;
    }
  }

  /**
   * 发送消息
   * @param channelid 通道ID
   * @param message 消息内容
   * @param isHex 是否为十六进制字符串
   * @param clientId 可选，TCP服务器客户端ID，用于指定发送目标
   */
  static async sendMessage(
    channelid: string, 
    message: string, 
    isHex: boolean = false,
    clientId?: string
  ): Promise<void> {
    try {
      // 处理消息内容
      let messageBytes: number[] = [];
      
      if (isHex) {
        // 如果是十六进制字符串，转换为字节数组
        const hexString = message.replace(/\s+/g, ''); // 移除所有空白字符
        if (!/^[0-9A-Fa-f]+$/.test(hexString)) {
          throw new Error('无效的十六进制字符串');
        }
        
        if (hexString.length % 2 !== 0) {
          throw new Error('十六进制字符串长度必须为偶数');
        }
        
        for (let i = 0; i < hexString.length; i += 2) {
          messageBytes.push(parseInt(hexString.substr(i, 2), 16));
        }
      } else {
        // 如果是普通字符串，转换为UTF-8字节数组
        for (let i = 0; i < message.length; i++) {
          messageBytes.push(message.charCodeAt(i));
        }
      }

      // 准备发送参数
      const sendParams: any = {
        channelid,
        message: messageBytes,
        clientid: clientId
      };

      console.log('发送消息参数:', {
        channelid,
        clientId,
        hexString: isHex ? message.replace(/\s+/g, '') : undefined,
        messageBytes,
        isHex,
        sendParams
      });

      // 调用send_message函数
      console.log('调用send_message，参数:', sendParams);
      await invoke('send_message', sendParams);
      console.log('send_message调用完成');
    } catch (error) {
      console.error('发送消息失败:', error);
      console.error('详细信息:', {
        error,
        message: error instanceof Error ? error.message : String(error),
        channelid,
        clientId,
        isHex
      });
      throw error;
    }
  }

  /**
   * 发送MQTT消息
   * @param channelId 通道ID
   * @param topic 主题
   * @param message 消息内容
   * @param isHex 是否为十六进制字符串
   */
  static async sendMqttMessage(
    channelId: string,
    topic: string,
    message: string,
    qos: number,
    retain: boolean = false
  ): Promise<void> {
    try {
      const jsonMessage = JSON.stringify({
        "topic": topic,
        "payload": message,
        "qos": qos,
        "retain": retain
      });
      const messageBytes = new TextEncoder().encode(jsonMessage);
      const sendParams: any = {
        channelId,
        message: messageBytes,
        clientid: channelId
      };

      await invoke('send_mqtt_message', sendParams);
    } catch (error) {
      console.error('发送MQTT消息失败:', error);
      throw error;  
    }
  }

  /**
   * 启动定时发送
   * @param channelType 通道类型
   * @param message 消息内容
   * @param intervalMs 间隔时间（毫秒）
   * @param isHex 是否为十六进制字符串
   */
  static async startTimerSend(
    channelType: ChannelType, 
    message: string, 
    intervalMs: number, 
    isHex: boolean = false
  ): Promise<void> {
    try {
      // 处理消息内容
      let messageBytes: number[] = [];
      
      if (isHex) {
        // 如果是十六进制字符串，转换为字节数组
        const hexString = message.replace(/\s+/g, ''); // 移除所有空白字符
        if (!/^[0-9A-Fa-f]+$/.test(hexString)) {
          throw new Error('无效的十六进制字符串');
        }
        
        if (hexString.length % 2 !== 0) {
          throw new Error('十六进制字符串长度必须为偶数');
        }
        
        for (let i = 0; i < hexString.length; i += 2) {
          messageBytes.push(parseInt(hexString.substr(i, 2), 16));
        }
      } else {
        // 如果是普通字符串，转换为UTF-8字节数组
        for (let i = 0; i < message.length; i++) {
          messageBytes.push(message.charCodeAt(i));
        }
      }

      console.log(`启动定时发送到 ${channelType}`, { 
        message,
        messageBytes,
        intervalMs,
        isHex
      });

      return invoke('start_timer_send', {
        channel: channelType,
        message: messageBytes,
        intervalMs
      });
    } catch (error) {
      console.error(`启动定时发送失败:`, error);
      throw error;
    }
  }

  /**
   * 停止定时发送
   * @param channelType 通道类型
   */
  static async stopTimerSend(channelType: ChannelType): Promise<void> {
    try {
      console.log(`停止定时发送 ${channelType}`);

      return invoke('stop_timer_send', {
        channel: channelType
      });
    } catch (error) {
      console.error(`停止定时发送失败:`, error);
      throw error;
    }
  }

  /**
   * 获取定时发送状态
   * @param channelType 通道类型
   */
  static async getTimerStatus(channelType: ChannelType): Promise<[number, number[]] | null> {
    try {
      return invoke<[number, number[]] | null>('get_timer_status', {
        channel: channelType
      });
    } catch (error) {
      console.error(`获取定时发送状态失败:`, error);
      return null;
    }
  }

  // MQTT 相关方法
  static async subscribeMqttTopic(channelId: string, topic: string, qos: number): Promise<void> {
    await invoke('subscribe_mqtt_topic', { channelId, topic, qos });
  }

  static async unsubscribeMqttTopic(channelId: string, topic: string): Promise<void> {
    await invoke('unsubscribe_mqtt_topic', { channelId, topic });
  }
}
