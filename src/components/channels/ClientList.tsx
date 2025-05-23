import React from 'react';
import { Send, MessageSquare } from 'lucide-react';
import { Client } from '../../types/channel';

interface ClientListProps {
    clients: Client[];
    selectedClient: Client | null;
    onClientSelect: (client: Client) => void;
}

const ClientList: React.FC<ClientListProps> = React.memo(({
    clients,
    selectedClient,
    onClientSelect
}) => {
    return (
        <div className="flex flex-col h-full">
            <div className="flex justify-between items-center mb-3 px-2">
                <h3 className="text-sm font-medium text-base-content/80">TCP客户端列表</h3>
                <span className="text-xs text-base-content/60 bg-base-300 px-2 py-0.5 rounded-full">
                    {clients.length}
                </span>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0 px-2">
                <div className="space-y-1.5">
                    {clients.map((client) => {
                        const isSelected = selectedClient?.channelId === client.channelId;
                        return (
                            <button
                                key={client.channelId}
                                onClick={() => onClientSelect(client)}
                                className={`w-full px-3 py-2 rounded-lg transition-colors duration-150
                                    ${isSelected 
                                        ? 'bg-primary/10 text-primary ring-1 ring-primary/20' 
                                        : 'text-base-content hover:bg-base-300/50'}`}
                            >
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors
                                        ${client.state === 'connected' 
                                            ? 'bg-success' 
                                            : 'bg-error'}`} 
                                    />
                                    <span className="text-sm font-medium truncate flex-1">{client.name}</span>
                                </div>
                                {(client.sentCount !== undefined || client.receivedCount !== undefined) && (
                                    <div className="text-xs text-base-content/70 flex gap-3 pl-4 mt-1">
                                        {client.sentCount !== undefined && (
                                            <span className="flex items-center gap-1">
                                                <Send className="w-3 h-3" />
                                                {client.sentCount}
                                            </span>
                                        )}
                                        {client.receivedCount !== undefined && (
                                            <span className="flex items-center gap-1">
                                                <MessageSquare className="w-3 h-3" />
                                                {client.receivedCount}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}, (prevProps, nextProps) => {
    // 自定义比较函数，只在必要时重新渲染
    return (
        prevProps.selectedClient?.channelId === nextProps.selectedClient?.channelId &&
        prevProps.clients.length === nextProps.clients.length &&
        prevProps.clients.every((client, index) => {
            const nextClient = nextProps.clients[index];
            return (
                client.channelId === nextClient.channelId &&
                client.state === nextClient.state &&
                client.sentCount === nextClient.sentCount &&
                client.receivedCount === nextClient.receivedCount
            );
        })
    );
});

ClientList.displayName = 'ClientList';

export default ClientList; 