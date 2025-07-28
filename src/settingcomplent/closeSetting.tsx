import React from 'react';
import { useSelector } from 'react-redux';
import { selectCloseToTray } from '../store/slices/settingsSlice';
import { useSettings } from '../hooks/useSettings';
import { LeafIcon } from 'lucide-react';

const CloseSetting = () => {
    const closeToTray = useSelector(selectCloseToTray);
    const { updateCloseToTray } = useSettings();

    // 处理关闭到托盘设置
    const handleCloseToTrayChange = async (value: boolean) => {
        try {
            await updateCloseToTray(value);
        } catch (error) {
            console.error('Failed to update close to tray setting:', error);
        }
    };

    return (
        <div className="join join-vertical collapse bg-base-200 shadow-md w-full">
            <div className="collapse-title text-base flex items-center w-full pr-0">
                <div className="flex items-center w-full">
                    <div className="flex-1 flex items-center">
                        <LeafIcon className="size-6" />
                        <div className='flex flex-col ml-2'>
                            <p className="text-lg">关闭窗口</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <label className="cursor-pointer flex items-center gap-2">
                            <input
                                type="radio"
                                name="closeAction"
                                className="radio radio-primary radio-sm"
                                checked={closeToTray === true || closeToTray === null}
                                onChange={() => handleCloseToTrayChange(true)}
                            />
                            <span className="label-text text-sm">托盘</span>
                        </label>
                        <label className="cursor-pointer flex items-center gap-2">
                            <input
                                type="radio"
                                name="closeAction"
                                className="radio radio-primary radio-sm"
                                checked={closeToTray === false}
                                onChange={() => handleCloseToTrayChange(false)}
                            />
                            <span className="label-text text-sm">退出</span>
                        </label>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CloseSetting; 