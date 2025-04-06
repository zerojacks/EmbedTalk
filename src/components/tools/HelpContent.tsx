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

        case 'measurement-points':
            return (
                <div className="prose prose-sm max-w-none">
                    <h4>基本功能</h4>
                    <ul>
                        <li>测量点转DA：将测量点格式转换为DA值</li>
                        <li>DA转测量点：将DA值转换为测量点格式</li>
                    </ul>

                    <h4>输入格式说明</h4>
                    <p>测量点转DA：</p>
                    <ul>
                        <li>单个测量点：<code>1,2,3,4</code></li>
                        <li>连续测量点：<code>1-20</code></li>
                        <li>多个测量点：<code>1-10,13,15,17-20</code></li>
                    </ul>

                    <p>DA转测量点：</p>
                    <ul>
                        <li>单个DA：<code>0xFF01</code> 或 <code>FF01</code></li>
                        <li>连续DA：<code>0x1234-0x1240</code> 或 <code>1234-1240</code></li>
                        <li>多个DA：<code>0x1234,0x1235</code> 或 <code>1234,1235</code></li>
                    </ul>

                    <h4>显示模式（测量点转DA）</h4>
                    <ul>
                        <li><strong>整合显示</strong>：将连续的DA值合并显示为范围格式</li>
                        <li><strong>单点显示</strong>：每个DA值单独显示</li>
                    </ul>

                    <h4>使用示例</h4>
                    <p>测量点转DA（整合显示）：</p>
                    <div className="space-y-1">
                        <div>输入：<code>1-10,13,15,17-20</code></div>
                        <div>输出：<code>FF01,5302,0F03</code></div>
                    </div>

                    <p>测量点转DA（单点显示）：</p>
                    <div className="space-y-1">
                        <div>输入：<code>1-10,13,15,17-20</code></div>
                        <div>输出：<code>0101,0201,0401,0801,1001,2001,4001,8001,0102,0202,1002,4002,0103,0203,0403,0803</code></div>
                    </div>

                    <p>DA转测量点：</p>
                    <div className="space-y-1">
                        <div>输入：<code>FF01,5302,0F03</code></div>
                        <div>输出：<code>1,2,3,4,5,6,7,8,9,10,13,15,17,18,19,20</code></div>
                    </div>

                    <h4>注意事项</h4>
                    <ul>
                        <li>DA值支持十六进制（0x前缀）和十进制格式</li>
                        <li>连续范围使用减号（-）分隔</li>
                        <li>多个值使用逗号（,）分隔</li>
                        <li>输入格式不区分大小写</li>
                    </ul>
                </div>
            );

        case 'data-item-parser':
            return (
                <div className="prose prose-sm max-w-none">
                    <h4>基本功能</h4>
                    <ul>
                        <li>解析数据项内容</li>
                        <li>支持多种协议格式</li>
                        <li>树形表格展示结果</li>
                    </ul>

                    <h4>输入格式</h4>
                    <ul>
                        <li>数据标识：可选，用于标识当前数据的来源或类型</li>
                        <li>数据内容：需要解析的原始数据</li>
                    </ul>

                    <h4>解析结果</h4>
                    <ul>
                        <li>名称：数据项的名称或标识</li>
                        <li>值：解析后的数据值</li>
                        <li>说明：数据项的详细描述</li>
                        <li>支持多级数据项的展示</li>
                    </ul>

                    <h4>使用示例</h4>
                    <p>输入数据：</p>
                    <pre><code>68 11 11 11 11 11 11 68 91 09 06 00 00 00 00 00 16</code></pre>
                    <p>解析结果：</p>
                    <ul>
                        <li>帧起始符：68H</li>
                        <li>地址域：11 11 11 11 11 11</li>
                        <li>控制码：91H</li>
                        <li>数据长度：09H</li>
                        <li>数据域：06 00 00 00 00 00</li>
                        <li>校验码：16H</li>
                    </ul>

                    <h4>注意事项</h4>
                    <ul>
                        <li>输入数据需要符合协议格式要求</li>
                        <li>支持复制解析结果</li>
                        <li>树形结构可以展开/折叠</li>
                    </ul>
                </div>
            );

        default:
            return null;
    }
}; 