import React, { useState, useEffect } from 'react';
import UpdateConfirmDialog from './UpdateConfirmDialog';

// Event bus for update progress
type ProgressEvent = {
  progress: number;
  downloadedSize: number;
  totalSize: number;
  status: 'preparing' | 'downloading' | 'installing' | 'finished' | 'error';
  message?: string;
  version?: string;
  releaseNotes?: string;
  needConfirm?: boolean;
};

const eventListeners: ((event: ProgressEvent) => void)[] = [];

// Global progress state
let currentProgress: ProgressEvent = {
  progress: 0,
  downloadedSize: 0,
  totalSize: 0,
  status: 'preparing',
  version: '',
  releaseNotes: '',
  needConfirm: false
};

// Publish progress update
export const publishProgress = (progress: ProgressEvent) => {
  currentProgress = progress;
  eventListeners.forEach(listener => listener(progress));
};

// Reset progress
export const resetProgress = () => {
  currentProgress = {
    progress: 0,
    downloadedSize: 0,
    totalSize: 0,
    status: 'preparing',
    version: '',
    releaseNotes: '',
    needConfirm: false
  };
  eventListeners.forEach(listener => listener(currentProgress));
};

// Callback functions for update actions
type UpdateCallbacks = {
  onInstallNow: () => void;
  onInstallLater: () => void;
};

let updateCallbacks: UpdateCallbacks | null = null;

// Set update callbacks
export const setUpdateCallbacks = (callbacks: UpdateCallbacks) => {
  updateCallbacks = callbacks;
};

// Component to display update progress
const UpdateProgress: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState<ProgressEvent>(currentProgress);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [minimized, setMinimized] = useState(false); // 新增：最小化状态

  useEffect(() => {
    const handleProgress = (event: ProgressEvent) => {
      setProgress(event);
      
      // Show/hide progress indicator based on status
      const shouldShow = event.status !== 'finished' && event.status !== 'error' && !event.needConfirm;
      setVisible(shouldShow);
      
      // Show confirmation dialog when download is complete and confirmation is needed
      if (event.needConfirm) {
        setShowConfirmDialog(true);
      }
    };

    eventListeners.push(handleProgress);
    return () => {
      const index = eventListeners.indexOf(handleProgress);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    };
  }, []);

  // Handle immediate update confirmation
  const handleConfirmUpdate = () => {
    setShowConfirmDialog(false);
    if (updateCallbacks?.onInstallNow) {
      updateCallbacks.onInstallNow();
    }
  };

  // Handle update on next restart
  const handleUpdateLater = () => {
    setShowConfirmDialog(false);
    if (updateCallbacks?.onInstallLater) {
      updateCallbacks.onInstallLater();
    }
  };

  // Close dialog without taking action
  const handleCloseDialog = () => {
    setShowConfirmDialog(false);
  };
  
  // Format sizes for display
  const downloadedMB = (progress.downloadedSize / 1024 / 1024).toFixed(2);
  const totalMB = (progress.totalSize / 1024 / 1024).toFixed(2);

  // 获取进度条容器的样式
  const getProgressContainerStyle = () => {
    if (!visible) return '';
    if (minimized) return 'minimized-progress';
    return 'expanded-progress';
  };

  return (
    <>
      {visible && (
        <div className={`fixed z-50 ${getProgressContainerStyle()}`}>
          <div className={`${minimized ? '' : 'bg-base-100 shadow-lg rounded-lg border border-base-300 p-4 w-80'}`}>
            {minimized ? (
              // 最小化状态：使用 daisyUI 的 Radial Progress
              <div 
                className="cursor-pointer" 
                onClick={() => setMinimized(false)}
                title={`${progress.progress}% - 点击展开`}
              >
                <div 
                  className="radial-progress text-primary bg-transparent" 
                  style={{ 
                    "--value": progress.progress, 
                    "--size": "2.5rem",
                    "--thickness": "3px"
                  } as React.CSSProperties}
                >
                  <span className="text-xs font-semibold text-base-content">{progress.progress}%</span>
                </div>
              </div>
            ) : (
              // 展开状态：显示完整进度信息
              <>
                {/* 标题栏 */}
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">
                    {progress.status === 'preparing' && '准备更新...'}
                    {progress.status === 'downloading' && '下载更新中'}
                    {progress.status === 'installing' && '安装更新中...'}
                  </span>
                  <div className="flex gap-2">
                    {/* 最小化按钮 */}
                    <button 
                      onClick={() => setMinimized(true)}
                      className="text-gray-500 hover:text-gray-700 focus:outline-none"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* 进度信息 */}
                <div className="flex justify-between mb-2">
                  <span className="text-sm">{progress.progress}%</span>
                  {progress.status === 'downloading' && progress.totalSize > 0 && (
                    <span className="text-xs text-gray-500">
                      {downloadedMB} MB / {totalMB} MB
                    </span>
                  )}
                </div>
                
                <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                  <div 
                    className="bg-primary h-2.5 rounded-full transition-all duration-300" 
                    style={{ width: `${progress.progress}%` }}
                  ></div>
                </div>
                
                {progress.message && (
                  <div className="text-sm mt-2">{progress.message}</div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <UpdateConfirmDialog
        visible={showConfirmDialog}
        version={progress.version || ''}
        releaseNotes={progress.releaseNotes}
        onConfirm={handleConfirmUpdate}
        onLater={handleUpdateLater}
        onClose={handleCloseDialog}
      />
    </>
  );
};

// 修改样式部分
const styles = `
.expanded-progress {
  right: 1rem;
  bottom: 1rem;
}

.minimized-progress {
  right: 1rem;
  bottom: 1rem;
}

@media (max-width: 640px) {
  .expanded-progress,
  .minimized-progress {
    right: 0.5rem;
    bottom: 0.5rem;
  }
}

/* 自定义 radial-progress 样式 */
.radial-progress.bg-transparent:before {
  background-color: transparent !important;
}

/* 确保进度环内的文字清晰可见 */
.radial-progress > span {
  text-shadow: 0 0 2px rgba(255, 255, 255, 0.8);
  z-index: 1;
}
`;

// 将样式添加到 head
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}

export default UpdateProgress;
