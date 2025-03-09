/**
 * 通道类型
 */
export type ChannelType = 'tcpclient' | 'tcpserver' | 'serial' | 'mqtt' | 'bluetooth';

/**
 * 连接状态
 */
export type ConnectionState = 
  | 'connected' 
  | 'connecting' 
  | 'disconnected' 
  | 'disconnecting' 
  | 'error';

/**
 * 消息方向
 */
export type MessageDirection = 'Sent' | 'Received';

/**
 * 消息接口
 */
export interface ChannelMessage {
  channeltype: ChannelType;
  channelId: string;
  timestamp: string;
  direction: MessageDirection;
  content: any;
  metadata?: Record<string, string>;
}

/**
 * 消息统计接口
 */
export interface MessageStats {
  sent: number;
  received: number;
  lastMessageTime?: string;
}

/**
 * 基础通道配置接口
 */
export interface BaseChannelConfig {
  state: ConnectionState;
}

/**
 * TCP客户端配置
 */
export interface TcpClientConfig extends BaseChannelConfig {
  ip?: string;
  port?: number;
}

/**
 * TCP服务器客户端
 */
export interface TcpServerClient {
  ip: string;
  port: number;
  state: ConnectionState;
}

/**
 * TCP服务器配置
 */
export interface TcpServerConfig extends BaseChannelConfig {
  ip?: string;
  port?: number;
  children?: TcpServerClient[];
}

/**
 * 串口配置
 */
export interface SerialConfig extends BaseChannelConfig {
  comname?: string;
  baurdate?: number;
  parity?: string;
  databit?: number;
  stopbit?: number;
  flowctrl?: number;
}

/**
 * MQTT配置
 */
export interface MqttConfig extends BaseChannelConfig {
  ip?: string;
  port?: number;
  clientid?: string;
  username?: string;
  password?: string;
  qos?: number;
  version?: string;
}

/**
 * 蓝牙配置
 */
export interface BluetoothConfig extends BaseChannelConfig {
  bluetoothname?: string;
  uuid?: string;
  adapter?: string;
}

/**
 * 通道配置映射
 */
export interface ChannelConfigMap {
  tcpclient: TcpClientConfig;
  tcpserver: TcpServerConfig;
  serial: SerialConfig;
  mqtt: MqttConfig;
  bluetooth: BluetoothConfig;
}

/**
 * 连接桥接信息
 */
export interface ConnectBridgeInfo {
  tcpclient?: TcpClientConfig;
  tcpserver?: TcpServerConfig;
  serial?: SerialConfig;
  mqtt?: MqttConfig;
  bluetooth?: BluetoothConfig;
}

/**
 * 连接参数类型
 */
export type ConnectionParams = Omit<Partial<ConnectBridgeInfo[ChannelType]>, 'state'>;
