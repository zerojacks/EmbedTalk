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
import MessageSender from '../components/MessageSender';
import { ChannelService } from '../services/channelService';
import { toast } from '../context/ToastProvider';

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

interface MessageListProps {
    messages: ChannelMessage[];
    className?: string;
    onClearMessages?: () => void;
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

// Message List Component with auto-scroll
const MessageList: React.FC<MessageListProps> = ({ messages, className = "", onClearMessages }) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<List>(null);
    const [displayFormat, setDisplayFormat] = useState<'ascii' | 'hex'>('ascii');
    const [listHeight, setListHeight] = useState(500);
    const containerRef = useRef<HTMLDivElement>(null);
    const [localMessages, setLocalMessages] = useState<ChannelMessage[]>(messages);

    // 当外部消息变化时更新本地消息，只保留最新的10000条
    useEffect(() => {
        const latestMessages = messages.length > 1000 ? messages.slice(-1000) : messages;
        setLocalMessages(latestMessages);
    }, [messages]);

    // 自动滚动到底部
    useEffect(() => {
        if (localMessages.length > 0 && listRef.current) {
            listRef.current.scrollToItem(localMessages.length - 1);
        }
    }, [localMessages.length]);

    // 计算容器高度
    useEffect(() => {
        if (containerRef.current) {
            const updateHeight = () => {
                if (containerRef.current) {
                    setListHeight(containerRef.current.clientHeight);
                }
            };
            
            updateHeight();
            window.addEventListener('resize', updateHeight);
            return () => window.removeEventListener('resize', updateHeight);
        }
    }, []);

    // 清空消息
    const clearMessages = () => {
        setLocalMessages([]);
        // 调用父组件提供的回调函数，通知消息已清空
        if (onClearMessages) {
            onClearMessages();
        }
    };

    // 将数字数组转换为 ASCII 字符串
    const bytesToAscii = (data: number[]): string => {
        return data.map(byte => {
            // 只显示可打印的 ASCII 字符，其他用点号代替
            return byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.';
        }).join('');
    };

    // 将数字数组转换为十六进制字符串
    const bytesToHex = (data: number[]): string => {
        return data.map(byte => byte.toString(16).padStart(2, '0')).join(' ');
    };

    // 格式化消息内容
    const formatContent = (content: any): string => {
        try {
            // 如果是字符串，尝试解析为 JSON
            if (typeof content === 'string') {
                const parsed = JSON.parse(content);
                
                // 提取 content.data 部分
                if (parsed.content?.data && Array.isArray(parsed.content.data)) {
                    return displayFormat === 'ascii' 
                        ? bytesToAscii(parsed.content.data) 
                        : bytesToHex(parsed.content.data);
                }
                
                // 如果直接有 data 字段
                if (parsed.data && Array.isArray(parsed.data)) {
                    return displayFormat === 'ascii' 
                        ? bytesToAscii(parsed.data) 
                        : bytesToHex(parsed.data);
                }
                
                return JSON.stringify(parsed, null, 2);
            }
            
            // 如果是对象，直接检查 content.data
            if (content?.content?.data && Array.isArray(content.content.data)) {
                return displayFormat === 'ascii' 
                    ? bytesToAscii(content.content.data) 
                    : bytesToHex(content.content.data);
            }
            
            // 如果直接有 data 字段
            if (content?.data && Array.isArray(content.data)) {
                return displayFormat === 'ascii' 
                    ? bytesToAscii(content.data) 
                    : bytesToHex(content.data);
            }
            
            // 如果无法提取，则返回格式化的 JSON
            return JSON.stringify(content, null, 2);
        } catch (error) {
            // 处理任何解析错误
            console.error('Error formatting content:', error);
            return typeof content === 'string' ? content : JSON.stringify(content, null, 2);
        }
    };

    // 格式化时间戳，包含毫秒
    const formatTimestamp = (timestamp: number | string): string => {
        try {
            // 检查是否是数字或数字字符串
            const numericTimestamp = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;
            
            // 如果是有效的数字
            if (!isNaN(numericTimestamp)) {
                // 判断是秒级还是毫秒级时间戳
                const date = new Date(numericTimestamp);
                const secondsDate = new Date(numericTimestamp * 1000);
                
                // 如果是合理的毫秒级时间戳（2000年以后）
                if (date.getFullYear() >= 2000 && date.getFullYear() <= 2100) {
                    return formatDateWithMilliseconds(date);
                }
                
                // 如果是合理的秒级时间戳（2000年以后）
                if (secondsDate.getFullYear() >= 2000 && secondsDate.getFullYear() <= 2100) {
                    return formatDateWithMilliseconds(secondsDate);
                }
            }
            
            // 如果是字符串但不是数字，尝试直接解析
            if (typeof timestamp === 'string' && isNaN(numericTimestamp)) {
                const date = new Date(timestamp);
                if (!isNaN(date.getTime())) {
                    return formatDateWithMilliseconds(date);
                }
            }
            
            // 如果无法解析，返回当前时间（带毫秒）
            return formatDateWithMilliseconds(new Date());
        } catch (error) {
            console.error('Error formatting timestamp:', error);
            return formatDateWithMilliseconds(new Date());
        }
    };

    // 格式化日期，包含毫秒
    const formatDateWithMilliseconds = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
        
        return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
    };

    // 从消息中提取时间戳
    const extractTimestampFromContent = (content: any): string | null => {
        try {
            // 如果是字符串，尝试解析为JSON
            if (typeof content === 'string') {
                try {
                    const parsed = JSON.parse(content);
                    if (parsed.timestamp) {
                        return parsed.timestamp;
                    }
                } catch {
                    // 解析失败，忽略
                }
            }
            
            // 如果是对象，直接检查
            if (content && typeof content === 'object') {
                if (content.timestamp) {
                    return content.timestamp;
                }
            }
            
            return null;
        } catch {
            return null;
        }
    };

    // 渲染单个消息项
    const MessageRow = ({ index, style }: { index: number, style: React.CSSProperties }) => {
        const msg = localMessages[index];
        return (
            <div
                style={style}
                className={`grid grid-cols-[160px_64px_1fr] gap-2 items-center p-1 border-b border-base-300 hover:bg-base-200/30 transition-colors ${
                    index % 2 === 0 ? 'bg-base-200/10' : ''
                }`}
            >
                {/* 时间戳 */}
                <div className="text-xs text-base-content/60 text-center">
                    <span className="whitespace-nowrap overflow-hidden">
                        {formatTimestamp(msg.timestamp)}
                    </span>
                </div>
                
                {/* 方向指示 */}
                <div className={`text-xs px-2 py-0.5 rounded-md text-center ${
                    msg.direction === 'Received' 
                        ? 'bg-success/20 text-success' 
                        : 'bg-primary/20 text-primary'
                }`}>
                    {msg.direction === 'Received' ? '接收' : '发送'}
                </div>
                
                {/* 消息内容 */}
                <div className="text-sm font-mono break-all whitespace-pre-wrap">
                    {formatContent(msg.content)}
                </div>
            </div>
        );
    };

    return (
        <div className={`flex flex-col h-full ${className}`}>
            <div className="flex-none px-4 py-2 border-b border-base-300 bg-base-200/50">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium">消息记录</h3>
                    <div className="flex items-center gap-2">
                        <div className="join">
                            <button 
                                className={`join-item btn btn-sm ${displayFormat === 'ascii' ? 'btn-active' : ''}`}
                                onClick={() => setDisplayFormat('ascii')}
                            >
                                ASCII
                            </button>
                            <button 
                                className={`join-item btn btn-sm ${displayFormat === 'hex' ? 'btn-active' : ''}`}
                                onClick={() => setDisplayFormat('hex')}
                            >
                                HEX
                            </button>
                        </div>
                        <button 
                            className="btn btn-sm btn-error btn-outline"
                            onClick={clearMessages}
                            title="清空消息"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                </div>
            </div>
            <div className="flex-1 overflow-hidden" ref={containerRef}>
                {localMessages.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-base-content/50">
                        暂无消息记录
                    </div>
                ) : (
                    <List
                        ref={listRef}
                        height={listHeight}
                        width="100%"
                        itemCount={localMessages.length}
                        itemSize={50}
                        className="custom-scrollbar"
                        overscanCount={5}
                    >
                        {MessageRow}
                    </List>
                )}
            </div>
            <div ref={messagesEndRef} />
        </div>
    );
};

// 分离客户端列表组件
const ClientList: React.FC<{
    clients: Client[];
    onClientSelect: (client: Client) => void;
    selectedClient: Client | null;
}> = React.memo(({ clients, onClientSelect, selectedClient }) => {
    // 使用 useMemo 缓存客户端列表
    const clientList = useMemo(() => clients.map((client) => {
        const isSelected = selectedClient?.channelId === client.channelId;
        return (
            <button
                key={client.channelId}
                onClick={() => onClientSelect(client)}
                className={`w-full px-3 py-2 rounded-lg transition-colors duration-150
                    ${isSelected 
                        ? 'bg-primary/10 text-primary ring-1 ring-primary/20' 
                        : 'text-base-content hover:bg-base-300/50'}`}
            >
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors
                        ${client.state === 'connected' 
                            ? 'bg-success' 
                            : 'bg-error'}`} 
                    />
                    <span className="text-sm font-medium truncate flex-1">{client.name}</span>
                </div>
                {(client.sentCount !== undefined || client.receivedCount !== undefined) && (
                    <div className="text-xs text-base-content/70 flex gap-3 pl-4 mt-1">
                        {client.sentCount !== undefined && (
                            <span className="flex items-center gap-1">
                                <Send className="w-3 h-3" />
                                {client.sentCount}
                            </span>
                        )}
                        {client.receivedCount !== undefined && (
                            <span className="flex items-center gap-1">
                                <MessageSquare className="w-3 h-3" />
                                {client.receivedCount}
                            </span>
                        )}
                    </div>
                )}
            </button>
        );
    }), [clients, selectedClient]);

    return (
        <div className="flex flex-col h-full">
            <div className="flex justify-between items-center mb-3 px-2">
                <h3 className="text-sm font-medium text-base-content/80">TCP客户端列表</h3>
                <span className="text-xs text-base-content/60 bg-base-300 px-2 py-0.5 rounded-full">
                    {clients.length}
                </span>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0 px-2">
                <div className="space-y-1.5">
                    {clientList}
                </div>
            </div>
        </div>
    );
}, (prevProps, nextProps) => {
    // 自定义比较函数，只在必要时重新渲染
    return (
        prevProps.selectedClient?.channelId === nextProps.selectedClient?.channelId &&
        prevProps.clients.length === nextProps.clients.length &&
        prevProps.clients.every((client, index) => {
            const nextClient = nextProps.clients[index];
            return (
                client.channelId === nextClient.channelId &&
                client.state === nextClient.state &&
                client.sentCount === nextClient.sentCount &&
                client.receivedCount === nextClient.receivedCount
            );
        })
    );
});

ClientList.displayName = 'ClientList';

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

// Main Component
const ChannelMonitorRedux: React.FC = () => {
    const dispatch = useAppDispatch();
    const { channels: channelConfigs, messageStats: allMessageStats } = useAppSelector(state => state.channel);
    const rootState = useAppSelector(state => state);

    // Local state with proper initialization
    const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [channels, setChannels] = useState<Channel[]>([]);

    // 优化通道列表初始化逻辑
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

            console.log(`Adding channel: ${channel.name}`, channel);
            acc.push(channel);
            return acc;
        }, []);

        console.log('Setting channels:', channelList);
        setChannels(channelList);
    }, [channelConfigs]);

    // 使用 useMemo 优化消息选择逻辑
    const messages = useMemo(() => {
        if (!selectedChannel) return [];
        
        if (selectedChannel.channeltype === 'tcpserver') {
            let messages: ChannelMessage[] = [];
            
            if (selectedClient) {
                // 如果选中了具体客户端，只显示该客户端的消息
                messages = [...selectTcpServerClientMessages(rootState, selectedClient.channelId)];
            } else {
                // 如果没有选中客户端，只显示服务器的消息
                messages = [...selectChannelMessages(rootState, selectedChannel.channelId)];
            }
            
            // 对数组副本进行排序
            return [...messages].sort((a, b) => {
                const timeA = typeof a.timestamp === 'string' ? parseInt(a.timestamp) : (a.timestamp || 0);
                const timeB = typeof b.timestamp === 'string' ? parseInt(b.timestamp) : (b.timestamp || 0);
                return timeA - timeB;
            });
        }
        
        // 对于其他类型的通道，也创建一个副本再返回
        return [...selectChannelMessages(rootState, selectedChannel.channelId)];
    }, [selectedChannel?.channelId, selectedClient?.channelId, rootState.channel.messageHistory]);

    
    // 使用 useEffect 监听消息变化
    useEffect(() => {
        if (messages.length > 0) {
            console.log('消息列表更新:', messages);
        }
    }, [messages]);

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
            const updatedChannel = {
                ...selectedChannel,
                sentCount: currentStats.sent,
                receivedCount: currentStats.received
            };
            console.log('更新通道统计信息:', updatedChannel);
            setSelectedChannel(updatedChannel);
        }
    }, [currentStats]);

    // 优化选中通道的更新逻辑
    useEffect(() => {
        if (!selectedChannel) return;

        const updatedChannel = channels.find(c => 
            c.channelId === selectedChannel.channelId && 
            c.channeltype === selectedChannel.channeltype
        );

        if (!updatedChannel) {
            console.log('Selected channel no longer exists');
            setSelectedChannel(null);
            setSelectedClient(null);
            return;
        }

        // 添加消息历史到更新的通道
        const channelMessages = selectChannelMessages(rootState, selectedChannel.channelId);
        updatedChannel.messages = channelMessages;
        console.log('更新通道消息:', updatedChannel.messages);

        if (JSON.stringify(updatedChannel) !== JSON.stringify(selectedChannel)) {
            console.log('Updating selected channel');
            setSelectedChannel(updatedChannel);
            
            if (selectedClient && updatedChannel.clients) {
                const updatedClient = updatedChannel.clients.find(
                    client => client.channelId === selectedClient.channelId
                );
                
                if (updatedClient) {
                    console.log('Updating selected client');
                    setSelectedClient(updatedClient);
                } else {
                    console.log('Selected client no longer exists');
                    setSelectedClient(null);
                }
            }
        }
    }, [channels, selectedChannel?.channelId, selectedChannel?.channeltype, rootState.channel.messageHistory]);

    // 处理通道选择
    const handleChannelSelect = useCallback((channel: Channel) => {
        // 如果已经选中，则取消选中
        if (selectedChannel?.channelId === channel.channelId && 
            selectedChannel?.channeltype === channel.channeltype) {
            setSelectedChannel(null);
            setSelectedClient(null);
        } else {
            setSelectedChannel(channel);
            setSelectedClient(null);
        }
    }, [selectedChannel?.channelId, selectedChannel?.channeltype]);

    // 使用useCallback优化客户端选择处理函数
    const handleClientSelect = useCallback((client: Client) => {
        setSelectedClient(client);
    }, []);

    return (
        <div className="h-full">
            <PanelGroup direction="horizontal">
                {/* 通道列表面板 */}
                <Panel defaultSize={25} minSize={20}>
                    <div className="h-full p-2 overflow-y-auto">
                        <div className="space-y-2">
                            {channels && channels.length > 0 ? (
                                channels.map((channel: Channel) => (
                                    <div
                                        key={`${channel.channeltype}-${channel.channelId}`}
                                        className={`card bg-base-100 shadow hover:shadow-md transition-all duration-300 cursor-pointer
                                            ${selectedChannel?.channelId === channel.channelId && 
                                              selectedChannel?.channeltype === channel.channeltype ? 'ring-1 ring-primary' : ''}`}
                                        onClick={() => handleChannelSelect(channel)}
                                    >
                                        <div className="card-body p-3">
                                            <div className="flex items-center gap-2">
                                                <ConnectionIndicator connected={channel.state === 'connected'} />
                                                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                                    {getChannelIcon({
                                                        type: channel.channeltype,
                                                        state: channel.state
                                                    })}
                                                    <h3 className="text-sm font-medium truncate">{channel.name}</h3>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between mt-1.5">
                                                <ChannelStats
                                                    sentCount={channel.sentCount}
                                                    receivedCount={channel.receivedCount}
                                                />
                                                {channel.lastActivityTime && (
                                                    <div className="text-xs opacity-60">
                                                        {new Date(channel.lastActivityTime).toLocaleTimeString()}
                                                    </div>
                                                )}
                                            </div>

                                            {/* 对于TCP服务器，显示连接的客户端数量 */}
                                            {channel.channeltype === 'tcpserver' && channel.clients && channel.clients.length > 0 && (
                                                <div className="mt-1.5 text-xs text-base-content/70">
                                                    已连接客户端: {channel.clients.length}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="flex flex-col items-center justify-center p-10 text-center">
                                    <WifiOff size={48} className="text-error mb-4" />
                                    <h3 className="text-xl font-semibold mb-2">没有通道连接</h3>
                                    <p className="text-gray-500">请在设置页面连接一个通道以开始监控</p>
                                </div>
                            )}
                        </div>
                    </div>
                </Panel>

                <ResizeHandle />

                {/* 消息面板 */}
                <Panel defaultSize={75} minSize={30}>
                    {selectedChannel ? (
                        <div className="flex flex-col h-full overflow-hidden">
                            {/* 顶部工具栏 */}
                            <div className="flex-none px-4 py-2 border-b border-base-300">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <ConnectionIndicator connected={selectedChannel.state === 'connected'} />
                                        {getChannelIcon({
                                            type: selectedChannel.channeltype,
                                            state: selectedChannel.state
                                        })}
                                        <h2 className="text-base font-medium">{selectedChannel.name}</h2>
                                        <ChannelStats
                                            sentCount={selectedChannel.sentCount}
                                            receivedCount={selectedChannel.receivedCount}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* 消息内容区域 */}
                            <div className="flex-1 overflow-hidden">
                                {selectedChannel.state === 'connected' ? (
                                    <PanelGroup direction="horizontal">
                                        {/* 客户端面板 - 仅对TCP服务器显示 */}
                                        {selectedChannel.channeltype === 'tcpserver' && selectedChannel.clients && selectedChannel.clients.length > 0 && (
                                            <>
                                                <Panel defaultSize={20} minSize={15}>
                                                    <div className="h-full p-3 overflow-y-auto border-r border-base-300 bg-base-200/20">
                                                        <div className="flex justify-between items-center mb-3">
                                                            <h3 className="text-sm font-medium">客户端列表</h3>
                                                            <button
                                                                onClick={() => setSelectedClient(null)}
                                                                className="btn btn-xs btn-ghost"
                                                                title="查看所有客户端消息"
                                                            >
                                                                全部 ({selectedChannel.clients.length})
                                                            </button>
                                                        </div>
                                                        
                                                        <ClientList 
                                                            clients={selectedChannel.clients}
                                                            onClientSelect={handleClientSelect}
                                                            selectedClient={selectedClient}
                                                        />
                                                        
                                                        {selectedClient && (
                                                            <div className="mt-4 p-2 bg-base-300/30 rounded text-xs">
                                                                <div className="text-base-content/70">当前选中客户端:</div>
                                                                <div className="font-medium">{selectedClient.name}</div>
                                                                <div className="flex justify-between mt-1">
                                                                    <div className="text-success">发送: {selectedClient.sentCount || 0}</div>
                                                                    <div className="text-info">接收: {selectedClient.receivedCount || 0}</div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </Panel>
                                                
                                                <ResizeHandle />
                                            </>
                                        )}
                                        
                                        {/* 消息面板 */}
                                        <Panel defaultSize={selectedChannel.channeltype === 'tcpserver' ? 80 : 100} minSize={30}>
                                            <PanelGroup direction="vertical">
                                                <Panel defaultSize={80} minSize={30}>
                                                    <MessageList
                                                        messages={messages}
                                                        className="h-full"
                                                        onClearMessages={() => {
                                                            if (selectedClient && selectedChannel) {
                                                                // 清空选中客户端的消息和统计
                                                                const clientId = selectedClient.channelId;
                                                                dispatch(clearChannelMessages(clientId));
                                                                
                                                                // 更新客户端对象
                                                                const updatedClient = {
                                                                    ...selectedClient,
                                                                    sentCount: 0,
                                                                    receivedCount: 0
                                                                };
                                                                
                                                                // 更新所属通道的客户端列表
                                                                const updatedChannel = {
                                                                    ...selectedChannel,
                                                                    clients: selectedChannel.clients?.map(client =>
                                                                        client.channelId === clientId ? updatedClient : client
                                                                    )
                                                                };
                                                                
                                                                // 更新 channels 数组
                                                                const updatedChannels = channels.map(channel =>
                                                                    channel.channelId === selectedChannel.channelId ? updatedChannel : channel
                                                                );
                                                                
                                                                setChannels(updatedChannels);
                                                                setSelectedChannel(updatedChannel);
                                                                setSelectedClient(updatedClient);
                                                            } else if (selectedChannel) {
                                                                // 清空通道的消息和统计
                                                                const channelId = selectedChannel.channelId;
                                                                dispatch(clearChannelMessages(channelId));
                                                                
                                                                // 准备更新的通道对象
                                                                let updatedChannel = {
                                                                    ...selectedChannel,
                                                                    sentCount: 0,
                                                                    receivedCount: 0
                                                                };
                                                                
                                                                // 如果是 TCP 服务器，同时清空所有客户端的消息和统计
                                                                if (selectedChannel.channeltype === 'tcpserver' && selectedChannel.clients) {
                                                                    // 更新所有客户端的计数器
                                                                    updatedChannel.clients = selectedChannel.clients.map(client => {
                                                                        // 清空每个客户端的消息
                                                                        dispatch(clearChannelMessages(client.channelId));
                                                                        return {
                                                                            ...client,
                                                                            sentCount: 0,
                                                                            receivedCount: 0
                                                                        };
                                                                    });
                                                                }
                                                                
                                                                // 更新 channels 数组
                                                                const updatedChannels = channels.map(channel =>
                                                                    channel.channelId === channelId ? updatedChannel : channel
                                                                );
                                                                
                                                                setChannels(updatedChannels);
                                                                setSelectedChannel(updatedChannel);
                                                            }
                                                        }}
                                                    />
                                                </Panel>
                                                
                                                <VerticalResizeHandle />
                                                
                                                <Panel defaultSize={20} minSize={15}>
                                                    {/* 消息发送组件 */}
                                                    <div className="h-full">
                                                        <MessageSender
                                                            channelType={selectedChannel.channeltype}
                                                            selectedClient={selectedClient}
                                                            onSendMessage={async (message, isHex, clientId) => {
                                                                try {
                                                                    console.log('发送消息:', message, isHex, clientId, selectedClient);
                                                                    // 如果是TCP服务端且选择了客户端，使用客户端ID发送
                                                                    if (selectedChannel.channeltype === 'tcpserver') {
                                                                        if (selectedClient) {
                                                                            // 使用选中客户端的channelId
                                                                            await ChannelService.sendMessage(
                                                                                selectedChannel.channelId,
                                                                                message,
                                                                                isHex,
                                                                                selectedClient.channelId
                                                                            );
                                                                        } else if (clientId) {
                                                                            // 使用传入的clientId
                                                                            await ChannelService.sendMessage(
                                                                                selectedChannel.channelId,
                                                                                message,
                                                                                isHex,
                                                                                clientId
                                                                            );
                                                                        } else {
                                                                            toast.warning(
                                                                                "请选择一个客户端进行发送",
                                                                                'end',
                                                                                'bottom',
                                                                                2000
                                                                            );
                                                                            return;
                                                                        }
                                                                    } else {
                                                                        // 非TCP服务端通道，正常发送
                                                                        await ChannelService.sendMessage(
                                                                            selectedChannel.channelId,
                                                                            message,
                                                                            isHex
                                                                        );
                                                                    }
                                                                    
                                                                    toast.success(
                                                                        `成功发送${isHex ? "十六进制" : "ASCII"}消息${selectedClient ? ` 到客户端 ${selectedClient.name}` : ''}`,
                                                                        'end',
                                                                        'bottom',
                                                                        2000
                                                                    );
                                                                } catch (error) {
                                                                    console.error('发送消息失败:', error);
                                                                    toast.error(
                                                                        `消息发送失败: ${error instanceof Error ? error.message : String(error)}`,
                                                                        'end',
                                                                        'bottom',
                                                                        3000
                                                                    );
                                                                }
                                                            }}
                                                            disabled={selectedChannel.state !== 'connected'}
                                                        />
                                                    </div>
                                                </Panel>
                                            </PanelGroup>
                                        </Panel>
                                    </PanelGroup>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-gray-500">
                                        <p>通道未连接，请先连接通道</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex items-center justify-center text-gray-500">
                            <p>请选择一个通道查看消息</p>
                        </div>
                    )}
                </Panel>
            </PanelGroup>
        </div>
    );
};

export default ChannelMonitorRedux;
