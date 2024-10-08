import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core"; // 如果你用的是 Tauri，使用这个导入
import { MapIcon } from "../components/Icons";

const getRegions = () => {
    return ["南网", "云南", "广东", "深圳", "广西", "贵州", "海南", "topo"]; // 这是一个静态的数组
};

export default function Region() {
    const regionList = getRegions(); // 这里确保调用了函数，返回数组
    const [selectedRegion, setSelectedRegion] = useState<string>("南网");
    const hasFetchedRegion = useRef(false); // 用于标记是否已获取选中的省份

    function cleanAndUppercase(targetRegion: string) {
        let cleaned = targetRegion;
        cleaned = cleaned.replace(/"/g, '');
        cleaned = cleaned.toUpperCase();
        return cleaned;
    }

    // 从后端获取选中的省份
    useEffect(() => {
        async function fetchSelectedRegion() {
            try {
                console.log("Fetching selected region...");
                const region = await invoke<string>("get_region_value"); // 调用后端接口获取选中的省份
                let cleanRegion = cleanAndUppercase(region);
                setSelectedRegion(cleanRegion); // 存储后端返回的选中的省份
                console.log("获取选中的省份成功: ", cleanRegion);
            } catch (error) {
                console.error("获取选中的省份失败: ", error);
            }
        }
        if (hasFetchedRegion.current === false) {
            fetchSelectedRegion();
            hasFetchedRegion.current = true;
        }
    }, []);

    useEffect(() => {
        if (selectedRegion != "") {
            localStorage.setItem('currentRegion', JSON.stringify(selectedRegion));
        }
    }, [selectedRegion]);

    const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        console.log("用户选择的省份: ", e.target.value);
        setSelectedRegion(e.target.value); // 处理用户选择的省份
        // 调用后端 Rust 函数，传递选中的省份
        invoke("set_region_value", { region: JSON.stringify(e.target.value) }).then(() => {
            // 你可以在这里处理成功回调
        });
    };

    return (
        <div tabIndex={0} className="collapse bg-base-200 shadow-md w-full">
            <div className="collapse-title text-base flex items-center w-full pr-0">
                <div className="flex items-center">
                    <MapIcon className="size-6" />
                    <p className="ml-2">省份</p> {/* 添加左侧间距 */}
                </div>
                <select
                    className="select mr-3 bg-base-200 select-bordered ml-auto h-1" // 将 select 靠右
                    value={selectedRegion}
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