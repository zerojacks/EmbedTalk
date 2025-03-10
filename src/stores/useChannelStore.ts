import { create } from 'zustand';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

// Message type definitions
export type MessageType = {
    content: string;
    timestamp: string;
    direction: 'Sent' | 'Received';
    metadata?: Record<string, any>;
};

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
    messages: MessageType[];
    lastActivityTime?: number;
};

let isInitializing = false;

// Store type definition
type ChannelStore = {
    channels: Channel[];
    activeChannels: Set<string>;
    initialized: boolean;
    eventListeners?: UnlistenFn[];
    initialize: () => Promise<void>;
    cleanup: () => void;
    setChannels: (channels: Channel[]) => void;
    updateChannelState: (message: ChannelStateMessage) => void;
    addMessage: (channeltype: string, channelId: string, content: string, direction: 'Sent' | 'Received', metadata?: Record<string, any>) => void;
};

const useChannelStore = create<ChannelStore>((set, get) => ({
    channels: [],
    activeChannels: new Set(),
    initialized: false,
    eventListeners: [],

    initialize: async () => {
        // 检查是否已经初始化或正在初始化
        if (get().initialized || isInitializing) {
            console.log('[initialize] Store already initialized or initializing, skipping');
            return;
        }

        // 设置初始化标志
        isInitializing = true;
        console.log('[initialize] Starting store initialization');

        try {
            const channelStateUnlisten = await listen<string>('channel-state', (event) => {
                try {
                    const message: ChannelStateMessage = JSON.parse(event.payload);
                    const eventId = `channel-state-${Date.now()}`;
                    console.log(`[${eventId}] Received channel state:`, message);
                    get().updateChannelState(message);
                } catch (error) {
                    console.error('[channel-state] Error processing event:', error);
                }
            });

            const messageEventUnlisten = await listen<string>('message-event', (event) => {
                try {
                    const message = JSON.parse(event.payload);
                    const eventId = `message-${Date.now()}`;
                    console.log(`[${eventId}] Received message:`, message);
                    
                    get().addMessage(
                        message.channeltype,
                        message.channelId,
                        message.content,
                        message.direction,
                        message.metadata
                    );
                } catch (error) {
                    console.error('[message-event] Error processing event:', error);
                }
            });

            set(state => ({
                ...state,
                initialized: true,
                eventListeners: [channelStateUnlisten, messageEventUnlisten]
            }));

            console.log('[initialize] Store initialization completed');
        } catch (error) {
            console.error('[initialize] Error during initialization:', error);
            isInitializing = false;  // 重置初始化标志
            throw error;
        }

        // 重置初始化标志
        isInitializing = false;
    },

    cleanup: () => {
        const state = get();
        if (!state.initialized) {
            console.log('[cleanup] Store not initialized, skipping cleanup');
            return;
        }

        console.log('[cleanup] Starting cleanup');
        
        if (state.eventListeners) {
            state.eventListeners.forEach((unlisten, index) => {
                try {
                    unlisten();
                    console.log(`[cleanup] Cleaned up listener ${index}`);
                } catch (error) {
                    console.error(`[cleanup] Error cleaning up listener ${index}:`, error);
                }
            });
        }

        set(state => ({
            ...state,
            initialized: false,
            eventListeners: []
        }));
        
        console.log('[cleanup] Cleanup completed');
    },

    setChannels: (channels) => {
        console.log('[setChannels] Updating channels:', channels);
        set({ channels });
    },

    updateChannelState: (message) => {
        console.log('[updateChannelState] Processing message:', message);
        
        set((state) => {
            const existingChannel = state.channels.find(ch => ch.channelId === message.channelId);
            
            if (!existingChannel) {
                console.log('[updateChannelState] Creating new channel:', message.channelId);
                
                // Create new channel
                const newChannel: Channel = {
                    channelId: message.channelId,
                    channeltype: message.channeltype as Channel['channeltype'],
                    name: message.channeltype,
                    state: message.state,
                    messages: [],
                    lastActivityTime: Date.now()
                };

                // Add clients if data exists
                if (message.data) {
                    newChannel.clients = [];
                    if (message.data.ip) {
                        const clientId = `${message.data.ip}:${message.data.port}`;
                        newChannel.clients.push({
                            channelId: clientId,
                            channeltype: 'tcpclient',
                            name: clientId,
                            state: message.state,
                            messages: []
                        });
                    }
                }

                // Mark as active temporarily
                const newActiveChannels = new Set(state.activeChannels);
                newActiveChannels.add(newChannel.channelId);

                // Remove from active after delay
                setTimeout(() => {
                    set(state => ({
                        activeChannels: new Set(
                            Array.from(state.activeChannels).filter(id => id !== newChannel.channelId)
                        )
                    }));
                }, 1000);

                return {
                    channels: [...state.channels, newChannel],
                    activeChannels: newActiveChannels
                };
            }

            console.log('[updateChannelState] Updating existing channel:', message.channelId);

            // Update existing channel
            const newChannels = state.channels.map(channel => {
                if (channel.channelId === message.channelId) {
                    // Mark as active temporarily
                    const newActiveChannels = new Set(state.activeChannels);
                    newActiveChannels.add(channel.channelId);

                    // Remove from active after delay
                    setTimeout(() => {
                        set(state => ({
                            activeChannels: new Set(
                                Array.from(state.activeChannels).filter(id => id !== channel.channelId)
                            )
                        }));
                    }, 1000);

                    return {
                        ...channel,
                        state: message.state,
                        lastActivityTime: Date.now()
                    };
                }
                return channel;
            });

            return { 
                channels: newChannels,
                activeChannels: new Set(state.activeChannels)
            };
        });
    },

    addMessage: (channeltype, channelId, content, direction, metadata) => {
        console.log('[addMessage] Adding new message:', {
            channeltype,
            channelId,
            content,
            direction,
            metadata
        });

        const message: MessageType = {
            content,
            timestamp: new Date().toISOString(),
            direction,
            metadata
        };

        set((state) => {
            const currentChannel = state.channels.find(ch => ch.channelId === channelId);
            console.log('[addMessage] Current channel state:', {
                channelId,
                found: !!currentChannel,
                messageCount: currentChannel?.messages.length
            });

            const newChannels = state.channels.map(channel => {
                if (channel.channelId === channelId) {
                    const updatedChannel = {
                        ...channel,
                        messages: [...channel.messages, message],
                        lastActivityTime: Date.now()
                    };
                    console.log('[addMessage] Updated channel:', {
                        channelId,
                        newMessageCount: updatedChannel.messages.length
                    });
                    return updatedChannel;
                }
                return channel;
            });

            return { channels: newChannels };
        });
    },
}));

// 导出一个初始化函数
export const initializeStore = async () => {
    try {
        await useChannelStore.getState().initialize();
    } catch (error) {
        console.error('Failed to initialize channel store:', error);
    }
};

export default useChannelStore;