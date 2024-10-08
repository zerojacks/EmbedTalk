import { useState, useEffect, useRef } from "react";
import reactLogo from "../assets/react.svg";
import { invoke } from "@tauri-apps/api/core";
import { TreeTableView, Column } from "../components/treeview";
import { TreeItem } from '../components/TreeItem';
import Split from 'react-split';
import { listen } from "@tauri-apps/api/event";

interface Response {
  data: TreeItem[];
  error?: string;
}

export default function Home() {
  const [splitSizes, setSplitSizes] = useState([30, 70]); // 初始化拆分比例
  const [message, setMessage] = useState("");
  const [tableData, setTableData] = useState<TreeItem[]>([]); // 初始化表格data

  const handleInputChange = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const formattedValue = newValue
    .replace(/\s+/g, '') // Remove all whitespace
    .replace(/(.{2})/g, '$1 ') // Add a space after every two characters
    .trim(); // Remove any trailing space

    clearTableData();
    setMessage(formattedValue);
    console.log(formattedValue);
    let currentRegion = localStorage.getItem('currentRegion');
    if (!currentRegion) {
      try {
        const region = await invoke<string>("get_region_value"); // 调用后端接口获取选中的省份
        localStorage.setItem('currentRegion', JSON.stringify(region));
        currentRegion = region;
      } catch (error) {
        currentRegion="南网";
      }
    }
    
    // 调用后端 Rust 函数，传递文本框内容
    try {
      const result = await invoke<Response>('on_text_change', { message: newValue, region: currentRegion});
      if (result.error) {
        console.log("错误信息：", result.error);
      } else {
        setTableData(result.data); // 直接将结果设置为 TreeItem 类型
      }
    } catch (error) {
      console.error("调用后端函数出错：", error);
    }
  };

  const clearTableData = () => {
    setTableData([]); // Clear the table data
    setMessage(""); // Clear the input message
    localStorage.setItem('cachedData', JSON.stringify([])); // Save empty array to localStorage
    localStorage.setItem('framemessage', JSON.stringify(""));
  };

  const initialColumns: Column[] = [
    { name: '帧域', width: 50, minWidth: 100 },
    { name: '数据', width: 100, minWidth: 50 },
    { name: '说明', width: 100, minWidth: 50 },
  ];

  useEffect(() => {
    // 监听自定义事件 "clear-local-storage"
    const unlisten = listen("clear-local-storage", () => {
      localStorage.clear(); // 清空所有本地存储
      console.log("Local storage cleared.");
    });

    // 返回清理函数
    return () => {
      (async () => {
        try {
          const unlistenFn = await unlisten; // 等待 Promise 解析
          unlistenFn(); // 调用 UnlistenFn 移除事件监听器
        } catch (error) {
          console.error("Error while removing event listener:", error);
        }
      })();
    };
  }, []);

  
  useEffect(() => {
    // 加载本地存储中的拆分比例
    const savedSizes = JSON.parse(localStorage.getItem('split-sizes') as string);
    if (savedSizes) {
      setSplitSizes(savedSizes);
    }
    const savedData = localStorage.getItem('cachedData');
    if (savedData) {
      console.log("加载本地缓存数据：", JSON.parse(savedData));
      setTableData(JSON.parse(savedData));
    }
    const savedMessage = localStorage.getItem('framemessage');
    if (savedMessage) {
      setMessage(JSON.parse(savedMessage));
    }
  }, []);

  useEffect(() => {
    if(tableData.length > 0) {
      console.log("保存数据到本地存储：", tableData.length);
      localStorage.setItem('cachedData', JSON.stringify(tableData));
    }
  }, [tableData]);

  useEffect(() => {
    // 保存拆分比例到本地存储
    if (message.length > 0) {
      localStorage.setItem('framemessage', JSON.stringify(message));
    }
  }, [message]);

  const handleSplitChange = (sizes: Array<number>) => {
    setSplitSizes(sizes);
    localStorage.setItem('split-sizes', JSON.stringify(sizes)); // 保存拆分比例到本地存储
  };

  const handleRowClick = (item: TreeItem) => {
    const textarea = document.querySelector('textarea');
    if (textarea && item.position && item.position.length === 2) {
      let start = item.position[0]; // 开始索引
      let end = item.position[1]; // 结束索引
      let length = end - start;
      length = length * 2 + (length - 1);
      start = start * 2 + start
      end = start + length
      textarea.setSelectionRange(start, end);
      textarea.focus(); // 聚焦到 textarea

      // 获取字符宽度和行高
      const computedStyle = getComputedStyle(textarea);
      const charWidth = parseInt(computedStyle.fontSize, 10); // 字符宽度
      const lineHeight = parseInt(computedStyle.lineHeight, 10); // 行高
      const lineSpacing = lineHeight - parseInt(computedStyle.fontSize, 10); // 行间距
      // 计算行数
      const lineCount = Math.floor(textarea.clientWidth / charWidth) * 2;
      const startLine = Math.floor(start / lineCount);
      // 设置滚动位置，确保整个字符可见
      textarea.scrollTop = (startLine - 1) * (lineHeight + lineSpacing);

      // 计算并设置水平滚动位置
      const startCharIndex = start % lineCount;
      const scrollLeft = startCharIndex * charWidth;

      // 增加偏移量确保字符可见
      textarea.scrollLeft = scrollLeft; // 调整偏移量
    }
  };
  

  return (
    <div className="w-full h-full">
      <Split
        className="w-full h-full"
        sizes={splitSizes}
        direction="vertical"
        minSize={100}
        expandToMin={false}
        gutterSize={10}
        gutterAlign="center"
        snapOffset={30}
        dragInterval={1}
        cursor="col-resize"
        onDragEnd={handleSplitChange} // 当用户调整拆分时保存比例
      >
        <div className="flex flex-col w-full h-full p-[5px] space-y-4">
          <div className="h-full">
            <textarea 
              className="textarea w-full h-full text-sm textarea-bordered" 
              placeholder="请输入报文...."
              value={message}
              onChange={handleInputChange}  // 监听内容变化
            ></textarea>
          </div>
        </div>
        {/* <div className="flex flex-col w-full h-full p-[5px] space-y-4">

        </div> */}
        <div className="flex flex-col w-full h-full p-[5px] space-y-4">
            <TreeTableView 
              data={tableData} initialColumns={initialColumns} onRowClick={handleRowClick}
            />
        </div>
      </Split>
    </div>
  );
}
