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
import { getCurrentWindow } from "@tauri-apps/api/window";

export type ThemeType = "light" | "dark" | "auto";

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
themeMedia.addEventListener("change", async (e) => {
  console.log("themeMedia", e);
  const systheme = await invoke<ThemeType>("plugin:theme|get_theme");
  applytheme(systheme as ThemeType);
});

const applytheme = async (theme: ThemeType) => {
  console.log("act theme", theme);
  await invoke("plugin:theme|set_theme", {
    theme: theme,
  });
  document.body.setAttribute("data-theme", theme);
};

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "dark");
  
  useEffect(() => {
    async function getconfigTheme() {
      let theme = await invoke<string>("get_config_value_async", { section: "MainWindow", key: "theme" });
      if (!theme.length) {
        theme = "auto";
      }
      setTheme(theme);
    };
    getconfigTheme();
  }, [])

  useEffect(() => {
    localStorage.setItem("theme", theme);
    console.log("theme", theme);
    applytheme(theme as ThemeType);
  }, [theme]);

  return (
    <SettingsContext.Provider value={{ theme, setTheme }}>
      {children}
    </SettingsContext.Provider>
  );
};
