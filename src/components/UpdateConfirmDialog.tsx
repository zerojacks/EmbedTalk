import React from 'react';

interface UpdateConfirmDialogProps {
  version: string;
  releaseNotes?: string;
  onConfirm: () => void;
  onLater: () => void;
  onClose: () => void;
  visible: boolean;
}

const UpdateConfirmDialog: React.FC<UpdateConfirmDialogProps> = ({
  version,
  releaseNotes,
  onConfirm,
  onLater,
  onClose,
  visible
}) => {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-base-100 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
        <div className="flex flex-col">
          <h3 className="text-lg font-bold mb-4">发现新版本</h3>
          
          <p className="mb-2">
            发现新版本 <span className="font-semibold">{version}</span>，是否下载并安装？
          </p>

          {releaseNotes && (
            <div className="mb-4 p-3 bg-base-200 rounded-lg max-h-48 overflow-y-auto">
              <h4 className="font-medium mb-2">更新说明：</h4>
              <p className="text-sm whitespace-pre-wrap">{releaseNotes}</p>
            </div>
          )}
          
          <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2 justify-end">
            <button 
              className="btn btn-outline" 
              onClick={onLater}
            >
              暂不更新
            </button>
            <button 
              className="btn btn-primary" 
              onClick={onConfirm}
            >
              下载并安装
            </button>
          </div>
          
          <button 
            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
            onClick={onClose}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdateConfirmDialog;
