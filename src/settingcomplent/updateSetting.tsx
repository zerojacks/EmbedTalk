import React, { useEffect, useState } from 'react';
import { SettingService } from '../services/settingService';
import { UpdateIcon } from '../components/Icons';

const UpdateSetting = () => {
    const [autoCheck, setAutoCheck] = useState(false);

    // 加载保存的设置
    useEffect(() => {
        async function loadSettings() {
            try {
                const savedValue = await SettingService.getConfig('updates.autoCheck');
                setAutoCheck(savedValue ?? false);
            } catch (error) {
                console.error('Failed to load auto check setting:', error);
                setAutoCheck(false);
            }
        }
        loadSettings();
    }, []);

    // 保存设置
    const handleAutoCheckChange = async (checked: boolean) => {
        setAutoCheck(checked);
        try {
            await SettingService.setConfig('updates.autoCheck', checked);
        } catch (error) {
            console.error('Failed to save auto check setting:', error);
        }
    };

    return (
        <div className="join join-vertical collapse bg-base-200 shadow-md w-full">
            <div className="collapse-title text-base flex items-center w-full pr-0">
                <div className="flex items-center w-full">
                    <div className="flex-1 flex items-center">
                        <UpdateIcon className="size-6" />
                        <div className='flex flex-col ml-2'>
                            <p className="text-lg">自动更新</p>
                        </div>
                    </div>
                    <label className="cursor-pointer label gap-2">
                        <span className="label-text">{autoCheck?"开":"关"}</span>
                        <input
                            type="checkbox"
                            className="toggle toggle-accent"
                            checked={autoCheck}
                            onChange={(e) => handleAutoCheckChange(e.target.checked)}
                        />
                    </label>
                </div>
            </div>
        </div>
    );
};

export default UpdateSetting; 