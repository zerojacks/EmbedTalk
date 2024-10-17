import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as monaco from 'monaco-editor';
import Editor, { EditorProps, Monaco, Theme } from '@monaco-editor/react';
import { useSettingsContext } from "../context/SettingsProvider";
import { toast } from "../context/ToastProvider";

// 自定义弹出确认框组件
const SaveChangesDialog: React.FC<{ onConfirm: (save: boolean) => void, onCancel: () => void }> = ({ onConfirm, onCancel }) => {
  console.log('save changes dialog');
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="modal-box space-x-4">
        <p className="py-4">是否保存当前更改</p>
        <div className="modal-action flex">
          <button className="btn flex items-center justify-center rounded hover:bg-blue-700" onClick={() => onConfirm(true)}>是</button>
          <button className="btn flex items-center justify-center rounded hover:bg-gray-700" onClick={() => onConfirm(false)}>否</button>
          <button className="btn flex items-center justify-center rounded hover:bg-red-700" onClick={() => onCancel()}>取消</button>
        </div>
      </div>
    </div>

  );
};


interface MonacoEditorProps {
  initialValue: string;
  language: string;
  onEditorChange: (value: string) => Promise<string | null>;
}

const MonacoEditorArea: React.FC<MonacoEditorProps> = ({ initialValue, language, onEditorChange }) => {
  const { efffectiveTheme } = useSettingsContext();
  const [edtheme, setEdtheme] = useState<Theme>(efffectiveTheme === 'dark' ? 'vs-dark' : 'light');
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [isChange, setIsChange] = useState<boolean>(false);
  const [showDialog, setShowDialog] = useState<boolean>(false); // 控制是否显示对话框
  const [textvalue, setTextvalue] = useState<string>(initialValue);
  const editvalueRef = useRef<string>(initialValue);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleOnMount = (editor: monaco.editor.IStandaloneCodeEditor, monaco: Monaco) => {
    editorRef.current = editor;
  };

  useEffect(() => {
    if (editorRef.current) {
      if (isChange) {
        if (editvalueRef.current !== initialValue) {
          setShowDialog(true);
        }
      } else {
        if(initialValue !== editvalueRef.current) {
          editvalueRef.current = initialValue;
          editorRef.current.setValue(initialValue);
        }
      }
    }
  }, [initialValue]);

  const handleOnChange = useCallback(async (value: string | undefined) => {
    if (editorRef.current) {
      if (initialValue !== value) {
        setIsChange(true);
      } else {
        setIsChange(false);
      }
      editvalueRef.current = value!;

      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set a new timeout
      timeoutRef.current = setTimeout(async () => {
        try {
          const result = await onEditorChange(value!);
          if (result) {
            // If result is not null, an error occurred
            setIsChange(true);
          } else {
            setIsChange(false);
          }
        } catch (error) {
          setIsChange(true);
        }
      }, 1000); // 1000ms delay, adjust as needed
    }
  }, [initialValue, onEditorChange]);

  async function handleDialogConfirm(save: boolean) {
    if (save) {
      console.log("Saving changes...");
      if (editorRef.current) {
        const value = editorRef.current.getValue();

        try {
          const result = await onEditorChange(value);
          
          if (result) {
            // If result is not null, an error occurred
            // console.error("Error parsing XML:", result);
            toast.error("XML 格式错误");
          } else {
            // Success, reset editor to initial value
            editorRef.current.setValue(initialValue);
          }
        } catch (error) {
          console.error("Error saving changes:", error);
        }
      }
      setIsChange(false);
      // Mark changes as saved
    } else {
      setIsChange(false);
      if (editorRef.current) {
        editorRef.current.setValue(initialValue);
      }
    }
    // Close the dialog
    setShowDialog(false);
  }
  
  
  const handleDialogCancel = () => {
    setShowDialog(false); // 用户选择取消，关闭对话框
    setIsChange(false);
    console.log("Canceling changes...", initialValue);
    if (editorRef.current) {
      editorRef.current.setValue(initialValue);
      // setTextvalue(initialValue);
    }
  };

  useEffect(() => {
    setEdtheme(efffectiveTheme === 'dark' ? 'vs-dark' : 'light');
  }, [efffectiveTheme]);

  const editorOptions: monaco.editor.IStandaloneEditorConstructionOptions = {
    minimap: { enabled: true },
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
        value={textvalue}
        onMount={handleOnMount}
        onChange={handleOnChange}
        options={editorOptions}
        className="w-full h-full m-2 flex items-center overflow-hidden"
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
