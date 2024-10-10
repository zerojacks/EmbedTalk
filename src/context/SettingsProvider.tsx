import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  ReactNode,
  useCallback,
  useRef,
} from "react";

import { setTheme as setTauriTheme } from '@tauri-apps/api/app';
import { Theme } from '@tauri-apps/api/window'
import { invoke } from "@tauri-apps/api/core";
export type ThemeType = "light" | "dark" | "system";

interface SettingsContextInterface {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
  effectiveTheme: "light" | "dark";
}

export const SettingsContext = createContext<SettingsContextInterface>({
  theme: (localStorage.getItem("theme") as ThemeType) || "dark",
  effectiveTheme: "dark",
  setTheme: () => {},
});

export const useSettingsContext = () => useContext(SettingsContext);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<ThemeType>(
    (localStorage.getItem("theme") as ThemeType) || "system"
  );
  const [effectiveTheme, setEffectiveTheme] = useState<"light" | "dark">("dark");
  const isSettingTheme = useRef(false);
  const mediaQueryList = useRef<MediaQueryList | null>(null);

  useEffect(() => {
    async function getconfigTheme() {
        let theme = await invoke<string>("get_config_value_async", {section: "MainWindow", key: "theme"});
        if (!theme.length) {
            theme = "system";
        }
        console.log("theme getconfigTheme", theme);
        setTheme(theme as ThemeType); // 设置主题
    };
    getconfigTheme();

}, [])

  const getSystemTheme = useCallback((): "light" | "dark" => {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }, []);

  const updateEffectiveTheme = useCallback(async (newTheme: ThemeType) => {
    if (isSettingTheme.current) return;
    isSettingTheme.current = true;

    try {
      let effective: "light" | "dark";
      
      if (newTheme === "system") {
        // 暂时移除事件监听器
        const currentMediaQueryList = mediaQueryList.current;
        if (currentMediaQueryList) {
          const currentListener = currentMediaQueryList.onchange;
          currentMediaQueryList.onchange = null;

          // 设置为系统主题
          await setTauriTheme('system' as Theme);
          
          // 短暂延迟，让系统有时间响应
          await new Promise(resolve => setTimeout(resolve, 50));
          
          effective = getSystemTheme();
          
          // 恢复事件监听器
          currentMediaQueryList.onchange = currentListener;
        } else {
          effective = getSystemTheme();
        }
      } else {
        effective = newTheme;
      }

      setEffectiveTheme(effective);
      document.body.setAttribute("data-theme", effective);
      if (newTheme !== "system") {
        await setTauriTheme(effective as Theme);
      }
    } finally {
      isSettingTheme.current = false;
    }
  }, [getSystemTheme]);

  const setTheme = useCallback((newTheme: ThemeType) => {
    setThemeState(newTheme);
    localStorage.setItem("theme", newTheme);
    updateEffectiveTheme(newTheme);
  }, [updateEffectiveTheme]);

  useEffect(() => {
    mediaQueryList.current = window.matchMedia("(prefers-color-scheme: dark)");
    
    const handleChange = () => {
      if (theme === "system" && !isSettingTheme.current) {
        updateEffectiveTheme("system");
      }
    };

    mediaQueryList.current.addEventListener("change", handleChange);
    
    // 初始化主题
    updateEffectiveTheme(theme);

    return () => {
      mediaQueryList.current?.removeEventListener("change", handleChange);
    };
  }, [theme, updateEffectiveTheme]);

  return (
    <SettingsContext.Provider value={{ theme, setTheme, effectiveTheme }}>
      {children}
    </SettingsContext.Provider>
  );
};