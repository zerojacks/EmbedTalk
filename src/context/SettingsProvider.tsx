import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  ReactNode,
  useCallback,
} from "react";
import { setTheme as setTauriTheme } from '@tauri-apps/api/app';
import { Theme } from '@tauri-apps/api/window';
import { invoke } from "@tauri-apps/api/core";

export type ThemeType = "light" | "dark" | "system";

interface SettingsContextInterface {
  theme: string;
  setTheme: (theme: string) => void;
}

export const SettingsContext = createContext<SettingsContextInterface>({
  theme: localStorage.getItem("theme") || "dark",
  setTheme: () => { },
});

export const useSettingsContext = () => useContext(SettingsContext);
const themeMedia = window.matchMedia("(prefers-color-scheme: dark)");

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "dark");
  const [curtheme, setCurTheme] = useState(theme);

  useEffect(() => {
    async function getconfigTheme() {
      let theme = await invoke<string>("get_config_value_async", { section: "MainWindow", key: "theme" });
      if (!theme.length) {
        theme = "system";
      }
      console.log("getconfigTheme", theme);
      setTheme(theme);
    };
    getconfigTheme();

  }, [])

  const getSystemTheme = () => {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  };

  const handleSystemThemeChange = useCallback(async (event: MediaQueryListEvent) => {
    console.log("systemtheme event", event, theme);
    if (curtheme !== "system") {
      return;
    }

    const isDark = event.matches;
    applytheme(isDark ? "dark" : "light");
  }, [curtheme, theme]);

  const setSysTheme = useCallback(async (theme: ThemeType) => {
    console.log("setsystem", theme);
    let currentTheme = theme;
    if (theme === "system") {
      currentTheme = getSystemTheme();
      themeMedia.addEventListener('change', handleSystemThemeChange);
      console.error("add listen")
    } else {
      themeMedia.removeEventListener('change', handleSystemThemeChange);
      console.error("remove listen")
    }
    await applytheme(currentTheme);
  }, []);

  useEffect(() => {
    localStorage.setItem("theme", theme);
    console.log("theme", theme);
    setCurTheme(theme);
    setSysTheme(theme as ThemeType);
  }, [theme]);

  const applytheme = async (theme: ThemeType) => {
    console.log("act theme", theme, themeMedia);

    await new Promise(resolve => setTimeout(resolve, 50));
    document.body.setAttribute("data-theme", theme);
    setTauriTheme(theme as Theme);
    console.log("add listen");
  };

  return (
    <SettingsContext.Provider value={{ theme, setTheme }}>
      {children}
    </SettingsContext.Provider>
  );
};
