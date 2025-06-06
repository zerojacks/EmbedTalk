import React, { useState } from 'react';
import { ToolDialog } from '../components/ToolDialog';
import { ToolCard, tools, Tool } from '../components/tools';
import { PPPFCS16Tool } from '../components/tools/PPPFCS16Tool';
import { TimeConverterTool } from '../components/tools/TimeConverterTool';
import { ByteConverterTool } from '../components/tools/ByteConverterTool';
import { MeasurementPointsTool } from '../components/tools/MeasurementPointsTool';
import { DataItemParserTool } from '../components/tools/DataItemParserTool';
import { BitPositionCalculatorTool } from '../components/tools/BitPositionCalculatorTool';

export default function Tools() {
    const [activeDialog, setActiveDialog] = useState<string | null>(null);

    const handleToolClick = (tool: Tool) => {
        if (tool.type === 'dialog') {
            setActiveDialog(tool.id);
        }
    };

    const renderToolContent = (toolId: string) => {
        switch (toolId) {
            case 'ppp-fcs16':
                return <PPPFCS16Tool />;
            case 'time-converter':
                return <TimeConverterTool />;
            case 'byte-converter':
                return <ByteConverterTool />;
            case 'measurement-points':
                return <MeasurementPointsTool />;
            case 'data-item-parser':
                return <DataItemParserTool />;
            case 'bit-position-calculator':
                return <BitPositionCalculatorTool />;
            default:
                return null;
        }
    };

    const selectedToolConfig = activeDialog ? tools.find(t => t.id === activeDialog) : null;
    
    return (
        <div className="container mx-auto px-4 py-8">
            <div className="mb-8">
                <h1 className="text-4xl font-bold mb-4">工具集合</h1>
                <p className="text-base-content/70">
                    选择下方的工具卡片来使用相应的功能
                </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {tools.map((tool) => (
                    <ToolCard
                        key={tool.id}
                        tool={tool}
                        onClick={() => handleToolClick(tool)}
                    />
                ))}
            </div>
            
            {activeDialog && selectedToolConfig && (
                <ToolDialog
                    title={selectedToolConfig.name}
                    onClose={() => setActiveDialog(null)}
                    helpId={selectedToolConfig.helpId}
                    initialWidth={800}
                    initialHeight={600}
                >
                    {renderToolContent(activeDialog)}
                </ToolDialog>
            )}
        </div>
    );
} 