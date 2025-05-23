import React, { useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Channel, MessageFormat } from '../../../types/channel';
import { useAppSelector } from '../../../store/hooks';
import { selectChannelMessages } from '../../../store/slices/channelSlice';
import { ChannelService } from '../../../services/channelService';
import { toast } from '../../../context/ToastProvider';
import ChannelHeader from '../ChannelHeader';
import { Plus, X } from 'lucide-react';
import MqttMessageList from './mqtt/MqttMessageList';
import MqttMessageSender from './mqtt/MqttMessageSender';
import SubscriptionDialog from './mqtt/SubscriptionDialog';

interface MqttContentProps {
    channel: Channel;
    onClearMessages: (channelId: string) => void;
}

interface TopicSubscription {
    topic: string;
    qos: number;
    alias?: string;
    color?: string;
}

const MqttContent: React.FC<MqttContentProps> = ({
    channel,
    onClearMessages
}) => {
    const rootState = useAppSelector(state => state);
    const messages = selectChannelMessages(rootState, channel.channelId);
    const [subscriptions, setSubscriptions] = useState<TopicSubscription[]>([]);
    const [showSubscriptionDialog, setShowSubscriptionDialog] = useState(false);

    const handleSubscribe = async (topic: string, qos: number, alias?: string, color?: string) => {
        try {
            await ChannelService.subscribeMqttTopic(channel.channelId, topic, qos);
            setSubscriptions([...subscriptions, { topic, qos, alias, color }]);
            toast.success(`成功订阅主题: ${topic}`, 'end', 'bottom', 2000);
        } catch (error) {
            toast.error(
                `订阅失败: ${error instanceof Error ? error.message : String(error)}`,
                'end',
                'bottom',
                3000
            );
        }
    };

    const handleUnsubscribe = async (topic: string) => {
        try {
            await ChannelService.unsubscribeMqttTopic(channel.channelId, topic);
            setSubscriptions(subscriptions.filter(sub => sub.topic !== topic));
            toast.success(`成功取消订阅主题: ${topic}`, 'end', 'bottom', 2000);
        } catch (error) {
            toast.error(
                `取消订阅失败: ${error instanceof Error ? error.message : String(error)}`,
                'end',
                'bottom',
                3000
            );
        }
    };

    const handleSendMessage = async (message: string, format: MessageFormat, topic: string, qos: number, retain: boolean) => {
        try {
            await ChannelService.sendMqttMessage(channel.channelId, topic, message, qos, retain);
            toast.success(
                `成功发布${format}格式消息到主题: ${topic}`,
                'end',
                'bottom',
                2000
            );
        } catch (error) {
            toast.error(
                `发布失败: ${error instanceof Error ? error.message : String(error)}`,
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
                    {/* 订阅列表面板 */}
                    <Panel defaultSize={20} minSize={15}>
                        <div className="h-full p-3 overflow-y-auto border-r border-base-300 bg-base-200/20">
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-medium">主题订阅</h3>
                                    <button
                                        onClick={() => setShowSubscriptionDialog(true)}
                                        className="btn btn-sm btn-primary"
                                        disabled={channel.state !== 'connected'}
                                    >
                                        <Plus size={16} />
                                        订阅
                                    </button>
                                </div>

                                {/* 订阅列表 */}
                                <div className="space-y-2">
                                    {subscriptions.map((sub) => (
                                        <div
                                            key={sub.topic}
                                            className="flex items-center justify-between p-2 bg-base-100 rounded"
                                            style={{ borderLeft: `4px solid ${sub.color || '#b5a2a6'}` }}
                                        >
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium truncate">
                                                    {sub.alias || sub.topic}
                                                </span>
                                                <span className="text-xs text-base-content/60">
                                                    {sub.alias && (
                                                        <span className="block truncate">{sub.topic}</span>
                                                    )}
                                                    QoS {sub.qos}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => handleUnsubscribe(sub.topic)}
                                                className="btn btn-ghost btn-xs"
                                                title="取消订阅"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </Panel>

                    <PanelResizeHandle className="w-0.5 bg-base-300 hover:bg-primary/50 transition-colors cursor-col-resize group relative">
                        <div className="absolute inset-y-0 -left-1 -right-1 group-hover:bg-transparent" />
                    </PanelResizeHandle>

                    {/* 消息面板 */}
                    <Panel defaultSize={80} minSize={30}>
                        <PanelGroup direction="vertical">
                            <Panel defaultSize={80} minSize={30}>
                                <MqttMessageList
                                    messages={messages}
                                    className="h-full"
                                    onClearMessages={() => onClearMessages(channel.channelId)}
                                    subscriptions={subscriptions}
                                />
                            </Panel>

                            <PanelResizeHandle className="h-0.5 bg-base-300 hover:bg-primary/50 transition-colors cursor-row-resize group relative">
                                <div className="absolute inset-x-0 -top-1 -bottom-1 group-hover:bg-transparent" />
                            </PanelResizeHandle>

                            <Panel defaultSize={20} minSize={15}>
                                <MqttMessageSender
                                    onSendMessage={handleSendMessage}
                                    disabled={channel.state !== 'connected'}
                                />
                            </Panel>
                        </PanelGroup>
                    </Panel>
                </PanelGroup>
            </div>

            <SubscriptionDialog
                open={showSubscriptionDialog}
                onClose={() => setShowSubscriptionDialog(false)}
                onSubscribe={handleSubscribe}
            />
        </>
    );
};

export default MqttContent;