import { useCallback } from 'react';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

// 单例窗口管理 - 只使用一个固定标签的窗口
let parseWindow: WebviewWindow | null = null;
const PARSE_WINDOW_LABEL = 'frame-parse';

export const useFrameParseWindows = () => {
  const openWindow = useCallback(async (frameId: string, frameContent: string) => {
    console.log(`尝试打开解析窗口，frameId: ${frameId}`);
    
    try {
      // 检查是否已经有解析窗口存在
      if (parseWindow) {
        try {
          // 检查窗口是否仍然有效
          const isVisible = await parseWindow.isVisible();
          console.log(`现有窗口可见性: ${isVisible}`);

          // 窗口已存在且有效，聚焦并发送新的数据
          await parseWindow.setFocus();
          await parseWindow.unminimize();

          // 通过事件发送新的报文数据到窗口
          console.log(`发送事件到现有窗口: frameId=${frameId}, 内容长度=${frameContent.length}`);
          await parseWindow.emit('update-frame-content', {
            frameId,
            frameContent
          });
          console.log(`事件发送到现有窗口完成`);

          console.log(`成功更新现有解析窗口内容: ${frameId}`);
          return PARSE_WINDOW_LABEL;
        } catch (error) {
          console.warn('现有窗口无效或已关闭，将创建新窗口:', error);
          parseWindow = null;
        }
      }

      // 检查是否已经存在同标签的窗口
      console.log(`检查是否存在解析窗口`);

      let tauriWindow = await WebviewWindow.getByLabel(PARSE_WINDOW_LABEL);

      if (tauriWindow) {
        // 窗口已存在，直接使用
        console.log(`找到现有窗口，直接使用`);
        await tauriWindow.show();
        await tauriWindow.setFocus();

        // 等待窗口完全显示后再发送事件
        await new Promise(resolve => setTimeout(resolve, 100));

        // 通过事件发送新数据
        console.log(`发送事件到窗口: frameId=${frameId}, 内容长度=${frameContent.length}`);
        await tauriWindow.emit('update-frame-content', {
          frameId,
          frameContent
        });
        console.log(`事件发送完成`);

        parseWindow = tauriWindow;
        return PARSE_WINDOW_LABEL;
      }

      // 创建新的解析窗口
      console.log(`创建新的解析窗口`);

      tauriWindow = new WebviewWindow(PARSE_WINDOW_LABEL, {
        url: `/frame-parse?frameId=${encodeURIComponent(frameId)}&frameContent=${encodeURIComponent(frameContent)}`,
        title: `报文解析`,
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        resizable: true,
        maximizable: true,
        minimizable: true,
        closable: true,
        center: true,
        decorations: true,
        alwaysOnTop: false,
        skipTaskbar: false,
        devtools: false
      });

      parseWindow = tauriWindow;

      // 只监听窗口销毁事件来清理引用
      tauriWindow.once('tauri://destroyed', () => {
        console.log(`解析窗口已销毁`);
        parseWindow = null;
      });

      // 监听窗口错误事件
      tauriWindow.once('tauri://error', (error) => {
        console.error(`解析窗口错误:`, error);
        parseWindow = null;
      });

      console.log(`解析窗口创建成功`);
      return PARSE_WINDOW_LABEL;
    } catch (error) {
      console.error('创建解析窗口失败:', error);
      parseWindow = null;

      // 如果是标签已存在的错误，尝试获取现有窗口
      if (error instanceof Error && error.message.includes('already exists')) {
        console.log('窗口标签已存在，尝试获取现有窗口');
        try {
          const existingWindow = await WebviewWindow.getByLabel(PARSE_WINDOW_LABEL);
          if (existingWindow) {
            parseWindow = existingWindow;
            await existingWindow.show();
            await existingWindow.setFocus();
            console.log(`发送事件到恢复的窗口: frameId=${frameId}, 内容长度=${frameContent.length}`);
            await existingWindow.emit('update-frame-content', {
              frameId,
              frameContent
            });
            console.log(`事件发送到恢复的窗口完成`);
            return PARSE_WINDOW_LABEL;
          }
        } catch (getError) {
          console.error('获取现有窗口失败:', getError);
        }
      }

      throw error;
    }
  }, []);

  const closeWindow = useCallback(async () => {
    if (parseWindow) {
      try {
        // 首先尝试正常关闭
        await parseWindow.close();
        console.log('解析窗口已正常关闭');
      } catch (error) {
        console.error('正常关闭窗口失败:', error);
        try {
          // 如果正常关闭失败，尝试强制销毁
          await parseWindow.destroy();
          console.log('解析窗口已强制销毁');
        } catch (destroyError) {
          console.error('强制销毁窗口失败:', destroyError);
        }
      } finally {
        parseWindow = null;
      }
    }
  }, []);

  const bringToFront = useCallback(async () => {
    if (parseWindow) {
      try {
        await parseWindow.setFocus();
        await parseWindow.unminimize();
        console.log(`成功置顶解析窗口`);
      } catch (error) {
        console.warn('置顶窗口失败:', error);
        parseWindow = null;
      }
    }
  }, []);

  const closeAllWindows = useCallback(async () => {
    await closeWindow();
  }, [closeWindow]);

  return {
    openWindow,
    closeWindow,
    bringToFront,
    closeAllWindows,
  };
};
