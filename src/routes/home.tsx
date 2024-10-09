import { useState, useEffect, useCallback } from "react";
import { TreeTableView, Column } from "../components/treeview";
import { TreeItem } from '../components/TreeItem';
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";

interface Response {
  data: TreeItem[];
  error?: string;
}

export default function Home() {
  const [isResizing, setIsResizing] = useState(false);
  const [splitPosition, setSplitPosition] = useState(30); // 默认30%
  const [message, setMessage] = useState("");
  const [tableData, setTableData] = useState<TreeItem[]>([]);

  useEffect(() => {
    // 加载保存的拆分位置
    const savedPosition = localStorage.getItem('split-position');
    if (savedPosition) {
      setSplitPosition(Number(savedPosition));
    }

    // 加载其他保存的数据
    const savedData = localStorage.getItem('cachedData');
    if (savedData) {
      setTableData(JSON.parse(savedData));
    }
    const savedMessage = localStorage.getItem('framemessage');
    if (savedMessage) {
      setMessage(JSON.parse(savedMessage));
    }
  }, []);

  const startResize = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    setIsResizing(true);
    e.preventDefault();
  }, []);

  const stopResize = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isResizing) {
      const container = e.currentTarget;
      const containerRect = container.getBoundingClientRect();
      const newPosition = ((e.clientY - containerRect.top) / containerRect.height) * 100;
      const clampedPosition = Math.min(Math.max(newPosition, 20), 80); // 限制在20%-80%之间
      setSplitPosition(clampedPosition);
      localStorage.setItem('split-position', clampedPosition.toString());
    }
  }, [isResizing]);

  const handleInputChange = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const formattedValue = newValue
      .replace(/\s+/g, '')
      .replace(/(.{2})/g, '$1 ')
      .trim();

    clearTableData();
    setMessage(formattedValue);
    
    let currentRegion = localStorage.getItem('currentRegion');
    if (!currentRegion) {
      try {
        const region = await invoke<string>("get_region_value");
        localStorage.setItem('currentRegion', JSON.stringify(region));
        currentRegion = region;
      } catch (error) {
        currentRegion = "南网";
      }
    }
    
    try {
      const result = await invoke<Response>('on_text_change', { 
        message: newValue, 
        region: currentRegion
      });
      if (result.error) {
        console.log("错误信息：", result.error);
      } else {
        setTableData(result.data);
      }
    } catch (error) {
      console.error("调用后端函数出错：", error);
    }
  };

  const clearTableData = () => {
    setTableData([]);
    setMessage("");
    localStorage.setItem('cachedData', JSON.stringify([]));
    localStorage.setItem('framemessage', JSON.stringify(""));
  };

  const initialColumns: Column[] = [
    { name: '帧域', width: 50, minWidth: 100 },
    { name: '数据', width: 100, minWidth: 50 },
    { name: '说明', width: 100, minWidth: 50 },
  ];

  useEffect(() => {
    const unlisten = listen("clear-local-storage", () => {
      localStorage.clear();
      console.log("Local storage cleared.");
    });

    return () => {
      (async () => {
        try {
          const unlistenFn = await unlisten;
          unlistenFn();
        } catch (error) {
          console.error("Error while removing event listener:", error);
        }
      })();
    };
  }, []);

  useEffect(() => {
    if(tableData.length > 0) {
      localStorage.setItem('cachedData', JSON.stringify(tableData));
    }
  }, [tableData]);

  useEffect(() => {
    if (message.length > 0) {
      localStorage.setItem('framemessage', JSON.stringify(message));
    }
  }, [message]);

  const handleRowClick = (item: TreeItem) => {
    const textarea = document.querySelector('textarea');
    if (textarea && item.position && item.position.length === 2) {
      let start = item.position[0];
      let end = item.position[1];
      let length = end - start;
      length = length * 2 + (length - 1);
      start = start * 2 + start;
      end = start + length;
      textarea.setSelectionRange(start, end);
      textarea.focus();

      const computedStyle = getComputedStyle(textarea);
      const charWidth = parseInt(computedStyle.fontSize, 10);
      const lineHeight = parseInt(computedStyle.lineHeight, 10);
      const lineSpacing = lineHeight - parseInt(computedStyle.fontSize, 10);
      const lineCount = Math.floor(textarea.clientWidth / charWidth) * 2;
      const startLine = Math.floor(start / lineCount);
      textarea.scrollTop = (startLine - 1) * (lineHeight + lineSpacing);

      const startCharIndex = start % lineCount;
      const scrollLeft = startCharIndex * charWidth;
      textarea.scrollLeft = scrollLeft;
    }
  };

  return (
    <div 
      className="w-full h-full relative"
      onMouseMove={resize}
      onMouseUp={stopResize}
      onMouseLeave={stopResize}
    >
      <div
        className="absolute w-full overflow-auto"
        style={{ height: `calc(${splitPosition}% - 4px)` }}
      >
        <div className="p-[5px] h-full">
          <textarea 
            className="textarea w-full h-full text-sm textarea-bordered" 
            placeholder="请输入报文...."
            value={message}
            onChange={handleInputChange}
          />
        </div>
      </div>

      {/* 增加分割线的可点击区域和视觉反馈 */}
      <div
        className="absolute left-0 right-0 h-[8px] bg-transparent cursor-row-resize group"
        style={{ 
          top: `calc(${splitPosition}% - 4px)`,
          transition: 'background-color 0.2s'
        }}
        onMouseDown={startResize}
      >
        {/* 实际的分割线 */}
        <div className="absolute left-0 right-0 h-[1px] top-[3.5px] group-hover:bg-blue-500 group-active:bg-blue-600" />
      </div>

      <div
        className="absolute w-full overflow-auto"
        style={{ 
          top: `calc(${splitPosition}% + 4px)`,
          height: `calc(${100 - splitPosition}% - 4px)`
        }}
      >
        <div className="p-[5px] h-full">
          <TreeTableView 
            data={tableData}
            initialColumns={initialColumns}
            onRowClick={handleRowClick}
          />
        </div>
      </div>
    </div>
  );
}