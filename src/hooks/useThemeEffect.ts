import { useEffect } from 'react';
import { useAppSelector } from '../store/hooks';
import { selectTheme } from '../store/slices/settingsSlice';

export function useThemeEffect() {
    const theme = useAppSelector(selectTheme);

    useEffect(() => {
        const root = window.document.documentElement;
        
        if (theme === 'system') {
            // 检测系统主题
            const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            const handleChange = (e: MediaQueryListEvent) => {
                root.setAttribute('data-theme', e.matches ? 'dark' : 'light');
            };
            
            // 设置初始主题
            root.setAttribute('data-theme', darkModeMediaQuery.matches ? 'dark' : 'light');
            
            // 监听系统主题变化
            darkModeMediaQuery.addEventListener('change', handleChange);
            
            return () => {
                darkModeMediaQuery.removeEventListener('change', handleChange);
            };
        } else {
            // 直接设置指定的主题
            root.setAttribute('data-theme', theme);
        }
    }, [theme]);
} 