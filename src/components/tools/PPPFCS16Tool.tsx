import React, { useState } from 'react';
import { invoke } from "@tauri-apps/api/core";
import { toast } from 'react-hot-toast';
import { FiCopy, FiCheck, FiRefreshCw } from 'react-icons/fi';

export const PPPFCS16Tool: React.FC = () => {
    const [input, setInput] = useState('');
    const [result, setResult] = useState<{
        hex: string;
        dec: number;
    } | null>(null);
    const [copiedHex, setCopiedHex] = useState(false);
    const [copiedDec, setCopiedDec] = useState(false);
    const [isCalculating, setIsCalculating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const calculateFCS = async () => {
        // 验证输入长度是否为偶数
        if (input.length % 2 !== 0) {
            setError('输入的16进制字符串长度必须是偶数（每个字节两位）');
            return;
        }

        try {
            setIsCalculating(true);
            setError(null);
            const fcs = await invoke<number>('caculate_pppfcs16', { frame: input });
            setResult({
                hex: fcs.toString(16).toUpperCase().padStart(4, '0'),
                dec: fcs
            });
        } catch (error) {
            toast.error('计算失败: ' + (error as Error).message);
        } finally {
            setIsCalculating(false);
        }
    };

    const copyToClipboard = (text: string, type: 'hex' | 'dec') => {
        navigator.clipboard.writeText(text);
        if (type === 'hex') {
            setCopiedHex(true);
            setTimeout(() => setCopiedHex(false), 2000);
        } else {
            setCopiedDec(true);
            setTimeout(() => setCopiedDec(false), 2000);
        }
        toast.success('已复制到剪贴板');
    };

    const formatInput = (text: string) => {
        // 移除所有空格和换行符
        const cleaned = text.replace(/[\s\n]/g, '');
        // 每两个字符添加一个空格
        return cleaned.replace(/(.{2})/g, '$1 ').trim();
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        setError(null); // 清除错误提示
        // 只允许输入16进制字符和空格
        if (/^[0-9A-Fa-f\s]*$/.test(value)) {
            const cleanedValue = value.replace(/\s/g, '');
            setInput(cleanedValue);
            
            // 实时验证输入长度
            if (cleanedValue.length > 0 && cleanedValue.length % 2 !== 0) {
                setError('输入的16进制字符串长度必须是偶数（每个字节两位）');
            }
        }
    };

    const clearInput = () => {
        setInput('');
        setResult(null);
        setError(null);
    };

    return (
        <div className="space-y-6 p-2">
            <div className="form-control">
                <div className="flex items-center justify-between mb-2">
                    <label className="text-lg font-medium flex items-center gap-2">
                        <span>输入16进制数据</span>
                        {input && (
                            <button 
                                className="btn btn-ghost btn-xs"
                                onClick={clearInput}
                            >
                                清除
                            </button>
                        )}
                    </label>
                    <div className="text-sm opacity-70">
                        {input ? `${input.length / 2} 字节` : ''}
                    </div>
                </div>
                <textarea
                    className={`textarea textarea-bordered h-32 font-mono text-lg bg-base-100 ${error ? 'textarea-error' : ''}`}
                    value={formatInput(input)}
                    onChange={handleInputChange}
                    placeholder="例如: 01 02 03"
                />
                {error && (
                    <div className="text-error text-sm mt-2">
                        {error}
                    </div>
                )}
            </div>
            
            <div className="flex justify-end">
                <button 
                    className={`btn btn-primary gap-2 min-w-[120px] ${isCalculating ? 'loading' : ''}`}
                    onClick={calculateFCS}
                    disabled={!input || isCalculating || !!error}
                >
                    {isCalculating ? (
                        <span>计算中...</span>
                    ) : (
                        <>
                            <span>计算 FCS16</span>
                            <FiRefreshCw className={`w-4 h-4 ${result ? '' : 'hidden'}`} />
                        </>
                    )}
                </button>
            </div>

            {result && (
                <div className="card bg-base-200 shadow-xl">
                    <div className="card-body">
                        <h3 className="card-title text-lg font-medium">计算结果</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex items-center justify-between p-4 bg-base-300 rounded-lg">
                                <div>
                                    <div className="text-sm opacity-70">16进制</div>
                                    <div className="text-2xl font-mono">{result.hex}</div>
                                </div>
                                <button 
                                    className="btn btn-ghost btn-sm tooltip tooltip-left"
                                    data-tip="复制16进制结果"
                                    onClick={() => copyToClipboard(result.hex, 'hex')}
                                >
                                    {copiedHex ? <FiCheck className="text-success" /> : <FiCopy />}
                                </button>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-base-300 rounded-lg">
                                <div>
                                    <div className="text-sm opacity-70">10进制</div>
                                    <div className="text-2xl font-mono">{result.dec}</div>
                                </div>
                                <button 
                                    className="btn btn-ghost btn-sm tooltip tooltip-left"
                                    data-tip="复制10进制结果"
                                    onClick={() => copyToClipboard(result.dec.toString(), 'dec')}
                                >
                                    {copiedDec ? <FiCheck className="text-success" /> : <FiCopy />}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}; 