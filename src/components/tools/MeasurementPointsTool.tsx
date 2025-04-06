import { useState, ChangeEvent, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { FiCopy, FiCheck } from 'react-icons/fi';
import { toast } from 'react-hot-toast';

type ConversionMode = 'point_to_da' | 'da_to_point';
type DisplayMode = 'continuous' | 'single';

export const MeasurementPointsTool: React.FC = () => {
    const [input, setInput] = useState('');
    const [result, setResult] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<ConversionMode>('point_to_da');
    const [displayMode, setDisplayMode] = useState<DisplayMode>('continuous');
    const [copied, setCopied] = useState(false);

    const handleConvert = useCallback(async (currentInput: string, currentMode: ConversionMode, currentDisplayMode: DisplayMode) => {
        if (!currentInput.trim()) {
            setError('请输入需要转换的数据');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const result = await invoke('da_and_measure_point_exchange', {
                input: currentInput.trim(),
                convertType: currentMode,
                continuous: currentDisplayMode === 'continuous'
            });
            setResult(result as string);
        } catch (err) {
            setError((err as Error).message);
            setResult(null);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleModeChange = (newMode: ConversionMode) => {
        setMode(newMode);
        setResult(null);
        setError(null);
        setInput('');
    };

    const handleDisplayModeChange = (newDisplayMode: DisplayMode) => {
        setDisplayMode(newDisplayMode);
        if (input.trim() && mode === 'point_to_da') {
            handleConvert(input, mode, newDisplayMode);
        }
    };

    const copyToClipboard = async () => {
        if (result) {
            await navigator.clipboard.writeText(result);
            setCopied(true);
            toast.success('已复制到剪贴板');
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const getPlaceholder = (): string => {
        if (mode === 'point_to_da') {
            return '请输入测量点，支持以下格式：\n' +
                '单个测量点：1,2,3,4\n' +
                '连续测量点：1-10,13,15,17-20\n' +
                '多个测量点：1,2,3,4,5,6,7,8,99';
        } else {
            return '请输入DA值，支持以下格式：\n' +
                '单个DA：0x1234 或 1234\n' +
                '连续DA：0x1234-0x1240 或 1234-1240\n' +
                '多个DA：0x1234,0x1235 或 1234,1235';
        }
    };

    return (
        <div className="flex flex-col gap-6 p-6">
            {/* 主要操作区域 */}
            <div className="flex flex-col gap-4">
                {/* 转换模式选择 - Tab样式 */}
                <div role="tablist" className="tabs tabs-border w-full relative">
                    <button
                        role="tab"
                        className={`tab flex-1 ${mode === 'point_to_da' ? 'tab-active' : ''}`}
                        onClick={() => handleModeChange('point_to_da')}
                    >
                        测量点转DA
                    </button>
                    <button
                        role="tab"
                        className={`tab flex-1 ${mode === 'da_to_point' ? 'tab-active' : ''}`}
                        onClick={() => handleModeChange('da_to_point')}
                    >
                        DA转测量点
                    </button>
                    {/* 选中指示器 */}
                    <div
                        className={`absolute bottom-0 h-0.5 bg-primary transition-all duration-200 ease-out`}
                        style={{
                            width: '50%',
                            left: mode === 'point_to_da' ? '0%' : '50%'
                        }}
                    />
                </div>

                {/* 显示模式选择 - Radio样式 */}
                {mode === 'point_to_da' && (
                    <div className="flex gap-6 px-1">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                className="radio radio-primary"
                                checked={displayMode === 'continuous'}
                                onChange={() => handleDisplayModeChange('continuous')}
                            />
                            <span className="text-sm">整合显示</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                className="radio radio-primary"
                                checked={displayMode === 'single'}
                                onChange={() => handleDisplayModeChange('single')}
                            />
                            <span className="text-sm">单点显示</span>
                        </label>
                    </div>
                )}

                {/* 输入区域 */}
                <textarea
                    value={input}
                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value)}
                    placeholder={getPlaceholder()}
                    className="w-full h-32 p-4 bg-card rounded-xl font-mono text-sm resize-none
                        border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary
                        placeholder:text-muted-foreground"
                />

                {/* 转换按钮 */}
                <button
                    onClick={() => handleConvert(input, mode, displayMode)}
                    disabled={loading}
                    className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium
                        disabled:opacity-50 disabled:cursor-not-allowed transition-all
                        hover:bg-primary/90 active:bg-primary/80"
                >
                    {loading ? '转换中...' : '转换'}
                </button>
            </div>

            {/* 错误提示 */}
            {error && (
                <div className="p-4 rounded-xl bg-destructive/10 text-destructive text-sm">
                    {error}
                </div>
            )}

            {/* 结果显示区域 */}
            {result && (
                <div className="rounded-xl bg-card overflow-hidden border border-border/50">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-card-header">
                        <span className="text-sm text-muted-foreground">
                            {mode === 'point_to_da'
                                ? `转换模式: ${displayMode === 'continuous' ? '整合显示' : '单点显示'}`
                                : '测量点列表'
                            }
                        </span>
                        <button
                            onClick={copyToClipboard}
                            className="btn btn-ghost btn-sm tooltip tooltip-left"
                            title="复制结果"
                        >
                            {copied ? (
                                <FiCheck className="text-success w-4 h-4" />
                            ) : (
                                <FiCopy className="w-4 h-4" />
                            )}
                        </button>
                    </div>
                    <div className="p-4 max-h-[200px] overflow-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-card">
                        {mode === 'point_to_da' ? (
                            <div className="font-mono text-sm space-y-1.5">
                                {result.split(',').map((item, index) => (
                                    <div key={index} className="text-primary flex items-center gap-2">
                                        <span className="text-muted-foreground opacity-50">{index + 1}.</span>
                                        {item.trim()}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="font-mono text-sm space-y-1.5">
                                {result.split(',').map((item, index) => (
                                    <div key={index} className="text-success flex items-center gap-2">
                                        <span className="text-muted-foreground opacity-50">{index + 1}.</span>
                                        {item.trim()}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}; 