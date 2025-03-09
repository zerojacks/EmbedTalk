import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type connectionState = 'connected' | 'connecting' | 'disconnecting' | 'disconnected' | 'error';

export interface tcpserverclient {
    ip: string;
    port: number;
    state: connectionState;
}

export interface ConnectBridgeInfo {
    tcpclient?: { ip?: string; port?: number; state?: connectionState };
    tcpserver?: { ip?: string; port?: number; state?: connectionState; children?: tcpserverclient[] };
    serial?: { comname?: string; baurdate?: number; parity?: string; databit?: number; stopbit?: number; flowctrl?:number; state?: connectionState };
    mqtt?: { ip?: string; port?: number; username?: string; password?: string; qos?: number; state?: connectionState };
    bluetooth?: { bluetoothname?: string; uuid?: string; adapter?: string; state?: connectionState };
}

interface ConnectStore {
    isInit: boolean;
    connectInfo: ConnectBridgeInfo | null;
    setConnectInfo: (info: Partial<ConnectBridgeInfo>) => void;
    setIsInit: (isInit: boolean) => void;
    updateChannelState: (channelType: keyof ConnectBridgeInfo, state: connectionState) => void;
}

export const useConnectStore = create<ConnectStore>()(
    persist(
        (set) => ({
            isInit: false,
            connectInfo: null,
            setConnectInfo: (info) => set((state) => ({
                connectInfo: {
                    ...state.connectInfo, // 合并已有信息
                    ...info,
                },
            })),
            setIsInit: (isInit: boolean) => set({ isInit: isInit }),
            updateChannelState: (channelType, state) => set((prevState) => {
                if (!prevState.connectInfo || !prevState.connectInfo[channelType]) {
                    return prevState; // 如果通道不存在，不做任何更改
                }
                
                return {
                    connectInfo: {
                        ...prevState.connectInfo,
                        [channelType]: {
                            ...prevState.connectInfo[channelType],
                            state: state
                        }
                    }
                };
            }),
        }),
        {
            name: 'connect-storage', // 存储的唯一名称
            partialize: (state) => ({ connectInfo: state.connectInfo }), // 只持久化 connectInfo
        }
    )
);
