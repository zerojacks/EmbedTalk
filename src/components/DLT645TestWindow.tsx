import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from "../context/ToastProvider";
import { TreeTable, Column } from './treeview';
import { Card, CardHeader, CardContent } from './ui/card';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { 
  ChannelType, 
  ConnectionState, 
  TcpClientConfig, 
  SerialConfig, 
  Channel 
} from '../types/channel';
import { ChannelService } from '../services/channelService';

interface Response {
  data: any[];
  error?: string;
}

// DLT645 协议测试页面列定义
const tableheads: Column[] = [
  { name: '帧域', width: 30, minWidth: 100 },
  { name: '数据', width: 30, minWidth: 50 },
  { name: '说明', width: 40, minWidth: 50 },
];

// 常用的 DLT645 功能码
const functionCodes = [
  { value: '01', label: '读数据' },
  { value: '04', label: '写数据' },
  { value: '08', label: '广播校时' },
  { value: '10', label: '冻结命令' },
];

// 常用的 DLT645 数据标识
const dataIdentifiers = [
  { value: '00010000', label: '组合有功总电能' },
  { value: '00020000', label: '正向有功总电能' },
  { value: '00030000', label: '反向有功总电能' },
  { value: '00040000', label: '组合无功总电能' },
  { value: '02010100', label: 'A相电压' },
  { value: '02020100', label: 'B相电压' },
  { value: '02030100', label: 'C相电压' },
  { value: '02060000', label: '电压相角' },
  { value: '02800001', label: '日期及星期' },
  { value: '02800002', label: '时间' },
];

const DLT645TestWindow: React.FC = () => {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('parser');
  const [address, setAddress] = useState('000000000000');
  const [functionCode, setFunctionCode] = useState('01');
  const [dataIdentifier, setDataIdentifier] = useState('00010000');
  const [customData, setCustomData] = useState('');
  const [generatedFrame, setGeneratedFrame] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [response, setResponse] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // 从 Redux store 获取通道状态
  const channelState = useSelector((state: RootState) => state.channel);
  const messageStats = useSelector((state: RootState) => state.channel.messageStats);
  
  // 获取已连接的通道列表
  const connectedChannels = Object.entries(channelState.channels)
    .filter(([_, config]) => config.state === 'connected' && !!config.channelId)
    .map(([channelType, config]): Channel => {
      // 获取通道名称
      let name = '';
      
      switch (channelType as ChannelType) {
        case 'tcpclient':
          const tcpConfig = config as TcpClientConfig;
          if (tcpConfig.ip && tcpConfig.port) {
            name = `TCP客户端: ${tcpConfig.ip}:${tcpConfig.port}`;
          }
          break;
        case 'serial':
          const serialConfig = config as SerialConfig;
          if (serialConfig.comname) {
            name = `串口: ${serialConfig.comname}`;
          }
          break;
        // 可以根据需要添加其他通道类型
      }
      
      // 获取消息统计
      const channelId = config.channelId as string; // 由于前面的过滤，这里可以断言 channelId 不为 undefined
      const stats = messageStats[channelId] || { sent: 0, received: 0 };
      
      // 返回 Channel 对象
      return {
        channelId,
        channeltype: channelType as ChannelType,
        name,
        state: config.state || "disconnected",
        messages: [],
        sentCount: stats.sent,
        receivedCount: stats.received,
        config
      };
    })
    .filter(channel => channel.channelId); // 过滤掉无效的通道

  // 解析 DLT645 报文
  const handleParse = async (message: string) => {
    if (!message.trim()) {
      setResult(null);
      return;
    }
    
    const formattedValue = message
      .replace(/\s+/g, '')
      .replace(/(.{2})/g, '$1 ')
      .trim()
      .toUpperCase();

    try {
      // 调用后端解析 DLT645 报文
      const result = await invoke<Response>('handle_protocol_message', { 
        action: 'parse',
        protocol: "DLT645-2007",
        channelid: selectedChannel?.channelId,
        message: formattedValue
      });
      
      if (result.error) {
        toast.error(`解析失败: ${result.error}`);
        setResult(null);
      } else {
        // 确保结果是数组
        setResult(Array.isArray(result.data) ? result.data : []);
      }
    } catch (error) {
      console.error('Parse error:', error);
      toast.error(`解析失败: ${error}`);
      setResult(null);
    }
  };

  // 生成 DLT645 报文
  const handleGenerateFrame = async () => {
    try {
      // 构建报文参数
      const params = {
        address,
        functionCode,
        dataIdentifier,
        data: customData.replace(/\s+/g, '')
      };

      // 调用后端生成 DLT645 报文
      const result = await invoke<any>('handle_protocol_message', { 
        action: 'build',
        protocol: 'DLT645-2007',
        channelid: selectedChannel?.channelId,
        message: '',
        params
      });
      console.log(result);
      setGeneratedFrame(result.hex);
    } catch (error) {
      console.error('Generate error:', error);
      toast.error(`生成失败: ${error}`);
    }
  };

  // 发送 DLT645 报文
  const handleSendFrame = async () => {
    if (!selectedChannel || !generatedFrame) {
      toast.error("请选择通道并生成报文");
      return;
    }
    
    setIsLoading(true);
    setResponse(null);
    
    try {
      // 发送报文并等待响应
      console.log('Sending frame:', selectedChannel);
      const result = await invoke<any>('handle_protocol_message', { 
        action: 'send',
        protocol: "DLT645-2007",
        channelid: selectedChannel?.channelId,
        message: generatedFrame.replace(/\s+/g, '')
      });
      setResponse(result);

      toast.success("报文发送成功");
    } catch (error) {
      console.error('Send error:', error);
      toast.error(`发送失败: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);
    handleParse(value);
  };

  return (
    <div className="h-full flex flex-col">
      {/* 固定高度的标题部分 */}
      <div className="flex-none">
        <h1 className="text-2xl font-bold mb-4">DLT645 协议测试</h1>
        
        <div className="tabs tabs-boxed mb-4">
          <a 
            className={`tab ${activeTab === 'parser' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('parser')}
          >
            报文解析
          </a>
          <a 
            className={`tab ${activeTab === 'builder' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('builder')}
          >
            报文构建
          </a>
        </div>
      </div>
      
      {/* 可滚动的内容区域 */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* 报文解析标签页 */}
        {activeTab === 'parser' && (
          <div className="space-y-4 pb-4">
            <Card>
              <CardHeader>
                <h2 className="text-xl font-semibold">DLT645 报文解析</h2>
                <p className="text-sm text-gray-500">输入 DLT645 报文进行解析</p>
              </CardHeader>
              <CardContent>
                <textarea
                  value={input}
                  onChange={handleInputChange}
                  placeholder="粘贴要解析的 DLT645 报文..."
                  className="w-full h-32 font-mono textarea textarea-bordered"
                />
              </CardContent>
            </Card>

            {result && (
              <Card>
                <CardHeader>
                  <h2 className="text-xl font-semibold">解析结果</h2>
                </CardHeader>
                <CardContent>
                  <TreeTable 
                    data={result} 
                    tableheads={tableheads}
                    onRowClick={() => {}}
                  />
                </CardContent>
              </Card>
            )}
          </div>
        )}
        
        {/* 报文构建标签页 */}
        {activeTab === 'builder' && (
          <div className="space-y-4 pb-4">
            <Card>
              <CardHeader>
                <h2 className="text-xl font-semibold">DLT645 报文构建</h2>
                <p className="text-sm text-gray-500">构建 DLT645 报文并发送</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">表地址</span>
                    </label>
                    <input 
                      type="text"
                      value={address} 
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="12 字节表地址"
                      className="input input-bordered font-mono"
                    />
                  </div>
                  
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">功能码</span>
                    </label>
                    <select 
                      className="select select-bordered w-full" 
                      value={functionCode}
                      onChange={(e) => setFunctionCode(e.target.value)}
                    >
                      {functionCodes.map((code) => (
                        <option key={code.value} value={code.value}>
                          {code.label} ({code.value})
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">数据标识</span>
                    </label>
                    <select 
                      className="select select-bordered w-full" 
                      value={dataIdentifier}
                      onChange={(e) => setDataIdentifier(e.target.value)}
                    >
                      {dataIdentifiers.map((di) => (
                        <option key={di.value} value={di.value}>
                          {di.label} ({di.value})
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">数据</span>
                    </label>
                    <input 
                      type="text"
                      value={customData} 
                      onChange={(e) => setCustomData(e.target.value)}
                      placeholder="十六进制数据 (可选)"
                      className="input input-bordered font-mono"
                    />
                  </div>
                </div>
                
                <button 
                  onClick={handleGenerateFrame} 
                  className="btn btn-primary w-full mb-4"
                >
                  生成报文
                </button>
                
                {generatedFrame && (
                  <div className="form-control mb-4">
                    <label className="label">
                      <span className="label-text">生成的报文</span>
                    </label>
                    <textarea
                      value={generatedFrame}
                      readOnly
                      className="textarea textarea-bordered w-full h-20 font-mono"
                    />
                  </div>
                )}
                
                <div className="form-control mb-4">
                  <label className="label">
                    <span className="label-text">选择通道</span>
                  </label>
                  <select 
                    className="select select-bordered w-full" 
                    value={selectedChannel?.channelId || ""}
                    onChange={(e) => {
                      const channel = connectedChannels.find(c => c.channelId === e.target.value);
                      if (channel) {
                        setSelectedChannel(channel);
                      }
                    }}
                  >
                    <option value="" disabled>选择通道</option>
                    {connectedChannels.map((channel) => (
                      <option key={channel.channelId} value={channel.channelId}>
                        {channel.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <button 
                  onClick={handleSendFrame} 
                  disabled={!selectedChannel || !generatedFrame || isLoading}
                  className={`btn w-full ${isLoading ? 'loading' : ''}`}
                >
                  {isLoading ? "发送中..." : "发送报文"}
                </button>
              </CardContent>
            </Card>
            
            {response && (
              <Card>
                <CardHeader>
                  <h2 className="text-xl font-semibold">响应结果</h2>
                </CardHeader>
                <CardContent>
                <TreeTable 
                  data={Array.isArray(response) ? response : [response]} 
                  tableheads={tableheads}
                  onRowClick={() => {}}
                />
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DLT645TestWindow;
