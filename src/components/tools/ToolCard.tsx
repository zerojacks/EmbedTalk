import React from 'react';

export interface Tool {
    id: string;
    name: string;
    description: string;
    icon: string;
    type: 'dialog';
}

interface ToolCardProps {
    tool: Tool;
    onClick: () => void;
}

export const ToolCard: React.FC<ToolCardProps> = ({ tool, onClick }) => (
    <div
        className="card bg-base-200 hover:bg-base-300 transition-all duration-300 cursor-pointer group"
        onClick={onClick}
    >
        <div className="card-body p-6">
            <div className="flex items-center gap-6">
                <div className="text-5xl transform group-hover:scale-110 transition-transform duration-300">
                    {tool.icon}
                </div>
                <div className="flex-1">
                    <h2 className="card-title text-xl mb-2 group-hover:text-primary transition-colors duration-300">
                        {tool.name}
                    </h2>
                    <p className="text-sm opacity-70 line-clamp-2">
                        {tool.description}
                    </p>
                </div>
            </div>
        </div>
    </div>
); 