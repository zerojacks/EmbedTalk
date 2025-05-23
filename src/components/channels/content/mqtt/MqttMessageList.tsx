import React, { useEffect, useRef, useState } from 'react';
import { Trash2, Eye } from 'lucide-react';
import { ChannelMessage, MessageFormat } from '../../../../types/channel';

interface MqttMessageListProps {
    messages: ChannelMessage[];
    onClearMessages: () => void;
    className?: string;
    subscriptions: Array<{
        topic: string;
        qos: number;
        alias?: string;
        color?: string;
    }>;
}

const MqttMessageList: React.FC<MqttMessageListProps> = ({
    messages,
    onClearMessages,
    className = "",
    subscriptions
}) => {
    const [selectedFormat, setSelectedFormat] = useState<MessageFormat>('raw');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const getSubscriptionColor = (topic: string) => {
        const subscription = subscriptions.find(sub => topic.startsWith(sub.topic.replace('#', '')));
        return subscription?.color || '#b5a2a6';
    };

    const getMqttMessage = (content: any, format: MessageFormat) => {
        console.log(JSON.stringify(content));
        
        // Handle the specific case where content contains data as a byte array
        if (content && Array.isArray(content.data)) {
            // Convert byte array to string
            const byteArray = content.data;
            const jsonString = String.fromCharCode(...byteArray);
            
            try {
                // Parse the resulting string as JSON
                const parsedData = JSON.parse(jsonString);
                
                // Create MQTT message structure
                const mqttMessage = {
                    topic: parsedData.topic || '',
                    payload: parsedData.payload || '',
                    qos: parsedData.qos || 0,
                    retain: parsedData.retain || false
                };
                
                // Format the payload according to the specified format
                let formattedPayload = mqttMessage.payload;
                switch (format) {
                    case 'json':
                        formattedPayload = JSON.stringify(formattedPayload, null, 2);
                        break;
                    case 'base64':
                        formattedPayload = btoa(JSON.stringify(formattedPayload));
                        break;
                    case 'hex':
                        formattedPayload = Array.from(JSON.stringify(formattedPayload))
                            .map((char) => char.charCodeAt(0).toString(16).padStart(2, '0'))
                            .join(' ');
                        break;
                    case 'cbor':
                        // For CBOR, we need to stringify the object to make it displayable in React
                        formattedPayload = JSON.stringify(formattedPayload, null, 2);
                        break;
                    default:
                        // For raw format, we also need to stringify to make it displayable
                        formattedPayload = JSON.stringify(formattedPayload, null, 2);
                        break;
                }
                
                return { 
                    topic: mqttMessage.topic, 
                    payload: formattedPayload, 
                    qos: mqttMessage.qos, 
                    retain: mqttMessage.retain 
                };
            } catch (error) {
                console.error('Error parsing data:', error);
                return { topic: content.topic || '', payload: 'Error parsing data', qos: content.qos || 0, retain: false };
            }
        }
        
        // Original implementation for regular object data
        if (typeof content === 'object' && content.data) {
            const mqttMessage = content.data;
            const topic = mqttMessage.topic;
            let payload = mqttMessage.payload;
            const qos = mqttMessage.qos;
            const retain = mqttMessage.retain;
            
            // Ensure payload is a string for all formats
            switch (format) {
                case 'json':
                    payload = typeof payload === 'object' ? JSON.stringify(payload, null, 2) : String(payload);
                    break;
                case 'base64':
                    payload = btoa(typeof payload === 'object' ? JSON.stringify(payload) : String(payload));
                    break;
                case 'hex':
                    payload = Array.from(typeof payload === 'object' ? JSON.stringify(payload) : String(payload))
                        .map((char) => char.charCodeAt(0).toString(16).padStart(2, '0'))
                        .join(' ');
                    break;
                case 'cbor':
                    // Ensure we have a string representation for display
                    payload = typeof payload === 'object' ? JSON.stringify(payload, null, 2) : String(payload);
                    break;
                default:
                    // Ensure we have a string representation for raw format
                    payload = typeof payload === 'object' ? JSON.stringify(payload, null, 2) : String(payload);
                    break;
            }
            return { topic, payload, qos, retain };
        }
        
        // Default case - ensure we return a string payload
        return { 
            topic: '', 
            payload: typeof content === 'object' ? JSON.stringify(content, null, 2) : String(content), 
            qos: 0, 
            retain: false 
        };
    }

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollTop = messagesEndRef.current.scrollHeight;
        }
    }, [messages]);

    const renderContent = (msg: ChannelMessage) => {
        const { topic, payload, qos, retain } = getMqttMessage(msg.content, selectedFormat);
        return (
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${msg.direction === 'Sent' ? 'bg-primary/20 text-primary' : 'bg-secondary/20 text-secondary'
                        }`}>
                        {msg.direction === 'Sent' ? '发送' : '接收'}
                    </span>
                    <span className="text-xs text-base-content/60">
                        {new Date(Number(msg.timestamp)).toLocaleTimeString()}
                    </span>
                    {/* MQTT 特有的主题显示 */}
                    <span className="text-xs bg-base-300 px-1.5 py-0.5 rounded">
                        主题: {topic}
                    </span>
                    {/* QoS 显示 */}
                    {qos !== undefined && (
                        <span className="text-xs bg-base-300 px-1.5 py-0.5 rounded">
                            QoS: {qos}
                        </span>
                    )}
                    {/* 格式显示 */}
                    {msg.format && (
                        <span className="text-xs bg-base-300 px-1.5 py-0.5 rounded">
                            格式: {msg.format}
                        </span>
                    )}
                </div>
                <div className="font-mono text-sm whitespace-pre-wrap break-all">
                    {payload}
                </div>
            </div>
        )
    };

    return (
        <div className={`flex flex-col h-full ${className}`}>
            {/* 头部工具栏 */}
            <div className="flex-none flex justify-between items-center px-3 py-2 border-b border-base-300">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">消息记录</span>
                    <span className="text-xs text-base-content/60">
                        共 {messages.length} 条
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {/* 格式选择 */}
                    <select
                        value={selectedFormat}
                        onChange={(e) => setSelectedFormat(e.target.value as MessageFormat)}
                        className="select select-sm select-bordered"
                    >
                        <option value="raw">原始文本</option>
                        <option value="json">JSON</option>
                        <option value="base64">Base64</option>
                        <option value="hex">16进制</option>
                        <option value="cbor">CBOR</option>
                    </select>
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={onClearMessages}
                        title="清空消息"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>

            {/* 消息列表 */}
            <div 
                ref={messagesEndRef}
                className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-base-300 scrollbar-track-base-200">
                {messages.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-base-content/60">
                        暂无消息
                    </div>
                ) : (
                    <div className="divide-y divide-base-300">
                        {messages.map((msg, index) => (
                            <div
                                key={index}
                                className={`p-3 ${msg.direction === 'Sent' ? 'bg-base-200/30' : ''}`}
                                style={{ borderLeft: `4px solid ${getSubscriptionColor(msg.channelId || '')}` }}
                            >
                                {renderContent(msg)}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MqttMessageList;