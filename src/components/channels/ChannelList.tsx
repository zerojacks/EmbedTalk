import React from 'react';
import { WifiOff, Wifi, Send, MessageSquare, Server, Usb, Radio, Bluetooth } from 'lucide-react';
import { Channel, ChannelType } from '../../types/channel';

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

// Helper function to get channel icon
const getChannelIcon = ({ type, state }: ChannelIconProps): JSX.Element | null => {
    const iconProps = {
        size: 20,
        className: `transition-all duration-300 ${state === 'connected' ? 'text-success' : 'text-error'}`
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

// 连接状态指示器组件
const ConnectionIndicator: React.FC<{ connected: boolean, className?: string }> = ({ connected, className }) => (
    <div className={`w-2 h-2 rounded-full ${connected ? 'bg-success' : 'bg-error'} ${className}`} />
);

// 通道统计组件
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

interface ChannelListProps {
    channels: Channel[];
    selectedChannel: Channel | null;
    onChannelSelect: (channel: Channel) => void;
}

const ChannelList: React.FC<ChannelListProps> = ({
    channels,
    selectedChannel,
    onChannelSelect
}) => {
    return (
        <div className="h-full p-2 overflow-y-auto">
            <div className="space-y-2">
                {channels && channels.length > 0 ? (
                    channels.map((channel: Channel) => (
                        <div
                            key={`${channel.channeltype}-${channel.channelId}`}
                            className={`card bg-base-100 shadow hover:shadow-md transition-all duration-300 cursor-pointer
                                ${selectedChannel?.channelId === channel.channelId && 
                                  selectedChannel?.channeltype === channel.channeltype ? 'ring-1 ring-primary' : ''}`}
                            onClick={() => onChannelSelect(channel)}
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
    );
};

export { ChannelList as default, getChannelIcon, getChannelTypeName, ConnectionIndicator, ChannelStats }; 