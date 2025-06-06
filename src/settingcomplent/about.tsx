import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { InfoIcon } from '../components/Icons';
import { toast } from '../context/ToastProvider';
import { useUpdate } from '../context/UpdateProvider';

interface AppInfo {
    name: string;
    version: string;
}

const AboutInfo = () => {
    const [version, setVersion] = useState('0.1.0');
    const [appName, setAppName] = useState('EmbedTalk');
    const [isUpdate, setIsUpdate] = useState(false);
    const [latestVersion, setLatestVersion] = useState<string | null>(null);
    const { checkForUpdates } = useUpdate();

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

    const handleClick = async () => {
        if (isUpdate) return;
        setIsUpdate(true);
        try {
            await checkForUpdates();
            if (!latestVersion) {
                setLatestVersion(version);
            }
        } catch (error) {
            console.log(error);
            toast.error(`检查更新失败: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsUpdate(false);
        }
    };

    // 订阅更新事件
    useEffect(() => {
        const handleUpdateFound = (event: CustomEvent<{version: string}>) => {
            setLatestVersion(event.detail.version);
        };

        window.addEventListener('update-found' as any, handleUpdateFound);

        return () => {
            window.removeEventListener('update-found' as any, handleUpdateFound);
        };
    }, []);

    return (
        <div className="join join-vertical collapse bg-base-200 shadow-md w-full">
            <div className="collapse-title text-base flex items-center w-full pr-0">
                <div className="flex items-center w-full">
                    <div className="flex-1 flex items-center">
                        <InfoIcon className="size-6" />
                        <div className='flex flex-col ml-2'>
                            <p className="text-lg">关于</p>
                            <p className="text-sm text-gray-500">
                                Copyright © {new Date().getFullYear()} - {appName}
                                <br />
                                All rights reserved
                                <br />
                                当前版本：{version}
                                {latestVersion && latestVersion !== version && (
                                    <>
                                        <br />
                                        <span className="text-primary">最新版本：{latestVersion}</span>
                                    </>
                                )}
                            </p>
                        </div>
                    </div>
                    <button className="btn btn-accent mr-3 h-1" onClick={handleClick}>
                        {isUpdate && <span className="text-sm loading loading-spinner"></span>}
                        {isUpdate ? '检查更新中...' : '检查更新'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AboutInfo;