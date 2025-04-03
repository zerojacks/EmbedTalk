import React, { useState, useEffect, useRef } from 'react';
import { IoClose } from 'react-icons/io5';
import { FiHelpCircle } from 'react-icons/fi';
import { HelpContent } from './tools/HelpContent';

interface ToolDialogProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  initialWidth?: number;
  initialHeight?: number;
  helpId?: string;
}

export const ToolDialog: React.FC<ToolDialogProps> = ({
  title,
  onClose,
  children,
  initialWidth = 600,
  initialHeight = 480,
  helpId
}) => {
  const [size, setSize] = useState({ width: initialWidth, height: initialHeight });
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const dialogRef = useRef<HTMLDivElement>(null);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    // 计算初始位置，使对话框居中并留有边距
    const x = Math.max(20, (window.innerWidth - size.width) / 2);
    const y = Math.max(20, (window.innerHeight - size.height) / 2);
    setPosition({ x, y });
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      // 计算新位置，确保不超出屏幕边界
      const newX = Math.max(0, Math.min(window.innerWidth - size.width, e.clientX - dragStart.x));
      const newY = Math.max(0, Math.min(window.innerHeight - size.height, e.clientY - dragStart.y));
      setPosition({
        x: newX,
        y: newY,
      });
    } else if (isResizing) {
      const deltaX = e.clientX - resizeStart.x;
      const deltaY = e.clientY - resizeStart.y;
      
      // 计算新尺寸，确保不超出屏幕边界
      const newWidth = Math.min(
        window.innerWidth - position.x - 20,
        Math.max(300, resizeStart.width + deltaX)
      );
      const newHeight = Math.min(
        window.innerHeight - position.y - 20,
        Math.max(200, resizeStart.height + deltaY)
      );
      
      setSize({
        width: newWidth,
        height: newHeight,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
  };

  useEffect(() => {
    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, dragStart, resizeStart]);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div
        ref={dialogRef}
        className="bg-base-100 rounded-lg shadow-xl flex flex-col"
        style={{
          width: size.width,
          height: size.height,
          position: 'absolute',
          left: position.x,
          top: position.y,
          maxWidth: '90vw',
          maxHeight: '90vh'
        }}
      >
        <div 
          className="flex items-center justify-between px-4 py-2 border-b border-base-300 cursor-move"
          onMouseDown={handleMouseDown}
        >
          <h2 className="text-lg font-medium select-none">{title}</h2>
          <div className="flex items-center gap-2">
            {helpId && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowHelp(true)}
              >
                <FiHelpCircle className="w-5 h-5" />
              </button>
            )}
            <button
              className="btn btn-ghost btn-sm"
              onClick={onClose}
            >
              <IoClose className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {showHelp && helpId ? (
            <HelpContent helpId={helpId} />
          ) : (
            children
          )}
        </div>
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
          onMouseDown={handleResizeStart}
        />
      </div>
      {showHelp && helpId && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="bg-base-100 rounded-lg shadow-xl flex flex-col max-w-2xl max-h-[80vh] w-full"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center px-4 py-2 border-b border-base-300 sticky top-0 bg-base-100 z-10">
              <h3 className="text-lg font-medium">使用说明</h3>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowHelp(false)}
              >
                <IoClose className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-6">
              <HelpContent helpId={helpId} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 