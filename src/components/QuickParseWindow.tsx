import React, { useState, useEffect, useRef } from 'react';
import { currentMonitor, getCurrentWindow, LogicalPosition, LogicalSize } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { writeText, readText } from '@tauri-apps/plugin-clipboard-manager';
import { toast } from "../context/ToastProvider";
import { TreeTable, Column } from '../components/treeview';
import { primaryMonitor } from '@tauri-apps/api/window';

interface Response {
  data: any[];
  error?: string;
}

const INPUT_HEIGHT_DEFAULT = 40;  // 默认输入框高度
const INPUT_HEIGHT_EXPANDED = 100; // 展开后输入框的高度
const WINDOW_HEIGHT_EXPANDED = 500; // 展开后窗口高度

const tableheads: Column[] = [
  { name: '帧域', width: 30, minWidth: 100 },
  { name: '数据', width: 30, minWidth: 50 },
  { name: '说明', width: 40, minWidth: 50 },
];

const QuickParseWindow: React.FC = () => {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<any>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [isFirstParse, setIsFirstParse] = useState(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const windowRef = useRef<Awaited<ReturnType<typeof getCurrentWindow>>>();
  const containerRef = useRef<HTMLDivElement>(null);

  const resetWindowSize = async () => {
    if (windowRef.current) {
      await windowRef.current.setSize(new LogicalSize(500, 52));
      // 重置后聚焦输入框
      inputRef.current?.focus();
      setIsFirstParse(true);
      setInput('');
      setResult(null);
    }
  };

  useEffect(() => {
    // 组件挂载时聚焦输入框
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    let moveTimeout: NodeJS.Timeout | null = null;
    let resizeTimeout: NodeJS.Timeout | null = null;

    const setupWindowListeners = async () => {
      const tauriWindow = await getCurrentWindow();
      windowRef.current = tauriWindow;

      // 监听窗口显示事件
      const unlistenShow = await tauriWindow.listen('tauri://focus', () => {
        // 窗口显示时聚焦输入框
        setTimeout(() => {
          resetWindowSize();
          inputRef.current?.focus();
        }, 100);
      });

      // 监听窗口移动事件
      const unlistenMove = await tauriWindow.listen('tauri://move', async () => {
        if (moveTimeout) {
          clearTimeout(moveTimeout);
        }
        moveTimeout = setTimeout(async () => {
          const position = await tauriWindow.innerPosition();
          const monitor = await currentMonitor();
          await invoke('update_window_position', { 
            x: position.x, 
            y: position.y,
            monitor_id: monitor?.name
          });
        }, 500);
      });

      // 监听窗口大小调整事件
      const unlistenResize = await tauriWindow.listen('tauri://resize', () => {
        setIsResizing(true);
        if (resizeTimeout) {
          clearTimeout(resizeTimeout);
        }
        resizeTimeout = setTimeout(() => {
          setIsResizing(false);
        }, 200);
      });

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          if (!result) {
            // 如果没有结果，直接隐藏窗口
            tauriWindow.hide();
          } else {
            // 如果有结果，先清空结果并重置窗口大小
            setResult(null);
            setInput('');
            resetWindowSize();
          }
        }
      };

      window.addEventListener('keydown', handleKeyDown);

      return () => {
        if (resizeTimeout) {
          clearTimeout(resizeTimeout);
        }
        if (moveTimeout) {
          clearTimeout(moveTimeout);
        }
        unlistenShow();
        unlistenMove();
        unlistenResize();
        window.removeEventListener('keydown', handleKeyDown);
      };
    };

    setupWindowListeners();
  }, [result]);

  const handleParse = async (text: string) => {
    if (!text.trim()) {
      setResult(null);
      await resetWindowSize();
      return;
    }

    const formattedValue = text
      .replace(/\s+/g, '')
      .replace(/(.{2})/g, '$1 ')
      .trim()
      .toUpperCase();

    try {
      let currentRegion = "";
      try {
        currentRegion = await invoke<string>("get_region_value");
      } catch (error) {
        currentRegion = "南网";
      }

      const result = await invoke<Response>('on_text_change', { 
        message: formattedValue, 
        region: currentRegion
      });

      if (result.error) {
        setResult(null);
        toast.error(result.error);
      } else {
        setResult(result.data);
        // 只在第一次解析时调整窗口大小
        if (isFirstParse && windowRef.current) {
          await windowRef.current.setSize(new LogicalSize(500, 300));
          await windowRef.current.setResizable(true);
          setIsFirstParse(false);
        }
      }
    } catch (error) {
      console.error('Parse error:', error);
      setResult(null);
      toast.error("解析失败");
    }
  };

  const handleInputChange = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);
    handleParse(value);
  };

  const handleRowClick = (item: any) => {
    console.log('Row clicked:', item);
  };

  return (
    <div 
      ref={containerRef}
      className="h-[100vh] bg-base-300/95 rounded-lg overflow-hidden select-none"
      data-tauri-drag-region // 使整个容器可拖动
    >
      <div className="h-full p-1.5 gap-1.5 flex flex-col">
        {/* 输入区域 */}
        <div 
          className={`relative transition-all duration-300 ease-in-out
            ${result ? 'h-1/3' : 'h-full'}
            bg-base-100/50 rounded-lg backdrop-blur-sm
            ${isResizing ? '' : 'transition-all duration-300 ease-in-out'}
            hover:bg-base-100/60 focus-within:bg-base-100/70`}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            placeholder="粘贴要解析的报文..."
            className="w-full h-full bg-transparent text-base-content
                    p-2 resize-none font-mono text-sm focus:outline-none
                    placeholder:text-base-content/50 select-text scrollbar-none" // 隐藏输入框滚动条
            onMouseDown={e => e.stopPropagation()} // 阻止输入框的拖动事件冒泡
          />
        </div>

        {/* 结果区域 */}
        {result && (
          <div 
            className={`flex-1 bg-base-100/50 rounded-lg p-2
                      backdrop-blur-sm font-mono text-sm text-base-content
                      ${isResizing ? '' : 'transition-all duration-300 ease-in-out'}
                      hover:bg-base-100/60 overflow-y-auto overflow-x-hidden
                      scrollbar-thin scrollbar-track-base-200/50 
                      scrollbar-thumb-base-content/20 hover:scrollbar-thumb-base-content/30`}
            onMouseDown={e => e.stopPropagation()} // 允许选择文本而不触发拖动
          >
            <TreeTable 
              data={result} 
              tableheads={tableheads}
              onRowClick={handleRowClick}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default QuickParseWindow;
