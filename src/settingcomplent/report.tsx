import { useState, useEffect, useRef } from "react";
import {ReplayIcon} from '../components/Icons'
import { SettingService } from '../services/settingService';
import { useProtocolInfoStore } from "../stores/useProtocolInfoStore";

const Report = () => {
    const hasgetconfig = useRef(false); // 用于标记是否已获取选中的省份
    const { isreport, setIsReport} = useProtocolInfoStore();

    useEffect(() => {
        async function get_report_config() {
            try {
                // 使用兼容的方法获取协议设置
                const reportstate = await SettingService.getConfigValue<string>("protocolsetting", "reportreplay");
                console.log("reportstate",reportstate);
                if (reportstate) {
                    setIsReport(true);
                } else {
                    setIsReport(false);
                }

            } catch (err) {}
        }
        if (!hasgetconfig.current) {
            get_report_config();
            hasgetconfig.current = true;
        }

    }, []);

    const handlevalueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.checked;
        setIsReport(value);
        SettingService.setConfigValue("protocolsetting", "reportreplay", value);
    };

    return (
        <div className="join join-vertical collapse bg-base-200 shadow-md w-full">
            <div className="collapse-title text-base flex items-center w-full pr-0">
                <div className="flex items-center">
                    <ReplayIcon className="size-6" />
                    <p className="ml-2">上报回复</p> {/* 添加左侧间距 */}
                </div>
                <div className="form-control flex ml-auto mr-3">
                    <label className="label cursor-pointer">
                        <span className="label-text">{isreport?"开":"关"}</span>
                        <input type="checkbox" className="toggle toggle-accent ml-2" checked={isreport} onChange={handlevalueChange}/>
                    </label>
                </div>
            </div>
        </div>
    );
}

export default Report;