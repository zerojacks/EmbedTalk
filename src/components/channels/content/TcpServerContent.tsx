import React, { useMemo } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Channel, Client } from '../../../types/channel';
import MessageList from '../MessageList';
import MessageSender from '../MessageSender';
import { useAppSelector } from '../../../store/hooks';
import { selectTcpServerClientMessages } from '../../../store/slices/channelSlice';
import { ChannelService } from '../../../services/channelService';
import { toast } from '../../../context/ToastProvider';
import ChannelHeader from '../ChannelHeader';
import ClientList from '../ClientList';

interface TcpServerContentProps {
    channel: Channel;
    selectedClient: Client | null;
    onClientSelect: (client: Client) => void;
    onClearMessages: (channelId: string) => void;
}

const TcpServerContent: React.FC<TcpServerContentProps> = ({
    channel,
    selectedClient,
    onClientSelect,
    onClearMessages
}) => {
    const rootState = useAppSelector(state => state);
    
    // 获取消息列表
    const messages = React.useMemo(() => {
        if (selectedClient) {
            return selectTcpServerClientMessages(rootState, selectedClient.channelId);
        }
        return [];
    }, [selectedClient, rootState.channel.messageHistory]);

    // 处理消息发送
    const handleSendMessage = async (message: string, isHex: boolean) => {
        try {
            if (!selectedClient) {
                toast.warning("请选择一个客户端进行发送", 'end', 'bottom', 2000);
                return;
            }

            await ChannelService.sendMessage(
                channel.channelId,
                message,
                isHex,
                selectedClient.channelId
            );

            toast.success(
                `成功发送${isHex ? "十六进制" : "ASCII"}消息到客户端 ${selectedClient.name}`,
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
                <PanelGroup direction="horizontal">
                    <Panel defaultSize={20} minSize={15}>
                        <ClientList
                            clients={channel.clients || []}
                            selectedClient={selectedClient}
                            onClientSelect={onClientSelect}
                        />
                    </Panel>

                    <PanelResizeHandle className="w-0.5 bg-base-300 hover:bg-primary/50 transition-colors cursor-col-resize group relative">
                        <div className="absolute inset-y-0 -left-1 -right-1 group-hover:bg-transparent" />
                    </PanelResizeHandle>

                    <Panel defaultSize={80} minSize={30}>
                        <PanelGroup direction="vertical">
                            <Panel defaultSize={80} minSize={30}>
                                <MessageList
                                    messages={messages}
                                    className="h-full"
                                    onClearMessages={() => {
                                        if (selectedClient) {
                                            onClearMessages(selectedClient.channelId);
                                        }
                                    }}
                                />
                            </Panel>

                            <PanelResizeHandle className="h-0.5 bg-base-300 hover:bg-primary/50 transition-colors cursor-row-resize group relative">
                                <div className="absolute inset-x-0 -top-1 -bottom-1 group-hover:bg-transparent" />
                            </PanelResizeHandle>

                            <Panel defaultSize={20} minSize={15}>
                                <MessageSender
                                    channelType={channel.channeltype}
                                    selectedClient={selectedClient}
                                    onSendMessage={handleSendMessage}
                                    disabled={!selectedClient || channel.state !== 'connected'}
                                />
                            </Panel>
                        </PanelGroup>
                    </Panel>
                </PanelGroup>
            </div>
        </>
    );
};

export default TcpServerContent; 