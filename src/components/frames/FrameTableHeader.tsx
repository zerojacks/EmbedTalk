import React from 'react';

export const FrameTableHeader: React.FC = () => {
    return (
        <thead>
            <tr className="text-xs bg-base-200/80 sticky top-0 z-10">
                <th className="py-2 px-2 font-medium text-left whitespace-nowrap" style={{ width: '180px', minWidth: '180px', maxWidth: '180px' }}>
                    时间戳
                </th>
                <th className="py-2 px-2 font-medium text-center whitespace-nowrap" style={{ width: '50px', minWidth: '50px', maxWidth: '50px' }}>
                    PID
                </th>
                <th className="py-2 px-2 font-medium text-center whitespace-nowrap" style={{ width: '120px', minWidth: '120px', maxWidth: '120px' }}>
                    标签
                </th>
                <th className="py-2 px-2 font-medium text-center whitespace-nowrap" style={{ width: '120px', minWidth: '120px', maxWidth: '120px' }}>
                    端口
                </th>
                <th className="py-2 px-2 font-medium text-center whitespace-nowrap" style={{ width: '120px', minWidth: '120px', maxWidth: '120px' }}>
                    协议
                </th>
                <th className="py-2 px-2 font-medium text-center whitespace-nowrap" style={{ width: '60px', minWidth: '60px', maxWidth: '60px' }}>
                    方向
                </th>
                <th className="py-2 px-2 font-medium text-left flex-1">
                    内容
                </th>
            </tr>
        </thead>
    );
}; 