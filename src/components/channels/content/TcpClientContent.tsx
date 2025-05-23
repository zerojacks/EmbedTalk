import React from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Channel } from '../../../types/channel';
import MessageList from '../MessageList';
import MessageSender from '../MessageSender';
import { useAppSelector } from '../../../store/hooks';
import { selectChannelMessages } from '../../../store/slices/channelSlice';
import { ChannelService } from '../../../services/channelService';
import { toast } from '../../../context/ToastProvider';
import ChannelHeader from '../ChannelHeader';

interface TcpClientContentProps {
    channel: Channel;
    onClearMessages: (channelId: string) => void;
}

const TcpClientContent: React.FC<TcpClientContentProps> = ({
    channel,
    onClearMessages
}) => {
    const rootState = useAppSelector(state => state);
    const messages = selectChannelMessages(rootState, channel.channelId);

    const handleSendMessage = async (message: string, isHex: boolean) => {
        try {
            await ChannelService.sendMessage(channel.channelId, message, isHex);
            toast.success(
                `成功发送${isHex ? "十六进制" : "ASCII"}消息`,
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
    };

    return (
        <>
            <ChannelHeader channel={channel} />
            
            <div className="flex-1 overflow-hidden">
                <PanelGroup direction="vertical">
                    <Panel defaultSize={80} minSize={30}>
                        <MessageList
                            messages={messages}
                            className="h-full"
                            onClearMessages={() => onClearMessages(channel.channelId)}
                        />
                    </Panel>

                    <PanelResizeHandle className="h-0.5 bg-base-300 hover:bg-primary/50 transition-colors cursor-row-resize group relative">
                        <div className="absolute inset-x-0 -top-1 -bottom-1 group-hover:bg-transparent" />
                    </PanelResizeHandle>

                    <Panel defaultSize={20} minSize={15}>
                        <MessageSender
                            channelType={channel.channeltype}
                            onSendMessage={handleSendMessage}
                            disabled={channel.state !== 'connected'}
                        />
                    </Panel>
                </PanelGroup>
            </div>
        </>
    );
};

export default TcpClientContent; 