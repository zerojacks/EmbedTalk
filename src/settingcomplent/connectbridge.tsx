import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useConnectStore, ConnectBridgeInfo, connectionState } from '../stores/useConnectStore';
import IpInput from '../components/IPInput'
import { json } from "stream/consumers";
import { toast } from "../context/ToastProvider";
import { listen, UnlistenFn } from '@tauri-apps/api/event';

type ChannelType = "tcpclient" | "tcpserver" | "serial" | "mqtt" | "bluetooth";

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
                const connectinfo = await invoke<ConnectBridgeInfo>("get_config_value_async", {
                    section: "connectcfg",
                    key: "",
                });
                if (connectinfo) {
                    setDefaultState(connectinfo);
                    setDefaultInfo(connectinfo);
                    setConnectInfo(connectinfo);
                    // Update other states if necessary
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
        const unlistenFn = await listen('channel-disconnected', (event) => {
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
                    setConnectInfo({
                        tcpclient: {
                            ...connectInfo?.tcpclient,
                            state: 'disconnected' as connectionState,
                        }
                    });
                    break;
                case "tcpserver":
                    setConnectInfo({
                        tcpserver: {
                            ...connectInfo?.tcpserver,
                            state: 'disconnected' as connectionState,
                        }
                    });
                    break;
                // ... 其他通道的处理
            }
        });

        channelListeners.current[channel] = unlistenFn;        
        // 清理监听器的函数
    };
    const cleanupChannelListener = async (channel: ChannelType) => {
        console.log(`Cleaning up listener for ${channel}`);
        if (channelListeners.current[channel]) {
            console.log(`exec Cleaning up listener for ${channel}`);
            await channelListeners.current[channel]!();
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
        if (!connectInfo?.tcpclient) return;

        try {
            const params = getChannelParams(channel); // 获取对应通道的参数
            const commandName = action === 'connect' ? "connect_channel" : "disconnect_channel";
            let curr_state = action === 'connect' ? 'connecting' : 'disconnecting' as connectionState;
            setConnectInfo({
                [channel]: {
                    ...connectInfo[channel],
                    state: curr_state,
                }
            });
            let toast_message = getToastMessage(channel, params, curr_state);
            toast.info(toast_message);
            const result = await invoke(commandName, { channel: channel, values: JSON.stringify(params) });

            if (action === 'connect') {
                await setupChannelListener(channel);
            } else {
                await cleanupChannelListener(channel);
            }
            curr_state = curr_state === 'connecting' ? 'connected' : 'disconnected' as connectionState;
            setConnectInfo({
                [channel]: {
                    ...connectInfo[channel],
                    state: curr_state,
                }
            });
            toast_message = getToastMessage(channel, params, curr_state);
            toast.success(toast_message);
        } catch (error) {
            console.error(`Error ${action}ing ${channel}:`, error);
            const err_type = (action === 'connect' ? "连接" : "断开");
            toast.error(`${getChannelNmae(channel)}${err_type}失败:${error}`, 'end', 'bottom', 3000);

            setConnectInfo({
                [channel]: {
                    ...connectInfo[channel],
                    state: action === 'connect' ? 'disconnected' : 'connected',
                }
            });
        }
    };

    // 获取通道参数的辅助函数
    const getChannelParams = (channel: ChannelType) => {
        switch (channel) {
            case "tcpclient":
                return {
                    ip: connectInfo?.tcpclient?.ip,
                    port: connectInfo?.tcpclient?.port
                };
            case "tcpserver":
                return {
                    ip: connectInfo?.tcpserver?.ip,
                    port: connectInfo?.tcpserver?.port
                };
            // ... 其他通道的参数获取
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
                version: "3.1.1", // 提供默认值
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
                    version: connectInfo?.mqtt?.version ?? "3.1.1", // 提供默认值
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
                version: connectInfo?.mqtt?.version ?? "3.1.1", // 提供默认值
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
                version: connectInfo?.mqtt?.version ?? "3.1.1", // 提供默认值
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
                version: connectInfo?.mqtt?.version ?? "3.1.1", // 提供默认值
                qos: connectInfo?.mqtt?.qos ?? 2, // 提供默认值
            }
        });
    }

    const handleMqttversionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        console.log(e.target.value);
        setConnectInfo({
            mqtt: {
                ...connectInfo?.mqtt,
                ip: connectInfo?.mqtt?.ip ?? "127.0.0.1", // 提供默认值
                port: connectInfo?.mqtt?.port ?? 1883, // 提供默认值
                state: connectInfo?.mqtt?.state ?? 'disconnected', // 提供默认值
                username: connectInfo?.mqtt?.username ?? "", // 提供默认值
                password: connectInfo?.mqtt?.password ?? "", // 提供默认值
                version: e.target.value, // 提供默认值
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
                version: connectInfo?.mqtt?.version ?? "3.1.1", // 提供默认值
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
        <div tabIndex={0} className="flex-col collapse bg-base-200 shadow-md w-full">
            <div role="tablist" className="tabs tabs-lifted">
                <input type="radio" name="my_tabs_2" role="tab" className="tab" aria-label="TCP客户端" defaultChecked />
                <div role="tabpanel" className="tab-content bg-base-100 border-base-300 rounded-box p-6">
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
                <div role="tabpanel" className="tab-content bg-base-100 border-base-300 rounded-box p-6">
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
                <div role="tabpanel" className="tab-content bg-base-100 border-base-300 rounded-box p-6">
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
                <div role="tabpanel" className="tab-content bg-base-100 border-base-300 rounded-box p-6">
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
                        <label className="w-16 flex-shrink-0 justify-between-text">版本</label>
                        <select
                            className="select mr-3 bg-base-200 select-bordered h-1 w-1/6" // 将 select 靠右
                            disabled={connectInfo?.mqtt?.state !== 'disconnected'}
                            value={connectInfo?.mqtt?.version}
                            onChange={handleMqttversionChange}
                        >
                            {mqttversionlist.map((version, index) => (
                                <option key={index} value={version}>
                                    {version}
                                </option>
                            ))}
                        </select>
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
                <div role="tabpanel" className="tab-content bg-base-100 border-base-300 rounded-box p-6">
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