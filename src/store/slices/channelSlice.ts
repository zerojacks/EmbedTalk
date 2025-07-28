import { createSlice, createAsyncThunk, PayloadAction, createSelector } from '@reduxjs/toolkit';
import { ChannelService } from '../../services/channelService';
import { SettingService } from '../../services/settingService';
import {
  ChannelType,
  ConnectionState,
  ConnectionParams,
  ChannelMessage,
  MessageStats,
  ChannelConfigMap,
  ConnectBridgeInfo,
  TcpClientConfig,
  TcpServerConfig,
  SerialConfig,
  MqttConfig,
  BluetoothConfig,
  ChannelConfig,
  BaseChannelConfig,
  TcpServerClient
} from '../../types/channel';
import { RootState } from '../index';
import { toast } from '../../context/ToastProvider';
import { invoke } from '@tauri-apps/api/core';
import { ThunkDispatch } from '@reduxjs/toolkit';
import { AnyAction } from 'redux';
import { AppDispatch } from '../index';

// 辅助函数 - 获取通道名称
const getChannelName = (channel: ChannelType): string => {
  switch (channel) {
    case "tcpclient": return "TCP客户端";
    case "tcpserver": return "TCP服务端";
    case "serial": return "串口";
    case "mqtt": return "MQTT";
    case "bluetooth": return "蓝牙";
    default: return "";
  }
};

// 辅助函数 - 获取状态名称
const getStateName = (state: ConnectionState): string => {
  switch (state) {
    case "connected": return "已连接";
    case "connecting": return "连接中";
    case "disconnected": return "已断开";
    case "disconnecting": return "断开中";
    case "error": return "错误";
    default: return "";
  }
};

// 辅助函数 - 获取通知消息
const getToastMessage = (channel: ChannelType, payload: any, action: ConnectionState): string => {
  switch (channel) {
    case "tcpclient":
      return `${getChannelName(channel)}:${payload.ip}:${payload.port} ${getStateName(action)}`;
    case "tcpserver":
      return `${getChannelName(channel)}:${payload.ip}:${payload.port} ${getStateName(action)}`;
    case "serial":
      return `${getChannelName(channel)}:${payload.comname} ${getStateName(action)}`;
    case "mqtt":
      return `${getChannelName(channel)}: ${payload.ip}:${payload.port} ${getStateName(action)}`;
    case "bluetooth":
      return `${getChannelName(channel)}:${payload.bluetoothname} ${getStateName(action)}`;
    default:
      return "断开连接";
  }
};

interface LocalMessageStats {
    sent: number;
    received: number;
    lastMessageTime?: string | number;
}

interface ChannelState {
    channels: Partial<{
        tcpclient: TcpClientConfig;
        tcpserver: TcpServerConfig;
        serial: SerialConfig;
        mqtt: MqttConfig;
        bluetooth: BluetoothConfig;
    }>;
    messageStats: { [key: string]: LocalMessageStats };
    messageHistory: { [key: string]: ChannelMessage[] };
    loading: boolean;
    error: string | null;
    serviceInitialized: boolean;
}

const initialState: ChannelState = {
    channels: {
        tcpclient: {
            type: 'tcpclient',
            ip: '',
            port: 0,
            state: 'disconnected',
            channelId: undefined
        },
        tcpserver: {
            type: 'tcpserver',
            ip: '',
            port: 0,
            state: 'disconnected',
            channelId: undefined,
            children: []
        },
        serial: {
            type: 'serial',
            comname: '',
            baurdate: 9600,
            state: 'disconnected',
            channelId: undefined
        },
        mqtt: {
            type: 'mqtt',
            ip: '127.0.0.1',
            port: 1883,
            state: 'disconnected',
            channelId: undefined,
            qos: 2,
            version: '3.1.1',
            topics: [{
                topic: '#',
                qos: 2,
                alias: '',
                color: '#ED01AF'
            }]
        },
        bluetooth: {
            type: 'bluetooth',
            bluetoothname: '',
            state: 'disconnected',
            channelId: undefined
        }
    },
    messageStats: {},
    messageHistory: {},
    loading: false,
    error: null,
    serviceInitialized: false
};

// 异步 Thunk - 初始化通道服务
export const initializeChannelService = createAsyncThunk<
  boolean,
  undefined,
  { 
    state: RootState;
    dispatch: ThunkDispatch<RootState, undefined, AnyAction>;
  }
>(
  'channel/initService',
  async (_, { dispatch }) => {
    try {
      // 初始化通道服务，传入 dispatch 以便服务可以更新状态
      await ChannelService.initializeChannelService(dispatch);
      
      // 初始化成功后立即加载配置
      dispatch(loadChannelConfigs());
      
      return true;
    } catch (error) {
      console.error("Error initializing channel service:", error);
      return false;
    }
  }
);

// 异步 Thunk - 加载通道配置
export const loadChannelConfigs = createAsyncThunk<
  Record<ChannelType, ConnectionParams>,
  void,
  { state: RootState }
>(
  'channel/loadConfigs',
  async () => {
    try {
      // 从配置文件加载参数
      const configs = await ChannelService.loadChannelConfigs();
      return configs;
    } catch (error) {
      console.error('加载通道配置失败:', error);
      throw error;
    }
  }
);

// 异步 Thunk - 从配置文件加载连接参数
export const loadChannelConfig = createAsyncThunk<
  Partial<ChannelConfigMap>,
  undefined,
  { state: RootState; rejectValue: string }
>(
  'channel/loadConfig',
  async (_, { rejectWithValue }) => {
    try {
      // 从配置文件加载连接信息
      console.log("Loading channel configuration from file");
      const connectInfo = await SettingService.getConfig('connectcfg.connectcfg') as ConnectBridgeInfo;
      
      if (connectInfo) {
        // 设置默认状态
        const configWithDisconnectedState = { ...connectInfo };
        
        // 确保所有通道的连接状态为断开状态
        Object.keys(configWithDisconnectedState).forEach(key => {
          const channelType = key as ChannelType;
          if (configWithDisconnectedState[channelType]) {
            const config = configWithDisconnectedState[channelType];
            if (config) {
              config.state = 'disconnected' as ConnectionState;
            }
          }
        });
        
        // 设置默认信息
        if (!configWithDisconnectedState.tcpclient) {
          configWithDisconnectedState.tcpclient = {
            type: 'tcpclient' as const,
            ip: '',
            port: 0,
            state: 'disconnected' as ConnectionState
          };
        }
        if (!configWithDisconnectedState.tcpserver) {
          configWithDisconnectedState.tcpserver = {
            type: 'tcpserver' as const,
            ip: '',
            port: 0,
            state: 'disconnected' as ConnectionState,
            children: []
          };
        }
        if (!configWithDisconnectedState.serial) {
          configWithDisconnectedState.serial = {
            type: 'serial' as const,
            comname: '',
            baurdate: 9600,
            state: 'disconnected' as ConnectionState
          };
        }
        if (!configWithDisconnectedState.mqtt) {
          configWithDisconnectedState.mqtt = {
            type: 'mqtt' as const,
            ip: '',
            port: 0,
            state: 'disconnected' as ConnectionState
          };
        }
        if (!configWithDisconnectedState.bluetooth) {
          configWithDisconnectedState.bluetooth = {
            type: 'bluetooth' as const,
            bluetoothname: '',
            state: 'disconnected' as ConnectionState
          };
        }
        
        return configWithDisconnectedState;
      } else {
        console.log("No configuration found, using defaults");
        return initialState.channels;
      }
    } catch (error) {
      console.error("Error loading channel configuration:", error);
      return rejectWithValue(error instanceof Error ? error.message : String(error));
    }
  }
);

// 异步 Thunk - 保存配置到本地存储
export const saveChannelConfig = createAsyncThunk<
  boolean,
  undefined,
  { state: RootState }
>(
  'channel/saveConfig',
  async (_, { getState }) => {
    try {
      const state = getState();
      const { channels } = state.channel;
      
      // 创建一个干净的配置对象，移除不需要序列化的字段
      const cleanInfo: Partial<Record<ChannelType, any>> = {};
      
      // 为每个通道创建不包含状态的配置
      Object.entries(channels).forEach(([key, config]) => {
        if (config) {
          const channelType = key as ChannelType;
          // 排除 state 属性，只保留其他配置
          const { state, ...configWithoutState } = config;
          cleanInfo[channelType] = configWithoutState;
        }
      });
      
      // 将配置对象转换为 JSON 字符串
      await invoke("set_config_value_async", {
        section: "connectcfg",
        key: "channels",
        value: JSON.stringify(cleanInfo)
      });
      console.log("Configuration saved successfully");
      return true;
    } catch (error) {
      console.error("Error saving configuration:", error);
      return false;
    }
  }
);

// 异步 Thunk - 连接通道
export const connectChannel = createAsyncThunk<
  { channelType: ChannelType; state: ConnectionState; channelId: string },
  { channelType: ChannelType; params: any },
  { state: RootState; rejectValue: { channelType: ChannelType; error: string } }
>(
  'channel/connect',
  async ({ channelType, params }, { dispatch, rejectWithValue }) => {
    try {
      // 更新状态为连接中
      dispatch(updateChannelState({ channelType, state: 'connecting' }));
      
      // 调用服务连接通道
      const channelId = await ChannelService.connectChannel(channelType, params);
      
      // 更新状态，包含 channelId
      dispatch(updateChannelState({ channelType, state: 'connected', channelId }));
      
      // 显示连接成功通知
      const message = getToastMessage(channelType, params, 'connected');
      toast.success(message, 'end', 'bottom', 3000);
      
      return { channelType, state: 'connected' as ConnectionState, channelId };
    } catch (error) {
      console.error(`Error connecting to ${channelType}:`, error);
      
      // 显示连接失败通知
      const message = getToastMessage(channelType, params, 'error');
      toast.error(message, 'end', 'bottom', 3000);
      
      return rejectWithValue({ channelType, error: String(error) });
    }
  }
);

// 异步 Thunk - 断开通道
export const disconnectChannel = createAsyncThunk<
  { channelType: ChannelType; state: ConnectionState },
  { channelType: ChannelType; channelId: string; params: any },
  { state: RootState; rejectValue: { channelType: ChannelType; error: string } }
>(
  'channel/disconnect',
  async ({ channelType, channelId, params }, { dispatch, rejectWithValue }) => {
    try {
      // 更新状态为断开中
      dispatch(updateChannelState({ channelType, state: 'disconnecting' }));
      
      // 调用服务断开通道
      await ChannelService.disconnectChannel(channelId);
      
      // 显示断开连接通知
      const message = getToastMessage(channelType, params, 'disconnected');
      toast.warning(message, 'end', 'bottom', 3000);
      
      return { channelType, state: 'disconnected' as ConnectionState };
    } catch (error) {
      console.error(`Error disconnecting from ${channelType}:`, error);
      
      // 显示断开失败通知
      const message = getToastMessage(channelType, params, 'error');
      toast.error(message, 'end', 'bottom', 3000);
      
      return rejectWithValue({ channelType, error: String(error) });
    }
  }
);

// 异步 Thunk - 验证所有通道连接
export const verifyAllConnections = createAsyncThunk<
  Record<ChannelType, boolean>,
  undefined,
  { state: RootState }
>(
  'channel/verifyAll',
  async (_, { getState, dispatch }) => {
    const state = getState();
    const { channels } = state.channel;
    
    const results: Record<ChannelType, boolean> = {
      tcpclient: false,
      tcpserver: false,
      serial: false,
      mqtt: false,
      bluetooth: false
    };
    
    // 检查每个通道的连接状态
    for (const [type, config] of Object.entries(channels)) {
      if (config?.state === 'connected') {
        try {
          const isConnected = await ChannelService.checkChannelConnection(type as ChannelType, config);
          results[type as ChannelType] = isConnected;
          
          // 如果连接状态不一致，更新状态
          if (!isConnected) {
            dispatch(updateChannelState({ 
              channelType: type as ChannelType, 
              state: 'disconnected' 
            }));
          }
        } catch (error) {
          console.error(`Error verifying connection for ${type}:`, error);
          results[type as ChannelType] = false;
          
          // 更新为断开状态
          dispatch(updateChannelState({ 
            channelType: type as ChannelType, 
            state: 'disconnected' 
          }));
        }
      }
    }
    
    return results;
  }
);

// 添加MQTT主题订阅的异步Thunk
export const subscribeMqttTopic = createAsyncThunk<
  void,
  { channelId: string; topic: string; qos: number; alias?: string; color?: string },
  { state: RootState }
>(
  'channel/subscribeMqttTopic',
  async ({ channelId, topic, qos, alias, color }, { dispatch, getState }) => {
    await ChannelService.subscribeMqttTopic(channelId, topic, qos);
    
    // 更新store中的topics
    const state = getState();
    const mqttConfig = state.channel.channels.mqtt;
    
    if (mqttConfig && mqttConfig.channelId === channelId) {
      const currentTopics = mqttConfig.topics || [];
      const newTopic = {
        topic,
        qos,
        alias: alias || topic,
        color: color || '#b5a2a6'
      };
      
      dispatch(updateChannelState({
        channelType: 'mqtt',
        state: mqttConfig.state || 'connected',
        config: {
          ...mqttConfig,
          topics: [...currentTopics, newTopic]
        }
      }));
    }
  }
);

// 取消MQTT主题订阅的异步Thunk
export const unsubscribeMqttTopic = createAsyncThunk<
  void,
  { channelId: string; topic: string },
  { state: RootState }
>(
  'channel/unsubscribeMqttTopic',
  async ({ channelId, topic }, { dispatch, getState }) => {
    await ChannelService.unsubscribeMqttTopic(channelId, topic);
    
    // 从store中移除topic
    const state = getState();
    const mqttConfig = state.channel.channels.mqtt;
    
    if (mqttConfig && mqttConfig.channelId === channelId) {
      const currentTopics = mqttConfig.topics || [];
      
      dispatch(updateChannelState({
        channelType: 'mqtt',
        state: mqttConfig.state || 'connected',
        config: {
          ...mqttConfig,
          topics: currentTopics.filter(t => t.topic !== topic)
        }
      }));
    }
  }
);

// 创建 Slice
const channelSlice = createSlice({
  name: 'channel',
  initialState,
  reducers: {
    // 设置连接信息
    setConnectInfo: (state, action: PayloadAction<Partial<ConnectBridgeInfo>>) => {
      state.channels = {
        ...state.channels,
        ...action.payload
      };
      // 当连接信息更新时，自动保存配置
      saveChannelConfig();
    },
    
    // 更新通道状态
    updateChannelState: (
      state,
      action: PayloadAction<{
        channelType: ChannelType;
        state: ConnectionState;
        config?: Partial<ChannelConfig>;
        channelId?: string;
      }>
    ) => {
      const { channelType, state: channelState, config, channelId } = action.payload;
      console.log(`更新通道状态: ${channelType}, 状态: ${channelState}, ID: ${channelId || '未设置'}`);

      // 确保通道存在并且有正确的初始值
      if (!state.channels[channelType]) {
        const defaultConfig = initialState.channels[channelType];
        if (defaultConfig) {
            switch (channelType) {
                case 'tcpclient':
                    state.channels.tcpclient = {
                        ...defaultConfig,
                        state: channelState,
                        channelId: channelId
                    } as TcpClientConfig;
                    break;
                case 'tcpserver':
                    state.channels.tcpserver = {
                        ...defaultConfig,
                        state: channelState,
                        channelId: channelId
                    } as TcpServerConfig;
                    break;
                case 'serial':
                    state.channels.serial = {
                        ...defaultConfig,
                        state: channelState,
                        channelId: channelId
                    } as SerialConfig;
                    break;
                case 'mqtt':
                    state.channels.mqtt = {
                        ...defaultConfig,
                        state: channelState,
                        channelId: channelId
                    } as MqttConfig;
                    break;
                case 'bluetooth':
                    state.channels.bluetooth = {
                        ...defaultConfig,
                        state: channelState,
                        channelId: channelId
                    } as BluetoothConfig;
                    break;
            }
        }
      }

      // 如果提供了配置，更新配置
      if (config) {
        const currentConfig = state.channels[channelType];
        if (!currentConfig) return;
        
        switch (channelType) {
            case 'tcpclient': {
                const tcpConfig = currentConfig as TcpClientConfig;
                state.channels.tcpclient = {
                    ...tcpConfig,
                    ...config,
                    type: 'tcpclient',
                    ip: (config as TcpClientConfig).ip || tcpConfig.ip || '',
                    port: (config as TcpClientConfig).port || tcpConfig.port || 0,
                    state: channelState,
                    channelId: channelId || config.channelId || tcpConfig.channelId
                } as TcpClientConfig;
                break;
            }
            case 'tcpserver': {
                const tcpConfig = currentConfig as TcpServerConfig;
                state.channels.tcpserver = {
                    ...tcpConfig,
                    ...config,
                    type: 'tcpserver',
                    ip: (config as TcpServerConfig).ip || tcpConfig.ip || '',
                    port: (config as TcpServerConfig).port || tcpConfig.port || 0,
                    state: channelState,
                    channelId: channelId || config.channelId || tcpConfig.channelId,
                    children: (config as TcpServerConfig).children || tcpConfig.children || []
                } as TcpServerConfig;
                break;
            }
            case 'serial': {
                const serialConfig = currentConfig as SerialConfig;
                state.channels.serial = {
                    ...serialConfig,
                    ...config,
                    type: 'serial',
                    comname: (config as SerialConfig).comname || serialConfig.comname || '',
                    baurdate: (config as SerialConfig).baurdate || serialConfig.baurdate || 9600,
                    state: channelState,
                    channelId: channelId || config.channelId || serialConfig.channelId
                } as SerialConfig;
                break;
            }
            case 'mqtt': {
                const mqttConfig = currentConfig as MqttConfig;
                state.channels.mqtt = {
                    ...mqttConfig,
                    ...config,
                    type: 'mqtt',
                    ip: (config as MqttConfig).ip || mqttConfig.ip || '',
                    port: (config as MqttConfig).port || mqttConfig.port || 0,
                    state: channelState,
                    channelId: channelId || config.channelId || mqttConfig.channelId
                } as MqttConfig;
                break;
            }
            case 'bluetooth': {
                const bluetoothConfig = currentConfig as BluetoothConfig;
                state.channels.bluetooth = {
                    ...bluetoothConfig,
                    ...config,
                    type: 'bluetooth',
                    bluetoothname: (config as BluetoothConfig).bluetoothname || bluetoothConfig.bluetoothname || '',
                    state: channelState,
                    channelId: channelId || config.channelId || bluetoothConfig.channelId
                } as BluetoothConfig;
                break;
            }
        }
      } else {
        // 只更新状态和channelId，保持其他配置不变
        const currentConfig = state.channels[channelType];
        if (currentConfig) {
            switch (channelType) {
                case 'tcpclient':
                    state.channels.tcpclient = {
                        ...currentConfig,
                        state: channelState,
                        channelId: channelId || currentConfig.channelId
                    } as TcpClientConfig;
                    break;
                case 'tcpserver':
                    state.channels.tcpserver = {
                        ...currentConfig,
                        state: channelState,
                        channelId: channelId || currentConfig.channelId
                    } as TcpServerConfig;
                    break;
                case 'serial':
                    state.channels.serial = {
                        ...currentConfig,
                        state: channelState,
                        channelId: channelId || currentConfig.channelId
                    } as SerialConfig;
                    break;
                case 'mqtt':
                    state.channels.mqtt = {
                        ...currentConfig,
                        state: channelState,
                        channelId: channelId || currentConfig.channelId
                    } as MqttConfig;
                    break;
                case 'bluetooth':
                    state.channels.bluetooth = {
                        ...currentConfig,
                        state: channelState,
                        channelId: channelId || currentConfig.channelId
                    } as BluetoothConfig;
                    break;
            }
        }
      }

      console.log(`通道 ${channelType} 更新后的状态:`, state.channels[channelType]);
    },
    // 更新TCP服务器客户端状态
    updateTcpServerClient: (state, action: PayloadAction<{ channelId: string; ip: string; port: number; state: ConnectionState }>) => {
      const { channelId, ip, port, state: clientState } = action.payload;
      console.log(`Updating TCP server client: ${ip}:${port}, state: ${clientState}`);

      if (state.channels.tcpserver) {
        const tcpServer = state.channels.tcpserver;
        if (!tcpServer.children) {
          tcpServer.children = [];
        }

        // 查找现有客户端
        const existingClientIndex = tcpServer.children.findIndex(
          client => client.ip === ip && client.port === port
        );

        if (existingClientIndex !== -1) {
          // 更新现有客户端
          tcpServer.children[existingClientIndex] = {
            ...tcpServer.children[existingClientIndex],
            state: clientState,
            channelId: channelId
          };
        } else {
          // 添加新客户端
          tcpServer.children.push({
            ip,
            port,
            state: clientState,
            channelId
          });
        }

        // 打印更新后的所有客户端列表
        console.log(`当前TCP服务器客户端列表 (${tcpServer.children.length}个):`);
        tcpServer.children.forEach((client, index) => {
          console.log(`- [${index}] ${client.ip}:${client.port}, 状态: ${client.state}, ID: ${client.channelId || '未知'}`);
        });
      } else {
        console.error('无法更新客户端: TCP服务器通道不存在');
      }
    },
    // 添加新的消息统计更新
    updateMessageStats: (state, action: PayloadAction<ChannelMessage>) => {
      const { channelId, direction, timestamp, channeltype, content, metadata } = action.payload;
      
      console.log(`updateMessageStats: 处理消息 - 通道ID: ${channelId}, 方向: ${direction}, 通道类型: ${channeltype}, 元数据:`, metadata);
      
      // 获取实际的通道ID
      let actualChannelId = channelId;
      let isTcpServerClient = false;
      let skipCount = false;

      // 查找对应通道的实际 channelId
      if (channeltype === 'tcpserver' && state.channels.tcpserver?.channelId) {
        // 检查是否为TCP服务器的客户端消息
          
          // 同时更新服务器统计
          const serverChannelId = state.channels.tcpserver.channelId;
          if (!state.messageStats[serverChannelId]) {
            state.messageStats[serverChannelId] = { sent: 0, received: 0 };
          }
          if (direction === 'Sent') {
            state.messageStats[serverChannelId].sent += 1;
          } else {
            state.messageStats[serverChannelId].received += 1;
          }
          state.messageStats[serverChannelId].lastMessageTime = timestamp;

          // 更新服务器通道配置中的统计
          if (state.channels.tcpserver) {
            state.channels.tcpserver = {
              ...state.channels.tcpserver,
              sentCount: state.messageStats[serverChannelId].sent,
              receivedCount: state.messageStats[serverChannelId].received
            };
          }
      }else if (channeltype === 'tcpclient' && state.channels.tcpclient?.channelId) {
        actualChannelId = state.channels.tcpclient.channelId;
      } else {
        actualChannelId = channelId;
      }

      console.log(`updateMessageStats: 使用实际通道ID: ${actualChannelId}, isTcpServerClient: ${isTcpServerClient}`);
      
      // 如果不需要跳过计数，则更新统计
      if (!skipCount) {
        // 如果这个通道还没有统计数据，初始化它
        if (!state.messageStats[actualChannelId]) {
          console.log(`updateMessageStats: 为通道 ${actualChannelId} 初始化消息统计`);
          state.messageStats[actualChannelId] = {
            sent: 0,
            received: 0
          };
        }

        // 更新统计数据
        const stats = state.messageStats[actualChannelId];
        if (direction === 'Sent') {
          stats.sent += 1;
          console.log(`updateMessageStats: 通道 ${actualChannelId} 发送消息数增加到 ${stats.sent}`);
        } else {
          stats.received += 1;
          console.log(`updateMessageStats: 通道 ${actualChannelId} 接收消息数增加到 ${stats.received}`);
        }
        stats.lastMessageTime = timestamp;

        // 同步消息统计到通道配置
        if (channeltype === 'tcpserver') {
          if (state.channels.tcpserver?.children) {
            // 更新客户端统计
            const clientIndex = state.channels.tcpserver.children.findIndex(
              client => client.channelId === actualChannelId
            );
            
            if (clientIndex !== -1) {
              console.log(`updateMessageStats: 同步消息统计到TCP客户端 ${actualChannelId}`);
              const client = state.channels.tcpserver.children[clientIndex];
              state.channels.tcpserver.children[clientIndex] = {
                ...client,
                sentCount: stats.sent,
                receivedCount: stats.received
              };
            }
          }
        } else if (channeltype === 'tcpclient' && state.channels.tcpclient) {
          state.channels.tcpclient = {
            ...state.channels.tcpclient,
            sentCount: stats.sent,
            receivedCount: stats.received
          };
        } else if (channeltype === 'serial' && state.channels.serial) {
          state.channels.serial = {
            ...state.channels.serial,
            sentCount: stats.sent,
            receivedCount: stats.received
          };
        } else if (channeltype === 'mqtt' && state.channels.mqtt) {
          state.channels.mqtt = {
            ...state.channels.mqtt,
            sentCount: stats.sent,
            receivedCount: stats.received
          };
        } else if (channeltype === 'bluetooth' && state.channels.bluetooth) {
          state.channels.bluetooth = {
            ...state.channels.bluetooth,
            sentCount: stats.sent,
            receivedCount: stats.received
          };
        }
      }

      // 更新消息历史记录
      if (!state.messageHistory[actualChannelId]) {
        console.log(`updateMessageStats: 为通道 ${actualChannelId} 初始化消息历史记录`);
        state.messageHistory[actualChannelId] = [];
      }
      
      // 添加新消息
      state.messageHistory[actualChannelId].push(action.payload);
      
      // 如果消息超过1000条，只保留最新的1000条
      if (state.messageHistory[actualChannelId].length > 1000) {
        console.log(`updateMessageStats: 通道 ${actualChannelId} 消息数量超过1000，进行裁剪`);
        state.messageHistory[actualChannelId] = state.messageHistory[actualChannelId].slice(-1000);
      }
      
      console.log(`updateMessageStats: 通道 ${actualChannelId} 消息历史记录更新，当前消息数: ${state.messageHistory[actualChannelId].length}，最新消息:`, action.payload);
    },
    // 重置消息统计
    resetMessageStats: (state, action: PayloadAction<string>) => {
      const channelId = action.payload;
      if (state.messageStats[channelId]) {
        state.messageStats[channelId] = {
          sent: 0,
          received: 0
        };
      }
      // 清空消息历史记录
      if (state.messageHistory[channelId]) {
        state.messageHistory[channelId] = [];
      }
    },
    // 清空指定通道或客户端的消息历史和统计
    clearChannelMessages: (state, action: PayloadAction<string>) => {
      const channelId = action.payload;
      
      // 清空消息历史
      if (state.messageHistory[channelId]) {
        state.messageHistory[channelId] = [];
      }
      
      // 重置消息统计
      if (state.messageStats[channelId]) {
        state.messageStats[channelId] = {
          sent: 0,
          received: 0
        };
      }
      
      console.log(`已清空通道 ${channelId} 的消息历史和统计`);
    }
  },
  extraReducers: (builder) => {
    // 初始化服务
    builder
      .addCase(initializeChannelService.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(initializeChannelService.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        state.serviceInitialized = action.payload;
      })
      .addCase(initializeChannelService.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || null;
        state.serviceInitialized = false;
      });

    // 加载通道配置
    builder
      .addCase(loadChannelConfigs.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadChannelConfigs.fulfilled, (state, action) => {
        // 合并配置，保持现有的连接状态
        Object.entries(action.payload).forEach(([type, config]) => {
          const channelType = type as ChannelType;
          const currentState = state.channels[channelType]?.state || 'disconnected' as ConnectionState;
          const currentChannelId = state.channels[channelType]?.channelId;

          // 根据通道类型设置配置
          switch (channelType) {
            case 'tcpclient':
              state.channels.tcpclient = {
                ...config as TcpClientConfig,
                state: currentState,
                channelId: currentChannelId
              };
              break;
            case 'tcpserver':
              state.channels.tcpserver = {
                ...config as TcpServerConfig,
                state: currentState,
                channelId: currentChannelId
              };
              break;
            case 'serial':
              state.channels.serial = {
                ...config as SerialConfig,
                state: currentState,
                channelId: currentChannelId
              };
              break;
            case 'mqtt':
              state.channels.mqtt = {
                ...config as MqttConfig,
                state: currentState,
                channelId: currentChannelId
              };
              break;
            case 'bluetooth':
              state.channels.bluetooth = {
                ...config as BluetoothConfig,
                state: currentState,
                channelId: currentChannelId
              };
              break;
          }
        });
        
        state.loading = false;
        state.error = null;
      })
      .addCase(loadChannelConfigs.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || null;
      });
    
    // 加载配置
    builder
      .addCase(loadChannelConfig.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadChannelConfig.fulfilled, (state, action) => {
        state.loading = false;
        state.channels = action.payload;
      })
      .addCase(loadChannelConfig.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
    
    // 连接通道
    builder
      .addCase(connectChannel.pending, (state, action) => {
        const { channelType } = action.meta.arg;
        if (state.channels[channelType]) {
          (state.channels[channelType] as any) = {
            ...state.channels[channelType],
            state: 'connecting' as ConnectionState
          };
        }
        state.loading = true;
        state.error = null;
      })
      .addCase(connectChannel.fulfilled, (state, action) => {
        const { channelType, channelId } = action.payload;
        if (state.channels[channelType]) {
          (state.channels[channelType] as any) = {
            ...state.channels[channelType],
            state: 'connected' as ConnectionState,
            channelId
          };
        }
        state.loading = false;
        state.error = null;
      })
      .addCase(connectChannel.rejected, (state, action) => {
        const { channelType } = action.meta.arg;
        if (state.channels[channelType]) {
          (state.channels[channelType] as any) = {
            ...state.channels[channelType],
            state: 'disconnected' as ConnectionState,
            channelId: undefined
          };
        }
        state.loading = false;
        state.error = action.error.message || null;
      });

    // 断开通道
    builder
      .addCase(disconnectChannel.pending, (state, action) => {
        const { channelType } = action.meta.arg;
        if (state.channels[channelType]) {
          (state.channels[channelType] as any) = {
            ...state.channels[channelType],
            state: 'disconnecting' as ConnectionState
          };
        }
        state.loading = true;
        state.error = null;
      })
      .addCase(disconnectChannel.fulfilled, (state, action) => {
        const { channelType } = action.payload;
        if (state.channels[channelType]) {
          (state.channels[channelType] as any) = {
            ...state.channels[channelType],
            state: 'disconnected' as ConnectionState,
            channelId: undefined
          };
        }
        state.loading = false;
        state.error = null;
      })
      .addCase(disconnectChannel.rejected, (state, action) => {
        const { channelType } = action.meta.arg;
        if (state.channels[channelType]) {
          (state.channels[channelType] as any) = {
            ...state.channels[channelType],
            state: 'error' as ConnectionState
          };
        }
        state.loading = false;
        state.error = action.error.message || null;
      });
    
    // 验证所有通道连接
    builder
      .addCase(verifyAllConnections.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(verifyAllConnections.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(verifyAllConnections.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to verify connections';
      });
    builder.addCase(subscribeMqttTopic.pending, (state, action) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(unsubscribeMqttTopic.pending, (state, action) => {
      state.loading = true;
      state.error = null;
    });
  }
});

export const { 
  setConnectInfo, 
  updateChannelState, 
  updateTcpServerClient,
  updateMessageStats, 
  resetMessageStats,
  clearChannelMessages 
} = channelSlice.actions;

// 更新通道状态的 action creator
export const updateChannel = (
    channelType: ChannelType,
    state: ConnectionState,
    config?: any,
    channelId?: string
) => {
    return (dispatch: AppDispatch) => {
        dispatch(updateChannelState({
            channelType,
            state,
            config,
            channelId
        }));
    };
};

// 更新TCP服务器客户端状态的 action creator
export const updateTcpClient = (
    ip: string,
    port: number,
    state: ConnectionState
) => {
    return (dispatch: AppDispatch) => {
        dispatch(updateTcpServerClient({
            channelId: `${ip}:${port}`,
            ip,
            port,
            state
        }));
    };
};

// 基本选择器 - 获取消息历史记录
const selectMessageHistory = (state: RootState) => state.channel.messageHistory;

// 基本选择器 - 获取消息统计
const selectMessageStatsMap = (state: RootState) => state.channel.messageStats;

// TCP服务端通道应该显示所有客户端消息的合集
const selectTcpServerAllMessages = createSelector(
  [
    selectMessageHistory,
    (state: RootState) => state.channel.channels.tcpserver
  ],
  (messageHistory, tcpServer) => {
    // 如果没有TCP服务端配置，返回空数组
    if (!tcpServer || !tcpServer.channelId) return [];
    
    // 获取所有消息
    const allMessages: ChannelMessage[] = [];
    
    // 首先添加服务端自身的消息
    if (messageHistory[tcpServer.channelId]) {
      allMessages.push(...messageHistory[tcpServer.channelId]);
    }
    
    // 然后查找所有客户端消息
    if (tcpServer.children) {
      tcpServer.children.forEach(client => {
        const clientId = client.channelId || `${client.ip}:${client.port}`;
        if (messageHistory[clientId]) {
          allMessages.push(...messageHistory[clientId]);
        }
      });
    }
    
          // 按时间戳排序并限制返回最新的1000条消息
      const sortedMessages = allMessages.sort((a, b) => {
        const timeA = typeof a.timestamp === 'string' ? parseInt(a.timestamp) : a.timestamp;
        const timeB = typeof b.timestamp === 'string' ? parseInt(b.timestamp) : b.timestamp;
        return timeA - timeB;
      });
      
      // 只返回最新的1000条消息
      return sortedMessages.slice(-1000);
  }
);

// 记忆化选择器 - 获取特定通道的消息
export const selectChannelMessages = createSelector(
  [
    selectMessageHistory,
    (state: RootState) => state.channel.channels.tcpserver,
    (state: RootState) => state.channel.channels.tcpclient,
    (_state: RootState, channelId: string) => channelId
  ],
  (messageHistory, tcpServer, tcpClient, channelId) => {
    console.log('selectChannelMessages called for channelId:', channelId);
    console.log('Current message history:', messageHistory);
    
    // 如果是TCP服务端通道，显示所有客户端消息
    if (tcpServer && tcpServer.channelId === channelId) {
      const allMessages: ChannelMessage[] = [];
      
      // 首先添加服务端自身的消息
      if (messageHistory[channelId]) {
        allMessages.push(...messageHistory[channelId]);
      }
      
      // 然后查找所有客户端消息
      if (tcpServer.children) {
        tcpServer.children.forEach(client => {
          const clientId = client.channelId || `${client.ip}:${client.port}`;
          if (messageHistory[clientId]) {
            allMessages.push(...messageHistory[clientId]);
          }
        });
      }
      
      return allMessages.sort((a, b) => {
        const timeA = typeof a.timestamp === 'string' ? parseInt(a.timestamp) : a.timestamp;
        const timeB = typeof b.timestamp === 'string' ? parseInt(b.timestamp) : b.timestamp;
        return timeA - timeB;
      });
    }
    
    // 对于TCP客户端，使用其channelId获取消息
    if (tcpClient && tcpClient.channelId === channelId) {
      console.log('获取TCP客户端消息，channelId:', channelId);
      const messages = messageHistory[channelId] || [];
      console.log('找到的消息:', messages);
      return messages;
    }
    
    // 其他通道直接返回对应ID的消息
    const messages = messageHistory[channelId] || [];
    console.log(`返回通道 ${channelId} 的消息:`, messages);
    return messages;
  }
);

// 记忆化选择器 - 获取通道消息统计
export const selectChannelMessageStats = createSelector(
  [selectMessageStatsMap, (_state: RootState, channelId: string) => channelId],
  (messageStats, channelId) => messageStats[channelId] || { sent: 0, received: 0 }
);

// 记忆化选择器 - 获取TCP服务器客户端消息
export const selectTcpServerClientMessages = createSelector(
  [selectMessageHistory, (_state: RootState, clientId: string) => clientId],
  (messageHistory, clientId) => messageHistory[clientId] || []
);

// 记忆化选择器 - 获取TCP服务器客户端消息统计
export const selectTcpServerClientMessageStats = createSelector(
  [selectMessageStatsMap, (_state: RootState, clientId: string) => clientId],
  (messageStats, clientId) => messageStats[clientId] || { sent: 0, received: 0 }
);

export default channelSlice.reducer;