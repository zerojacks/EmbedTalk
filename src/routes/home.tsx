import { TreeItemType } from '../components/TreeItem';
import { invoke } from "@tauri-apps/api/core";
import Split from 'react-split';
import { useFrameTreeStore } from '../stores/useFrameAnalysicStore';
import { useEffect, useRef, useState } from "react";
import { useProtocolInfoStore } from '../stores/useProtocolInfoStore';
import { toast } from "../context/ToastProvider";
import { TreeTableView } from "../components/TreeTable";
import { TreeTable, Column } from "../components/treeview";
import { listen } from '@tauri-apps/api/event';
import { PraseFrame, createPraseFrame, updatePraseFrame, deletePraseFrame, getPraseFrames, searchPraseFrames, getPraseFramesByDateRange } from '../utils/database';
import { HistoryDrawer } from "../components/HistoryDrawer";
import { useShortcuts } from "../context/ShortcutProvider";

const initialColumns: Column[] = [
  { name: '帧域', width: 30, minWidth: 100 },
  { name: '数据', width: 30, minWidth: 50 },
  { name: '说明', width: 40, minWidth: 50 },
];

interface Response {
  data: TreeItemType[];
  error?: string;
}

export default function Home() {
  const {
    tabledata,
    frame,
    splitSize,
    selectedframe,
    frameScroll,
    setTableData,
    setFrame,
    setSplitSize,
    setSelectedFrame,
    setFrameScroll,
  } = useFrameTreeStore();

  const { region, setRegion } = useProtocolInfoStore();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  
  const handleInputChange = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const formattedValue = newValue
      .replace(/\s+/g, '')
      .replace(/(.{2})/g, '$1 ')
      .trim()
      .toUpperCase();

    clearTableData();
    setFrame(formattedValue);

    if (formattedValue === "") {
      return;
    }

    createPraseFrame(formattedValue);

    let currentRegion = region;
    if (region === "") {
      try {
        currentRegion = await invoke<string>("get_region_value");
      } catch (error) {
        currentRegion = "南网";
      }
      setRegion(currentRegion);
    }
    
    try {
      const result = await invoke<Response>('on_text_change', { 
        message: newValue, 
        region: currentRegion
      });
      if (result.error) {
        toast.error("解析失败！");
        console.log("错误信息：", result.error);
      } else {
        setTableData(result.data);
      }
    } catch (error) {
      console.error("调用后端函数出错：", error);
      toast.error("解析失败！");
    }
  };

  const clearTableData = () => {
    setTableData([]);
    setFrame("");
  };

  const handleRowClick = (item: TreeItemType) => {
    if (item.position && item.position.length === 2) {
      let start = item.position[0];
      let end = item.position[1];
      let length = end - start;
      length = length * 2 + (length - 1);
      start = start * 2 + start;
      end = start + length;
      setSelectedFrame([start, end]);
    }
  };

  useEffect(() => {
    const start = selectedframe[0];
    const end = selectedframe[1];
    const textarea = textareaRef.current;
    if(textarea) {
      textarea.setSelectionRange(start, end);
      textarea.focus();
  
      const computedStyle = getComputedStyle(textarea);
      const charWidth = parseInt(computedStyle.fontSize, 10);
      const lineHeight = parseInt(computedStyle.lineHeight, 10);
      const lineSpacing = lineHeight - parseInt(computedStyle.fontSize, 10);
      const lineCount = Math.floor(textarea.clientWidth / charWidth) * 2;
      const startLine = Math.floor(start / lineCount);
      const scrollTop = (startLine - 1) * (lineHeight + lineSpacing);
      const startCharIndex = start % lineCount;
      const scrollLeft = startCharIndex * charWidth;
      setFrameScroll([scrollTop, scrollLeft]);
    }

  }, [selectedframe]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if(textarea) {
      const scrollTop = frameScroll[0];
      const scrollLeft = frameScroll[1];
      textarea.scrollTop = scrollTop;
      textarea.scrollLeft = scrollLeft;
    }

  },[frameScroll])

  const handleDragEnd = (sizes: number[]) => {
    setSplitSize(sizes);
  };

  const handleParse = async (text: string) => {
    try {
      const formattedValue = text
        .replace(/\s+/g, '')
        .replace(/(.{2})/g, '$1 ')
        .trim()
        .toUpperCase();

      clearTableData();
      setFrame(formattedValue);

      if (formattedValue === "") {
        return;
      }

      let currentRegion = region;
      if (region === "") {
        try {
          currentRegion = await invoke<string>("get_region_value");
        } catch (error) {
          currentRegion = "南网";
        }
        setRegion(currentRegion);
      }
      
      try {
        const result = await invoke<Response>('on_text_change', { 
          message: formattedValue, 
          region: currentRegion
        });
        if (result.error) {
          toast.error("解析失败！");
          console.log("错误信息：", result.error);
        } else {
          setTableData(result.data);
        }
      } catch (error) {
        console.error("调用后端函数出错：", error);
        toast.error("解析失败！");
      }
    } catch (error) {
      console.error('解析失败:', error);
    }
  };

  const { historyVisible, setHistoryVisible } = useShortcuts();

  const handleFrameSelect = (selectedFrame: string) => {
    handleParse(selectedFrame);
  };

  return (
    <>
      <div className="flex flex-col h-screen">
        <Split
          direction="vertical"
          sizes={splitSize}
          minSize={[20, 10]}
          gutterSize={2}
          snapOffset={30}
          dragInterval={0}
          onDragEnd={handleDragEnd}
          className="flex flex-col w-full h-full"
        >
        <div className="w-full overflow-hidden" >
          <div className="p-[5px] h-full">
            <textarea 
              ref={textareaRef}
              className="textarea w-full h-full text-sm textarea-bordered" 
              placeholder="请输入报文...."
              value={frame}
              onChange={handleInputChange}
            />
          </div>
        </div>

        <div className="w-full border-b-2 border-transparent">
          <div className="p-[5px] h-full overflow-auto" style={{width: "99.99%"}}>
            <TreeTable 
              data={tabledata}
              tableheads={initialColumns}
              onRowClick={handleRowClick}
            />
          </div>
        </div>
        </Split>
      </div>
      <HistoryDrawer 
        onSelectFrame={handleFrameSelect} 
        visible={historyVisible}
        onClose={() => setHistoryVisible(false)}
      />
    </>
  );
}