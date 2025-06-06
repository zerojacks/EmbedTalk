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
  const [dismissed, setDismissed] = useState(false); // Track if user has dismissed the progress indicator

  useEffect(() => {
    const handleProgress = (event: ProgressEvent) => {
      setProgress(event);
      
      // Show/hide progress indicator based on status and whether it was dismissed
      const shouldShow = event.status !== 'finished' && event.status !== 'error' && !event.needConfirm && !dismissed;
      setVisible(shouldShow);
      
      // Show confirmation dialog when download is complete and confirmation is needed
      if (event.needConfirm) {
        setShowConfirmDialog(true);
        setDismissed(false); // Reset dismissed state when showing confirmation dialog
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
  
  // Dismiss the progress indicator
  const handleDismissProgress = () => {
    setVisible(false);
    setDismissed(true);
  };

  // Format sizes for display
  const downloadedMB = (progress.downloadedSize / 1024 / 1024).toFixed(2);
  const totalMB = (progress.totalSize / 1024 / 1024).toFixed(2);

  return (
    <>
      {visible && (
        <div className="fixed bottom-4 right-4 bg-base-100 shadow-lg rounded-lg p-4 w-80 z-50 border border-base-300 relative">
          {/* Close button */}
          <button 
            onClick={handleDismissProgress}
            className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 focus:outline-none"
            aria-label="关闭"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <div className="flex justify-between mb-2 pr-4">
            <span className="font-medium">
              {progress.status === 'preparing' && '准备更新...'}
              {progress.status === 'downloading' && '下载更新中'}
              {progress.status === 'installing' && '安装更新中...'}
            </span>
            <span className="font-medium">{progress.progress}%</span>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
            <div 
              className="bg-primary h-2.5 rounded-full transition-all duration-300" 
              style={{ width: `${progress.progress}%` }}
            ></div>
          </div>
          
          {progress.status === 'downloading' && progress.totalSize > 0 && (
            <div className="text-xs mt-1 text-gray-500">
              {downloadedMB} MB / {totalMB} MB
            </div>
          )}
          
          {progress.message && (
            <div className="text-sm mt-2">{progress.message}</div>
          )}
        </div>
      )}

      <UpdateConfirmDialog 
        version={progress.version || ''}
        onConfirm={handleConfirmUpdate}
        onLater={handleUpdateLater}
        onClose={handleCloseDialog}
        visible={showConfirmDialog}
      />
    </>
  );
};

export default UpdateProgress;
