import { FiLayers } from 'react-icons/fi';
import { DataItemParserTool } from './components/tools/DataItemParserTool';
import FrameExtractorPage from './routes/frame-extractor';

const tools = [
    // ... 其他工具 ...
    {
        id: 'data-item-parser',
        name: '数据项解析',
        description: '解析数据项内容，支持多种协议格式',
        icon: <FiLayers className="w-5 h-5" />,
        component: DataItemParserTool,
    },
]; 