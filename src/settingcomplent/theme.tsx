import { useSettingsContext } from "../context/SettingsProvider";
import { ThemeIcon } from '../components/Icons';
import { useState } from "react";
import { ThemeOption } from '../store/slices/themeSlice';

const themes: Array<{ code: ThemeOption; name: string }> = [
    { code: 'light', name: '明亮' },
    { code: 'dark', name: '黑暗' },
    { code: 'system', name: '系统' }
];



// 定义为 React 组件
const ThemeChange = () => {
    const { setTheme, theme: currentTheme } = useSettingsContext();
    const [selectTheme, setSelectTheme] = useState<ThemeOption>(currentTheme);

    async function setcurrentTheme(theme: string) {
        setTheme(theme as ThemeOption);
        setSelectTheme(theme as ThemeOption);
    };
    const handleThemeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedTheme = event.target.value;
        setcurrentTheme(selectedTheme);
    };

    return (
        <div className="join join-vertical collapse bg-base-200 shadow-md w-full">
            <div className="collapse-title text-base flex items-center w-full pr-0">
                <div className="flex items-center">
                    <ThemeIcon className="size-6" />
                    <p className="ml-2">主题</p> {/* 添加左侧间距 */}
                </div>
                <select
                    value={selectTheme}
                    className="select mr-3 bg-base-200 select-bordered ml-auto h-1" // 将 select 靠右
                    onChange={handleThemeChange}
                >
                    {themes.map((theme, index) => (
                        <option key={index} value={theme.code}>
                            {theme.name}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
};

export default ThemeChange;
