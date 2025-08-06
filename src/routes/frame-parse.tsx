import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { TreeItemType } from '../components/TreeItem';
import { useFrameTreeStore } from '../stores/useFrameAnalysicStore';
import { useProtocolInfoStore } from '../stores/useProtocolInfoStore';
import { toast } from "../context/ToastProvider";
import { TreeTable, Column } from "../components/treeview";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useDispatch, useSelector } from 'react-redux';
import { selectSplitSize, setSplitSize } from '../store/slices/splitSizeSlice';
import { desktopApi } from '../api/desktop';
import { cleanAndUppercase, getRegions } from '../utils/region';

const initialColumns: Column[] = [
  { name: '帧域', width: 30, minWidth: 100 },
  { name: '数据', width: 30, minWidth: 50 },
  { name: '说明', width: 40, minWidth: 50 },
];



export default function FrameParse() {
  const [searchParams] = useSearchParams();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // 初始化状态
  const [currentFrameContent] = useState(searchParams.get('frameContent') || '');

  // Store状态
  const {
    tabledata,
    selectedframe,
    protocol,
    region,
    setTableData,
    setFrame,
    setSelectedFrame,
    setProtocol,
    setRegion,
  } = useFrameTreeStore();

  const dispatch = useDispatch();
  const splitSize = useSelector(selectSplitSize);
  const { region: storeRegion, setRegion: setStoreRegion } = useProtocolInfoStore();

  // 优化的面板大小调整处理
  const handlePanelResize = useCallback((sizes: number[]) => {
    dispatch(setSplitSize(sizes));
  }, [dispatch]);

  // 优化的滚动处理
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || selectedframe.length !== 2) return;

    const [start, end] = selectedframe;

    // 设置选中范围
    textarea.setSelectionRange(start, end);
    textarea.focus();

    // 计算滚动位置
    const computedStyle = getComputedStyle(textarea);
    const charWidth = parseInt(computedStyle.fontSize, 10);
    const lineHeight = parseInt(computedStyle.lineHeight, 10);
    const lineSpacing = lineHeight - parseInt(computedStyle.fontSize, 10);
    const lineCount = Math.floor(textarea.clientWidth / charWidth) * 2;
    const startLine = Math.floor(start / lineCount);
    const scrollTop = Math.max(0, (startLine - 1) * (lineHeight + lineSpacing));
    const startCharIndex = start % lineCount;
    const scrollLeft = startCharIndex * charWidth;

    // 直接设置滚动位置，避免额外的状态更新
    textarea.scrollTop = scrollTop;
    textarea.scrollLeft = scrollLeft;
  }, [selectedframe]);

  // 格式化输入文本
  const formatHexText = useCallback((text: string) => {
    return text
      .replace(/\s+/g, '')
      .replace(/(.{2})/g, '$1 ')
      .trim()
      .toUpperCase();
  }, []);

  // 解析报文数据
  const handleParse = useCallback(async (text: string, region: string = "") => {
    if (!text.trim()) {
      setTableData([]);
      return;
    }

    const formattedValue = formatHexText(text);
    setFrame(formattedValue);

    // 更新输入框显示格式化后的内容
    if (textareaRef.current && textareaRef.current.value !== formattedValue) {
      const cursorPosition = textareaRef.current.selectionStart;
      textareaRef.current.value = formattedValue;
      // 尝试保持光标位置
      textareaRef.current.setSelectionRange(cursorPosition, cursorPosition);
    }
    parseFrame(formattedValue, region);

  }, [setFrame, setTableData, formatHexText]);

  const parseFrame = async function (formattedValue: string, region: string = "") {
    try {
      // 获取区域配置
      let currentRegion = region;
      if (!currentRegion) {
        currentRegion = storeRegion;
        if (!currentRegion) {
          try {
            currentRegion = await desktopApi.getRegion();
          } catch (error) {
            currentRegion = "南网";
          }
        }
        currentRegion = cleanAndUppercase(currentRegion);
        setStoreRegion(currentRegion);
      }
      // 如果传入了region，则直接clean并用它
      else {
        currentRegion = cleanAndUppercase(currentRegion);
      }
      setRegion(currentRegion);
      // 解析报文
      const result = await desktopApi.parseFrame(formattedValue, currentRegion);
      if (result.error) {
        toast.error("解析失败！");
        console.error("解析错误：", result.error);
        setTableData([]);
        setProtocol("自适应");
      } else {
        setTableData(result.data);
        if(result.protocol) {
          setProtocol(result.protocol);
        }
        // 不再 setRegion(result.region)，避免覆盖用户选择
      }
    } catch (error) {
      console.error("解析失败:", error);
      toast.error("解析失败！");
      setTableData([]);
      setProtocol("自适应");
    }
  }
  
  // 输入变化处理
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const inputValue = e.target.value;
    handleParse(inputValue);
  }, [handleParse]);

  // 初始化和事件监听
  useEffect(() => {
    const currentWindow = getCurrentWindow();
    let unlistenFn: (() => void) | null = null;

    const setupWindow = async () => {
      try {
        // 初始化内容
        if (currentFrameContent && textareaRef.current) {
          // 先设置原始内容，然后通过handleParse格式化
          textareaRef.current.value = currentFrameContent;
          await handleParse(currentFrameContent);
        }

        // 设置事件监听
        await currentWindow.emit('parse-window-ready', { ready: true });

        const unlisten = await currentWindow.listen('update-frame-content', (event) => {
          const { frameContent } = event.payload as { frameId: string; frameContent: string };
          if (textareaRef.current) {
            textareaRef.current.value = frameContent;
            handleParse(frameContent);
          }
          currentWindow.setTitle("报文解析");
        });

        return unlisten;
      } catch (error) {
        console.error('窗口初始化失败:', error);
        return null;
      }
    };

    setupWindow().then(fn => {
      unlistenFn = fn;
    }).catch(error => {
      console.error('设置窗口失败:', error);
    });

    // 添加页面级别的beforeunload处理，确保不阻止窗口关闭
    const handleBeforeUnload = () => {
      // 不设置returnValue，允许页面卸载
      console.log('FrameParse页面即将卸载');
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // 添加键盘快捷键测试关闭功能
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        console.log('ESC键被按下，尝试关闭窗口');
        currentWindow.close().catch(error => {
          console.error('通过ESC关闭窗口失败:', error);
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      // 清理事件监听器 - 添加更安全的检查
      if (unlistenFn && typeof unlistenFn === 'function') {
        try {
          unlistenFn();
        } catch (error) {
          console.error('清理事件监听器失败:', error);
        }
      }

      try {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        window.removeEventListener('keydown', handleKeyDown);
      } catch (error) {
        console.error('移除事件监听器失败:', error);
      }

      console.log('FrameParse组件清理完成');
    };
  }, [currentFrameContent, handleParse]);

  // 行点击处理
  const handleRowClick = useCallback((item: TreeItemType) => {
    if (item.position && item.position.length === 2) {
      const [start, end] = item.position;
      const length = end - start;
      const formattedLength = length * 2 + (length - 1);
      const formattedStart = start * 2 + start;
      const formattedEnd = formattedStart + formattedLength;
      setSelectedFrame([formattedStart, formattedEnd]);
    }
  }, [setSelectedFrame]);

  // 优化表格渲染
  const tableContent = useMemo(() => {
    if (tabledata.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-base-content/40">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-base-300/30 rounded-full flex items-center justify-center">
              <span className="text-2xl">📊</span>
            </div>
            <p className="text-sm">等待报文数据解析...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="h-full overflow-hidden">
        <TreeTable
          data={tabledata}
          tableheads={initialColumns}
          onRowClick={handleRowClick}
        />
      </div>
    );
  }, [tabledata, handleRowClick]);

  const handle_region_change = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedRegion = e.target.value;
    setRegion(selectedRegion);
    // 立即用最新选择的省份重新解析
    parseFrame(textareaRef.current?.value || '', selectedRegion);
  };

  return (
    <div className="flex flex-col h-screen bg-base-100">
      {/* 主内容区域 */}
      <div className="flex-1 overflow-hidden p-2">
        <PanelGroup direction="vertical" onLayout={handlePanelResize}>
          {/* 输入面板 */}
          <Panel defaultSize={splitSize[0]} minSize={25}>
            <div className="flex flex-col h-full bg-gradient-to-br from-base-100 to-base-200/30 rounded-lg border border-base-300/30">
              <div className="px-4 py-3 border-b border-base-300/30">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 bg-blue-500 rounded-full"></div>
                  <label className="text-sm font-semibold text-base-content">
                    报文数据输入
                  </label>
                  <div className="flex-1"></div>
                  <span className="text-xs text-base-content/50 font-mono bg-base-200/50 px-2 py-1 rounded">
                    HEX格式
                  </span>
                </div>
              </div>
              <div className="flex-1 p-4">
                <textarea
                  ref={textareaRef}
                  className="textarea textarea-bordered w-full h-full resize-none font-mono text-sm bg-base-100/80 backdrop-blur-sm border-2 focus:border-primary focus:bg-base-100 transition-all duration-200"
                  placeholder="输入十六进制报文数据，例如：68 04 00 43 01 16 ..."
                  onChange={handleInputChange}
                  style={{
                    minHeight: '120px',
                    height: 'calc(100% - 8px)' // 确保不会超出容器
                  }}
                />
              </div>
            </div>
          </Panel>

          <PanelResizeHandle className="my-1 h-1 bg-gradient-to-r from-transparent via-blue-300 to-transparent hover:via-blue-400 cursor-row-resize transition-all duration-200 flex items-center justify-center group">
            <div className="w-6 h-0.5 bg-blue-400/60 group-hover:bg-blue-500/80 rounded-full transition-all duration-200"></div>
          </PanelResizeHandle>

          {/* 解析结果面板 */}
          <Panel defaultSize={splitSize[1]} minSize={35}>
            <div className="flex flex-col h-full bg-gradient-to-br from-base-50 to-base-100 rounded-lg border border-base-300/30">
              <div className="px-4 py-3 border-b border-base-300/50 bg-base-100/80 backdrop-blur-sm rounded-t-lg">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 bg-green-500 rounded-full"></div>
                  {/* <span className="text-sm font-semibold text-base-content">解析结果</span> */}
                  <div className="flex items-center gap-1">
                    <label className="text-sm font-semibold text-base-content">解析结果:</label>
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
              <div className="flex-1 overflow-hidden rounded-b-lg">
                {tableContent}
              </div>
            </div>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}

