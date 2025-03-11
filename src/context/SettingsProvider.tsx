import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  ReactNode,
} from "react";
import { useSelector, useDispatch } from 'react-redux';
import { selectTheme, setTheme, getEffectiveTheme, ThemeOption } from '../store/slices/themeSlice';

interface SettingsContextInterface {
  theme: ThemeOption;
  effectiveTheme: 'light' | 'dark';
  setTheme: (theme: ThemeOption) => void;
}

export const SettingsContext = createContext<SettingsContextInterface>({
  theme: 'system',
  effectiveTheme: 'light',
  setTheme: () => { },
});

export const useSettingsContext = () => useContext(SettingsContext);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const dispatch = useDispatch();
  const theme = useSelector(selectTheme);
  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>(
    getEffectiveTheme()
  );

  const changeTheme = (newTheme: ThemeOption) => {
    dispatch(setTheme(newTheme));
  };

  return (
    <SettingsContext.Provider value={{ 
      theme, 
      effectiveTheme, 
      setTheme: changeTheme 
    }}>
      {children}
    </SettingsContext.Provider>
  );
};