import React from 'react';
import { X, FileText } from 'lucide-react';

export interface ParseProgressItem {
    id: string;
    fileName: string;
    filePath?: string; // 添加完整文件路径用于精确去重
    type: 'log' | 'frame';
    status: 'parsing' | 'completed' | 'error';
    progress: number; // 0-100
    totalEntries?: number;
    currentEntries?: number;
    segments?: number;
    errorMessage?: string;
    startTime: number;
    endTime?: number;
}

interface ParseProgressProps {
    items: ParseProgressItem[];
    onRemove: (id: string) => void;
    onClear: () => void;
}

const ParseProgress: React.FC<ParseProgressProps> = ({ items, onRemove, onClear }) => {
    if (items.length === 0) return null;

    const getStatusColor = (status: ParseProgressItem['status']) => {
        switch (status) {
            case 'parsing':
                return 'text-info';
            case 'completed':
                return 'text-success';
            case 'error':
                return 'text-error';
            default:
                return 'text-base-content';
        }
    };

    const getProgressColor = (status: ParseProgressItem['status']) => {
        switch (status) {
            case 'parsing':
                return 'progress-info';
            case 'completed':
                return 'progress-success';
            case 'error':
                return 'progress-error';
            default:
                return 'progress-primary';
        }
    };

    const formatDuration = (startTime: number, endTime?: number) => {
        const duration = (endTime || Date.now()) - startTime;
        if (duration < 1000) {
            return `${duration}ms`;
        }
        return `${(duration / 1000).toFixed(1)}s`;
    };

    const getTypeIcon = (type: 'log' | 'frame') => {
        // 统一使用 FileText 图标，与文件tab保持一致
        return <FileText className="h-4 w-4 flex-shrink-0" />;
    };

    const getStatusText = (item: ParseProgressItem) => {
        switch (item.status) {
            case 'parsing':
                if (item.currentEntries !== undefined && item.segments) {
                    return `解析中... ${item.currentEntries} 条目 (${item.segments} 线程)`;
                }
                return '解析中...';
            case 'completed':
                const duration = formatDuration(item.startTime, item.endTime);
                if (item.totalEntries !== undefined && item.segments) {
                    return `完成 - ${item.totalEntries} 条目 (${duration}, ${item.segments} 线程)`;
                }
                return `完成 (${duration})`;
            case 'error':
                return `错误: ${item.errorMessage || '解析失败'}`;
            default:
                return '';
        }
    };

    return (
        <div className="fixed bottom-4 right-4 z-50 w-96 max-w-[calc(100vw-2rem)]">
            <div className="card bg-base-100 shadow-xl border border-base-300">
                <div className="card-header px-4 py-3 border-b border-base-300">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-sm">解析进度</h3>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-base-content/70">
                                {items.filter(item => item.status === 'parsing').length} 进行中
                            </span>
                            <button
                                className="btn btn-ghost btn-xs"
                                onClick={onClear}
                                title="清除所有"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </div>
                    </div>
                </div>
                
                <div className="card-body p-0 max-h-80 overflow-y-auto">
                    {items.map((item) => (
                        <div key={item.id} className="group px-4 py-3 border-b border-base-300 last:border-b-0 hover:bg-base-200/50">
                            <div className="flex items-start gap-3">
                                <div className={`mt-0.5 ${getStatusColor(item.status)}`}>
                                    {getTypeIcon(item.type)}
                                </div>
                                
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        <span className="text-sm font-medium truncate" title={item.fileName}>
                                            {item.fileName}
                                        </span>
                                        <button
                                            className="btn btn-ghost btn-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => onRemove(item.id)}
                                            title="移除"
                                        >
                                            <X className="h-3 w-3" />
                                        </button>
                                    </div>
                                    
                                    <div className="mb-2">
                                        <progress
                                            className={`progress progress-xs w-full ${getProgressColor(item.status)}`}
                                            value={item.progress}
                                            max="100"
                                        />
                                    </div>
                                    
                                    <div className="flex items-center justify-between">
                                        <span className={`text-xs ${getStatusColor(item.status)}`}>
                                            {getStatusText(item)}
                                        </span>
                                        <span className="text-xs text-base-content/50">
                                            {item.progress.toFixed(0)}%
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ParseProgress;
