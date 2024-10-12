import React, { useRef, useEffect } from 'react';
import * as monaco from 'monaco-editor';
import { ThemeType, useSettingsContext } from "../context/SettingsProvider";

interface MonacoEditorProps {
    initialValue: string;
    language: string;
    onChange: (value: string) => void;
}

const MonacoEditor: React.FC<MonacoEditorProps> = ({ initialValue, language, onChange }) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const editor = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
    const { efffectiveTheme } = useSettingsContext();

    monaco.editor.defineTheme('custom-dark', {
        base: 'vs-dark', // 或者 'vs' 如果你想要浅色主题
        inherit: true,
        rules: [],
        colors: {
          'editor.background': '#1d232a', // 设置背景为透明
          // 你可以在这里添加其他颜色设置
        }
    });

    useEffect(() => {
        if (editorRef.current) {
            editor.current = monaco.editor.create(editorRef.current, {
                value: initialValue,
                language: language,
                theme: efffectiveTheme==='dark' ? 'custom-dark' : 'vs-light',
                minimap: { enabled: false },
                automaticLayout: true,
            });

            editor.current.onDidChangeModelContent(() => {
                onChange(editor.current?.getValue() || '');
            });
        }

        return () => {
            editor.current?.dispose();
        };
    }, []);

    useEffect(() => {
        if (editor.current) {
            monaco.editor.setTheme(efffectiveTheme === 'dark' ? 'custom-dark' : 'vs-light');
        }
    }, [efffectiveTheme]);

    useEffect(() => {
        if (editor.current) {
            const model = editor.current.getModel();
            if (model) {
                monaco.editor.setModelLanguage(model, language);
            }
        }
    }, [language]);

    return <div ref={editorRef} className="flex w-full h-full items-start" />;
};

export default MonacoEditor;