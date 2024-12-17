import React, { useEffect, useRef, useState } from 'react';
import { WifiOff, Wifi, Send, MessageSquare, Server, Usb, Radio, Bluetooth } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "../components/dialog";
import useCombinedStore from '../stores/useCombinedStore';
import { Channel, MessageType } from '../stores/useChannelStore';

// Type definitions
interface Message {
    direction: 'Sent' | 'Received';
    content: string | object;
    timestamp: string;
    metadata?: Record<string, string | number | boolean>;
}

interface Client {
    channelid: string;
    name: string;
    state: 'Connected' | 'Disconnected';
}

interface ChannelIconProps {
    type: Channel['channeltype'];
    state: Channel['state'];
}

interface MessageListProps {
    messages: Message[];
    className?: string;
}

interface ChannelDetailDialogProps {
    channel: Channel | null;
    open: boolean;
    onClose: () => void;
}

// Helper function to get channel icon
const getChannelIcon = ({ type, state }: ChannelIconProps): JSX.Element | null => {
    const iconProps = {
        size: 20,
        className: `transition-all duration-300 ${state === 'Connected' ? 'text-success' : 'text-error'
            }`
    };

    switch (type) {
        case 'tcpclient':
            return state === 'Connected' ? <Wifi {...iconProps} /> : <WifiOff {...iconProps} />;
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
const MessageList: React.FC<MessageListProps> = ({ messages, className = "" }) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    return (
        <div className={`space-y-2 ${className}`}>
            {messages.map((msg, index) => (
                <div
                    key={index}
                    className={`flex items-start space-x-2 animate-slideIn ${msg.direction === 'Received' ? 'justify-start' : 'justify-end'
                        }`}
                >
                    {msg.direction === 'Received' && (
                        <MessageSquare size={16} className="mt-1 opacity-70" />
                    )}
                    <div className={`chat ${msg.direction === 'Received' ? 'chat-start' : 'chat-end'}`}>
                        <div className={`chat-bubble ${msg.direction === 'Received'
                                ? 'chat-bubble-neutral'
                                : 'chat-bubble-primary'
                            } max-w-[80%]`}>
                            <div className="text-sm break-all whitespace-pre-wrap">
                                {typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}
                            </div>
                            <div className="text-xs opacity-70 mt-1">
                                {new Date(msg.timestamp).toLocaleTimeString()}
                            </div>
                            {msg.metadata && Object.keys(msg.metadata).length > 0 && (
                                <div className="text-xs opacity-70 mt-1 space-x-1">
                                    {Object.entries(msg.metadata).map(([key, value]) => (
                                        <span key={key} className="badge badge-sm badge-ghost gap-1">
                                            {key}: {String(value)}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    {msg.direction === 'Sent' && (
                        <Send size={16} className="mt-1 text-primary opacity-70" />
                    )}
                </div>
            ))}
            <div ref={messagesEndRef} />
        </div>
    );
};

const ChannelDetailDialog: React.FC<ChannelDetailDialogProps> = ({
    channel,
    open,
    onClose
}) => {
    if (!channel) return null;

    return (
        <Dialog open={open} onClose={onClose}>
            <DialogContent className="w-full h-full m-10">
                <DialogHeader>
                    <DialogTitle className="flex items-center space-x-2">
                        {getChannelIcon({ type: channel.channeltype, state: channel.state })}
                        <span>{channel.name}</span>
                        <div className={`badge ${channel.state === 'Connected' ? 'badge-success' : 'badge-error'
                            } gap-2`}>
                            {channel.state}
                        </div>
                    </DialogTitle>
                </DialogHeader>

                {channel.channeltype === 'tcpserver' && channel.clients && (
                    <div className="border rounded-lg p-4 space-y-2">
                        <h4 className="font-semibold">Connected Clients</h4>
                        {channel.clients.map((client: Client) => (
                            <div
                                key={client.channelid}
                                className="flex items-center justify-between border-l-2 pl-4 py-2 hover:bg-base-200 rounded-lg"
                            >
                                <span>{client.name}</span>
                                <div className={`badge ${client.state === 'Connected' ? 'badge-success' : 'badge-error'
                                    }`}>
                                    {client.state}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex-1 overflow-hidden">
                    <div className="h-full overflow-y-auto p-4">
                        <MessageList messages={channel.messages} />
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
// Main Component
const ChannelMonitor: React.FC = () => {
    const { channels, activeChannels } = useCombinedStore();
    const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);

    useEffect(() => {
        // 找到channels中的selectedChannel
        setSelectedChannel(channels.find((c) => c.channelid === selectedChannel?.channelid) || null);
    }, [channels])

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                {channels.map((channel: Channel) => (
                    <div
                        key={channel.channelid}
                        className={`card bg-base-100 shadow-xl transition-all duration-300 cursor-pointer hover:scale-105 ${activeChannels.has(channel.channelid) ? 'ring-2 ring-primary' : ''
                            }`}
                        onClick={() => setSelectedChannel(channel)}
                    >
                        <div className="card-body p-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                    {getChannelIcon({
                                        type: channel.channeltype,
                                        state: channel.state
                                    })}
                                    <h3 className="card-title text-lg">{channel.name}</h3>
                                </div>
                                <div className={`badge ${channel.state === 'Connected' ? 'badge-success' : 'badge-error'
                                    } gap-2`}>
                                    {channel.state}
                                </div>
                            </div>

                            <div className="h-40 overflow-hidden relative">
                                <MessageList
                                    messages={channel.messages.slice(-3)}
                                    className="opacity-75"
                                />
                                {channel.messages.length > 3 && (
                                    <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-base-100 to-transparent" />
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <ChannelDetailDialog
                channel={selectedChannel}
                open={!!selectedChannel}
                onClose={() => setSelectedChannel(null)}
            />
        </>
    );
};


export default ChannelMonitor;