// src/services/updaterService.ts
import { toast } from '../context/ToastProvider';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

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
        // Show update notification with version and release notes
        toast.success(`发现新版本: ${update.version}`);
        
        if (update.body) {
          // Show release notes if available
          console.log(`更新说明: ${update.body}`);
        }
        
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
   * Install available update with progress tracking
   */
  public static async installUpdate(): Promise<void> {
    try {      
      // Check for updates first
      const update = await check();
      
      if (!update) {
        toast.info('没有可用的更新');
        return;
      }

      toast.info('正在下载更新...');
      
      let downloaded = 0;
      let contentLength = 0;
      
      // Download and install the update with progress tracking
      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength || 0;
            console.log(`开始下载更新: ${contentLength} 字节`);
            break;
          case 'Progress':
            downloaded += event.data.chunkLength || 0;
            const progress = Math.round((downloaded / contentLength) * 100);
            console.log(`已下载 ${progress}%`);
            break;
          case 'Finished':
            console.log('下载完成');
            break;
        }
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
    }
  }
}
