import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { InfoIcon } from '../components/Icons';
import { useLocation } from 'react-router-dom'; // 如果你使用了 React Router

interface AppInfo {
    name: string;
    version: string;
}

const AboutInfo = () => {
    const [version, setVersion] = useState('0.1.0'); // 初始化版本号
    const [appName, setAppName] = useState('EmbedTalk'); // 初始化应用名称
    const [isUpdate, setIsUpdate] = useState(false);
    const [NewVersion, setNewVersion] = useState({ haveNewVersion: false, newVersion: "0.1.2" });
    const [opendev, setOpendev] = useState(false);

    // 获取应用信息
    useEffect(() => {
        async function getAppInfo() {
            try {
                const appInfo: AppInfo = await invoke('get_app_info');
                setVersion(appInfo.version);
                setAppName(appInfo.name);
            } catch (error) {
                console.error('Failed to fetch app info:', error);
            }
        }

        getAppInfo();
    }, []);

    // 从 localStorage 获取新版本信息
    useEffect(() => {
        async function getNewVersion() {
            try {
                const result = localStorage.getItem('getNewVersion');
                if (result) {
                    setNewVersion(JSON.parse(result));
                } else {
                    setNewVersion({ haveNewVersion: false, newVersion: version });
                }
            } catch (error) {
                console.log(error);
            }
        }

        getNewVersion();
    }, [version]); // 依赖于 version 状态

    // 将 NewVersion 保存到 localStorage
    useEffect(() => {
        if (NewVersion.haveNewVersion) {
            localStorage.setItem('getNewVersion', JSON.stringify(NewVersion));
        }
    }, [NewVersion]);

    const handleClick = () => {
        if (isUpdate) return;
        console.log('check update');
        async function checkUpdate() {
            setIsUpdate(true);
            try {
                const result: AppInfo = await invoke('check_update');
                if (result) {
                    console.log('有新版本');
                    setNewVersion({ haveNewVersion: true, newVersion: result.version });
                } else {
                    console.log('没有新版本');
                    setNewVersion({ haveNewVersion: false, newVersion: version });
                }
            } catch (error) {
                console.log(error);
            } finally {
                setIsUpdate(false);
            }
        }

        checkUpdate();
    };

    const handleOpenDevTools = async () => {
        try {
          await invoke('open_devtools');
        } catch (error) {
          console.error('Failed to open devtools:', error);
        }
      };

    return (
        <div className="join join-vertical collapse bg-base-200 shadow-md w-full">
            <div className="collapse-title text-base flex items-center w-full pr-0">
                <div className="flex items-center w-full">
                    <div className="flex-1 flex items-center">
                        <InfoIcon className="size-6" />
                        <div className='flex flex-col ml-2'>
                            <p className="text-lg">关于</p> {/* 添加左侧间距 */}
                            <p className="text-sm text-gray-500">
                                Copyright © {new Date().getFullYear()} - {appName}
                                <br />
                                All rights reserved
                                <br />
                                {NewVersion.haveNewVersion ? (
                                    <span className="text-red-500 font-bold">发现新版本：{NewVersion.newVersion}</span>
                                ) : (
                                    `当前版本：${version}`
                                )}
                            </p>
                        </div>
                    </div>
                    <button className="btn btn-accent mr-3 h-1" onClick={handleClick}>
                        {isUpdate && <span className="text-sm loading loading-spinner"></span>}
                        {isUpdate ? '检查更新中...' : '检查更新'}
                    </button> {/* 按钮靠右对齐 */}
                </div>
                <div>
                    <button onClick={handleOpenDevTools}>
                        打开开发工具
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AboutInfo;