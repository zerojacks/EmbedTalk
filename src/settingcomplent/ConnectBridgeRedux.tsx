import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import SimpleIPInput from '../components/SimpleIPInput';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { 
  setConnectInfo, 
  connectChannel, 
  disconnectChannel,
  loadChannelConfigs
} from '../store/slices/channelSlice';
import { ChannelType, ConnectionState } from '../types/channel';

// 常量定义
const baudratelist = [4800, 9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600];
const databitlist = [5, 6, 7, 8];
const stopbitlist = [1, 2];
const paritylist = ["None", "Odd", "Even"];
const mqttversionlist = ["3.1", "3.1.1", "5.0"];
const mqttqoslist = [0, 1, 2];

// 获取按钮文本
const getButtonText = (state: ConnectionState | undefined): string => {
  switch (state) {
    case 'disconnected':
      return "连接";
    case 'connected':
      return "断开";
    case 'connecting':
      return "连接中...";
    case 'disconnecting':
      return "断开中...";
    default:
      return "连接";
  }
};

const ConnectBridgeRedux = () => {
  // 使用 Redux hooks
  const dispatch = useAppDispatch();
  const { channels, serviceInitialized } = useAppSelector(state => state.channel);
  
  // 本地状态 - 仅用于串口列表
  const [comList, setComList] = useState<string[]>([]);

  // 初始化时加载配置
  useEffect(() => {
    if (serviceInitialized) {
      dispatch(loadChannelConfigs());
      refreshComList();
    }
  }, [dispatch, serviceInitialized]);

  // 获取串口列表
  const refreshComList = async () => {
    try {
      const ports = await invoke<string[]>("list_serial_ports");
      setComList(ports);
    } catch (error) {
      console.error("Error loading COM ports:", error);
      setComList([]);
    }
  };

  // 处理通道操作
  const handleChannelAction = async (channelType: ChannelType) => {
    const channelConfig = channels[channelType];
    if (!channelConfig) {
      return;
    }

    if (channelConfig.state === 'connected' && channelConfig.channelId) {
      // 断开连接时使用 channelId
      await dispatch(disconnectChannel({ 
        channelType, 
        channelId: channelConfig.channelId,
        params: channelConfig 
      }));
    } else {
      // 连接时保持原有逻辑
      await dispatch(connectChannel({ channelType, params: channelConfig }));
    }
  };

  // 更新通道配置
  const updateChannelConfig = (channelType: ChannelType, updates: Partial<any>) => {
    dispatch(setConnectInfo({
      [channelType]: {
        ...channels[channelType],
        ...updates
      }
    }));
  };

  // 渲染组件
  return (
    <div className="join join-vertical collapse bg-base-200 shadow-md w-full">
      <div role="tablist" className="tabs tabs-lifted">
        {/* TCP客户端 */}
        <input type="radio" name="my_tabs_2" role="tab" className="tab" aria-label="TCP客户端" defaultChecked />
        <div role="tabpanel" className="tab-content bg-base-100 border-base-300 rounded-md p-6">
          <div className="grid grid-cols-[120px_1fr] gap-4 mb-4">
            <div className="text-right flex items-center justify-end">远程地址</div>
            <div>
              <SimpleIPInput
                value={channels.tcpclient?.ip || ""}
                onChange={(value) => updateChannelConfig('tcpclient', { ip: value })}
                disabled={channels.tcpclient?.state !== 'disconnected'}
                className="w-1/3"
              />
            </div>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-4 mb-4">
            <div className="text-right flex items-center justify-end">远程端口</div>
            <div>
              <input 
                type="text" 
                className="w-1/3 input input-bordered" 
                disabled={channels.tcpclient?.state !== 'disconnected'} 
                value={channels.tcpclient?.port || ""} 
                onChange={(e) => updateChannelConfig('tcpclient', { port: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-4">
            <div></div>
            <button 
              className="btn btn-accent w-1/3" 
              onClick={() => handleChannelAction('tcpclient')}
            >
              {(channels.tcpclient?.state === 'connecting' || channels.tcpclient?.state === 'disconnecting') && 
                <span className="text-sm loading loading-spinner"></span>
              }
              {getButtonText(channels.tcpclient?.state)}
            </button>
          </div>
        </div>

        {/* TCP服务器 */}
        <input type="radio" name="my_tabs_2" role="tab" className="tab" aria-label="TCP服务器" />
        <div role="tabpanel" className="tab-content bg-base-100 border-base-300 rounded-md p-6">
          <div className="grid grid-cols-[120px_1fr] gap-4 mb-4">
            <div className="text-right flex items-center justify-end">本地地址</div>
            <div>
              <SimpleIPInput
                value={channels.tcpserver?.ip || ""}
                onChange={(value) => updateChannelConfig('tcpserver', { ip: value })}
                disabled={channels.tcpserver?.state !== 'disconnected'}
                className="w-1/3"
              />
            </div>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-4 mb-4">
            <div className="text-right flex items-center justify-end">本地端口</div>
            <div>
              <input 
                type="text" 
                className="w-1/3 input input-bordered" 
                disabled={channels.tcpserver?.state !== 'disconnected'} 
                value={channels.tcpserver?.port || ""} 
                onChange={(e) => updateChannelConfig('tcpserver', { port: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-4">
            <div></div>
            <button 
              className="btn btn-accent w-1/3" 
              onClick={() => handleChannelAction('tcpserver')}
            >
              {(channels.tcpserver?.state === 'connecting' || channels.tcpserver?.state === 'disconnecting') && 
                <span className="text-sm loading loading-spinner"></span>
              }
              {getButtonText(channels.tcpserver?.state)}
            </button>
          </div>
        </div>

        {/* 串口 */}
        <input type="radio" name="my_tabs_2" role="tab" className="tab" aria-label="串口" />
        <div role="tabpanel" className="tab-content bg-base-100 border-base-300 rounded-md p-6">
          <div className="grid grid-cols-[120px_1fr] gap-4 mb-4">
            <div className="text-right flex items-center justify-end">串口号</div>
            <div className="flex gap-2">
              <select
                className="w-1/3 input input-bordered"
                disabled={channels.serial?.state !== 'disconnected'}
                value={channels.serial?.comname || ""}
                onChange={(e) => updateChannelConfig('serial', { comname: e.target.value })}
              >
                <option value="">请选择串口</option>
                {comList.map((port) => (
                  <option key={port} value={port}>{port}</option>
                ))}
              </select>
              <button 
                className="btn btn-square btn-sm"
                onClick={refreshComList}
                disabled={channels.serial?.state !== 'disconnected'}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
              </button>
            </div>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-4 mb-4">
            <div className="text-right flex items-center justify-end">波特率</div>
            <div>
              <select
                className="w-1/3 input input-bordered"
                disabled={channels.serial?.state !== 'disconnected'}
                value={channels.serial?.baurdate || 115200}
                onChange={(e) => updateChannelConfig('serial', { baudrate: parseInt(e.target.value) })}
              >
                {baudratelist.map((rate) => (
                  <option key={rate} value={rate}>{rate}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-4 mb-4">
            <div className="text-right flex items-center justify-end">数据位</div>
            <div>
              <select
                className="w-1/3 input input-bordered"
                disabled={channels.serial?.state !== 'disconnected'}
                value={channels.serial?.databit || 8}
                onChange={(e) => updateChannelConfig('serial', { databit: parseInt(e.target.value) })}
              >
                {databitlist.map((bit) => (
                  <option key={bit} value={bit}>{bit}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-4 mb-4">
            <div className="text-right flex items-center justify-end">停止位</div>
            <div>
              <select
                className="w-1/3 input input-bordered"
                disabled={channels.serial?.state !== 'disconnected'}
                value={channels.serial?.stopbit || 1}
                onChange={(e) => updateChannelConfig('serial', { stopbit: parseInt(e.target.value) })}
              >
                {stopbitlist.map((bit) => (
                  <option key={bit} value={bit}>{bit}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-4 mb-4">
            <div className="text-right flex items-center justify-end">校验位</div>
            <div>
              <select
                className="w-1/3 input input-bordered"
                disabled={channels.serial?.state !== 'disconnected'}
                value={channels.serial?.parity || "None"}
                onChange={(e) => updateChannelConfig('serial', { parity: e.target.value })}
              >
                {paritylist.map((parity) => (
                  <option key={parity} value={parity}>{parity}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-4">
            <div></div>
            <button 
              className="btn btn-accent w-1/3" 
              onClick={() => handleChannelAction('serial')}
            >
              {(channels.serial?.state === 'connecting' || channels.serial?.state === 'disconnecting') && 
                <span className="text-sm loading loading-spinner"></span>
              }
              {getButtonText(channels.serial?.state)}
            </button>
          </div>
        </div>

        {/* MQTT */}
        <input type="radio" name="my_tabs_2" role="tab" className="tab" aria-label="MQTT" />
        <div role="tabpanel" className="tab-content bg-base-100 border-base-300 rounded-md p-6">
          <div className="grid grid-cols-[120px_1fr] gap-4 mb-4">
            <div className="text-right flex items-center justify-end">服务器地址</div>
            <div>
              <SimpleIPInput
                value={channels.mqtt?.ip || ""}
                onChange={(value) => updateChannelConfig('mqtt', { ip: value })}
                disabled={channels.mqtt?.state !== 'disconnected'}
                className="w-1/3"
              />
            </div>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-4 mb-4">
            <div className="text-right flex items-center justify-end">服务器端口</div>
            <div>
              <input 
                type="text" 
                className="w-1/3 input input-bordered" 
                disabled={channels.mqtt?.state !== 'disconnected'} 
                value={channels.mqtt?.port || ""} 
                onChange={(e) => updateChannelConfig('mqtt', { port: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-4 mb-4">
            <div className="text-right flex items-center justify-end">客户端ID</div>
            <div>
              <input 
                type="text" 
                className="w-1/3 input input-bordered" 
                disabled={channels.mqtt?.state !== 'disconnected'} 
                value={channels.mqtt?.clientid || ""} 
                onChange={(e) => updateChannelConfig('mqtt', { clientid: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-4 mb-4">
            <div className="text-right flex items-center justify-end">用户名</div>
            <div>
              <input 
                type="text" 
                className="w-1/3 input input-bordered" 
                disabled={channels.mqtt?.state !== 'disconnected'} 
                value={channels.mqtt?.username || ""} 
                onChange={(e) => updateChannelConfig('mqtt', { username: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-4 mb-4">
            <div className="text-right flex items-center justify-end">密码</div>
            <div>
              <input 
                type="password" 
                className="w-1/3 input input-bordered" 
                disabled={channels.mqtt?.state !== 'disconnected'} 
                value={channels.mqtt?.password || ""} 
                onChange={(e) => updateChannelConfig('mqtt', { password: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-4 mb-4">
            <div className="text-right flex items-center justify-end">MQTT版本</div>
            <div>
              <select
                className="w-1/3 input input-bordered"
                disabled={channels.mqtt?.state !== 'disconnected'}
                value={channels.mqtt?.version || "3.1.1"}
                onChange={(e) => updateChannelConfig('mqtt', { version: e.target.value })}
              >
                {mqttversionlist.map((version) => (
                  <option key={version} value={version}>{version}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-4 mb-4">
            <div className="text-right flex items-center justify-end">QoS</div>
            <div>
              <select
                className="w-1/3 input input-bordered"
                disabled={channels.mqtt?.state !== 'disconnected'}
                value={channels.mqtt?.qos || 0}
                onChange={(e) => updateChannelConfig('mqtt', { qos: parseInt(e.target.value) })}
              >
                {mqttqoslist.map((qos) => (
                  <option key={qos} value={qos}>{qos}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-4">
            <div></div>
            <button 
              className="btn btn-accent w-1/3" 
              onClick={() => handleChannelAction('mqtt')}
            >
              {(channels.mqtt?.state === 'connecting' || channels.mqtt?.state === 'disconnecting') && 
                <span className="text-sm loading loading-spinner"></span>
              }
              {getButtonText(channels.mqtt?.state)}
            </button>
          </div>
        </div>

        {/* 蓝牙 */}
        <input type="radio" name="my_tabs_2" role="tab" className="tab" aria-label="蓝牙" />
        <div role="tabpanel" className="tab-content bg-base-100 border-base-300 rounded-md p-6">
          <div className="grid grid-cols-[120px_1fr] gap-4 mb-4">
            <div className="text-right flex items-center justify-end">蓝牙名称</div>
            <div>
              <input 
                type="text" 
                className="w-1/3 input input-bordered" 
                disabled={channels.bluetooth?.state !== 'disconnected'} 
                value={channels.bluetooth?.bluetoothname || ""} 
                onChange={(e) => updateChannelConfig('bluetooth', { bluetoothname: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-[120px_1fr] gap-4">
            <div></div>
            <button 
              className="btn btn-accent w-1/3" 
              onClick={() => handleChannelAction('bluetooth')}
            >
              {(channels.bluetooth?.state === 'connecting' || channels.bluetooth?.state === 'disconnecting') && 
                <span className="text-sm loading loading-spinner"></span>
              }
              {getButtonText(channels.bluetooth?.state)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConnectBridgeRedux;
