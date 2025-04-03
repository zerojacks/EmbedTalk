import React, { useState, useEffect } from 'react';
import { FiCopy, FiCheck } from 'react-icons/fi';
import { toast } from 'react-hot-toast';

export const TimeConverterTool: React.FC = () => {
    const [timestamp, setTimestamp] = useState('');
    const [utcDateTime, setUtcDateTime] = useState('');
    const [localDateTime, setLocalDateTime] = useState('');
    const [copiedTimestamp, setCopiedTimestamp] = useState(false);
    const [copiedDateTime, setCopiedDateTime] = useState(false);

    // 获取当前时区信息
    const timeZoneOffset = new Date().getTimezoneOffset();
    const timeZoneName = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const timeZoneHours = -timeZoneOffset / 60; // 转换为小时
    const timeZoneString = `UTC${timeZoneHours >= 0 ? '+' : ''}${timeZoneHours}`;

    // 获取当前时间的默认值
    useEffect(() => {
        const now = new Date();
        setTimestamp(Math.floor(now.getTime() / 1000).toString());
        setUtcDateTime(now.toISOString().slice(0, 19));
        setLocalDateTime(formatLocalDateTime(now));
    }, []);

    // 格式化本地时间为datetime-local输入框所需的格式
    const formatLocalDateTime = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
    };

    const handleTimestampChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.trim();
        setTimestamp(value);
        
        if (/^\d+$/.test(value)) {
            try {
                // 判断是毫秒还是秒
                const ts = value.length > 10 ? Number(value) : Number(value) * 1000;
                const date = new Date(ts);
                if (!isNaN(date.getTime())) {
                    setUtcDateTime(date.toISOString().slice(0, 19));
                    setLocalDateTime(formatLocalDateTime(date));
                }
            } catch (error) {
                // 转换失败时不更新日期时间
            }
        }
    };

    const handleUtcDateTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setUtcDateTime(value);
        
        try {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
                setTimestamp(Math.floor(date.getTime() / 1000).toString());
                setLocalDateTime(formatLocalDateTime(date));
            }
        } catch (error) {
            // 转换失败时不更新时间戳
        }
    };

    const handleLocalDateTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setLocalDateTime(value);
        
        try {
            // 将本地时间转换为UTC时间戳
            const [datePart, timePart] = value.split('T');
            const [year, month, day] = datePart.split('-').map(Number);
            const [hours, minutes, seconds] = timePart.split(':').map(Number);
            
            const localDate = new Date(year, month - 1, day, hours, minutes, seconds);
            const timestamp = Math.floor(localDate.getTime() / 1000);
            
            setTimestamp(timestamp.toString());
            const utcDate = new Date(timestamp * 1000);
            setUtcDateTime(utcDate.toISOString().slice(0, 19));
        } catch (error) {
            // 转换失败时不更新其他值
        }
    };

    const copyToClipboard = (text: string, type: 'timestamp' | 'datetime') => {
        navigator.clipboard.writeText(text);
        if (type === 'timestamp') {
            setCopiedTimestamp(true);
            setTimeout(() => setCopiedTimestamp(false), 2000);
        } else {
            setCopiedDateTime(true);
            setTimeout(() => setCopiedDateTime(false), 2000);
        }
        toast.success('已复制到剪贴板');
    };

    const setCurrentTime = () => {
        const now = new Date();
        setTimestamp(Math.floor(now.getTime() / 1000).toString());
        setUtcDateTime(now.toISOString().slice(0, 19));
        setLocalDateTime(formatLocalDateTime(now));
    };

    const formatDate = (timestamp: number, options: Intl.DateTimeFormatOptions = {}) => {
        try {
            const date = new Date(timestamp * 1000);
            return new Intl.DateTimeFormat('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
                ...options
            }).format(date);
        } catch {
            return '无效时间';
        }
    };

    return (
        <div className="space-y-6 p-2">
            <div className="alert alert-info shadow-lg mb-4">
                <div>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current flex-shrink-0 w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    <div>
                        <div className="font-medium">当前时区信息</div>
                        <div className="text-sm">{timeZoneName} ({timeZoneString})</div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                <div className="form-control">
                    <label className="label">
                        <span className="text-lg font-medium">Unix 时间戳</span>
                        <span className="text-sm opacity-70">秒</span>
                    </label>
                    <div className="flex gap-2 items-center">
                        <input
                            type="text"
                            className="input input-bordered flex-1 font-mono"
                            value={timestamp}
                            onChange={handleTimestampChange}
                            placeholder="1234567890"
                        />
                        <button
                            className="btn btn-ghost !p-0 flex items-center justify-center h-[40px] w-[40px] min-h-0 tooltip tooltip-left"
                            data-tip="复制时间戳"
                            onClick={() => copyToClipboard(timestamp, 'timestamp')}
                        >
                            <div className="w-full h-full flex items-center justify-center">
                                {copiedTimestamp ? <FiCheck className="text-success w-5 h-5" /> : <FiCopy className="w-5 h-5" />}
                            </div>
                        </button>
                    </div>
                </div>

                <div className="form-control">
                    <label className="label">
                        <span className="text-lg font-medium">日期时间 (UTC)</span>
                        <button
                            className="btn btn-ghost btn-xs"
                            onClick={setCurrentTime}
                        >
                            设为当前时间
                        </button>
                    </label>
                    <div className="flex gap-2 items-center">
                        <input
                            type="datetime-local"
                            step="1"
                            className="input input-bordered flex-1 font-mono"
                            value={utcDateTime}
                            onChange={handleUtcDateTimeChange}
                        />
                        <button
                            className="btn btn-ghost !p-0 flex items-center justify-center h-[40px] w-[40px] min-h-0 tooltip tooltip-left"
                            data-tip="复制日期时间"
                            onClick={() => copyToClipboard(utcDateTime, 'datetime')}
                        >
                            <div className="w-full h-full flex items-center justify-center">
                                {copiedDateTime ? <FiCheck className="text-success w-5 h-5" /> : <FiCopy className="w-5 h-5" />}
                            </div>
                        </button>
                    </div>
                </div>

                <div className="form-control">
                    <label className="label">
                        <span className="text-lg font-medium">本地时间 ({timeZoneString})</span>
                    </label>
                    <div className="flex gap-2 items-center">
                        <input
                            type="datetime-local"
                            step="1"
                            className="input input-bordered flex-1 font-mono"
                            value={localDateTime}
                            onChange={handleLocalDateTimeChange}
                        />
                    </div>
                </div>
            </div>

            <div className="card bg-base-200 shadow-xl">
                <div className="card-body">
                    <h3 className="card-title text-lg font-medium">时间格式</h3>
                    <div className="space-y-2">
                        <div className="flex justify-between items-center p-2 bg-base-300 rounded">
                            <span className="text-sm opacity-70">毫秒时间戳</span>
                            <span className="font-mono">{Number(timestamp) * 1000}</span>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-base-300 rounded">
                            <span className="text-sm opacity-70">UTC 时间</span>
                            <span className="font-mono">
                                {new Date(Number(timestamp) * 1000).toUTCString()}
                            </span>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-base-300 rounded">
                            <span className="text-sm opacity-70">本地时间</span>
                            <span className="font-mono">
                                {formatDate(Number(timestamp))}
                            </span>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-base-300 rounded">
                            <span className="text-sm opacity-70">ISO 8601</span>
                            <span className="font-mono">
                                {new Date(Number(timestamp) * 1000).toISOString()}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}; 