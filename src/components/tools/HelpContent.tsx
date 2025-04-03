import React from 'react';

export interface HelpContentProps {
    helpId: string;
}

export const HelpContent: React.FC<HelpContentProps> = ({ helpId }) => {
    switch (helpId) {
        case 'ppp-fcs16':
            return (
                <div className="prose prose-sm max-w-none">
                    <h4>基本操作</h4>
                    <p>在输入框中输入十六进制数据，可以用空格分隔（如：<code>7E FF 03 7E</code>）</p>
                    
                    <h4>计算规则</h4>
                    <ul>
                        <li>使用 PPP 协议中定义的 FCS16 算法</li>
                        <li>支持标准的 PPP 帧格式</li>
                        <li>自动处理字节序</li>
                    </ul>

                    <h4>结果显示</h4>
                    <ul>
                        <li>计算结果以十六进制形式显示</li>
                        <li>同时提供十进制格式</li>
                        <li>支持一键复制结果</li>
                    </ul>

                    <h4>示例</h4>
                    <p>输入：<code>7E FF 03 7E</code></p>
                    <p>输出：<code>FCS16: 0x7D 0x5E</code></p>
                </div>
            );

        case 'time-converter':
            return (
                <div className="prose prose-sm max-w-none">
                    <h4>基本功能</h4>
                    <ul>
                        <li>时间戳转日期时间</li>
                        <li>日期时间转时间戳</li>
                        <li>支持多种时间戳格式</li>
                    </ul>

                    <h4>支持的格式</h4>
                    <ul>
                        <li>Unix 时间戳（秒）</li>
                        <li>Unix 时间戳（毫秒）</li>
                        <li>标准日期时间格式</li>
                        <li>自定义格式</li>
                    </ul>

                    <h4>时区处理</h4>
                    <ul>
                        <li>支持本地时区</li>
                        <li>支持 UTC 时间</li>
                        <li>可选择其他时区</li>
                    </ul>

                    <h4>使用示例</h4>
                    <p>时间戳转换：<code>1609459200</code> → <code>2021-01-01 00:00:00</code></p>
                    <p>日期转换：<code>2021-01-01 00:00:00</code> → <code>1609459200</code></p>
                </div>
            );

        case 'byte-converter':
            return (
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
            );

        default:
            return null;
    }
}; 