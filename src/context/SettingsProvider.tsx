import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  ReactNode,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow, Theme } from "@tauri-apps/api/window";

export type ThemeType = "light" | "dark" | "auto";

interface SettingsContextInterface {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
}

export const SettingsContext = createContext<SettingsContextInterface>({
  theme: (localStorage.getItem("theme") as ThemeType) || "dark",
  setTheme: () => { },
});

export const useSettingsContext = () => useContext(SettingsContext);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<ThemeType>(
    (localStorage.getItem("theme") as ThemeType) || "auto"
  );
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    async function initTheme() {
      try {
        const savedTheme = await invoke<string>("get_config_value_async", {
          section: "MainWindow",
          key: "theme",
        });

        const initialTheme: ThemeType = savedTheme as ThemeType || "auto";
        setThemeState(initialTheme);
        await applyTheme(initialTheme);
      } catch (error) {
        console.error("Failed to initialize theme:", error);
      }
    }

    initTheme();
  }, []);

  const applyTheme = async (newTheme: ThemeType) => {
    let effectiveTheme = newTheme;
    if (newTheme === 'auto') {
      effectiveTheme = await invoke<ThemeType>("get_system_theme");
    }
    await getCurrentWindow().setTheme(effectiveTheme as Theme);
    document.body.setAttribute("data-theme", effectiveTheme);
  };

  const setTheme = async (newTheme: ThemeType) => {
    setThemeState(newTheme);
    localStorage.setItem("theme", newTheme);
    await applyTheme(newTheme);
  };

  const updateSystemTheme = async () => {
    try {
      const newSystemTheme = await invoke<string>("get_system_theme");
      setSystemTheme(newSystemTheme as 'light' | 'dark');
      if (theme === 'auto') {
        await applyTheme('auto');
      }
    } catch (error) {
      console.error("Failed to get system theme:", error);
    }
  };

  useEffect(() => {
    applyTheme(theme);

    // 设置定时器定期检查系统主题
    const intervalId = setInterval(updateSystemTheme, 100);

    return () => {
      clearInterval(intervalId);
    };
  }, [theme]);

  return (
    <SettingsContext.Provider value={{ theme, setTheme }}>
      {children}
    </SettingsContext.Provider>
  );
};