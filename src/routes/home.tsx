import { TreeItemType } from '../components/TreeItem';
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
import { getApi } from '../api';
import { getRegions } from '../utils/region';

const protocolTypes = [
  { value: "auto", label: "自适应" },
  { value: "nanwang13", label: "南网13" },
  { value: "dlt645", label: "DLT-645" },
  { value: "nanwang16", label: "南网16" },
  { value: "task", label: "任务方案" },
  { value: "other", label: "其他" }
];

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
    protocol,
    region, 
    setTableData,
    setFrame,
    setSelectedFrame,
    setFrameScroll,
    setProtocol,
    setRegion,
  } = useFrameTreeStore();
  const dispatch = useDispatch();
  const splitSize = useSelector(selectSplitSize);
  const { historyVisible, setHistoryVisible } = useShortcuts();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  function cleanAndUppercase(targetRegion: string) {
    let cleaned = targetRegion;
    cleaned = cleaned.replace(/"/g, '');
    cleaned = cleaned.toUpperCase();
    return cleaned;
}
  useEffect(() => {
    const loadInitialData = async () => {
      const api = await getApi();
      try {
        const currentRegion = await api.getRegion();
        let cleanRegion = cleanAndUppercase(currentRegion);
        setRegion(cleanRegion);
        console.log("currentRegion set to:", cleanRegion);
      } catch (error) {
        console.error("Failed to get region:", error);
        setRegion("南网"); // Fallback
      }
    };
    if(region === "") {
      loadInitialData();
    }
  }, [setRegion]);

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

  const handleParse = async (text: string, region: string = "") => {
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

      const api = await getApi();
      
      try {
        console.log("formattedValue", formattedValue)
        console.log("region", region)
        if(region === "") {
          try {
            region = await api.getRegion();
            region = cleanAndUppercase(region);
            setRegion(region);
          } catch (error) {
            console.error("获取选中的省份失败: ", error);
            region = "南网";
          }
        }
        const result = await api.parseFrame(formattedValue, region);
        if (result.error) {
          toast.error("解析失败！");
          console.log("错误信息：", result.error);
        } else {
          console.log("******", result.data);
          setTableData(result.data);
          // 更新协议类型
          if (result.protocol) {
            setProtocol(result.protocol);
          }
          // 更新区域
          if (result.region) {
            setRegion(result.region);
          }
        }
      } catch (error) {
        console.error("解析失败:", error);
        toast.error("解析失败！");
      }
    } catch (error) {
      console.error('解析失败:', error);
    }
  };

  const handle_region_change = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRegion = e.target.value;
    console.log("newRegion", newRegion);
    setRegion(newRegion);
    if (frame) handleParse(frame, newRegion);
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
          <div className="h-full p-2 flex flex-col">
            <div className="h-full flex flex-col">
              {/* 操作区：固定高度 */}
              <div className="bg-base-100 rounded shadow p-1 mb-2 flex flex-wrap items-center gap-3 shrink-0 text-xs">
                <div className="flex items-center gap-8 flex-wrap">
                {/* 解析结果组 */}
                <div className="flex items-center gap-1">
                  <label className="text-xs font-semibold text-gray-700">解析结果:</label>
                  <label className="text-xs font-normal">协议类型:</label>
                  <span
                    className="badge badge-info px-3 py-1 text-xs"
                    style={{ fontWeight: 500, letterSpacing: 1 }}
                  >
                    {protocol || '自适应'}
                  </span>
                </div>
                {/* 省份组 */}
                <div className="flex items-center gap-1">
                  <label className="text-xs font-normal">省份:</label>
                  <select 
                    className="select select-bordered select-xs min-w-[70px]"
                    value={region}
                    onChange={handle_region_change}
                  >
                    {getRegions().map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>
              </div>
              {/* 表格区：占满剩余空间 */}
              <div className="flex-grow min-h-0">
                <TreeTable
                  data={tabledata}
                  tableheads={initialColumns}
                  onRowClick={handleRowClick}
                />
              </div>
            </div>
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