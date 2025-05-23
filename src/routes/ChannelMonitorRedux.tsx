import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { WifiOff, Wifi, Send, MessageSquare, Server, Usb, Radio, Bluetooth, ArrowLeft, Trash2 } from 'lucide-react';
import { FixedSizeList as List } from 'react-window';
import {
    Panel,
    PanelGroup,
    PanelResizeHandle
} from 'react-resizable-panels';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "../components/dialog";
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { 
    ChannelType, 
    ConnectionState, 
    ChannelMessage,
    BaseChannelConfig,
    TcpClientConfig,
    TcpServerConfig,
    SerialConfig,
    MqttConfig,
    BluetoothConfig,
    TcpServerClient,
    ChannelConfigMap,
    Channel,
    Client
} from '../types/channel';
import { 
    selectChannelMessages, 
    selectChannelMessageStats, 
    selectTcpServerClientMessages, 
    selectTcpServerClientMessageStats,
    clearChannelMessages 
} from '../store/slices/channelSlice';
import { RootState } from '../store';
import MessageSender from '../components/channels/MessageSender';
import { ChannelService } from '../services/channelService';
import { toast } from '../context/ToastProvider';
import ChannelList from '../components/channels/ChannelList';
import ChannelContent from '../components/channels/ChannelContent';

// 辅助函数 - 获取通道类型名称
const getChannelTypeName = (type: ChannelType): string => {
    switch (type) {
        case 'tcpclient': return 'TCP客户端';
        case 'tcpserver': return 'TCP服务端';
        case 'serial': return '串口';
        case 'mqtt': return 'MQTT';
        case 'bluetooth': return '蓝牙';
        default: return '';
    }
};

interface ChannelIconProps {
    type: Channel['channeltype'];
    state: Channel['state'];
}

interface ChannelDetailDialogProps {
    channel: Channel | null;
    client: Client | null;
    open: boolean;
    onClose: () => void;
}

// Helper function to get channel icon
const getChannelIcon = ({ type, state }: ChannelIconProps): JSX.Element | null => {
    const iconProps = {
        size: 20,
        className: `transition-all duration-300 ${state === 'connected' ? 'text-success' : 'text-error'
            }`
    };

    switch (type) {
        case 'tcpclient':
            return state === 'connected' ? <Wifi {...iconProps} /> : <WifiOff {...iconProps} />;
        case 'tcpserver':
            return <Server {...iconProps} />;
        case 'serial':
            return <Usb {...iconProps} />;
        case 'bluetooth':
            return <Bluetooth {...iconProps} />;
        case 'mqtt':
            return <Radio {...iconProps} />;
        default:
            return null;
    }
};

// 分离通道统计组件
const ChannelStats: React.FC<{
    sentCount: number;
    receivedCount: number;
    className?: string;
}> = ({ sentCount, receivedCount, className = "" }) => (
    <div className={`flex gap-2 ${className}`}>
        <div className="flex items-center gap-1.5 text-sm">
            <span className="opacity-70 truncate">发送</span>
            <span className="text-primary font-medium">{sentCount}</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm">
            <span className="opacity-70 truncate">接收</span>
            <span className="text-secondary font-medium">{receivedCount}</span>
        </div>
    </div>
);

// 连接状态指示器组件
const ConnectionIndicator: React.FC<{ connected: boolean, className?: string }> = ({ connected, className }) => (
    <div className={`w-2 h-2 rounded-full ${connected ? 'bg-success' : 'bg-error'} ${className}`} />
);

// 将Redux连接状态转换为组件状态
const mapReduxStateToChannelState = (state: ConnectionState): ConnectionState => {
    return state;
};

// 水平分隔面板的拖动把手组件
const ResizeHandle = () => (
    <PanelResizeHandle className="w-0.5 bg-base-300 hover:bg-primary/50 transition-colors cursor-col-resize group relative">
        <div className="absolute inset-y-0 -left-1 -right-1 group-hover:bg-transparent" />
    </PanelResizeHandle>
);

// 垂直分隔面板的拖动把手组件
const VerticalResizeHandle = () => (
    <PanelResizeHandle className="h-0.5 bg-base-300 hover:bg-primary/50 transition-colors cursor-row-resize group relative">
        <div className="absolute inset-x-0 -top-1 -bottom-1 group-hover:bg-transparent" />
    </PanelResizeHandle>
);

// 消息项渲染组件 - 用于虚拟列表
const MessageItem = React.memo(({ index, style, data }: { index: number; style: React.CSSProperties; data: ChannelMessage[] }) => {
    const message = data[index];
    if (!message) return null;
    
    return (
        <div style={style} className={`p-2 border-b border-base-300 ${message.direction === 'Received' ? 'bg-base-200' : 'bg-base-100'}`}>
            <div className="flex justify-between text-xs text-opacity-70 mb-1">
                <span>{message.direction === 'Received' ? '接收' : '发送'}</span>
                <span>{new Date(Number(message.timestamp)).toLocaleTimeString()}</span>
            </div>
            <div className="whitespace-pre-wrap break-all">
                {typeof message.content === 'string' ? message.content : JSON.stringify(message.content)}
            </div>
        </div>
    );
});

// 设置每页消息数量
const PAGE_SIZE = 500;

// Main Component
const ChannelMonitorRedux: React.FC = () => {
    const dispatch = useAppDispatch();
    const { channels: channelConfigs, messageStats: allMessageStats } = useAppSelector(state => state.channel);
    const rootState = useAppSelector(state => state);

    // Local state with proper initialization
    const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [channels, setChannels] = useState<Channel[]>([]);
    
    // 消息分页状态
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // 获取通道类型名称
    const getChannelTypeName = (type: ChannelType): string => {
        switch (type) {
            case 'tcpclient': return 'TCP客户端';
            case 'tcpserver': return 'TCP服务端';
            case 'serial': return '串口';
            case 'mqtt': return 'MQTT';
            case 'bluetooth': return '蓝牙';
            default: return '';
        }
    };

    // 初始化通道列表
    useEffect(() => {
        console.log('Channel configs updated:', channelConfigs);
        const channelList = Object.entries(channelConfigs).reduce<Channel[]>((acc, [channelType, config]) => {
            if (!config) {
                console.log(`Skipping channel ${channelType} due to missing config`);
                return acc;
            }
            
            const type = channelType as ChannelType;
            const stats = config.channelId ? (allMessageStats[config.channelId] || { sent: 0, received: 0 }) : { sent: 0, received: 0 };
            
            const channel: Channel = {
                channelId: config.channelId || `${type}-${Date.now()}`,
                channeltype: type,
                name: getChannelTypeName(type),
                state: config.state || 'disconnected',
                sentCount: stats.sent || 0,
                receivedCount: stats.received || 0,
                config: config,
                messages: [],
                clients: []
            };

            // 根据通道类型添加特定信息
            if (type === 'tcpserver') {
                const tcpConfig = config as TcpServerConfig;
                if (tcpConfig.ip && tcpConfig.port) {
                    channel.name = `TCP服务器 (${tcpConfig.ip}:${tcpConfig.port})`;
                    channel.address = `${tcpConfig.ip}:${tcpConfig.port}`;
                }
                
                if (tcpConfig.children && Array.isArray(tcpConfig.children)) {
                    channel.clients = tcpConfig.children.map(client => {
                        const clientId = client.channelId || `${client.ip}:${client.port}`;
                        const clientStats = allMessageStats[clientId] || { sent: 0, received: 0 };
                        
                        return {
                            ip: client.ip,
                            port: client.port,
                            state: client.state || 'disconnected',
                            channelId: clientId,
                            name: `${client.ip}:${client.port}`,
                            messages: [],
                            sentCount: clientStats.sent || 0,
                            receivedCount: clientStats.received || 0
                        };
                    });
                }
            } else if (type === 'tcpclient') {
                const tcpConfig = config as TcpClientConfig;
                if (tcpConfig.ip && tcpConfig.port) {
                    channel.name = `TCP客户端 (${tcpConfig.ip}:${tcpConfig.port})`;
                    channel.address = `${tcpConfig.ip}:${tcpConfig.port}`;
                }
            }

            acc.push(channel);
            return acc;
        }, []);

        setChannels(channelList);
    }, [channelConfigs, allMessageStats]);

    // 获取原始消息列表
    const rawMessages = useMemo(() => {
        if (!selectedChannel) return [];
        
        let messages: ChannelMessage[] = [];
        
        if (selectedChannel.channeltype === 'tcpserver' && selectedClient) {
            // 如果选中了具体客户端，只显示该客户端的消息
            messages = [...selectTcpServerClientMessages(rootState, selectedClient.channelId)];
        } else {
            // 否则显示通道消息
            messages = [...selectChannelMessages(rootState, selectedChannel.channelId)];
        }
        
        return messages;
    }, [selectedChannel?.channelId, selectedClient?.channelId, rootState.channel.messageHistory]);

    // 对消息进行排序和分页
    const messages = useMemo(() => {
        // 复制一份数据避免修改原始数据
        const sortedMessages = [...rawMessages].sort((a, b) => {
            const timeA = typeof a.timestamp === 'string' ? parseInt(a.timestamp) : (a.timestamp || 0);
            const timeB = typeof b.timestamp === 'string' ? parseInt(b.timestamp) : (b.timestamp || 0);
            return timeA - timeB;
        });
        
        return sortedMessages;
    }, [rawMessages]);

    // 分页后的消息
    const paginatedMessages = useMemo(() => {
        const startIndex = 0;
        const endIndex = messages.length;
        return messages.slice(startIndex, endIndex);
    }, [messages]);

    // 重置分页当通道改变时
    useEffect(() => {
        setCurrentPage(1);
    }, [selectedChannel?.channelId, selectedClient?.channelId]);
    
    // 使用 useEffect 监听消息变化
    useEffect(() => {
        if (messages.length > 0 && messages.length % 100 === 0) {
            console.log('消息列表更新:', messages.length);
        }
    }, [messages.length]);

    // 使用 useMemo 优化消息统计
    const currentStats = useMemo(() => {
        if (!selectedChannel) return { sent: 0, received: 0 };
        
        if (selectedClient) {
            return allMessageStats[selectedClient.channelId] || { sent: 0, received: 0 };
        }
        
        return allMessageStats[selectedChannel.channelId] || { sent: 0, received: 0 };
    }, [selectedChannel?.channelId, selectedClient?.channelId, allMessageStats]);

    // 更新选中通道的统计信息
    useEffect(() => {
        if (selectedChannel && currentStats) {
            setSelectedChannel(prev => {
                if (!prev) return null;
                if (prev.sentCount === currentStats.sent && prev.receivedCount === currentStats.received) {
                    return prev;
                }
                return {
                    ...prev,
                    sentCount: currentStats.sent,
                    receivedCount: currentStats.received
                };
            });
        }
    }, [currentStats]);

    // 优化选中通道的更新逻辑
    useEffect(() => {
        if (!selectedChannel) return;

        const updatedChannel = channels.find(c => 
            c.channelId === selectedChannel.channelId
        );

        if (!updatedChannel) {
            console.log('Selected channel no longer exists');
            setSelectedChannel(null);
            setSelectedClient(null);
            return;
        }

        // 只在必要属性变化时更新
        const needsUpdate = 
            updatedChannel.state !== selectedChannel.state ||
            updatedChannel.name !== selectedChannel.name;
            
        if (needsUpdate) {
            console.log('Updating selected channel properties');
            setSelectedChannel(prev => ({
                ...prev!,
                state: updatedChannel.state,
                name: updatedChannel.name
            }));
        }
            
        if (selectedClient && updatedChannel.clients) {
            const updatedClient = updatedChannel.clients.find(
                client => client.channelId === selectedClient.channelId
            );
            
            if (!updatedClient) {
                console.log('Selected client no longer exists');
                setSelectedClient(null);
            } else if (updatedClient.state !== selectedClient.state) {
                console.log('Updating selected client');
                setSelectedClient(prev => ({
                    ...prev!,
                    state: updatedClient.state
                }));
            }
        }
    }, [channels]);

    // 处理通道选择 - 使用useCallback优化
    const handleChannelSelect = useCallback((channel: Channel) => {
        if (selectedChannel?.channelId === channel.channelId) {
            setSelectedChannel(null);
            setSelectedClient(null);
        } else {
            // 防止在通道切换时重复渲染
            setSelectedClient(null);
            setCurrentPage(1);
            
            // 设置一个短暂的延迟状态用于UI反馈
            setIsLoadingMessages(true);
            
            // 使用requestAnimationFrame可以让UI更新后再加载数据
            requestAnimationFrame(() => {
                setSelectedChannel(channel);
                setIsLoadingMessages(false);
            });
        }
    }, [selectedChannel?.channelId]);

    // 处理客户端选择 - 使用useCallback优化
    const handleClientSelect = useCallback((client: Client) => {
        if (selectedClient?.channelId === client.channelId) {
            setSelectedClient(null);
        } else {
            setCurrentPage(1);
            
            // 同样增加加载状态
            setIsLoadingMessages(true);
            
            requestAnimationFrame(() => {
                setSelectedClient(client);
                setIsLoadingMessages(false);
            });
        }
    }, [selectedClient?.channelId]);

    // 处理消息清除
    const handleClearMessages = useCallback((channelId: string) => {
        dispatch(clearChannelMessages(channelId));
    }, [dispatch]);

    return (
        <div className="h-full">
            <PanelGroup direction="horizontal">
                {/* 通道列表面板 */}
                <Panel defaultSize={25} minSize={20}>
                    <ChannelList
                        channels={channels}
                        selectedChannel={selectedChannel}
                        onChannelSelect={handleChannelSelect}
                    />
                </Panel>

                <ResizeHandle />

                {/* 通道内容面板 */}
                <Panel defaultSize={75} minSize={30}>
                    <ChannelContent
                        selectedChannel={selectedChannel}
                        selectedClient={selectedClient}
                        onClientSelect={handleClientSelect}
                        onClearMessages={handleClearMessages}
                        messages={paginatedMessages}
                        isLoadingMessages={isLoadingMessages}
                    />
                </Panel>
            </PanelGroup>
        </div>
    );
};

// 优化渲染，防止不必要的重绘
export default React.memo(ChannelMonitorRedux);
