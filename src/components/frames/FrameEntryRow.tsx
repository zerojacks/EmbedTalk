import React from 'react';
import { FrameEntry } from '../../types/frameTypes';

interface FrameEntryRowProps {
    entry: FrameEntry;
}

export const FrameEntryRow: React.FC<FrameEntryRowProps> = ({ entry }) => {
    const tagName = entry.tag_name ? entry.tag + ":" + entry.tag_name : entry.tag.toString();
    const portName = entry.port_name ? entry.port + ":" + entry.port_name : entry.port.toString();
    const protocolName = entry.protocol_name ? entry.protocol + ":" + entry.protocol_name : entry.protocol.toString();
    const directionName = entry.direction_name ? entry.direction_name : entry.direction.toString();

    return (
        <tr className="border-b border-base-200/50 hover:bg-base-200/30 transition-colors text-xs">
            <td className="py-1.5 px-2 font-mono whitespace-nowrap" style={{ width: '180px', minWidth: '180px', maxWidth: '180px' }}>
                {entry.timestamp}
            </td>
            <td className="py-1.5 px-2 text-center whitespace-nowrap" style={{ width: '50px', minWidth: '50px', maxWidth: '50px' }}>
                {entry.pid}
            </td>
            <td className="py-1.5 px-2 text-center whitespace-nowrap" style={{ width: '120px', minWidth: '120px', maxWidth: '120px' }}>
                {tagName}
            </td>
            <td className="py-1.5 px-2 text-center whitespace-nowrap" style={{ width: '120px', minWidth: '120px', maxWidth: '120px' }}>
                {portName}
            </td>
            <td className="py-1.5 px-2 text-center whitespace-nowrap" style={{ width: '120px', minWidth: '120px', maxWidth: '120px' }}>
                {protocolName}
            </td>
            <td className={`py-1.5 px-2 text-center whitespace-nowrap ${entry.direction === 0 ? 'text-info' : 'text-success'}`} style={{ width: '60px', minWidth: '60px', maxWidth: '60px' }}>
                {directionName}
            </td>
            <td className="py-1.5 px-2 font-mono break-all">
                <div className="flex items-center space-x-2">
                    <span className="text-base-content/70 break-all whitespace-pre-wrap flex-1">
                        {entry.content}
                    </span>
                </div>
            </td>
        </tr>
    );
}; 