import { create } from 'zustand';

// 定义通道和连接的类型
export type connectionState = 'connected' | 'connecting' | 'disconnecting' | 'disconnected' | 'error';

export interface ConnectBridgeInfo {
    tcpclient?: { ip?: string; port?: number; state?: connectionState };
    tcpserver?: { ip?: string; port?: number; state?: connectionState; children?: any[] };
    serial?: { comname?: string; baurdate?: number; parity?: string; databit?: number; stopbit?: number; flowctrl?: number; state?: connectionState };
    mqtt?: { ip?: string; port?: number; username?: string; password?: string; qos?: number; version?: string; state?: connectionState };
    bluetooth?: { bluetoothname?: string; uuid?: string; state?: connectionState };
}

export type ChannelStateMessage = {
    channeltype: string;
    channelId: string;
    state: 'Connected' | 'Disconnected';
    data?: {
        ip?: string;
        port?: number;
    };
    reason?: string;
};

export type Channel = {
    channeltype: 'tcpclient' | 'tcpserver' | 'serial' | 'bluetooth' | 'mqtt';
    channelId: string;
    name: string;
    state: 'Connected' | 'Disconnected';
    clients?: Channel[];
    messages: any[];
    lastActivityTime?: number;
};

// 定义新的 store 类型
interface CombinedStore {
    channels: Channel[];
    connectInfo: ConnectBridgeInfo | null;
    activeChannels: Set<string>;
    initialized: boolean;
    setConnectInfo: (info: Partial<ConnectBridgeInfo>) => void;
    setChannels: (channels: Channel[]) => void;
    updateChannelState: (message: ChannelStateMessage) => void;
    initialize: () => Promise<void>;
    cleanup: () => void;
}

// 创建新的 store
const useCombinedStore = create<CombinedStore>((set, get) => ({
    channels: [],
    connectInfo: null,
    activeChannels: new Set(),
    initialized: false,

    setConnectInfo: (info) => set((state) => ({
        connectInfo: {
            ...state.connectInfo,
            ...info,
        },
    })),

    setChannels: (channels) => set({ channels }),

    updateChannelState: (message) => {
        set((state) => {
            const existingChannel = state.channels.find(ch => ch.channelId === message.channelId);
            if (!existingChannel) {
                const newChannel: Channel = {
                    channelId: message.channelId,
                    channeltype: message.channeltype as Channel['channeltype'],
                    name: message.channeltype,
                    state: message.state,
                    messages: [],
                };
                return {
                    channels: [...state.channels, newChannel],
                    activeChannels: new Set(state.activeChannels).add(newChannel.channelId),
                };
            }

            const newChannels = state.channels.map(channel => {
                if (channel.channelId === message.channelId) {
                    return {
                        ...channel,
                        state: message.state,
                    };
                }
                return channel;
            });

            return { channels: newChannels };
        });
    },

    initialize: async () => {
        if (get().initialized) return;
        // 初始化逻辑
        set({ initialized: true });
    },

    cleanup: () => {
        if (!get().initialized) return;
        // 清理逻辑
        set({ initialized: false });
    },
}));

export default useCombinedStore; 