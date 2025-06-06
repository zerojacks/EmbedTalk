// src/services/updaterService.ts
import { toast } from '../context/ToastProvider';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { publishProgress, resetProgress, setUpdateCallbacks } from '../components/UpdateProgress';

/**
 * Updater service for checking and installing application updates from GitHub releases
 */
export class UpdaterService {
  /**
   * Check for updates from GitHub releases
   * @param silent If true, no notification will be shown if no updates are available
   * @returns Promise<boolean> True if an update is available
   */
  public static async checkForUpdates(silent = false): Promise<boolean> {
    try {
      // Check for updates from GitHub releases
      const update = await check();
      
      if (update) {
        // 显示更新日志
        if (update.body) {
          toast.info(
            `更新说明:\n${update.body}`,
            'center', // x position
            'top', // y position
            10000 // duration
          );
        }
        
        // 发送更新事件
        const event = new CustomEvent('update-found', {
          detail: { version: update.version }
        });
        window.dispatchEvent(event);
        
        // 显示确认对话框
        publishProgress({
          progress: 0,
          downloadedSize: 0,
          totalSize: 0,
          status: 'finished',
          message: '发现新版本',
          version: update.version,
          releaseNotes: update.body,
          needConfirm: true
        });

        // 设置确认对话框的回调
        setUpdateCallbacks({
          onInstallNow: async () => {
            await this.downloadAndInstall(update);
          },
          onInstallLater: () => {
            toast.info('已取消更新');
          }
        });
        
        return true;
      } else if (!silent) {
        toast.info('当前已是最新版本');
      }
      
      return false;
    } catch (error) {
      console.error('检查更新失败:', error);
      if (!silent) {
        toast.error(`检查更新失败: ${error instanceof Error ? error.message : String(error)}`);
      }
      return false;
    }
  }

  /**
   * Download and install update
   */
  private static async downloadAndInstall(update: Update): Promise<void> {
    try {
      // Reset and initialize progress display
      resetProgress();
      publishProgress({
        progress: 0,
        downloadedSize: 0,
        totalSize: 0,
        status: 'preparing',
        message: '准备下载更新...'
      });
      
      let downloaded = 0;
      let contentLength = 0;
      let lastProgressUpdateTime = 0;
      const progressUpdateInterval = 200; // Update progress every 200ms at most
      
      // Start the download and install process
      await update.download((event) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength || 0;
            console.log(`开始下载更新: ${contentLength} 字节`);
            
            // Update progress display with total size information
            publishProgress({
              progress: 0,
              downloadedSize: 0,
              totalSize: contentLength,
              status: 'downloading',
              message: `开始下载更新 (${(contentLength / 1024 / 1024).toFixed(2)} MB)`
            });
            break;
            
          case 'Progress':
            downloaded += event.data.chunkLength || 0;
            const progress = Math.round((downloaded / contentLength) * 100);
            
            // Limit progress updates to avoid too many updates
            const now = Date.now();
            if (now - lastProgressUpdateTime > progressUpdateInterval) {
              lastProgressUpdateTime = now;
              
              // Update progress display
              publishProgress({
                progress: progress,
                downloadedSize: downloaded,
                totalSize: contentLength,
                status: 'downloading',
                message: `正在下载更新 ${progress}%`
              });
            }
            break;
            
          case 'Finished':
            console.log('下载完成');
            publishProgress({
              progress: 100,
              downloadedSize: contentLength,
              totalSize: contentLength,
              status: 'installing',
              message: '正在安装更新...'
            });
            break;
        }
        
        return true;
      });

      // Install the update
      await update.install();
      
      // Show completion message
      publishProgress({
        progress: 100,
        downloadedSize: 100,
        totalSize: 100,
        status: 'finished',
        message: '更新已安装，正在重启应用...'
      });
      
      toast.success('更新已安装，正在重启应用...');
      
      // Relaunch the app after a short delay
      setTimeout(async () => {
        try {
          await relaunch();
        } catch (err) {
          console.error('重启应用失败:', err);
        }
      }, 2000);
    } catch (error) {
      console.error('安装更新失败:', error);
      toast.error(`安装更新失败: ${error instanceof Error ? error.message : String(error)}`);
      
      // Reset progress on error
      publishProgress({
        progress: 0,
        downloadedSize: 0,
        totalSize: 0,
        status: 'error',
        message: `更新失败: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
}
