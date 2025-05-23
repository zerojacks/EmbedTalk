import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { FixedSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { Channel, Client, ChannelMessage } from '../../types/channel';
import MessageSender from './MessageSender';
import TcpServerContent from './content/TcpServerContent';
import TcpClientContent from './content/TcpClientContent';
import SerialContent from './content/SerialContent';
import MqttContent from './content/MqttContent';
import BluetoothContent from './content/BluetoothContent';

interface ChannelContentProps {
    selectedChannel: Channel | null;
    selectedClient: Client | null;
    onClientSelect: (client: Client) => void;
    onClearMessages: (channelId: string) => void;
    messages: ChannelMessage[];
    isLoadingMessages: boolean;
}

const ChannelContent: React.FC<ChannelContentProps> = ({
    selectedChannel,
    selectedClient,
    onClientSelect,
    onClearMessages,
    messages,
    isLoadingMessages
}) => {
    const [containerHeight, setContainerHeight] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<any>(null);
    const [autoScroll, setAutoScroll] = useState(true);
    const lastMessageCountRef = useRef(0);

    // 测量容器高度
    useEffect(() => {
        const updateHeight = () => {
            if (containerRef.current) {
                setContainerHeight(containerRef.current.offsetHeight);
            }
        };

        updateHeight();
        window.addEventListener('resize', updateHeight);
        return () => window.removeEventListener('resize', updateHeight);
    }, []);

    // 自动滚动到底部
    useEffect(() => {
        if (autoScroll && messages.length > 0 && messages.length !== lastMessageCountRef.current) {
            listRef.current?.scrollToItem(messages.length - 1);
            lastMessageCountRef.current = messages.length;
        }
    }, [messages.length, autoScroll]);

    // 如果未选择通道，显示空白
    if (!selectedChannel) {
        return (
            <div className="h-full flex items-center justify-center text-base-content/50">
                <div className="flex flex-col items-center">
                    <div className="text-3xl mb-2">💬</div>
                    <div>请选择一个通道</div>
                </div>
            </div>
        );
    }

    const handleScrollChange = ({ scrollOffset, scrollDirection }: { scrollOffset: number, scrollDirection: 'forward' | 'backward' }) => {
        // 当用户向上滚动时，暂停自动滚动
        if (scrollDirection === 'backward') {
            setAutoScroll(false);
        }
        
        // 当滚动到底部时，恢复自动滚动
        const listElement = listRef.current?._outerRef;
        if (listElement) {
            const isAtBottom = listElement.scrollHeight - listElement.scrollTop - listElement.clientHeight < 10;
            if (isAtBottom) {
                setAutoScroll(true);
            }
        }
    };

    const renderMessageItem = ({ index, style }: { index: number, style: React.CSSProperties }) => {
        const message = messages[index];
        if (!message) return null;
        
        // 使用现有的类型定义
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
    };

    const handleClearMessages = () => {
        const channelId = selectedClient ? selectedClient.channelId : selectedChannel.channelId;
        onClearMessages(channelId);
    };

    // 根据通道类型选择对应的内容组件
    const renderContent = () => {
        switch (selectedChannel.channeltype) {
            case 'tcpserver':
                return (
                    <TcpServerContent
                        channel={selectedChannel}
                        selectedClient={selectedClient}
                        onClientSelect={onClientSelect}
                        onClearMessages={onClearMessages}
                    />
                );
            case 'tcpclient':
                return (
                    <TcpClientContent
                        channel={selectedChannel}
                        onClearMessages={onClearMessages}
                    />
                );
            case 'serial':
                return (
                    <SerialContent
                        channel={selectedChannel}
                        onClearMessages={onClearMessages}
                    />
                );
            case 'mqtt':
                return (
                    <MqttContent
                        channel={selectedChannel}
                        onClearMessages={onClearMessages}
                    />
                );
            case 'bluetooth':
                return (
                    <BluetoothContent
                        channel={selectedChannel}
                        onClearMessages={onClearMessages}
                    />
                );
            default:
                return (
                    <div className="h-full flex items-center justify-center text-gray-500">
                        <p>不支持的通道类型</p>
                    </div>
                );
        }
    };

    return (
        <div className="h-full flex flex-col">
            {/* 通道标题 */}
            <div className="flex justify-between items-center p-3 bg-base-200 border-b border-base-300">
                <div className="flex items-center gap-2">
                    {selectedClient && (
                        <button 
                            className="btn btn-ghost btn-sm p-0 h-auto min-h-0" 
                            onClick={() => onClientSelect(selectedClient)}
                        >
                            <ArrowLeft size={16} />
                        </button>
                    )}
                    <h2 className="text-lg font-medium">
                        {selectedClient 
                            ? `客户端 ${selectedClient.name}`
                            : selectedChannel.name
                        }
                    </h2>
                    <div className={`w-2 h-2 rounded-full ${
                        (selectedClient?.state || selectedChannel.state) === 'connected' 
                            ? 'bg-success' 
                            : 'bg-error'
                    }`}/>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex flex-col text-sm">
                        <span className="flex items-center gap-1">
                            <span className="opacity-70">发送:</span>
                            <span className="text-primary font-medium">
                                {selectedClient 
                                    ? selectedClient.sentCount 
                                    : selectedChannel.sentCount}
                            </span>
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="opacity-70">接收:</span>
                            <span className="text-secondary font-medium">
                                {selectedClient 
                                    ? selectedClient.receivedCount 
                                    : selectedChannel.receivedCount}
                            </span>
                        </span>
                    </div>
                    
                    <button 
                        className="btn btn-ghost btn-sm text-error" 
                        onClick={handleClearMessages}
                    >
                        <Trash2 size={16} />
                        <span>清空消息</span>
                    </button>
                </div>
            </div>

            {/* 服务器客户端列表 */}
            {selectedChannel.channeltype === 'tcpserver' && !selectedClient && selectedChannel.clients && (
                <div className="p-3 border-b border-base-300 bg-base-100">
                    <h3 className="text-sm font-medium mb-2">已连接客户端 ({selectedChannel.clients.length})</h3>
                    <div className="flex flex-wrap gap-2">
                        {selectedChannel.clients.map(client => (
                            <button 
                                key={client.channelId} 
                                className="btn btn-sm btn-outline" 
                                onClick={() => onClientSelect(client)}
                            >
                                <div className={`w-2 h-2 rounded-full ${client.state === 'connected' ? 'bg-success' : 'bg-error'}`}/>
                                <span>{client.name}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* 通道PanelGroup部分 */}
            <div className="flex-1 overflow-hidden">
                <PanelGroup direction="vertical">
                    {/* 消息部分 */}
                    <Panel defaultSize={70} minSize={30}>
                        <div className="h-full flex flex-col" ref={containerRef}>
                            {isLoadingMessages ? (
                                <div className="flex-1 flex justify-center items-center">
                                    <div className="loading loading-spinner loading-md"></div>
                                    <span className="ml-2">加载消息中...</span>
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="flex-1 flex justify-center items-center text-base-content/50">
                                    暂无消息
                                </div>
                            ) : (
                                <div className="flex-1">
                                    <AutoSizer>
                                        {({ height, width }: { height: number, width: number }) => (
                                            <List
                                                ref={listRef}
                                                className="messages-list"
                                                height={height}
                                                width={width}
                                                itemCount={messages.length}
                                                itemSize={80} // 预估每条消息高度
                                                overscanCount={5}
                                                onScroll={handleScrollChange}
                                            >
                                                {renderMessageItem}
                                            </List>
                                        )}
                                    </AutoSizer>
                                </div>
                            )}
                            
                            {!autoScroll && messages.length > 0 && (
                                <button 
                                    className="btn btn-circle btn-sm btn-primary absolute bottom-4 right-4"
                                    onClick={() => {
                                        setAutoScroll(true);
                                        listRef.current?.scrollToItem(messages.length - 1);
                                    }}
                                >
                                    ↓
                                </button>
                            )}
                        </div>
                    </Panel>

                    <PanelResizeHandle className="h-0.5 bg-base-300 hover:bg-primary/50 transition-colors cursor-row-resize">
                        <div className="h-1 w-full" />
                    </PanelResizeHandle>

                    {/* 发送器部分 */}
                    <Panel defaultSize={30} minSize={15}>
                        <MessageSender 
                            channelType={selectedChannel.channeltype}
                            onSendMessage={(message, isHex, topic) => {
                                // 实现发送消息逻辑
                                console.log('发送消息:', message, isHex, topic);
                                // 这里可以调用ChannelService的发送方法
                            }}
                            selectedClient={selectedClient}
                            disabled={selectedChannel.state !== 'connected' || 
                                (selectedChannel.channeltype === 'tcpserver' && !selectedClient)}
                        />
                    </Panel>
                </PanelGroup>
            </div>
        </div>
    );
};

export default React.memo(ChannelContent); 