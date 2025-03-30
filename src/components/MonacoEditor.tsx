import * as monaco from 'monaco-editor';
import React, { useEffect, useRef, useCallback } from 'react';
import { debounce } from 'lodash';

interface MonacoEditorProps {
  value: string;
  language: string;
  onChange?: (value: string) => void;
  onSave?: (value: string) => void;
  theme?: string;
}

export const MonacoEditor: React.FC<MonacoEditorProps> = ({
  value,
  language,
  onChange,
  onSave,
  theme = 'vs-dark'
}) => {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef(value);
  const modelRef = useRef<monaco.editor.ITextModel | null>(null);

  // 使用防抖处理自动保存，避免频繁触发
  const debouncedSave = useCallback(
    debounce((content: string) => {
      onSave?.(content);
    }, 1000),
    [onSave]
  );

  useEffect(() => {
    if(editorRef.current) {
      editorRef.current.updateOptions({
        theme:theme
      })
    }
  }, [theme])
  useEffect(() => {
    if (!containerRef.current) return;

    // 创建编辑器实例
    editorRef.current = monaco.editor.create(containerRef.current, {
      value,
      language,
      theme,
      automaticLayout: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      fontSize: 14,
      lineNumbers: 'on',
      renderWhitespace: 'selection',
      tabSize: 2,
      wordWrap: 'on'
    });

    // 创建模型并保存引用
    modelRef.current = editorRef.current.getModel();

    // 监听内容变化
    const disposable = editorRef.current.onDidChangeModelContent(() => {
      if (!editorRef.current) return;
      
      const newValue = editorRef.current.getValue();
      valueRef.current = newValue;
      
      // 触发onChange回调
      onChange?.(newValue);
      
      // 触发自动保存
      debouncedSave(newValue);
    });

    // 添加键盘快捷键
    editorRef.current.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
      () => {
        onSave?.(valueRef.current);
      }
    );

    return () => {
      disposable.dispose();
      if (editorRef.current) {
        editorRef.current.dispose();
      }
    };
  }, []); // 仅在组件挂载时执行一次

  // 当外部value发生变化且与当前编辑器内容不同时更新
  useEffect(() => {
    if (editorRef.current && value !== valueRef.current) {
      const position = editorRef.current.getPosition();
      editorRef.current.setValue(value);
      if (position) {
        editorRef.current.setPosition(position);
      }
      valueRef.current = value;
    }
  }, [value]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
};

export default MonacoEditor;
