import React, { useRef, useEffect, useState } from 'react';
import * as monaco from 'monaco-editor';
import Editor, { EditorProps, Monaco, Theme } from '@monaco-editor/react';
import { useSettingsContext } from "../context/SettingsProvider";

// 自定义弹出确认框组件
const SaveChangesDialog: React.FC<{ onConfirm: (save: boolean) => void, onCancel: () => void }> = ({ onConfirm, onCancel }) => {
  console.log("show dialog");
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white p-6 rounded-lg shadow-lg z-50">
        <p className="text-lg mb-4">Do you want to save your changes?</p>
        <div className="flex justify-end space-x-4">
          <button 
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-700"
            onClick={() => onConfirm(true)}>
            Save
          </button>
          <button 
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-700"
            onClick={() => onConfirm(false)}>
            Don't Save
          </button>
          <button 
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-700"
            onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};


interface MonacoEditorProps {
  initialValue: string;
  language: string;
  onEditorChange: (value: string) => void;
}

const MonacoEditorArea: React.FC<MonacoEditorProps> = ({ initialValue, language, onEditorChange }) => {
  const { efffectiveTheme } = useSettingsContext();
  const [edtheme, setEdtheme] = useState<Theme>(efffectiveTheme === 'dark' ? 'vs-dark' : 'light');
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [isChange, setIsChange] = useState<boolean>(false);
  const [showDialog, setShowDialog] = useState<boolean>(false); // 控制是否显示对话框

  const handleOnMount = (editor: monaco.editor.IStandaloneCodeEditor, monaco: Monaco) => {
    editorRef.current = editor;
  };

  useEffect(() => {
    if (editorRef.current) {
      if(isChange) {
        setShowDialog(true);
      } else {
        if(editorRef.current) {
          editorRef.current.setValue(initialValue);
        }
      }
    }
  }, [initialValue]);

  const handleOnChange = (value: string | undefined) => {
    if (editorRef.current) {
      if (initialValue !== value) {
        onEditorChange(value!);
        setIsChange(true);
      } else {
        setIsChange(false);
      }
    }
  };

  // // 监听用户试图离开页面时的逻辑
  // useEffect(() => {
  //   const beforeUnloadHandler = (event: BeforeUnloadEvent) => {
  //     if (isChange) {
  //       event.preventDefault();
  //       setShowDialog(true);  // 显示自定义的弹出框
  //       return (event.returnValue = ''); // 显示默认提示
  //     }
  //   };

  //   window.addEventListener('beforeunload', beforeUnloadHandler);

  //   return () => {
  //     window.removeEventListener('beforeunload', beforeUnloadHandler);
  //   };
  // }, [isChange]);

  const handleDialogConfirm = (save: boolean) => {
    if (save) {
      // 保存文件的逻辑
      console.log("Saving changes...");
      // 例如：保存文件后可以重置 isChange 状态
      if(editorRef.current) {
        const value = editorRef.current.getValue();
        onEditorChange(value);
        editorRef.current.setValue(initialValue);
      }
      setIsChange(false);
    }
    setShowDialog(false); // 关闭对话框
  };

  const handleDialogCancel = () => {
    setShowDialog(false); // 用户选择取消，关闭对话框
    setIsChange(false);
  };

  useEffect(() => {
    setEdtheme(efffectiveTheme === 'dark' ? 'vs-dark' : 'light');
  }, [efffectiveTheme]);

  const editorOptions: monaco.editor.IStandaloneEditorConstructionOptions = {
    minimap: { enabled: false },
    automaticLayout: true,
    folding: true,
    foldingStrategy: 'indentation',
    showFoldingControls: 'always',
    foldingHighlight: true,
    unfoldOnClickAfterEndOfLine: true,
  };

  return (
    <div className="relative w-full h-full"> {/* 外层容器，使用相对定位 */}
      <Editor
        language={language}
        theme={edtheme}
        defaultLanguage="xml"
        value={initialValue}
        onMount={handleOnMount}
        onChange={handleOnChange}
        options={editorOptions}
      />
      {showDialog && (
        <SaveChangesDialog
          onConfirm={handleDialogConfirm}
          onCancel={handleDialogCancel}
        />
      )}
    </div>
  );
};

export default MonacoEditorArea;
