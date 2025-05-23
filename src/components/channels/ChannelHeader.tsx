import React from 'react';
import { Channel } from '../../types/channel';
import { getChannelIcon } from './ChannelList';

interface ChannelHeaderProps {
    channel: Channel;
}

const ConnectionIndicator: React.FC<{ connected: boolean, className?: string }> = ({ connected, className }) => (
    <div className={`w-2 h-2 rounded-full ${connected ? 'bg-success' : 'bg-error'} ${className}`} />
);

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

const ChannelHeader: React.FC<ChannelHeaderProps> = ({ channel }) => {
    return (
        <div className="flex-none px-4 py-2 border-b border-base-300">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <ConnectionIndicator connected={channel.state === 'connected'} />
                    {getChannelIcon({
                        type: channel.channeltype,
                        state: channel.state
                    })}
                    <h2 className="text-base font-medium">{channel.name}</h2>
                    <ChannelStats
                        sentCount={channel.sentCount}
                        receivedCount={channel.receivedCount}
                    />
                </div>
            </div>
        </div>
    );
};

export default ChannelHeader; 