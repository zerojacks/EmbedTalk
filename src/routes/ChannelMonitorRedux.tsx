import React, { useEffect, useRef, useState } from 'react';
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
    ChannelConfigMap
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

// Type definitions
interface MessageListProps {
    messages: ChannelMessage[];
    className?: string;
    onClearMessages?: () => void;
}

interface Client {
    ip: string;
    port: number;
    state: ConnectionState;
    channelid: string;
    name: string;
    messages: ChannelMessage[];
    sentCount?: number;
    receivedCount?: number;
}

interface Channel {
    channelid: string;
    channeltype: ChannelType;
    name: string;
    state: ConnectionState;
    clients?: Client[];
    messages: ChannelMessage[];
    lastActivityTime?: number;
    sentCount: number;
    receivedCount: number;
    config?: TcpClientConfig | TcpServerConfig | SerialConfig | MqttConfig | BluetoothConfig;
    address?: string;
}

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

// Message List Component with auto-scroll
const MessageList: React.FC<MessageListProps> = ({ messages, className = "", onClearMessages }) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<List>(null);
    const [displayFormat, setDisplayFormat] = useState<'ascii' | 'hex'>('ascii');
    const [listHeight, setListHeight] = useState(500);
    const containerRef = useRef<HTMLDivElement>(null);
    const [localMessages, setLocalMessages] = useState<ChannelMessage[]>(messages);

    // 当外部消息变化时更新本地消息
    useEffect(() => {
        setLocalMessages(messages);
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
                        {formatTimestamp(extractTimestampFromContent(msg.content) || msg.timestamp)}
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
}> = ({ clients, onClientSelect, selectedClient }) => (
    <div className="flex flex-wrap gap-2">
        {clients.map((client) => (
            <button
                key={`${client.channelid}`}
                onClick={() => onClientSelect(client)}
                className={`btn btn-sm ${selectedClient?.channelid === client.channelid
                    ? 'btn-primary'
                    : client.state === 'connected'
                        ? 'btn-outline'
                        : 'btn-ghost'
                    }`}
            >
                <div className="flex items-center gap-2">
                    <span>{client.name}</span>
                    <div className={`w-2 h-2 rounded-full ${client.state === 'connected' ? 'bg-success' : 'bg-error'}`} />
                    {(client.sentCount !== undefined || client.receivedCount !== undefined) && (
                        <div className="text-xs opacity-70">
                            {client.sentCount !== undefined && <span>↑{client.sentCount}</span>}
                            {client.receivedCount !== undefined && <span className="ml-1">↓{client.receivedCount}</span>}
                        </div>
                    )}
                </div>
            </button>
        ))}
    </div>
);

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
    <PanelResizeHandle className="h-0.5 bg-base-300 hover:bg-primary/50 transition-colors cursor-row-resize" />
);

// Main Component
const ChannelMonitorRedux: React.FC = () => {
    // Redux hooks
    const channelConfigs = useAppSelector(state => state.channel.channels);
    const dispatch = useAppDispatch();

    // Local state
    const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [channels, setChannels] = useState<Channel[]>([]);

    // 处理通道选择
    const handleChannelSelect = (channel: Channel) => {
        // 如果已经选中，则取消选中
        if (selectedChannel?.channelid === channel.channelid && 
            selectedChannel?.channeltype === channel.channeltype) {
            setSelectedChannel(null);
            setSelectedClient(null);
        } else {
            setSelectedChannel(channel);
            setSelectedClient(null);
        }
    };

    // 处理客户端选择
    const handleClientSelect = (client: Client) => {
        console.log(`Selected client: ${client.name}, ID: ${client.channelid}`);
        setSelectedClient(client);
    };

    // 使用选择器获取消息
    const messages = useAppSelector(state => {
        if (selectedClient) {
            // 如果选择了客户端，使用客户端ID获取消息
            // 客户端ID格式为 "IP:PORT"，与后端发送的消息ID格式一致
            const clientId = `${selectedClient.ip}:${selectedClient.port}`;
            console.log(`获取客户端消息 - 客户端: ${selectedClient.name}, ID: ${clientId}`);
            
            // 检查Redux store中是否有该客户端的消息
            const clientMessages = selectTcpServerClientMessages(state, clientId);
            console.log(`客户端 ${clientId} 的消息数量: ${clientMessages.length}`);
            
            // 打印所有可用的消息ID
            console.log('Redux store中所有可用的消息ID:');
            Object.keys(state.channel.messageHistory).forEach(id => {
                console.log(`- ${id}: ${state.channel.messageHistory[id].length}条消息`);
            });
            
            return clientMessages;
        } else if (selectedChannel) {
            // 否则使用通道ID获取消息
            console.log(`获取通道消息 - 通道: ${selectedChannel.name}, ID: ${selectedChannel.channelid}`);
            
            // 如果是TCP客户端通道，并且有地址信息，使用地址作为ID
            if (selectedChannel.channeltype === 'tcpclient' && selectedChannel.address) {
                const clientId = selectedChannel.address;
                console.log(`TCP客户端通道使用地址作为ID: ${clientId}`);
                
                // 检查Redux store中是否有该通道的消息
                const channelMessages = selectChannelMessages(state, clientId);
                console.log(`通道 ${clientId} 的消息数量: ${channelMessages.length}`);
                
                return channelMessages;
            }
            
            // 检查Redux store中是否有该通道的消息
            const channelMessages = selectChannelMessages(state, selectedChannel.channelid);
            console.log(`通道 ${selectedChannel.channelid} 的消息数量: ${channelMessages.length}`);
            
            return channelMessages;
        }
        return [];
    });
    
    // 使用选择器获取消息统计
    const messageStats = useAppSelector(state => {
        if (selectedClient) {
            // 如果选择了客户端，使用客户端ID获取消息统计
            // 客户端ID格式为 "IP:PORT"，与后端发送的消息ID格式一致
            const clientId = `${selectedClient.ip}:${selectedClient.port}`;
            console.log(`获取客户端消息统计 - 客户端: ${selectedClient.name}, ID: ${clientId}`);
            return selectTcpServerClientMessageStats(state, clientId);
        } else if (selectedChannel) {
            // 否则使用通道ID获取消息统计
            
            // 如果是TCP客户端通道，并且有地址信息，使用地址作为ID
            if (selectedChannel.channeltype === 'tcpclient' && selectedChannel.address) {
                const clientId = selectedChannel.address;
                console.log(`TCP客户端通道使用地址作为ID获取消息统计: ${clientId}`);
                return selectChannelMessageStats(state, clientId);
            }
            
            return selectChannelMessageStats(state, selectedChannel.channelid);
        }
        return { sent: 0, received: 0 };
    });

    // 将 Redux 中的通道配置转换为组件需要的格式
    useEffect(() => {
        const newChannels: Channel[] = [];
        
        // 处理 TCP 客户端
        if (channelConfigs.tcpclient) {
            const { state, ip, port } = channelConfigs.tcpclient;
            // 构建地址字符串
            const address = ip && port ? `${ip}:${port}` : undefined;
            
            newChannels.push({
                channelid: 'tcpclient',
                channeltype: 'tcpclient',
                name: `TCP客户端 (${ip}:${port})`,
                state,
                sentCount: 0,
                receivedCount: 0,
                config: channelConfigs.tcpclient,
                address, // 添加地址字段
                messages: [] // 添加空的消息数组
            });
        }
        
        // 处理 TCP 服务器
        if (channelConfigs.tcpserver) {
            const { state, ip, port } = channelConfigs.tcpserver;
            const clients: Client[] = [];
            
            // 如果有客户端连接，添加到列表
            if (channelConfigs.tcpserver.children) {
                channelConfigs.tcpserver.children.forEach(client => {
                    clients.push({
                        ip: client.ip,
                        port: client.port,
                        state: client.state,
                        channelid: `${client.ip}:${client.port}`,
                        name: `${client.ip}:${client.port}`,
                        messages: [],
                        sentCount: 0,
                        receivedCount: 0
                    });
                });
            }
            
            newChannels.push({
                channelid: 'tcpserver',
                channeltype: 'tcpserver',
                name: `TCP服务器 (${ip}:${port})`,
                state,
                sentCount: 0,
                receivedCount: 0,
                clients,
                config: channelConfigs.tcpserver,
                messages: [] // 添加空的消息数组
            });
        }
        
        // 处理其他通道类型
        Object.entries(channelConfigs).forEach(([channelId, config]) => {
            if (config && config.state && channelId !== 'tcpclient' && channelId !== 'tcpserver') {
                const channelType = channelId as ChannelType;
                const stats = selectChannelMessageStats(
                    { channel: { channels: channelConfigs, messageStats: {}, messageHistory: {}, loading: false, error: null, serviceInitialized: true } } as RootState, 
                    channelId
                );
                
                // 创建基本通道信息
                const channel: Channel = {
                    channelid: channelId,
                    channeltype: channelType,
                    name: getChannelTypeName(channelType),
                    state: config.state,
                    sentCount: stats.sent,
                    receivedCount: stats.received,
                    config: config as any,
                    messages: [] // 添加空的消息数组
                };

                // 根据通道类型添加特定信息
                switch (channelType) {
                    case 'serial': {
                        const serialConfig = config as SerialConfig;
                        if (serialConfig.comname) {
                            channel.name = `串口 (${serialConfig.comname})`;
                        }
                        break;
                    }
                    case 'mqtt': {
                        const mqttConfig = config as MqttConfig;
                        if (mqttConfig.ip && mqttConfig.port) {
                            channel.name = `MQTT (${mqttConfig.ip}:${mqttConfig.port})`;
                        }
                        break;
                    }
                    case 'bluetooth': {
                        const bluetoothConfig = config as BluetoothConfig;
                        if (bluetoothConfig.bluetoothname) {
                            channel.name = `蓝牙 (${bluetoothConfig.bluetoothname})`;
                        }
                        break;
                    }
                }

                newChannels.push(channel);
            }
        });

        setChannels(newChannels);

        // 如果当前选中的通道存在于新的列表中，更新它
        if (selectedChannel) {
            const updatedChannel = newChannels.find(c => 
                c.channelid === selectedChannel.channelid && 
                c.channeltype === selectedChannel.channeltype
            );
            if (!updatedChannel) {
                // 如果选中的通道不在新列表中，清除选择
                setSelectedChannel(null);
                setSelectedClient(null);
            }
        }
    }, [channelConfigs]); // 只在 channelConfigs 变化时更新

    // 更新选中通道的消息统计
    useEffect(() => {
        if (selectedChannel && messageStats) {
            // 如果选择了客户端，更新客户端的消息统计
            if (selectedClient) {
                // 使用消息统计数据更新客户端对象
                const updatedClient = {
                    ...selectedClient,
                    sentCount: messageStats.sent,
                    receivedCount: messageStats.received
                };
                
                console.log(`Updating client stats: ${updatedClient.name}, Sent: ${messageStats.sent}, Received: ${messageStats.received}`);
                setSelectedClient(updatedClient);
                
                // 更新通道中的客户端列表
                if (selectedChannel.clients) {
                    const updatedClients = selectedChannel.clients.map(client => 
                        client.ip === selectedClient.ip && client.port === selectedClient.port ? updatedClient : client
                    );
                    
                    const updatedChannel = {
                        ...selectedChannel,
                        clients: updatedClients
                    };
                    
                    setSelectedChannel(updatedChannel);
                    setChannels(prevChannels => 
                        prevChannels.map(channel => 
                            channel.channelid === selectedChannel.channelid ? updatedChannel : channel
                        )
                    );
                }
            } 
            // 如果没有选择客户端，更新通道的消息统计
            else {
                const updatedChannel = channels.find(c => 
                    c.channelid === selectedChannel.channelid && 
                    c.channeltype === selectedChannel.channeltype
                );
                
                if (updatedChannel && (
                    updatedChannel.sentCount !== messageStats.sent || 
                    updatedChannel.receivedCount !== messageStats.received
                )) {
                    const newChannel = {
                        ...updatedChannel,
                        sentCount: messageStats.sent,
                        receivedCount: messageStats.received
                    };
                    
                    console.log(`Updating channel stats: ${newChannel.name}, Sent: ${messageStats.sent}, Received: ${messageStats.received}`);
                    setSelectedChannel(newChannel);
                    setChannels(prevChannels => 
                        prevChannels.map(channel => 
                            channel.channelid === selectedChannel.channelid ? newChannel : channel
                        )
                    );
                }
            }
        }
    }, [messageStats, channels, selectedChannel, selectedClient]); // 添加selectedClient作为依赖项
    
    return (
        <div className="h-full">
            <PanelGroup direction="horizontal">
                {/* 通道列表面板 */}
                <Panel defaultSize={25} minSize={20}>
                    <div className="h-full p-2 overflow-y-auto">
                        <div className="space-y-2">
                            {channels.length > 0 ? (
                                channels.map((channel: Channel) => (
                                    <div
                                        key={`${channel.channeltype}-${channel.channelid}`}
                                        className={`card bg-base-100 shadow hover:shadow-md transition-all duration-300 cursor-pointer
                                            ${selectedChannel?.channelid === channel.channelid && 
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

                                            {channel.channeltype === 'tcpserver' && channel.clients && channel.clients.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-1.5">
                                                    {channel.clients.map((client) => (
                                                        <div
                                                            key={`${channel.channeltype}-${channel.channelid}-${client.channelid}`}
                                                            className="flex items-center gap-1 px-1.5 py-0.5 bg-base-200 rounded text-xs"
                                                        >
                                                            <ConnectionIndicator 
                                                                connected={client.state === 'connected'} 
                                                                className="w-1.5 h-1.5"
                                                            />
                                                            <span className="truncate max-w-[100px]">{client.name}</span>
                                                        </div>
                                                    ))}
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

                                    {/* TCP服务器客户端选择器 */}
                                    {selectedChannel.channeltype === 'tcpserver' && 
                                     selectedChannel.clients && 
                                     selectedChannel.clients.length > 0 && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm opacity-70">客户端:</span>
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => setSelectedClient(null)}
                                                    className={`btn btn-xs ${!selectedClient ? 'btn-primary' : 'btn-ghost'}`}
                                                >
                                                    全部
                                                </button>
                                                {selectedChannel.clients.map((client) => (
                                                    <button
                                                        key={`${selectedChannel.channeltype}-${selectedChannel.channelid}-${client.channelid}`}
                                                        onClick={() => handleClientSelect(client)}
                                                        className={`btn btn-xs ${selectedClient?.channelid === client.channelid ? 'btn-primary' : 'btn-ghost'} gap-1`}
                                                    >
                                                        <ConnectionIndicator 
                                                            connected={client.state === 'connected'} 
                                                            className="w-1.5 h-1.5"
                                                        />
                                                        <span>{client.name}</span>
                                                        <span className="opacity-70">({client.messages.length})</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 消息列表和发送组件 */}
                            <div className="flex-1 overflow-hidden">
                                {selectedChannel.state === 'connected' ? (
                                    <PanelGroup direction="vertical">
                                        <Panel defaultSize={80} minSize={30}>
                                            <MessageList
                                                messages={selectedClient ? selectedClient.messages : messages}
                                                className="h-full"
                                                onClearMessages={() => {
                                                    // 创建一个更新后的对象，清空消息并重置计数器
                                                    if (selectedClient) {
                                                        // 获取客户端ID
                                                        const clientId = `${selectedClient.ip}:${selectedClient.port}`;
                                                        
                                                        // 清空 Redux store 中的消息
                                                        dispatch(clearChannelMessages(clientId));
                                                        
                                                        // 更新客户端对象
                                                        const updatedClient = { 
                                                            ...selectedClient, 
                                                            messages: [],
                                                            sentCount: 0,
                                                            receivedCount: 0
                                                        };
                                                        setSelectedClient(updatedClient);
                                                        
                                                        // 更新所属通道的客户端列表
                                                        if (selectedChannel && selectedChannel.clients) {
                                                            const updatedClients = selectedChannel.clients.map(client => 
                                                                client.channelid === updatedClient.channelid ? updatedClient : client
                                                            );
                                                            setSelectedChannel({
                                                                ...selectedChannel,
                                                                clients: updatedClients
                                                            });
                                                        }
                                                    } else if (selectedChannel) {
                                                        // 获取通道ID
                                                        let channelId = selectedChannel.channelid;
                                                        
                                                        // 如果是TCP客户端通道，并且有地址信息，使用地址作为ID
                                                        if (selectedChannel.channeltype === 'tcpclient' && selectedChannel.address) {
                                                            channelId = selectedChannel.address;
                                                        }
                                                        
                                                        // 清空 Redux store 中的消息
                                                        dispatch(clearChannelMessages(channelId));
                                                        
                                                        // 更新通道对象
                                                        setSelectedChannel({
                                                            ...selectedChannel,
                                                            messages: [],
                                                            sentCount: 0,
                                                            receivedCount: 0
                                                        });
                                                    }
                                                    
                                                    // 可以考虑添加一个通知提示
                                                    console.log('消息已清空，计数器已重置');
                                                }}
                                            />
                                        </Panel>
                                        
                                        <VerticalResizeHandle />
                                        
                                        <Panel defaultSize={20} minSize={15}>
                                            {/* 消息发送组件 */}
                                            <div className="h-full">
                                                <MessageSender
                                                    channelType={selectedChannel.channeltype}
                                                    onSendMessage={async (message, isHex) => {
                                                        try {
                                                            await ChannelService.sendMessage(
                                                                selectedChannel.channeltype,
                                                                message,
                                                                isHex
                                                            );
                                                            
                                                            // 显示成功提示
                                                            toast.success(
                                                                `成功发送${isHex ? "十六进制" : "ASCII"}消息`,
                                                                'end',
                                                                'bottom',
                                                                2000
                                                            );
                                                        } catch (error) {
                                                            console.error('发送消息失败:', error);
                                                            
                                                            // 显示错误提示
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
