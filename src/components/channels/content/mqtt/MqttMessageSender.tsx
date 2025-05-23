import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { MessageFormat } from '../../../../types/channel';

interface MqttMessageSenderProps {
    onSendMessage: (message: string, format: MessageFormat, topic: string, qos: number, retain: boolean) => void;
    disabled?: boolean;
}

const MqttMessageSender: React.FC<MqttMessageSenderProps> = ({
    onSendMessage,
    disabled = false
}) => {
    const [message, setMessage] = useState('');
    const [topic, setTopic] = useState('');
    const [format, setFormat] = useState<MessageFormat>('raw');
    const [qos, setQos] = useState<number>(0);
    const [retain, setRetain] = useState<boolean>(false);

    const handleSend = () => {
        if (!topic.trim() || !message.trim()) return;

        // 验证消息格式
        try {
            switch (format) {
                case 'json':
                    JSON.parse(message);
                    break;
                case 'base64':
                    if (!message.match(/^[A-Za-z0-9+/]*={0,2}$/)) {
                        throw new Error('无效的 Base64 格式');
                    }
                    break;
                case 'hex':
                    if (!message.match(/^([0-9A-Fa-f]{2}\s)*([0-9A-Fa-f]{2})?$/)) {
                        throw new Error('无效的十六进制格式');
                    }
                    break;
                case 'cbor':
                    // CBOR 格式验证可以在后端处理
                    break;
            }
            onSendMessage(message, format, topic, qos, retain);
            setMessage(''); // 发送后清空消息，但保留主题
        } catch (error) {
            console.error('消息格式验证失败:', error);
            // 这里可以添加错误提示
        }
    };

    return (
        <div className="flex flex-col gap-2 p-2 border border-base-300 rounded-md bg-base-200/30">
            {/* 顶部控制区 */}
            <div className="flex items-center gap-2">
                {/* 主题输入 */}
                <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="发布主题..."
                    className="input input-sm input-bordered flex-1"
                    disabled={disabled}
                />

                {/* QoS 选择 */}
                <select
                    value={qos}
                    onChange={(e) => setQos(Number(e.target.value))}
                    className="select select-sm select-bordered"
                    disabled={disabled}
                >
                    <option value={0}>QoS 0</option>
                    <option value={1}>QoS 1</option>
                    <option value={2}>QoS 2</option>
                </select>

                <input type="checkbox" checked={retain} onChange={(e) => setRetain(e.target.checked)} />

                {/* 格式选择 */}
                <select
                    value={format}
                    onChange={(e) => setFormat(e.target.value as MessageFormat)}
                    className="select select-sm select-bordered"
                    disabled={disabled}
                >
                    <option value="raw">原始文本</option>
                    <option value="json">JSON</option>
                    <option value="base64">Base64</option>
                    <option value="hex">16进制</option>
                    <option value="cbor">CBOR</option>
                </select>

                {/* 发送按钮 */}
                <button
                    className="btn btn-primary btn-sm"
                    onClick={handleSend}
                    disabled={disabled || !topic.trim() || !message.trim()}
                >
                    <Send size={16} />
                    <span>发送</span>
                </button>
            </div>

            {/* 消息输入区 */}
            <textarea
                className="textarea textarea-bordered font-mono text-sm resize-none h-24"
                placeholder={
                    format === 'json' ? '输入 JSON 格式数据...' :
                    format === 'hex' ? '输入十六进制数据 (例如: 48 65 6C 6C 6F)' :
                    format === 'base64' ? '输入 Base64 编码数据...' :
                    format === 'cbor' ? '输入 CBOR 格式数据...' :
                    '输入要发送的消息...'
                }
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                    }
                }}
                disabled={disabled}
            />
        </div>
    );
};

export default MqttMessageSender; 