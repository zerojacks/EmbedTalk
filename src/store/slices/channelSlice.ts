import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { ChannelService } from '../../services/channelService';
import { 
  ChannelType, 
  ConnectionState, 
  ConnectBridgeInfo,
  ChannelConfigMap,
  ChannelMessage,
  MessageStats
} from '../../types/channel';
import { invoke } from '@tauri-apps/api/core';
import { toast } from '../../context/ToastProvider';
import { RootState } from '../index';
import { ThunkDispatch } from '@reduxjs/toolkit';
import { AnyAction } from 'redux';

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

// 状态接口
export interface ChannelState {
  // 所有通道的配置和状态
  channels: Partial<ChannelConfigMap>;
  // 加载状态
  loading: boolean;
  // 错误信息
  error: string | null;
  // 服务是否初始化
  serviceInitialized: boolean;
  // 消息统计
  messageStats: Record<string, MessageStats>;
  // 消息历史记录
  messageHistory: Record<string, ChannelMessage[]>;
}

// 初始状态
const initialState: ChannelState = {
  channels: {
    tcpclient: { state: 'disconnected' },
    tcpserver: { state: 'disconnected' },
    serial: { state: 'disconnected' },
    mqtt: { state: 'disconnected' },
    bluetooth: { state: 'disconnected' }
  },
  loading: false,
  error: null,
  serviceInitialized: false,
  messageStats: {},
  messageHistory: {}
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
      return true;
    } catch (error) {
      console.error("Error initializing channel service:", error);
      return false;
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
      const connectInfo = await invoke<ConnectBridgeInfo>("get_config_value_async", {
        section: "connectcfg",
        key: "channels"
      });
      
      if (connectInfo) {
        // 设置默认状态
        const configWithDisconnectedState = { ...connectInfo };
        
        // 确保所有通道的连接状态为断开状态
        Object.keys(configWithDisconnectedState).forEach(key => {
          const channelType = key as ChannelType;
          if (configWithDisconnectedState[channelType]) {
            configWithDisconnectedState[channelType] = {
              ...configWithDisconnectedState[channelType],
              state: 'disconnected'
            };
          }
        });
        
        // 设置默认信息
        if (!configWithDisconnectedState.tcpclient) configWithDisconnectedState.tcpclient = { state: 'disconnected' };
        if (!configWithDisconnectedState.tcpserver) configWithDisconnectedState.tcpserver = { state: 'disconnected' };
        if (!configWithDisconnectedState.serial) configWithDisconnectedState.serial = { state: 'disconnected' };
        if (!configWithDisconnectedState.mqtt) configWithDisconnectedState.mqtt = { state: 'disconnected' };
        if (!configWithDisconnectedState.bluetooth) configWithDisconnectedState.bluetooth = { state: 'disconnected' };
        
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
  { channelType: ChannelType; state: ConnectionState },
  { channelType: ChannelType; params: any },
  { state: RootState; rejectValue: { channelType: ChannelType; error: string } }
>(
  'channel/connect',
  async ({ channelType, params }, { dispatch, rejectWithValue }) => {
    try {
      // 更新状态为连接中
      dispatch(updateChannelState({ channelType, state: 'connecting' }));
      
      // 调用服务连接通道
      await ChannelService.connectChannel(channelType, params);
      
      // 显示连接成功通知
      const message = getToastMessage(channelType, params, 'connected');
      toast.success(message, 'end', 'bottom', 3000);
      
      return { channelType, state: 'connected' as ConnectionState };
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
  { channelType: ChannelType; params: any },
  { state: RootState; rejectValue: { channelType: ChannelType; error: string } }
>(
  'channel/disconnect',
  async ({ channelType, params }, { dispatch, rejectWithValue }) => {
    try {
      // 更新状态为断开中
      dispatch(updateChannelState({ channelType, state: 'disconnecting' }));
      
      // 调用服务断开通道
      await ChannelService.disconnectChannel(channelType, params);
      
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
    updateChannelState: (state, action: PayloadAction<{ channelType: ChannelType, state: ConnectionState }>) => {
      const { channelType, state: connectionState } = action.payload;
      
      if (state.channels[channelType]) {
        state.channels[channelType] = {
          ...state.channels[channelType],
          state: connectionState
        };
      }
    },
    // 添加新的 reducer 来处理消息统计更新
    updateMessageStats: (state, action: PayloadAction<ChannelMessage>) => {
      const { channelId, direction, timestamp, channeltype } = action.payload;
      
      console.log(`updateMessageStats: 处理消息 - 通道ID: ${channelId}, 方向: ${direction}, 通道类型: ${channeltype}`);
      
      // 如果这个通道还没有统计数据，初始化它
      if (!state.messageStats[channelId]) {
        console.log(`updateMessageStats: 为通道 ${channelId} 初始化消息统计`);
        state.messageStats[channelId] = {
          sent: 0,
          received: 0
        };
      }

      // 更新统计数据
      const stats = state.messageStats[channelId];
      if (direction === 'Sent') {
        stats.sent += 1;
        console.log(`updateMessageStats: 通道 ${channelId} 发送消息数增加到 ${stats.sent}`);
      } else {
        stats.received += 1;
        console.log(`updateMessageStats: 通道 ${channelId} 接收消息数增加到 ${stats.received}`);
      }
      stats.lastMessageTime = timestamp;

      // 更新消息历史记录
      if (!state.messageHistory[channelId]) {
        console.log(`updateMessageStats: 为通道 ${channelId} 初始化消息历史记录`);
        state.messageHistory[channelId] = [];
      }
      state.messageHistory[channelId].push(action.payload);
      console.log(`updateMessageStats: 通道 ${channelId} 消息历史记录更新，当前消息数: ${state.messageHistory[channelId].length}`);
      
      // 限制每个通道的消息历史记录数量
      const maxMessages = 100;
      if (state.messageHistory[channelId].length > maxMessages) {
        state.messageHistory[channelId] = state.messageHistory[channelId].slice(-maxMessages);
        console.log(`updateMessageStats: 通道 ${channelId} 消息历史记录已裁剪至 ${maxMessages} 条`);
      }
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
    clearChannelMessages(state, action: PayloadAction<string>) {
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
    // 初始化通道服务
    builder
      .addCase(initializeChannelService.pending, (state) => {
        state.loading = true;
      })
      .addCase(initializeChannelService.fulfilled, (state, action) => {
        state.serviceInitialized = action.payload;
        state.loading = false;
      })
      .addCase(initializeChannelService.rejected, (state) => {
        state.serviceInitialized = false;
        state.loading = false;
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
        // 状态已经在 thunk 中更新为 connecting
      })
      .addCase(connectChannel.fulfilled, (state, action) => {
        const { channelType, state: connectionState } = action.payload;
        
        if (state.channels[channelType]) {
          state.channels[channelType] = {
            ...state.channels[channelType],
            state: connectionState
          };
        }
      })
      .addCase(connectChannel.rejected, (state, action) => {
        const payload = action.payload as { channelType: ChannelType };
        
        if (state.channels[payload.channelType]) {
          state.channels[payload.channelType] = {
            ...state.channels[payload.channelType],
            state: 'error'
          };
        }
      });
    
    // 断开通道
    builder
      .addCase(disconnectChannel.pending, (state, action) => {
        // 状态已经在 thunk 中更新为 disconnecting
      })
      .addCase(disconnectChannel.fulfilled, (state, action) => {
        const { channelType, state: connectionState } = action.payload;
        
        if (state.channels[channelType]) {
          state.channels[channelType] = {
            ...state.channels[channelType],
            state: connectionState
          };
        }
      })
      .addCase(disconnectChannel.rejected, (state, action) => {
        const payload = action.payload as { channelType: ChannelType };
        
        if (state.channels[payload.channelType]) {
          state.channels[payload.channelType] = {
            ...state.channels[payload.channelType],
            state: 'error'
          };
        }
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
  }
});

export const { 
  setConnectInfo, 
  updateChannelState, 
  updateMessageStats, 
  resetMessageStats,
  clearChannelMessages 
} = channelSlice.actions;

// 选择器函数
export const selectChannelMessages = (state: RootState, channelId: string) => {
    return state.channel.messageHistory[channelId] || [];
};

// 选择器函数 - 获取通道消息统计
export const selectChannelMessageStats = (state: RootState, channelId: string) => {
    return state.channel.messageStats[channelId] || { sent: 0, received: 0 };
};

// 选择器函数 - 获取TCP服务器客户端消息
export const selectTcpServerClientMessages = (state: RootState, clientId: string) => {
    // 客户端ID格式为 "IP:PORT"
    return state.channel.messageHistory[clientId] || [];
};

// 选择器函数 - 获取TCP服务器客户端消息统计
export const selectTcpServerClientMessageStats = (state: RootState, clientId: string) => {
    // 客户端ID格式为 "IP:PORT"
    return state.channel.messageStats[clientId] || { sent: 0, received: 0 };
};

export default channelSlice.reducer;
