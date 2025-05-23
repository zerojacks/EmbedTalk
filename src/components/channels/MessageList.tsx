import { Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ChannelMessage } from "../../types/channel";
import { FixedSizeList as List } from 'react-window';

interface MessageListProps {
    messages: ChannelMessage[];
    className?: string;
    onClearMessages?: () => void;
}

// Message List Component with auto-scroll
const MessageList: React.FC<MessageListProps> = ({ messages, className = "", onClearMessages }) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<List>(null);
    const [displayFormat, setDisplayFormat] = useState<'ascii' | 'hex'>('ascii');
    const [listHeight, setListHeight] = useState(500);
    const containerRef = useRef<HTMLDivElement>(null);
    const [localMessages, setLocalMessages] = useState<ChannelMessage[]>(messages);

    // 当外部消息变化时更新本地消息，只保留最新的10000条
    useEffect(() => {
        const latestMessages = messages.length > 1000 ? messages.slice(-1000) : messages;
        setLocalMessages(latestMessages);
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
                        {formatTimestamp(msg.timestamp)}
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

export default MessageList;
