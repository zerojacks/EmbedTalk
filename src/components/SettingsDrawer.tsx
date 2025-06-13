import React from 'react';
import { AiOutlineClose } from 'react-icons/ai';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { selectRegion, selectTheme, setRegion, setTheme, SettingsState } from '../store/slices/settingsSlice';
import { getApi } from '../api';


interface SettingsDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

export function SettingsDrawer({ isOpen, onClose }: SettingsDrawerProps) {
    const dispatch = useAppDispatch();
    const region = useAppSelector(selectRegion);

    React.useEffect(() => {
        const fetchRegion = async () => {
            try {
                const api = await getApi();
                const region = await api.getRegion();
                dispatch(setRegion(region as SettingsState['region']));
            } catch (error) {
                console.error('Failed to get region:', error);
            }
        };
        // 获取初始区域设置
        fetchRegion();
    }, [dispatch]);

    const handleRegionChange = async (newRegion: SettingsState['region']) => {
        try {
            const api = await getApi();
            await api.setRegion(newRegion);
            dispatch(setRegion(newRegion));
        } catch (error) {
            console.error('Failed to set region:', error);
        }
    };

    return (
        <div className={`drawer drawer-end ${isOpen ? 'drawer-open' : ''}`}>
            <input id="settings-drawer" type="checkbox" className="drawer-toggle" checked={isOpen} readOnly />
            <div className="drawer-side z-50">
                <label htmlFor="settings-drawer" className="drawer-overlay"></label>
                <div className="menu p-4 w-80 min-h-full bg-base-200 text-base-content">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-semibold">设置</h2>
                        <button onClick={onClose} className="btn btn-ghost btn-circle">
                            <AiOutlineClose className="w-5 h-5" />
                        </button>
                    </div>
                    
                    <div className="space-y-4">
                        {/* 区域设置 */}
                        <div className="form-control">
                            <label className="label">
                                <span className="label-text">区域设置</span>
                            </label>
                            <select 
                                className="select select-bordered w-full"
                                value={region}
                                onChange={(e) => handleRegionChange(e.target.value as SettingsState['region'])}
                            >
                                <option value="南网">南网</option>
                                <option value="云南">云南</option>
                                <option value="广东">广东</option>
                                <option value="深圳">深圳</option>
                                <option value="广西">广西</option>
                                <option value="贵州">贵州</option>
                                <option value="海南">海南</option>
                                <option value="topo">topo</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
} 