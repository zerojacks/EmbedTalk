import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useConnectStore, ConnectBridgeInfo, connectionState } from '../stores/useConnectStore';
import IpInput from '../components/IPInput'
import { json } from "stream/consumers";
import { toast } from "../context/ToastProvider";
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { SettingService } from '../services/settingService';

type ChannelType = "tcpclient" | "tcpserver" | "serial" | "mqtt" | "bluetooth";

// 定义蓝牙接口，仅用于类型提示，不与导入的接口冲突
interface BluetoothConfig {
    bluetoothname?: string;
    uuid?: string;
    adapter?: string;
    state?: connectionState;
}

const comlist = ["COM1", "COM2", "COM3"];
const baurdatelist = [9600, 14400, 19200];
const partylist = ["奇校验", "偶校验", "无校验"];
const databitlist = [5, 6, 7, 8];
const stopbitlist = [1, 1.5, 2];

const bluetoothlist = ["BL1", "BL2"];
const uuidlist = ["12345678-09AB-CD0E-FEDC-BA9876543210"];
const mqttversionlist = ["3.1", "3.1.1", "5.0"];
const mqttqoslist = [0, 1, 2];

async function getcommlist() {
    const comlist = await invoke<string[]>("get_com_list");
    console.log(comlist);
    return comlist;
};

const getChannelNmae = (channel: ChannelType) => {
switch (channel) {
        case "tcpclient":
            return "TCP客户端";
        case "tcpserver":
            return "TCP服务端";
        case "serial":
            return "串口";
        case "mqtt":
            return "MQTT";
        case "bluetooth":
            return "蓝牙";
        default:
            return "";
    }
};

const getStateName = (state: connectionState) => {
    switch (state) {
        case "connected":
            return "已连接";
        case "connecting":
            return "正在连接...";
        case "disconnecting":
            return "正在断开...";
        case "disconnected":
            return "已断开";
        default:
            return "";
    }
};
// const comlist: string[] = await getcommlist();

const ConnectBridge = () => {
    const { connectInfo, setConnectInfo } = useConnectStore();
    const [listenevent, setListenevent] = useState<Record<ChannelType, any>>({} as Record<ChannelType, any>);
    // 使用 useRef 来存储所有通道的监听器
    const channelListeners = useRef<Record<ChannelType, UnlistenFn | null>>({
        tcpclient: null,
        tcpserver: null,
        serial: null,
        mqtt: null,
        bluetooth: null
    });

    useEffect(() => {
        async function getConnectInfo() {
            try {
                const connectinfo = await SettingService.getConfig('connectcfg.connectcfg') as ConnectBridgeInfo;
                if (connectinfo) {
                    setDefaultState(connectinfo);
                    setDefaultInfo(connectinfo);
                    setConnectInfo(connectinfo);

                    // 加载配置后立即验证连接状态
                    verifyConnections(connectinfo);
                } else {
                    console.log("Failed to fetch configuration");
                    setDefaultInfo(connectinfo);
                    setConnectInfo(connectinfo);
                }
                console.log(connectinfo);
            } catch (error) {
                console.error("Error fetching connect info:", error);
                let connectinfo = { tcpclient: {}, tcpserver: {}, serial: {}, mqtt: {} } as ConnectBridgeInfo;
                setDefaultInfo(connectinfo);
                setConnectInfo(connectinfo);
            }
        }

        getConnectInfo();
        
        // 组件挂载时验证所有通道的实际连接状态
        async function verifyConnections(currentConnectInfo: ConnectBridgeInfo) {
            if (!currentConnectInfo) return;
            
            // 检查每个可能的通道类型
            const channelTypes: ChannelType[] = ['tcpclient', 'tcpserver', 'serial', 'mqtt', 'bluetooth'];
            
            for (const channelType of channelTypes) {
                // 只检查存在且状态为 connected 的通道
                if (currentConnectInfo[channelType] && currentConnectInfo[channelType]?.state === 'connected') {
                    try {
                        // 调用后端验证连接状态
                        const isConnected = await invoke<boolean>('check_channel_connection', { 
                            channel_type: channelType 
                        });
                        
                        // 如果实际已断开但状态仍为连接，则更新状态
                        if (!isConnected) {
                            // 获取最新状态
                            const latestConnectInfo = useConnectStore.getState().connectInfo;
                            if (!latestConnectInfo) continue;
                            
                            setConnectInfo({
                                ...latestConnectInfo,
                                [channelType]: {
                                    ...latestConnectInfo[channelType],
                                    state: 'disconnected'
                                }
                            });
                            
                            // 同时设置监听器以便接收后续事件
                            setupChannelListener(channelType);
                        }
                    } catch (error) {
                        console.error(`Error verifying ${channelType} connection:`, error);
                        // 连接验证失败，假定已断开
                        // 获取最新状态
                        const latestConnectInfo = useConnectStore.getState().connectInfo;
                        if (!latestConnectInfo) continue;
                        
                        setConnectInfo({
                            ...latestConnectInfo,
                            [channelType]: {
                                ...latestConnectInfo[channelType],
                                state: 'disconnected'
                            }
                        });
                    }
                }
            }
        }
        
        // 如果 connectInfo 已加载，则验证连接状态
        if (connectInfo) {
            verifyConnections(connectInfo);
        }
    }, []);

    const getToastMessage = (channel: ChannelType, payload: any, action: connectionState) => {
        switch (channel) {
            case "tcpclient":
                return `${getChannelNmae(channel)}:${payload.ip}:${payload.port} ${getStateName(action)}`;
            case "tcpserver":
                return `${getChannelNmae(channel)}:${payload.ip}:${payload.port} ${getStateName(action)}`;
            case "serial":
                return `${getChannelNmae(channel)}:${payload.comname} ${getStateName(action)}`;
            case "mqtt":
                return `${getChannelNmae(channel)}: ${payload.ip}:${payload.port} ${getStateName(action)}`;
            case "bluetooth":
                return `${getChannelNmae(channel)}:${payload.bluetoothname} ${getStateName(action)}`;
            default:
                return "断开连接";
        }
    };

    // 设置监听器的函数
    const setupChannelListener = async (channel: ChannelType) => {
        // 如果已经存在监听器，先移除它
        if (channelListeners.current[channel]) {
            await channelListeners.current[channel]!();
        }

        // 设置新的监听器
        const unlistenFn = await listen('channel-state', (event) => {
            const payload = JSON.parse(event.payload as string);
            if (payload.channel !== channel) return; // 只处理对应通道的事件
            const toast_message = getToastMessage(channel, payload, 'disconnected');
            console.log(payload);
            console.log(toast_message);
            toast.warning(toast_message, 'end', 'bottom', 3000);
            cleanupChannelListener(channel);

            // 根据不同的通道类型更新状态
            switch (channel) {
                case "tcpclient":
                    if (connectInfo) {
                        setConnectInfo({
                            ...connectInfo,
                            tcpclient: {
                                ...connectInfo.tcpclient,
                                state: 'disconnected'
                            }
                        });
                    }
                    break;
                case "tcpserver":
                    if (connectInfo) {
                        setConnectInfo({
                            ...connectInfo,
                            tcpserver: {
                                ...connectInfo.tcpserver,
                                state: 'disconnected'
                            }
                        });
                    }
                    break;
                case "serial":
                    if (connectInfo) {
                        setConnectInfo({
                            ...connectInfo,
                            serial: {
                                ...connectInfo.serial,
                                state: 'disconnected'
                            }
                        });
                    }
                    break;
                case "mqtt":
                    if (connectInfo) {
                        setConnectInfo({
                            ...connectInfo,
                            mqtt: {
                                ...connectInfo.mqtt,
                                state: 'disconnected'
                            }
                        });
                    }
                    break;
                case "bluetooth":
                    if (connectInfo) {
                        setConnectInfo({
                            ...connectInfo,
                            bluetooth: {
                                ...connectInfo.bluetooth,
                                state: 'disconnected'
                            }
                        });
                    }
                    break;
                default:
                    break;
            }
        });

        channelListeners.current[channel] = unlistenFn;        
        // 清理监听器的函数
    };
    const cleanupChannelListener = async (channel: ChannelType) => {
        console.log(`Cleaning up listener for ${channel}`);
        if (channelListeners.current[channel] && typeof channelListeners.current[channel] === 'function') {
            console.log(`exec Cleaning up listener for ${channel}`);
            try {
                await channelListeners.current[channel]!();
            } catch (error) {
                console.error(`清理${channel}监听器失败:`, error);
            }
            channelListeners.current[channel] = null;
        }
    };

    useEffect(() => {
        if (connectInfo?.tcpclient?.state === 'disconnected') {
            cleanupChannelListener('tcpclient');
            console.log("tcp cleaned up tcpclient");
        }
        
    },[connectInfo])

    // 组件卸载时清理所有监听器
    useEffect(() => {
        return () => {
            Object.keys(channelListeners.current).forEach(async (channel) => {
                await cleanupChannelListener(channel as ChannelType);
            });
        };
    }, []);

    // 修改连接处理函数
    const handleChannelConnection = async (channel: ChannelType, action: 'connect' | 'disconnect') => {
        if (!connectInfo) return;
        
        // 确保通道信息存在
        if (!connectInfo[channel]) {
            console.error(`Channel ${channel} info not found`);
            return;
        }

        try {
            const params = getChannelParams(channel); // 获取对应通道的参数
            const commandName = action === 'connect' ? "connect_channel" : "disconnect_channel";
            let curr_state = action === 'connect' ? 'connecting' : 'disconnecting' as connectionState;
            
            // 更新状态
            setConnectInfo({
                ...connectInfo,
                [channel]: {
                    ...connectInfo[channel],
                    state: curr_state
                }
            });
            
            let toast_message = getToastMessage(channel, params, curr_state);
            toast.info(toast_message);
            const result = await invoke(commandName, { channel: channel, values: JSON.stringify(params) });
            if (action === 'connect') {
                setupChannelListener(channel);
            } else {
                await cleanupChannelListener(channel);
            }
            
            // 获取最新的状态，因为在异步操作期间可能已经改变
            const currentConnectInfo = useConnectStore.getState().connectInfo;
            if (!currentConnectInfo) return;
            
            curr_state = curr_state === 'connecting' ? 'connected' : 'disconnected' as connectionState;
            
            setConnectInfo({
                ...currentConnectInfo,
                [channel]: {
                    ...currentConnectInfo[channel],
                    state: curr_state
                }
            });
            
            toast_message = getToastMessage(channel, params, curr_state);
            toast.success(toast_message);
            
            // 同步更新配置文件
            await invoke("set_config_value_async", {
                section: "connectcfg",
                key: "",
                value: JSON.stringify(useConnectStore.getState().connectInfo)
            });
        } catch (error) {
            console.error(`Error ${action === 'connect' ? 'connecting to' : 'disconnecting from'} ${channel}:`, error);
            const err_type = (action === 'connect' ? "连接" : "断开");
            toast.error(`${getChannelNmae(channel)}${err_type}失败:${error}`, 'end', 'bottom', 3000);

            // 获取最新的状态
            const currentConnectInfo = useConnectStore.getState().connectInfo;
            if (!currentConnectInfo) return;
            
            setConnectInfo({
                ...currentConnectInfo,
                [channel]: {
                    ...currentConnectInfo[channel],
                    state: action === 'connect' ? 'disconnected' : 'connected'
                }
            });
        }
    };

    // 获取通道参数的辅助函数
    const getChannelParams = (channel: ChannelType) => {
        // 确保 connectInfo 不为 null
        if (!connectInfo) {
            console.error("Connection info is null");
            return {};
        }
        
        switch (channel) {
            case "tcpclient":
                return {
                    ip: connectInfo.tcpclient?.ip || "127.0.0.1",
                    port: connectInfo.tcpclient?.port || 8080,
                };
            case "tcpserver":
                return {
                    ip: connectInfo.tcpserver?.ip || "0.0.0.0",
                    port: connectInfo.tcpserver?.port || 8080,
                };
            case "serial":
                return {
                    comname: connectInfo.serial?.comname || "COM1",
                    baurdate: connectInfo.serial?.baurdate || 9600,
                    databit: connectInfo.serial?.databit || 8,
                    flowctrl: connectInfo.serial?.flowctrl || 0,
                    parity: connectInfo.serial?.parity || "无校验",
                    stopbit: connectInfo.serial?.stopbit || 1,
                };
            case "mqtt":
                return {
                    ip: connectInfo.mqtt?.ip || "127.0.0.1",
                    port: connectInfo.mqtt?.port || 1883,
                    username: connectInfo.mqtt?.username || "",
                    password: connectInfo.mqtt?.password || "",
                    clientid: "embedtalk_client",
                    qos: connectInfo.mqtt?.qos || 0,
                    topic: "embedtalk/topic",
                };
            case "bluetooth":
                return {
                    adapter: connectInfo.bluetooth?.adapter || "default",
                    bluetoothname: connectInfo.bluetooth?.bluetoothname || "",
                    uuid: connectInfo.bluetooth?.uuid || "",
                };
            default:
                return {};
        }
    };

    const handleTcpButtonClick = () => {
        console.log("tcp按钮被点击了");
        console.log(connectInfo?.tcpclient);

        if (!connectInfo?.tcpclient) {
            console.log("tcpclient为空");
            return;
        }

        const currentState = connectInfo?.tcpclient?.state === 'disconnected' ? 'connecting':'disconnecting';
        const action = currentState === 'connecting' ? 'connect' : 'disconnect';
        handleChannelConnection('tcpclient', action);

        if (currentState === 'connecting') {
            saveConnectinfo();
        }
    };

    const isValidIP = (ip: string) => {
        const ipPattern = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        return ipPattern.test(ip);
    };

    const isValidPort = (port: number) => {
        return port > 0 && port <= 65535;
    };

    const getCleanSaveInfo = (info: ConnectBridgeInfo) => {
        const result: ConnectBridgeInfo = {};

        if (info.tcpclient) {
            const { state, ...rest } = info.tcpclient;
            result.tcpclient = rest;
        }

        if (info.tcpserver) {
            const { state, children, ...rest } = info.tcpserver;
            result.tcpserver = rest;
        }

        if (info.serial) {
            const { state, ...rest } = info.serial;
            result.serial = rest;
        }

        if (info.mqtt) {
            const { state, ...rest } = info.mqtt;
            result.mqtt = rest;
        }

        if (info.bluetooth) {
            const { state, ...rest } = info.bluetooth;
            result.bluetooth = rest;
        }
        return result;
    }

    const setDefaultInfo = (info: ConnectBridgeInfo) => {
        console.log("set default info", info);
        if (!info.tcpclient) {
            info.tcpclient = {
                ip: "127.0.0.1", // 提供默认值
                port: 8001, // 提供默认值
                state: 'disconnected', // 提供默认值
            }
        }
        if (!info.tcpserver) {
            info.tcpserver = {
                ip: "127.0.0.1", // 提供默认值
                port: 8001, // 提供默认值
                state: 'disconnected', // 提供默认值
            }
        }
        if (!info.serial) {
            info.serial = {
                comname: "", // 提供默认值
                baurdate: 9600, // 提供默认值
                databit: 8, // 提供默认值
                parity: "偶校验", // 提供默认值
                stopbit: 1, // 提供默认值
                state: 'disconnected', // 提供默认值
            }
        }
        if (!info.mqtt) {
            info.mqtt = {
                ip: "127.0.0.1", // 提供默认值
                port: 8003, // 提供默认值
                username: "", // 提供默认值
                password: "", // 提供默认值
                qos: 2, // 提供默认值
                state: 'disconnected', // 提供默认值
            }
        }
        if (!info.bluetooth) {
            info.bluetooth = {
                bluetoothname: "", // 提供默认值
                uuid: "", // 提供默认值
                state: 'disconnected', // 提供默认值
            }
        }
    }
    const setDefaultState = (info: ConnectBridgeInfo) => {
        console.log("set default state", info);
        if (info.tcpclient) {
            info.tcpclient = {
                ...info.tcpclient,
                state: info.tcpclient?.state ? info.tcpclient?.state : 'disconnected', // 提供默认值
            }
        }
        if (info.tcpserver) {
            info.tcpserver = {
                ...info.tcpserver,
                state: info.tcpserver?.state ? info.tcpserver?.state : 'disconnected', // 提供默认值
            }
        }
        if (info.serial) {
            info.serial = {
                ...info.serial,
                state: info.serial?.state ? info.serial?.state : 'disconnected', // 提供默认值
            }
        }
        if (info.mqtt) {
            info.mqtt = {
                ...info.mqtt,
                state: info.mqtt?.state ? info.mqtt?.state : 'disconnected', // 提供默认值
            }
        }
        if (info.bluetooth) {
            info.bluetooth = {
                ...info.bluetooth,
                state: info.bluetooth?.state ? info.bluetooth?.state : 'disconnected', // 提供默认值
            }
        }
    }

    const handletcpclientipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        console.log(e.target.value);
        //ip检查
        setConnectInfo({
            tcpclient: {
                ...connectInfo?.tcpclient,
                ip: e.target.value, // 提供默认值
                port: connectInfo?.tcpclient?.port ?? 8001, // 提供默认值
                state: connectInfo?.tcpclient?.state ?? 'disconnected', // 提供默认值
            }
        })
    };

    const handletcpclientPortChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setConnectInfo({
            tcpclient: {
                ...connectInfo?.tcpclient,
                ip: connectInfo?.tcpclient?.ip ?? "127.0.0.1", // 提供默认值
                port: parseInt(e.target.value), // 提供默认值
                state: connectInfo?.tcpclient?.state ?? 'disconnected', // 提供默认值

            }
        })
    };

    async function saveConnectinfo() {
        try {
            const cleanInfo = getCleanSaveInfo(connectInfo!);
            const result = await invoke("set_config_value_async", {
                section: "connectcfg",
                key: "",
                value: JSON.stringify(cleanInfo)
            });
            console.log(result);
            console.log("Config updated successfully");
        } catch (error) {
            console.error("Error updating config:", error);
        }
    };

    const handletcpServeripChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setConnectInfo({
            tcpserver: {
                ...connectInfo?.tcpserver,
                ip: e.target.value, // 提供默认值
                port: connectInfo?.tcpserver?.port ?? 8001, // 提供默认值
                state: connectInfo?.tcpserver?.state ?? 'disconnected', // 提供默认值
            }
        })
    };

    useEffect(() => {
        console.log("useEffect", connectInfo);
    }, [connectInfo])

    const handletcpServerPortChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setConnectInfo({
            tcpserver: {
                ...connectInfo?.tcpserver,
                ip: connectInfo?.tcpserver?.ip ?? "127.0.0.1", // 提供默认值
                port: parseInt(e.target.value), // 提供默认值
                state: connectInfo?.tcpserver?.state ?? 'disconnected', // 提供默认值

            }
        })
    };

    const handleTcpServerButtonClick = () => {
        console.log("tcpserver按钮被点击了");
        console.log(connectInfo?.tcpserver);

        if (!connectInfo?.tcpserver) {
            toast.error("请先配置连接信息！");
            return;
        }
        if ((connectInfo?.tcpserver.ip) && (!isValidIP(connectInfo?.tcpserver.ip))) {
            toast.error("请输入正确的IP地址！");
            return;
        }
        if ((connectInfo?.tcpserver.port) && (!isValidPort(connectInfo?.tcpserver.port))) {
            toast.error("请输入正确的端口！");
            return;
        }

        const currentState = connectInfo?.tcpserver?.state === 'disconnected' ? 'connecting':'disconnecting';
        const action = currentState === 'connecting' ? 'connect' : 'disconnect';
        
        handleChannelConnection('tcpserver', action);
        if (currentState === 'connecting') {
            saveConnectinfo();
        }
    }

    const handleCommSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setConnectInfo({
            serial: {
                ...connectInfo?.serial,
                comname: e.target.value,
                baurdate: connectInfo?.serial?.baurdate ?? 0, // 提供默认值
                parity: connectInfo?.serial?.parity ?? "偶校验", // 提供默认值
                databit: connectInfo?.serial?.databit ?? 8, // 提供默认值
                stopbit: connectInfo?.serial?.stopbit ?? 1, // 提供默认值
                state: connectInfo?.tcpclient?.state ?? 'disconnected', // 提供默认值
            },
        });
    };

    const handleBaurdateSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        console.log(e.target.value);
        const baurdate = String(e.target.value)
        // 将字符串转换为数字
        const baurdateNum = parseInt(baurdate, 10);

        setConnectInfo({
            serial: {
                ...connectInfo?.serial,
                comname: connectInfo?.serial?.comname ?? "", // 提供默认值
                baurdate: baurdateNum,
                parity: connectInfo?.serial?.parity ?? "偶校验", // 提供默认值
                databit: connectInfo?.serial?.databit ?? 8, // 提供默认值
                stopbit: connectInfo?.serial?.stopbit ?? 1, // 提供默认值
                state: connectInfo?.tcpclient?.state ?? 'disconnected', // 提供默认值
            },
        })
    };

    const handleParitySelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        console.log(e.target.value);
        setConnectInfo({
            serial: {
                ...connectInfo?.serial,
                comname: connectInfo?.serial?.comname ?? "", // 提供默认值
                baurdate: connectInfo?.serial?.baurdate ?? 9600, // 提供默认值
                parity: e.target.value, // 提供默认值
                databit: connectInfo?.serial?.databit ?? 8, // 提供默认值
                stopbit: connectInfo?.serial?.stopbit ?? 1, // 提供默认值
                state: connectInfo?.tcpclient?.state ?? 'disconnected', // 提供默认值
            },
        })
    };
    const handleDatabitSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        console.log(e.target.value);
        setConnectInfo({
            serial: {
                ...connectInfo?.serial,
                comname: connectInfo?.serial?.comname ?? "", // 提供默认值
                baurdate: connectInfo?.serial?.baurdate ?? 9600, // 提供默认值
                parity: connectInfo?.serial?.parity ?? "偶校验", // 提供默认值
                databit: Number(e.target.value), // 提供默认值
                stopbit: connectInfo?.serial?.stopbit ?? 1, // 提供默认值
                state: connectInfo?.tcpclient?.state ?? 'disconnected', // 提供默认值
            },
        })
    };
    const handleStopbitSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        console.log(e.target.value);
        setConnectInfo({
            serial: {
                ...connectInfo?.serial,
                comname: connectInfo?.serial?.comname ?? "", // 提供默认值
                baurdate: connectInfo?.serial?.baurdate ?? 9600, // 提供默认值
                parity: connectInfo?.serial?.parity ?? "偶校验", // 提供默认值
                databit: connectInfo?.serial?.databit ?? 8, // 提供默认值
                stopbit: Number(e.target.value), // 提供默认值
                state: connectInfo?.tcpclient?.state ?? 'disconnected', // 提供默认值
            },
        });
    };

    const handleMqttipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        console.log(e.target.value);
        //ip检查
        const result = isValidIP(e.target.value);
        if (result) {
            setConnectInfo({
                mqtt: {
                    ...connectInfo?.mqtt,
                    ip: connectInfo?.mqtt?.ip ?? "127.0.0.1", // 提供默认值
                    port: parseInt(e.target.value), // 提供默认值
                    state: connectInfo?.mqtt?.state ?? 'disconnected', // 提供默认值
                    username: connectInfo?.mqtt?.username ?? "", // 提供默认值
                    password: connectInfo?.mqtt?.password ?? "", // 提供默认值
                    qos: connectInfo?.mqtt?.qos ?? 2, // 提供默认值
                }
            })
        }
    }

    const handleMqttportChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        console.log(e.target.value);
        //ip检查
        setConnectInfo({
            mqtt: {
                ...connectInfo?.mqtt,
                ip: connectInfo?.mqtt?.ip ?? "127.0.0.1", // 提供默认值
                port: parseInt(e.target.value), // 提供默认值
                state: connectInfo?.mqtt?.state ?? 'disconnected', // 提供默认值
                username: connectInfo?.mqtt?.username ?? "", // 提供默认值
                password: connectInfo?.mqtt?.password ?? "", // 提供默认值
                qos: connectInfo?.mqtt?.qos ?? 2, // 提供默认值
            }
        });
    }

    const handleMqttusernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        console.log(e.target.value);
        setConnectInfo({
            mqtt: {
                ...connectInfo?.mqtt,
                ip: connectInfo?.mqtt?.ip ?? "127.0.0.1", // 提供默认值
                port: connectInfo?.mqtt?.port ?? 1883, // 提供默认值
                state: connectInfo?.mqtt?.state ?? 'disconnected', // 提供默认值
                username: e.target.value, // 提供默认值
                password: connectInfo?.mqtt?.password ?? "", // 提供默认值
                qos: connectInfo?.mqtt?.qos ?? 2, // 提供默认值
            }
        });
    }

    const handleMqttpasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        console.log(e.target.value);
        setConnectInfo({
            mqtt: {
                ...connectInfo?.mqtt,
                ip: connectInfo?.mqtt?.ip ?? "127.0.0.1", // 提供默认值
                port: connectInfo?.mqtt?.port ?? 1883, // 提供默认值
                state: connectInfo?.mqtt?.state ?? 'disconnected', // 提供默认值
                username: connectInfo?.mqtt?.username ?? "", // 提供默认值
                password: e.target.value, // 提供默认值
                qos: connectInfo?.mqtt?.qos ?? 2, // 提供默认值
            }
        });
    }

    const handleMqttqosChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        console.log(e.target.value);
        setConnectInfo({
            mqtt: {
                ...connectInfo?.mqtt,
                ip: connectInfo?.mqtt?.ip ?? "127.0.0.1", // 提供默认值
                port: connectInfo?.mqtt?.port ?? 1883, // 提供默认值
                state: connectInfo?.mqtt?.state ?? 'disconnected', // 提供默认值
                username: connectInfo?.mqtt?.username ?? "", // 提供默认值
                password: connectInfo?.mqtt?.password ?? "", // 提供默认值
                qos: Number(e.target.value), // 提供默认值
            }
        });
    }

    const handleBluetoothSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        console.log(e.target.value);
        setConnectInfo({
            bluetooth: {
                ...connectInfo?.bluetooth,
                bluetoothname: e.target.value, // 提供默认值
                uuid: connectInfo?.bluetooth?.uuid ?? "", // 提供默认值
                state: connectInfo?.tcpclient?.state ?? 'disconnected', // 提供默认值
            },
        })
    };

    const handleUUIDSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        console.log(e.target.value);
        setConnectInfo({
            bluetooth: {
                ...connectInfo?.bluetooth,
                bluetoothname: connectInfo?.bluetooth?.bluetoothname ?? "", // 提供默认值
                uuid: e.target.value, // 提供默认值
                state: connectInfo?.tcpclient?.state ?? 'disconnected', // 提供默认值
            },
        });
    };

    const getButtonText = (state: connectionState | undefined): string => {
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

    return (
        <div className="join join-vertical collapse bg-base-200 shadow-md w-full">
            <div role="tablist" className="tabs tabs-lifted">
                <input type="radio" name="my_tabs_2" role="tab" className="tab" aria-label="TCP客户端" defaultChecked />
                <div role="tabpanel" className="tab-content bg-base-100 border-base-300 rounded-md p-6">
                    <div className="flex items-center gap-2 m-2">远程地址
                        <input type="text" className="w-1/6 input input-bordered flex items-center gap-2" disabled={connectInfo?.tcpclient?.state !== 'disconnected'} value={connectInfo?.tcpclient?.ip} onChange={handletcpclientipChange} />
                    </div>
                    <div className="flex items-center gap-2 m-2">远程端口
                        <input type="text" className="w-1/6 input input-bordered flex items-center gap-2" disabled={connectInfo?.tcpclient?.state !== 'disconnected'} value={connectInfo?.tcpclient?.port} onChange={handletcpclientPortChange} />
                    </div>
                    <button className="btn btn-accent flex ml-20" onClick={handleTcpButtonClick}>
                        {(connectInfo?.tcpclient?.state === 'connecting' || connectInfo?.tcpclient?.state === 'disconnecting') && <span className="text-sm loading loading-spinner"></span>}
                        {getButtonText(connectInfo?.tcpclient?.state)}
                    </button> {/* 按钮靠右对齐 */}
                </div>

                <input type="radio" name="my_tabs_2" role="tab" className="tab" aria-label="TCP服务器" />
                <div role="tabpanel" className="tab-content bg-base-100 border-base-300 rounded-md p-6">
                    <div className="flex items-center gap-2 m-2">本地地址
                        <input type="text" className="w-1/6 input input-bordered flex items-center gap-2" disabled={connectInfo?.tcpserver?.state !== 'disconnected'} value={connectInfo?.tcpserver?.ip} onChange={handletcpServeripChange} />
                    </div>
                    <div className="flex items-center gap-2 m-2">本地端口
                        <input type="text" className="w-1/6 input input-bordered flex items-center gap-2" disabled={connectInfo?.tcpserver?.state !== 'disconnected'} value={connectInfo?.tcpserver?.port} onChange={handletcpServerPortChange} />
                    </div>
                    <button className="btn btn-accent flex ml-20" onClick={handleTcpServerButtonClick}>
                        {(connectInfo?.tcpserver?.state === 'connecting' || connectInfo?.tcpserver?.state === 'disconnecting') && <span className="text-sm loading loading-spinner"></span>}
                        {getButtonText(connectInfo?.tcpserver?.state)}
                    </button> {/* 按钮靠右对齐 */}
                </div>

                <input type="radio" name="my_tabs_2" role="tab" className="tab" aria-label="串口" />
                <div role="tabpanel" className="tab-content bg-base-100 border-base-300 rounded-md p-6">
                    <div className="flex items-center gap-2 m-2">串口号
                        <select
                            className="select mr-3 bg-base-200 select-bordered w-1/6" // 将 select 靠右
                            disabled={connectInfo?.serial?.state !== 'disconnected'}
                            value={connectInfo?.serial?.comname}
                            onChange={handleCommSelectChange}
                        >
                            {comlist.map((serial, index) => (
                                <option key={index} value={serial}>
                                    {serial}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-center gap-2 m-2">波特率
                        <select
                            className="select mr-3 bg-base-200 select-bordered h-1 w-1/6" // 将 select 靠右
                            disabled={connectInfo?.serial?.state !== 'disconnected'}
                            value={connectInfo?.serial?.baurdate}
                            onChange={handleBaurdateSelectChange}
                        >
                            {baurdatelist.map((baurdate, index) => (
                                <option key={index} value={baurdate}>
                                    {baurdate}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-center gap-2 m-2">校验位
                        <select
                            className="select mr-3 bg-base-200 select-bordered h-1 w-1/6" // 将 select 靠右
                            disabled={connectInfo?.serial?.state !== 'disconnected'}
                            value={connectInfo?.serial?.parity}
                            onChange={handleParitySelectChange}
                        >
                            {partylist.map((party, index) => (
                                <option key={index} value={party}>
                                    {party}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-center gap-2 m-2">数据位
                        <select
                            className="select mr-3 bg-base-200 select-bordered h-1 w-1/6" // 将 select 靠右
                            disabled={connectInfo?.serial?.state !== 'disconnected'}
                            value={connectInfo?.serial?.databit}
                            onChange={handleDatabitSelectChange}
                        >
                            {databitlist.map((databit, index) => (
                                <option key={index} value={databit}>
                                    {databit}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-center gap-2 m-2">停止位
                        <select
                            className="select mr-3 bg-base-200 select-bordered h-1 w-1/6" // 将 select 靠右
                            disabled={connectInfo?.serial?.state !== 'disconnected'}
                            value={connectInfo?.serial?.stopbit}
                            onChange={handleStopbitSelectChange}
                        >
                            {stopbitlist.map((stopbit, index) => (
                                <option key={index} value={stopbit}>
                                    {stopbit}
                                </option>
                            ))}
                        </select>
                    </div>
                    <button className="btn btn-accent flex ml-20">
                        {(connectInfo?.serial?.state === 'connecting' || connectInfo?.serial?.state === 'disconnecting') && <span className="text-sm loading loading-spinner"></span>}
                        {getButtonText(connectInfo?.serial?.state)}
                    </button> {/* 按钮靠右对齐 */}
                </div>
                <input type="radio" name="my_tabs_2" role="tab" className="tab" aria-label="MQTT" />
                <div role="tabpanel" className="tab-content bg-base-100 border-base-300 rounded-md p-6">
                    <div className="flex items-center gap-2 m-2">
                        <label className="w-16 flex-shrink-0">远程地址</label>
                        <input type="text" className="w-1/6 input input-bordered" disabled={connectInfo?.mqtt?.state !== 'disconnected'} value={connectInfo?.mqtt?.ip} onChange={handleMqttipChange} />
                    </div>
                    <div className="flex items-center gap-2 m-2">
                        <label className="w-16 flex-shrink-0">远程端口</label>
                        <input type="text" className="w-1/6 input input-bordered" disabled={connectInfo?.mqtt?.state !== 'disconnected'} value={connectInfo?.mqtt?.port} onChange={handleMqttportChange} />
                    </div>
                    <div className="flex items-center gap-2 m-2">
                        <label className="w-16 flex-shrink-0 justify-between-text">用户名</label>
                        <input type="text" className="w-1/6 input input-bordered" disabled={connectInfo?.mqtt?.state !== 'disconnected'} value={connectInfo?.mqtt?.username} onChange={handleMqttusernameChange} />
                    </div>
                    <div className="flex items-center gap-2 m-2">
                        <label className="w-16 flex-shrink-0 justify-between-text">密码</label>
                        <input type="text" className="w-1/6 input input-bordered" disabled={connectInfo?.mqtt?.state !== 'disconnected'} value={connectInfo?.mqtt?.password} onChange={handleMqttpasswordChange} />
                    </div>
                    <div className="flex items-center gap-2 m-2">
                        <label className="w-16 flex-shrink-0 justify-between-text">Qos</label>
                        <select
                            className="select mr-3 bg-base-200 select-bordered h-1 w-1/6" // 将 select 靠右
                            disabled={connectInfo?.mqtt?.state !== 'disconnected'}
                            value={connectInfo?.mqtt?.qos}
                            onChange={handleMqttqosChange}
                        >
                            {mqttqoslist.map((qos, index) => (
                                <option key={index} value={qos}>
                                    {qos}
                                </option>
                            ))}
                        </select>
                    </div>
                    <button className="btn btn-accent ml-20">
                        {(connectInfo?.mqtt?.state === 'connecting' || connectInfo?.mqtt?.state === 'disconnecting') && <span className="text-sm loading loading-spinner"></span>}
                        {getButtonText(connectInfo?.mqtt?.state)}
                    </button> {/* 按钮靠右对齐 */}
                </div>
                <input type="radio" name="my_tabs_2" role="tab" className="tab" aria-label="蓝牙" />
                <div role="tabpanel" className="tab-content bg-base-100 border-base-300 rounded-md p-6">
                    <div className="flex items-center gap-2 m-2">设备名称
                        <select
                            className="select mr-3 bg-base-200 select-bordered h-1 w-1/6" // 将 select 靠右
                            disabled={connectInfo?.bluetooth?.state !== 'disconnected'}
                            value={connectInfo?.bluetooth?.bluetoothname}
                            onChange={handleBluetoothSelectChange}
                        >
                            {bluetoothlist.map((blute, index) => (
                                <option key={index} value={blute}>
                                    {blute}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-center gap-2 m-2">服务特征
                        <select
                            className="select mr-3 bg-base-200 select-bordered h-1 w-1/6" // 将 select 靠右
                            disabled={connectInfo?.bluetooth?.state !== 'disconnected'}
                            value={connectInfo?.bluetooth?.uuid}
                            onChange={handleUUIDSelectChange}
                        >
                            {uuidlist.map((uuid, index) => (
                                <option key={index} value={uuid}>
                                    {uuid}
                                </option>
                            ))}
                        </select>
                    </div>
                    <button className="btn btn-accent flex ml-20">
                        {(connectInfo?.bluetooth?.state === 'connecting' || connectInfo?.bluetooth?.state === 'disconnecting') && <span className="text-sm loading loading-spinner"></span>}
                        {getButtonText(connectInfo?.bluetooth?.state)}
                    </button> {/* 按钮靠右对齐 */}
                </div>
            </div>
        </div>
    );
}

export default ConnectBridge;