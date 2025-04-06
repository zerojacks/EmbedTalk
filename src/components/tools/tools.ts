import { Tool } from './types';

export const tools: Tool[] = [
    {
        id: 'ppp-fcs16',
        name: 'PPP FCS16 计算器',
        description: '计算PPP帧校验序列(FCS)',
        icon: '🔢',
        type: 'dialog',
        helpId: 'ppp-fcs16'
    },
    {
        id: 'time-converter',
        name: '时间转换工具',
        description: '时间戳与日期时间互转',
        icon: '⏰',
        type: 'dialog',
        helpId: 'time-converter'
    },
    {
        id: 'byte-converter',
        name: '字节转换工具',
        description: '字节加减0x33和数据反转',
        icon: '🔄',
        type: 'dialog',
        helpId: 'byte-converter'
    },
    {
        id: 'measurement-points',
        name: '测量点转换工具',
        description: '测量点与DA之间互相转换',
        icon: '📊',
        type: 'dialog',
        helpId: 'measurement-points'
    },
    {
        id: 'data-item-parser',
        name: '数据项解析工具',
        description: '解析数据项内容',
        icon: '📝',
        type: 'dialog',
        helpId: 'data-item-parser'
    }
]; 