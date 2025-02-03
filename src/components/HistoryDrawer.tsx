import React, { useEffect, useState } from 'react';
import { PraseFrame, getPraseFrames, deletePraseFrameById, clearAllPraseFrames } from '../utils/database';
import { useConfig } from '../hooks/useConfig';

interface HistoryDrawerProps {
  onSelectFrame: (frame: string) => void;
  visible: boolean;
  onClose: () => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({ onSelectFrame, visible, onClose }) => {
  const [frames, setFrames] = useState<PraseFrame[]>([]);
  const { getConfigValue } = useConfig();
  const [historyLimit, setHistoryLimit] = useState(100);
  const [currentCount, setCurrentCount] = useState(0);

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    if (visible) {
      loadFrames();
    }
  }, [visible]);

  const loadConfig = async () => {
    const limit = await getConfigValue('historyLimit');
    setHistoryLimit(Number(limit) || 100);
  };

  const loadFrames = async () => {
    try {
      const loadedFrames = await getPraseFrames();
      setFrames(loadedFrames);
      setCurrentCount(loadedFrames.length);
    } catch (error) {
      console.error('Failed to load frames:', error);
    }
  };

  const handleDeleteFrame = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation(); // 
    try {
      await deletePraseFrameById(id);
      await loadFrames();
    } catch (error) {
      console.error('Failed to delete frame:', error);
    }
  };

  const handleClearAll = async () => {
    try {
      await clearAllPraseFrames();
      await loadFrames();
    } catch (error) {
      console.error('Failed to clear frames:', error);
    }
  };

  const handleSelectFrame = (frame: PraseFrame) => {
    onSelectFrame(frame.frame);
    onClose();
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString();
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 bg-base-300 bg-opacity-50">
      <div className="drawer drawer-end">
        <input id="history-drawer" type="checkbox" className="drawer-toggle" checked={visible} readOnly />
        <div className="drawer-content">
          {/* Page content here */}
        </div>
        <div className="drawer-side">
          <label htmlFor="history-drawer" className="drawer-overlay" onClick={onClose}></label>
          <div className="p-4 w-96 min-h-full bg-base-200 text-base-content">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-bold">历史记录</h2>
                <p className="text-sm text-base-content/70">
                  当前记录数: {currentCount} / 最大记录数: {historyLimit}
                </p>
              </div>
              <div className="flex gap-2">
                <button 
                  className="btn btn-error btn-sm"
                  onClick={handleClearAll}
                >
                  清空
                </button>
                <button 
                  className="btn btn-circle btn-sm" 
                  onClick={onClose}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-8rem)]">
              {frames.map((frame) => (
                <div
                  key={frame.id}
                  className="card bg-base-100 shadow-xl hover:bg-base-200 cursor-pointer transition-colors relative group"
                  onClick={() => handleSelectFrame(frame)}
                >
                  <div className="card-body p-4">
                    <h3 className="card-title text-sm truncate pr-8">{frame.frame}</h3>
                    <p className="text-xs text-base-content/70">{formatDate(frame.created_at)}</p>
                    <button
                      className="btn btn-error btn-xs absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                      onClick={(e) => frame.id && handleDeleteFrame(frame.id, e)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
