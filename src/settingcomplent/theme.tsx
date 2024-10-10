import { Outlet } from "react-router-dom";
import themes from "../utils/themes";
import { ThemeType, useSettingsContext } from "../context/SettingsProvider";
import { ThemeIcon } from '../components/Icons';
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

const themesMap = {
    light: "明亮",
    dark: "黑暗",
    system: "系统",
};


// 定义为 React 组件
const ThemeChange = () => {
    const { setTheme, theme: currentTheme } = useSettingsContext();
    const [selectTheme, setSelectTheme] = useState<string>(currentTheme);

    useEffect(() => {
        async function getconfigTheme() {
            let theme = await invoke<string>("get_config_value_async", {section: "MainWindow", key: "theme"});
            if (!theme.length) {
                theme = "system";
            }
            console.log("getconfigTheme", theme);
            setSelectTheme(theme);
            setTheme(theme as ThemeType)
        };
        getconfigTheme();

    }, [])
    
    async function setcurrentTheme(theme: string) {
        console.log("curenttheme", theme);
        setTheme(theme as ThemeType);
        await invoke("set_config_value_async", {section: "MainWindow", key: "theme", value: JSON.stringify(theme)});
        setSelectTheme(theme);
    };
    const handleThemeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedTheme = event.target.value;
        setcurrentTheme(selectedTheme);
    };

    return (
        <div tabIndex={0} className="collapse bg-base-200 shadow-md w-full">
            <div className="collapse-title text-base flex items-center w-full pr-0">
                <div className="flex items-center">
                    <ThemeIcon className="size-6" />
                    <p className="ml-2">主题</p> {/* 添加左侧间距 */}
                </div>
                <select
                    className="select mr-3 bg-base-200 select-bordered ml-auto h-1" // 将 select 靠右
                    value={selectTheme}
                    onChange={handleThemeChange}
                >
                    {themes.map((theme, index) => (
                        <option key={index} value={theme}>
                            {themesMap[theme as keyof typeof themesMap]}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
};

export default ThemeChange;
