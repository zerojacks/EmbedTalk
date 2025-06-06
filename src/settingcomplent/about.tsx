import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { InfoIcon } from '../components/Icons';
import { UpdaterService } from '../services/updaterService';
import { toast } from '../context/ToastProvider';

interface AppInfo {
    name: string;
    version: string;
}

const AboutInfo = () => {
    const [version, setVersion] = useState('0.1.0'); // 初始化版本号
    const [appName, setAppName] = useState('EmbedTalk'); // 初始化应用名称
    const [isUpdate, setIsUpdate] = useState(false);
    const [NewVersion, setNewVersion] = useState({ haveNewVersion: false, newVersion: "0.1.2" });

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
    
    // 检查是否有待安装的更新
    useEffect(() => {
        async function checkPendingUpdates() {
            try {
                // 在应用启动时检查是否有待安装的更新
                await UpdaterService.checkPendingUpdatesOnStartup();
            } catch (error) {
                console.error('检查待安装更新失败:', error);
            }
        }
        
        // 在组件挂载后等待一秒再检查，避免与其他初始化操作冲突
        const timer = setTimeout(() => {
            checkPendingUpdates();
        }, 1000);
        
        return () => clearTimeout(timer);
    }, []);

    const handleClick = () => {
        if (isUpdate) return;
        console.log('check update');
        async function checkUpdate() {
            setIsUpdate(true);
            try {
                // 显示正在检查更新的提示
                toast.info('正在检查更新...');
                
                // 使用 UpdaterService 检查更新
                const hasUpdate = await UpdaterService.checkForUpdates(true); // 使用静默模式，避免重复提示
                
                if (hasUpdate) {
                    console.log('有新版本');
                    // 显示安装按钮
                    setNewVersion({ haveNewVersion: true, newVersion: '新版本' });
                    
                    // 显示更新通知
                    toast.success('发现新版本，准备下载...');
                    
                    try {
                        // 开始下载更新，完成后会显示确认对话框
                        // 用户可以选择立即安装或下次启动时安装
                        const updateResult = await UpdaterService.downloadUpdate();
                        
                        if (updateResult) {
                            console.log(`已下载更新: ${updateResult.version}`);
                        }
                    } catch (downloadError) {
                        // 如果是我们的有意异常，忽略它
                        if (downloadError instanceof Error && downloadError.message === 'DOWNLOAD_ONLY') {
                            console.log('已取消自动安装，等待用户确认');
                        } else {
                            // 其他下载错误
                            toast.error(`下载更新失败: ${downloadError instanceof Error ? downloadError.message : String(downloadError)}`);
                        }
                    }
                } else {
                    console.log('没有新版本');
                    setNewVersion({ haveNewVersion: false, newVersion: version });
                    toast.info('当前已是最新版本');
                }
            } catch (error) {
                console.log(error);
                toast.error(`检查更新失败: ${error instanceof Error ? error.message : String(error)}`);
            } finally {
                setIsUpdate(false);
            }
        }

        checkUpdate();
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
            </div>
        </div>
    );
};

export default AboutInfo;