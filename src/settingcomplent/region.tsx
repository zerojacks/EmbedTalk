import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core"; // 如果你用的是 Tauri，使用这个导入
import { MapIcon } from "../components/Icons";
import { useProtocolInfoStore } from '../stores/useProtocolInfoStore';
import { cleanAndUppercase, getRegions } from '../utils/region'

export default function Region() {
    const regionList = getRegions(); // 这里确保调用了函数，返回数组
    const { region, setRegion} = useProtocolInfoStore();
    const hasFetchedRegion = useRef(false); // 用于标记是否已获取选中的省份

    // 从后端获取选中的省份
    useEffect(() => {
        async function fetchSelectedRegion() {
            try {
                console.log("Fetching selected region...");
                const curregion = await invoke<string>("get_region_value"); // 调用后端接口获取选中的省份
                let cleanRegion = cleanAndUppercase(curregion);
                setRegion(cleanRegion); // 存储后端返回的选中的省份
            } catch (error) {
                console.error("获取选中的省份失败: ", error);
            }
        }
        if (hasFetchedRegion.current === false) {
            fetchSelectedRegion();
            hasFetchedRegion.current = true;
        }
    }, []);


    const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setRegion(cleanAndUppercase(e.target.value)); // 处理用户选择的省份
        invoke("set_region_value", { region: JSON.stringify(e.target.value) }).then(() => {
            // 你可以在这里处理成功回调
        });
    };

    return (
        <div className="join join-vertical collapse bg-base-200 shadow-md w-full">
            <div className="collapse-title text-base flex items-center w-full pr-0">
                <div className="flex items-center">
                    <MapIcon className="size-6" />
                    <p className="ml-2">省份</p> {/* 添加左侧间距 */}
                </div>
                <select
                    className="select mr-3 bg-base-200 select-bordered ml-auto h-1" // 将 select 靠右
                    value={region}
                    onChange={handleSelectChange}
                >
                    {regionList.map((region, index) => (
                        <option key={index} value={region}>
                            {region}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
}