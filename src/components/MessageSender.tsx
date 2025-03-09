import React, { useState, useEffect, useRef } from 'react';
import { Send, Clock, Play, Pause, AlertCircle, X } from 'lucide-react';
import { ChannelType } from '../types/channel';
import { ChannelService } from '../services/channelService';

interface MessageSenderProps {
  channelType: ChannelType;
  onSendMessage: (message: string, isHex: boolean) => void;
  disabled?: boolean;
}

const MessageSender: React.FC<MessageSenderProps> = ({
  channelType,
  onSendMessage,
  disabled = false
}) => {
  const [message, setMessage] = useState('');
  const [isHex, setIsHex] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTimerSettings, setShowTimerSettings] = useState(false);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [intervalTime, setIntervalTime] = useState(1000);

  // 组件加载时检查定时发送状态
  useEffect(() => {
    async function checkTimerStatus() {
      try {
        const status = await ChannelService.getTimerStatus(channelType);
        if (status) {
          // 如果存在定时任务，更新状态
          const [interval, messageBytes] = status;
          setIntervalTime(interval);
          setIsTimerActive(true);
          
          // 尝试将字节数组转换回消息
          try {
            // 尝试检测是否为文本
            let isText = true;
            for (const byte of messageBytes) {
              if (byte > 127 || (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13)) {
                isText = false;
                break;
              }
            }
            
            if (isText) {
              // 转换为文本
              const textDecoder = new TextDecoder();
              const text = textDecoder.decode(new Uint8Array(messageBytes));
              setMessage(text);
              setIsHex(false);
            } else {
              // 转换为十六进制
              const hexArray = messageBytes.map(byte => byte.toString(16).padStart(2, '0'));
              setMessage(hexArray.join(' '));
              setIsHex(true);
            }
          } catch (e) {
            console.error('无法解析定时消息内容', e);
          }
        }
      } catch (error) {
        console.error('获取定时发送状态失败', error);
      }
    }
    
    if (channelType) {
      checkTimerStatus();
    }
    
    // 组件卸载时清理
    return () => {
      // 不需要停止定时发送，因为它现在在后端运行
    };
  }, [channelType]);

  // 切换定时设置显示
  const toggleTimerSettings = () => {
    if (isTimerActive) {
      stopTimer();
    } else {
      setShowTimerSettings(!showTimerSettings);
    }
  };

  // 开始定时发送
  const startTimer = async () => {
    if (message.trim() === '') return;
    
    try {
      // 使用后端的定时发送功能
      await ChannelService.startTimerSend(
        channelType,
        message,
        intervalTime,
        isHex
      );
      
      setIsTimerActive(true);
      setShowTimerSettings(false);
    } catch (error) {
      console.error('启动定时发送失败', error);
      setError('启动定时发送失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  // 停止定时发送
  const stopTimer = async () => {
    try {
      await ChannelService.stopTimerSend(channelType);
      setIsTimerActive(false);
    } catch (error) {
      console.error('停止定时发送失败', error);
      setError('停止定时发送失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  // 处理十六进制输入
  const handleHexInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessage(value);
    
    // 验证十六进制格式
    if (value.trim() !== '') {
      const hexPattern = /^([0-9A-Fa-f]{2}\s)*([0-9A-Fa-f]{2})?$/;
      if (!hexPattern.test(value)) {
        setError('无效的十六进制格式，请使用空格分隔的两位十六进制数字 (例如: 48 65 6C 6C 6F)');
      } else {
        setError(null);
      }
    } else {
      setError(null);
    }
  };

  // 发送消息
  const handleSend = () => {
    if (message.trim() === '') return;
    
    // 验证十六进制格式
    if (isHex) {
      const hexPattern = /^([0-9A-Fa-f]{2}\s)*([0-9A-Fa-f]{2})?$/;
      if (!hexPattern.test(message)) {
        setError('无效的十六进制格式，请使用空格分隔的两位十六进制数字 (例如: 48 65 6C 6C 6F)');
        return;
      }
    }
    
    setError(null);
    onSendMessage(message, isHex);
  };

  return (
    <div className="flex flex-col w-full h-full">
      {/* 消息输入区域 */}
      <div className="flex flex-col gap-2 p-2 border border-base-300 rounded-md bg-base-200/30 h-full">
        {/* 顶部工具栏：格式选择、定时发送和错误提示 */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            {/* 格式选择和定时发送区域 */}
            <div className="flex items-center gap-2">
              {/* 格式选择 */}
              <div className="join">
                <button
                  className={`join-item btn btn-sm ${!isHex ? 'btn-active' : ''}`}
                  onClick={() => setIsHex(false)}
                >
                  ASCII
                </button>
                <button
                  className={`join-item btn btn-sm ${isHex ? 'btn-active' : ''}`}
                  onClick={() => setIsHex(true)}
                >
                  HEX
                </button>
              </div>
              
              {/* 定时发送区域 - 水平布局 */}
              <div className="flex items-center">
                {/* 定时发送按钮 */}
                <button
                  className={`btn btn-sm ${isTimerActive ? 'btn-error' : showTimerSettings ? 'btn-accent' : 'btn-outline'}`}
                  onClick={toggleTimerSettings}
                  disabled={disabled}
                  title={isTimerActive ? "停止定时发送" : "定时发送设置"}
                >
                  {isTimerActive ? <Pause size={16} /> : <Clock size={16} />}
                  {isTimerActive && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-success"></span>
                    </span>
                  )}
                </button>
                
                {/* 定时设置控件 - 直接显示在按钮右侧 */}
                {showTimerSettings && !isTimerActive && (
                  <div className="flex items-center gap-1 ml-1 animate-fadeIn">
                    <input
                      type="number"
                      className="input input-bordered input-sm w-20 text-xs"
                      value={intervalTime}
                      onChange={(e) => setIntervalTime(Math.max(100, parseInt(e.target.value) || 1000))}
                      min="100"
                      disabled={disabled}
                      title="发送间隔 (毫秒)"
                    />
                    <button
                      className="btn btn-xs btn-success"
                      onClick={startTimer}
                      disabled={disabled || message.trim() === ''}
                      title="开始定时发送"
                    >
                      <Play size={14} />
                    </button>
                  </div>
                )}
              </div>
              
              {/* 定时发送状态指示 */}
              {isTimerActive && (
                <span className="text-xs text-success flex items-center">
                  <span className="inline-block w-1.5 h-1.5 bg-success rounded-full mr-1"></span>
                  每 {intervalTime}ms 发送
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {error && (
              <div className="flex items-center text-error text-xs mr-2">
                <AlertCircle size={12} className="mr-1" />
                {error}
              </div>
            )}
            
            {/* 发送按钮 - 放在顶部工具栏右侧 */}
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSend}
              disabled={disabled || message.trim() === ''}
            >
              <Send size={16} />
              <span>发送</span>
            </button>
          </div>
        </div>

        {/* 消息输入框 - 使用 flex-1 确保它占据剩余空间 */}
        <div className="flex flex-col flex-1">
          <textarea
            className="textarea textarea-bordered font-mono text-sm resize-none flex-1"
            placeholder={isHex ? "输入十六进制数据 (例如: 48 65 6C 6C 6F)" : "输入要发送的消息..."}
            value={message}
            onChange={isHex ? handleHexInput : (e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
};

export default MessageSender;
