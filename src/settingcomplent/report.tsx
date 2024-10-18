import { useState, useEffect, useRef } from "react";
import {ReplayIcon} from '../components/Icons'
import { invoke } from "@tauri-apps/api/core";
import { useProtocolInfoStore } from "../stores/useProtocolInfoStore";

const Report = () => {
    const hasgetconfig = useRef(false); // 用于标记是否已获取选中的省份
    const { isreport, setIsReport} = useProtocolInfoStore();

    useEffect(() => {
        async function get_report_config() {
            try {
                const reportstate = await invoke<string>("get_config_value_async", {section: "ProtocolSetting", key: "reportreplay"});
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
        invoke<string>("set_config_value_async", {section: "ProtocolSetting", key: "reportreplay", value: JSON.stringify(value)});
    };

    return (
        <div tabIndex={0} className="collapse bg-base-200 shadow-md w-full">
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