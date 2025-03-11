import React from 'react';
import DLT645TestWindow from '../components/DLT645TestWindow';

const DLT645Test: React.FC = () => {
  // 使用 h-full 确保容器占满父元素高度
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <DLT645TestWindow />
    </div>
  );
};

export default DLT645Test;
