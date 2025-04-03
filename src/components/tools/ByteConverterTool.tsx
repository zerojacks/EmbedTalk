import React, { useState } from 'react';
import { FiCopy, FiCheck, FiArrowRight, FiHelpCircle } from 'react-icons/fi';
import { toast } from 'react-hot-toast';

interface ConversionResult {
    id: string;
    operation: string;
    result: string;
    sourceId: string | null; // 来源结果的ID，如果是原始输入则为null
    chain: string[]; // 操作链，记录从原始输入到当前结果的所有操作
}

const HelpDialog: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-base-100 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col">
                <div className="p-4 border-b border-base-300 flex justify-between items-center">
                    <h3 className="text-lg font-medium">使用说明</h3>
                    <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
                </div>
                <div className="p-6 overflow-y-auto">
                    <div className="prose prose-sm max-w-none">
                        <h4>基本操作</h4>
                        <p>在源数据框中输入十六进制数据，可以用空格分隔（如：<code>01 02 03</code>）</p>
                        
                        <h4>数据处理</h4>
                        <p>支持以下三种操作：</p>
                        <ul>
                            <li><strong>+0x33</strong>：每个字节加0x33</li>
                            <li><strong>-0x33</strong>：每个字节减0x33</li>
                            <li><strong>反转</strong>：反转字节顺序</li>
                        </ul>

                        <h4>结果处理</h4>
                        <ul>
                            <li>所有处理结果都会显示在右侧列表中</li>
                            <li>点击任意结果可以选中，然后继续进行处理</li>
                            <li>每个结果都会显示完整的处理链，方便追踪转换过程</li>
                            <li>点击复制按钮可以复制对应的结果到剪贴板</li>
                        </ul>

                        <h4>示例</h4>
                        <p>输入：<code>01 02 03</code></p>
                        <ul>
                            <li>+0x33 结果：<code>34 35 36</code></li>
                            <li>-0x33 结果：<code>CE CF D0</code></li>
                            <li>反转结果：<code>03 02 01</code></li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const ByteConverterTool: React.FC = () => {
    const [inputData, setInputData] = useState('');
    const [results, setResults] = useState<ConversionResult[]>([]);
    const [copied, setCopied] = useState<string | null>(null);
    const [selectedResult, setSelectedResult] = useState<string | null>(null);
    const [showHelp, setShowHelp] = useState(false);

    // 验证输入的十六进制字符串
    const isValidHexString = (str: string) => {
        return /^[0-9A-Fa-f\s]*$/.test(str);
    };

    // 将输入字符串转换为字节数组
    const parseHexString = (str: string) => {
        const cleanStr = str.replace(/\s+/g, '');
        const bytes: number[] = [];
        for (let i = 0; i < cleanStr.length; i += 2) {
            if (i + 1 >= cleanStr.length) break;
            const byte = parseInt(cleanStr.slice(i, i + 2), 16);
            bytes.push(byte);
        }
        return bytes;
    };

    // 将字节数组转换为格式化的十六进制字符串
    const formatHexString = (bytes: number[]) => {
        return bytes.map(byte => byte.toString(16).padStart(2, '0').toUpperCase()).join(' ');
    };

    // 加0x33操作
    const add0x33 = (bytes: number[]) => {
        return bytes.map(byte => (byte + 0x33) & 0xFF);
    };

    // 减0x33操作
    const sub0x33 = (bytes: number[]) => {
        return bytes.map(byte => (byte - 0x33) & 0xFF);
    };

    // 反转数据
    const reverse = (bytes: number[]) => {
        return [...bytes].reverse();
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value.toUpperCase();
        if (isValidHexString(value)) {
            setInputData(value);
        }
    };

    const processData = (operation: 'add33' | 'sub33' | 'reverse', sourceData: string, sourceId: string | null = null) => {
        try {
            const bytes = parseHexString(sourceData);
            if (bytes.length === 0) {
                toast.error('请输入有效的十六进制数据');
                return;
            }

            let result: number[];
            let operationName: string;
            switch (operation) {
                case 'add33':
                    result = add0x33(bytes);
                    operationName = '+0x33';
                    break;
                case 'sub33':
                    result = sub0x33(bytes);
                    operationName = '-0x33';
                    break;
                case 'reverse':
                    result = reverse(bytes);
                    operationName = '反转';
                    break;
                default:
                    return;
            }

            const resultHex = formatHexString(result);
            const newId = Date.now().toString();
            
            // 获取操作链
            let chain: string[] = [];
            if (sourceId) {
                const sourceResult = results.find(r => r.id === sourceId);
                if (sourceResult) {
                    chain = [...sourceResult.chain, operationName];
                }
            } else {
                chain = [operationName];
            }

            // 添加新结果到结果列表
            setResults(prev => [...prev, {
                id: newId,
                operation: operationName,
                result: resultHex,
                sourceId,
                chain
            }]);
        } catch (error) {
            toast.error('处理数据时出错');
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(text);
        setTimeout(() => setCopied(null), 2000);
        toast.success('已复制到剪贴板');
    };

    const handleResultClick = (resultId: string) => {
        setSelectedResult(resultId === selectedResult ? null : resultId);
    };

    return (
        <div className="space-y-6 p-2">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 左侧：输入和操作区域 */}
                <div className="space-y-6">
                    <div className="form-control">
                        <label className="label">
                            <span className="text-lg font-medium">源数据（十六进制）</span>
                            <span className="text-sm opacity-70">示例：01 02 03</span>
                        </label>
                        <div className="flex flex-col gap-2">
                            <textarea
                                className="textarea textarea-bordered font-mono h-24"
                                value={inputData}
                                onChange={handleInputChange}
                                placeholder="请输入十六进制数据，空格分隔（如：01 02 03）"
                            />
                            <div className="flex gap-2 justify-end">
                                <button
                                    className="btn btn-primary"
                                    onClick={() => processData('add33', inputData)}
                                    disabled={!inputData}
                                >
                                    +0x33
                                </button>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => processData('sub33', inputData)}
                                    disabled={!inputData}
                                >
                                    -0x33
                                </button>
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => processData('reverse', inputData)}
                                    disabled={!inputData}
                                >
                                    反转
                                </button>
                            </div>
                        </div>
                    </div>

                    {selectedResult && (
                        <div className="form-control">
                            <label className="label">
                                <span className="text-lg font-medium">选中的结果</span>
                                <span className="text-sm opacity-70">继续处理</span>
                            </label>
                            <div className="flex flex-col gap-2">
                                <div className="bg-base-300 p-3 rounded font-mono">
                                    {results.find(r => r.id === selectedResult)?.result}
                                </div>
                                <div className="flex gap-2 justify-end">
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => processData('add33', results.find(r => r.id === selectedResult)!.result, selectedResult)}
                                    >
                                        +0x33
                                    </button>
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => processData('sub33', results.find(r => r.id === selectedResult)!.result, selectedResult)}
                                    >
                                        -0x33
                                    </button>
                                    <button
                                        className="btn btn-secondary"
                                        onClick={() => processData('reverse', results.find(r => r.id === selectedResult)!.result, selectedResult)}
                                    >
                                        反转
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* 右侧：结果列表 */}
                <div className="space-y-4">
                    <h3 className="text-lg font-medium">转换结果</h3>
                    <div className="space-y-2">
                        {results.map((result) => (
                            <div
                                key={result.id}
                                className={`relative bg-base-200 hover:bg-base-300 cursor-pointer transition-colors rounded-lg ${
                                    selectedResult === result.id ? 'ring-2 ring-primary' : ''
                                }`}
                                onClick={() => handleResultClick(result.id)}
                            >
                                <div className="p-3">
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {result.chain.map((op, idx) => (
                                                <React.Fragment key={idx}>
                                                    {idx > 0 && <FiArrowRight className="text-base-content/50 shrink-0" />}
                                                    <span className="badge badge-primary whitespace-nowrap">{op}</span>
                                                </React.Fragment>
                                            ))}
                                        </div>
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="font-mono break-all pr-8">{result.result}</div>
                                            <button
                                                className="btn btn-ghost btn-sm !p-0 flex items-center justify-center h-8 w-8 min-h-0 absolute top-1/2 right-3 -translate-y-1/2"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    copyToClipboard(result.result);
                                                }}
                                            >
                                                {copied === result.result ? (
                                                    <FiCheck className="text-success w-4 h-4" />
                                                ) : (
                                                    <FiCopy className="w-4 h-4" />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <HelpDialog isOpen={showHelp} onClose={() => setShowHelp(false)} />
        </div>
    );
}; 