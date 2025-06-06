import React, { useState } from 'react';

export function BitPositionCalculatorTool() {
    const [hexString, setHexString] = useState('');
    const [bitPositions, setBitPositions] = useState<number[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [hasAttemptedCalculationWithValidInput, setHasAttemptedCalculationWithValidInput] = useState(false);

    const calculateBitPositions = () => {
        setError(null);
        setBitPositions([]);
        setHasAttemptedCalculationWithValidInput(false); // 每次调用时重置

        const cleanedHexString = hexString.replace(/\s+/g, '');

        if (!cleanedHexString.trim()) {
            // setError('十六进制字符串不能为空。'); // 允许初始状态或清除时为空
            return;
        }
        if (cleanedHexString.length % 2 !== 0) {
            setError('十六进制字符串必须有偶数个字符。');
            return;
        }
        if (!/^[0-9a-fA-F]*$/.test(cleanedHexString)) {
            setError('十六进制字符串只能包含十六进制字符 (0-9, a-f, A-F)。');
            return;
        }

        // 如果所有验证通过且清理后的输入不为空
        setHasAttemptedCalculationWithValidInput(true);

        const positions: number[] = [];
        for (let i = 0; i < cleanedHexString.length; i += 2) {
            const byteHex = cleanedHexString.substring(i, i + 2);
            const byteValue = parseInt(byteHex, 16);
            const byteIndex = i / 2; // 字节索引

            for (let bitInByte = 0; bitInByte < 8; bitInByte++) {
                // 检查字节中的每一位 (LSB first)
                if ((byteValue & (1 << bitInByte)) !== 0) {
                    // bit的全局位置 = (字节索引 * 8) + bit在字节内的位置
                    positions.push(byteIndex * 8 + bitInByte);
                }
            }
        }
        setBitPositions(positions);
    };

    return (
        <div className="p-6 space-y-6 flex flex-col h-full">
            <div className="form-control w-full">
                <label htmlFor="hexInput" className="label">
                    <span className="label-text">十六进制字符串:</span>
                </label>
                <input
                    type="text"
                    id="hexInput"
                    value={hexString}
                    onChange={(e) => setHexString(e.target.value)}
                    placeholder="例如：000000000000f81f0000000000000000"
                    className="input input-bordered w-full"
                />
            </div>
            <button onClick={calculateBitPositions} className="btn btn-primary w-full sm:w-auto">
                计算置1的Bit位
            </button>
            {error && <div role="alert" className="alert alert-error text-sm"><svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2 2m2-2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><span>{error}</span></div>}
            {bitPositions.length > 0 && (
                <div className="mt-4 flex-grow flex flex-col">
                    <h3 className="font-semibold text-base-content mb-2">置1的Bit位 (0索引, 低位在前):</h3>
                    <div className="p-3 bg-base-200 rounded-box flex-grow overflow-auto">
                        <p className="text-base-content/90 break-words whitespace-pre-wrap font-mono text-sm">
                            {bitPositions.join(', ')}
                        </p>
                    </div>
                </div>
            )}
             {bitPositions.length === 0 && !error && hasAttemptedCalculationWithValidInput && (
                 <div role="alert" className="alert alert-info text-sm"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg><span>提供的字符串中没有置1的Bit位。</span></div>
             )}
        </div>
    );
}
