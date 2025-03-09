import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { ChannelType, ConnectionState, ChannelMessage, ConnectionParams } from '../types/channel';
import { ThunkDispatch, AnyAction } from '@reduxjs/toolkit';
import { RootState } from '../store';
import { updateChannelState, updateMessageStats } from '../store/slices/channelSlice';

/**
 * 服务层 - 处理与 Tauri 后端的通信
 */
export class ChannelService {
  // 存储全局监听器的解绑函数
  private static channelStateUnlistener: UnlistenFn | null = null;
  private static messageUnlistener: UnlistenFn | null = null;
  private static dispatch: ThunkDispatch<RootState, undefined, AnyAction> | null = null;

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

    console.log('Channel service initialized with global listeners');
  }

  /**
   * 清理所有监听器
   */
  static async cleanupListeners(): Promise<void> {
    if (this.channelStateUnlistener) {
      await this.channelStateUnlistener();
      this.channelStateUnlistener = null;
    }
    if (this.messageUnlistener) {
      await this.messageUnlistener();
      this.messageUnlistener = null;
    }
    this.dispatch = null;
  }

  /**
   * 连接通道
   * @param channelType 通道类型
   * @param params 连接参数
   */
  static async connectChannel(channelType: ChannelType, params: ConnectionParams): Promise<void> {
    return invoke('connect_channel', { 
      channel: channelType, 
      values: JSON.stringify(params) 
    });
  }

  /**
   * 断开通道
   * @param channelType 通道类型
   * @param params 连接参数
   */
  static async disconnectChannel(channelType: ChannelType, params: ConnectionParams): Promise<void> {
    return invoke('disconnect_channel', { 
      channel: channelType, 
      values: JSON.stringify(params) 
    });
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
   * 获取可用串口列表
   */
  static async listSerialPorts(): Promise<string[]> {
    return invoke('list_serial_ports');
  }
}
