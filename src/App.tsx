import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { FiLayers } from 'react-icons/fi';
import { DataItemParserTool } from './components/tools/DataItemParserTool';
import FrameExtractorPage from './routes/frame-extractor';
import TaskAnalysisPage from './routes/task-analysis';
import { Toaster } from 'react-hot-toast';

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

function App() {
    return (
        <>
            {/* 现有的路由或组件 */}
            <Toaster 
                position="top-right"
                reverseOrder={false}
                toastOptions={{
                    style: {
                        borderRadius: '10px',
                        background: '#333',
                        color: '#fff',
                    },
                }}
            />
        </>
    );
}

export default App; 