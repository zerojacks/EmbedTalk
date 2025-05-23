/**
 * 通道类型
 */
export type ChannelType = 'tcpclient' | 'tcpserver' | 'serial' | 'mqtt' | 'bluetooth';

/**
 * 连接状态
 */
export type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'disconnecting' | 'error';

/**
 * 消息方向
 */
export type MessageDirection = 'Sent' | 'Received';

/**
 * 消息格式
 */
export type MessageFormat = 'raw' | 'json' | 'base64' | 'hex' | 'cbor';

/**
 * 消息接口
 */
export interface ChannelMessage {
  id: string;
  channelId: string;
  direction: MessageDirection;
  timestamp: string | number;
  data: string;
  channeltype: ChannelType;
  content: any;
  metadata?: Record<string, string>;
  format: MessageFormat;
}

/**
 * 主题订阅表单数据
 */
export interface TopicFormData {
  topic: string;
  qos: number;
  alias: string;
  color: string;
}

/**
 * 消息统计接口
 */
export interface MessageStats {
  sent: number;
  received: number;
  lastMessageTime?: string | number;
}

/**
 * 基础通道配置接口
 */
export interface BaseChannelConfig {
  type: ChannelType;
  state?: ConnectionState;
  channelId?: string;
  sentCount?: number;
  receivedCount?: number;
}

/**
 * TCP客户端配置
 */
export interface TcpClientConfig extends BaseChannelConfig {
  type: 'tcpclient';
  ip: string;
  port: number;
}

/**
 * TCP服务器客户端
 */
export interface TcpServerClient {
  ip: string;
  port: number;
  state: ConnectionState;
  channelId?: string;
  sentCount?: number;
  receivedCount?: number;
}

/**
 * TCP服务器配置
 */
export interface TcpServerConfig extends BaseChannelConfig {
  type: 'tcpserver';
  ip: string;
  port: number;
  children?: TcpServerClient[];
}

/**
 * 串口配置
 */
export interface SerialConfig extends BaseChannelConfig {
  type: 'serial';
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
  type: 'mqtt';
  ip: string;
  port: number;
  clientid?: string;
  username?: string;
  password?: string;
  qos?: number;
  version?: string;
  topics?: TopicFormData[];
}

/**
 * 蓝牙配置
 */
export interface BluetoothConfig extends BaseChannelConfig {
  type: 'bluetooth';
  bluetoothname: string;
}

export type ChannelConfig = TcpClientConfig | TcpServerConfig | SerialConfig | MqttConfig | BluetoothConfig;

export interface ChannelConfigMap {
    [key: string]: ChannelConfig | undefined;
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

export interface Client {
  ip: string;
  port: number;
  state: ConnectionState;
  channelId: string;
  name: string;
  messages: ChannelMessage[];
  sentCount?: number;
  receivedCount?: number;
}

export interface Channel {
  channelId: string;
  channeltype: ChannelType;
  name: string;
  state: ConnectionState;
  address?: string;
  config?: any;
  messages: ChannelMessage[];
  clients?: Client[];
  sentCount: number;
  receivedCount: number;
  lastActivityTime?: number;
}

/**
 * 连接参数类型
 */
export type ConnectionParams = Omit<Partial<ConnectBridgeInfo[ChannelType]>, 'state'>;
