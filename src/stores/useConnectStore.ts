import { create } from 'zustand'

export type connectionState = 'connected' | 'connecting' | 'disconnecting' | 'disconnected' | 'error';

export interface tcpserverclient {
    ip: string;
    port: number;
    state: connectionState;
}

export interface ConnectBridgeInfo {
    tcpclient?: { ip?: string; port?: number; state?: connectionState };
    tcpserver?: { ip?: string; port?: number; state?: connectionState; children?: tcpserverclient[] };
    serial?: { comname?: string; baurdate?: number; parity?: string; databit?: number; stopbit?: number; state?: connectionState };
    mqtt?: { ip?: string; port?: number; username?: string; password?: string; qos?: number; version?: string; state?: connectionState };
    bluetooth?: { bluetoothname?: string; uuid?: string; state?: connectionState };
}

interface ConnectStore {
    connectInfo: ConnectBridgeInfo | null;
    setConnectInfo: (info: Partial<ConnectBridgeInfo>) => void;
}

export const useConnectStore = create<ConnectStore>((set) => ({
    connectInfo: null,
    setConnectInfo: (info) => set((state) => ({
        connectInfo: {
            ...state.connectInfo, // 合并已有信息
            ...info,
        },
    })),
}));