// src/services/updaterService.ts
import { toast } from '../context/ToastProvider';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { publishProgress, resetProgress, setUpdateCallbacks } from '../components/UpdateProgress';
import { SettingService } from './settingService';

// Configuration constants for update settings
const UPDATE_SECTION = 'Updates';
const PENDING_UPDATE_KEY = 'pendingUpdate';

// Helper functions for storing update preferences using SettingService
const savePendingUpdate = async (version: string): Promise<boolean> => {
  return await SettingService.setConfigValue(UPDATE_SECTION, PENDING_UPDATE_KEY, {
    version,
    timestamp: new Date().toISOString()
  });
};

const getPendingUpdate = async (): Promise<{version: string} | null> => {
  return await SettingService.getConfigValue<{version: string}>(UPDATE_SECTION, PENDING_UPDATE_KEY);
};

const clearPendingUpdate = async (): Promise<boolean> => {
  return await SettingService.setConfigValue(UPDATE_SECTION, PENDING_UPDATE_KEY, null);
};

/**
 * Updater service for checking and installing application updates from GitHub releases
 */
export class UpdaterService {
  /**
   * Check for updates and handle pending updates on startup
   */
  public static async checkPendingUpdatesOnStartup(): Promise<void> {
    try {
      // Check if there's a pending update in config
      const pendingUpdate = await getPendingUpdate();
      
      if (pendingUpdate) {
        // Check if the update file is already downloaded and ready to install
        const update = await check();
        
        if (update) {
          // Ask user if they want to install the pending update now
          toast.info(`有待安装的更新: ${pendingUpdate.version}`);
          
          // Set up callbacks for the confirmation dialog
          setUpdateCallbacks({
            onInstallNow: async () => {
              try {
                // Show installing progress
                publishProgress({
                  progress: 100,
                  downloadedSize: 100,
                  totalSize: 100,
                  status: 'installing',
                  message: '正在安装更新...'
                });
                
                // Install the update using the Tauri updater install API
                await update.downloadAndInstall();
                
                // Update progress to show completion
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
              } catch (installError) {
                console.error('安装更新失败:', installError);
                toast.error(`安装更新失败: ${installError instanceof Error ? installError.message : String(installError)}`);
              }
            },
            onInstallLater: async () => {
              // Do nothing, keep the pending update
              toast.info('更新将在下次启动时安装');
            }
          });
          
          // Show confirmation dialog
          publishProgress({
            progress: 100,
            downloadedSize: 100,
            totalSize: 100,
            status: 'finished',
            message: '发现待安装的更新',
            version: pendingUpdate.version,
            needConfirm: true
          });
        } else {
          // The update file is not available, clear the pending update
          console.log('找不到待安装的更新文件，清除记录');
          await clearPendingUpdate();
        }
      }
    } catch (error) {
      console.error('检查待安装更新失败:', error);
    }
  }

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
   * Save update for later installation on next app restart
   * @param updateVersion The version of the update to save for later
   */
  public static async saveUpdateForLater(updateVersion: string): Promise<void> {
    try {
      // Save the update preference to config file using SettingService
      const saved = await savePendingUpdate(updateVersion);
      if (saved) {
        toast.info('更新将在下次启动时安装');
      } else {
        toast.error('保存更新偏好失败');
      }
    } catch (error) {
      console.error('保存更新偏好失败:', error);
      toast.error(`保存更新偏好失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if there's a pending update saved for later installation
   */
  public static async checkPendingUpdate(): Promise<{version: string} | null> {
    try {
      // Get the pending update from config file using SettingService
      return await getPendingUpdate();
    } catch (error) {
      console.error('检查待安装更新失败:', error);
      return null;
    }
  }

  /**
   * Clear any pending updates
   */
  public static async clearPendingUpdate(): Promise<void> {
    try {
      // Clear the pending update from config file using SettingService
      await clearPendingUpdate();
    } catch (error) {
      console.error('清除待安装更新失败:', error);
    }
  }

  /**
   * Download update without installing it
   * 
   * Note: Due to how Tauri updater works, we can't easily separate download from install.
   * Instead, we'll use a workaround to download the update and then cancel the installation
   * by throwing an exception after download completes.
   */
  public static async downloadUpdate(): Promise<{version: string} | null> {
    try {
      // Check for updates first
      const update = await check();
      
      if (!update) {
        toast.info('没有可用的更新');
        return null;
      }

      toast.info('准备下载更新...');
      
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
      let downloadCompleted = false; // Flag to track if download is completed
      
      try {
        // Start the download process
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
              console.log(`已下载 ${progress}%`);
              
              // Limit progress updates to avoid too many updates
              const now = Date.now();
              if (now - lastProgressUpdateTime > progressUpdateInterval) {
                lastProgressUpdateTime = now;
                
                // Update progress display
                publishProgress({
                  progress: progress,
                  downloadedSize: downloaded,
                  totalSize: contentLength,
                  status: 'downloading'
                });
              }
              break;
              
            case 'Finished':
              console.log('下载完成');
              downloadCompleted = true;
              
              // Show confirmation dialog
              publishProgress({
                progress: 100,
                downloadedSize: contentLength,
                totalSize: contentLength,
                status: 'finished',
                message: '下载完成，请选择更新方式',
                version: update.version,
                needConfirm: true
              });
              
              toast.success('更新已下载完成');
              
              // Throw an exception to cancel the installation process
              // This is a workaround to prevent automatic installation
              throw new Error('DOWNLOAD_ONLY');
          }
          
          // Continue with the download process
          return true;
        });
      } catch (err) {
        // If this is our intentional error to stop after download, ignore it
        if (err instanceof Error && err.message === 'DOWNLOAD_ONLY') {
          console.log('已取消自动安装，等待用户确认');
        } else {
          // Re-throw any other errors
          throw err;
        }
      }
      
      // Set up callbacks for the confirmation dialog
      setUpdateCallbacks({
        onInstallNow: async () => {
          await this.installUpdate();
        },
        onInstallLater: async () => {
          await this.saveUpdateForLater(update.version);
        }
      });
      
      return { version: update.version };
    } catch (error) {
      console.error('下载更新失败:', error);
      toast.error(`下载更新失败: ${error instanceof Error ? error.message : String(error)}`);
      
      // Reset progress on error
      publishProgress({
        progress: 0,
        downloadedSize: 0,
        totalSize: 0,
        status: 'error',
        message: `下载失败: ${error instanceof Error ? error.message : String(error)}`
      });
      
      return null;
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
      
      // Show installing progress
      publishProgress({
        progress: 100,
        downloadedSize: 100,
        totalSize: 100,
        status: 'installing',
        message: '正在安装更新...'
      });
      
      // Clear any pending updates since we're installing now
      await this.clearPendingUpdate();
      
      // Install the update using the Tauri updater install API
      await update.download();
      await update.install();
      
      // Update progress to show completion
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
    }
  }
}
