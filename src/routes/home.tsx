import { TreeItemType } from '../components/TreeItem';
import { invoke } from "@tauri-apps/api/core";
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
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useDispatch, useSelector } from 'react-redux';
import { selectSplitSize, setSplitSize } from '../store/slices/splitSizeSlice';

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
    selectedframe,
    frameScroll,
    setTableData,
    setFrame,
    setSelectedFrame,
    setFrameScroll,
  } = useFrameTreeStore();

  const dispatch = useDispatch();
  const splitSize = useSelector(selectSplitSize);
  const { historyVisible, setHistoryVisible } = useShortcuts();
  const { region, setRegion } = useProtocolInfoStore();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const handlePanelResize = (sizes: number[]) => {
    dispatch(setSplitSize(sizes));
  };
  
  const handleInputChange = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    handleParse(newValue);
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

  const handleFrameSelect = (selectedFrame: string) => {
    handleParse(selectedFrame);
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
          console.log("******", result.data)
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

  return (
    <div className="flex flex-col h-full">
      <PanelGroup direction="vertical" className="flex-grow" onLayout={handlePanelResize}>
        <Panel defaultSize={splitSize[0]} minSize={0}>
          <div className="h-full p-2">
            <textarea
              ref={textareaRef}
              className="textarea textarea-bordered w-full h-full font-mono"
              value={frame}
              onChange={handleInputChange}
              placeholder="请输入要解析的报文..."
            />
          </div>
        </Panel>
        <PanelResizeHandle className="h-0.5 bg-base-300 hover:bg-primary/50 transition-colors cursor-row-resize" />
        <Panel defaultSize={splitSize[1]} minSize={30}>
          <div className="h-full p-2">
            <TreeTable
              data={tabledata}
              tableheads={initialColumns}
              onRowClick={handleRowClick}
            />
          </div>
        </Panel>
      </PanelGroup>
      <HistoryDrawer 
        onSelectFrame={handleFrameSelect} 
        visible={historyVisible}
        onClose={() => setHistoryVisible(false)}
      />
    </div>
  );
}