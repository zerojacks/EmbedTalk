import React, { useState } from 'react';
import { TreeTable } from 'primereact/treetable';
import { Column } from 'primereact/column';
import { TreeNode } from 'primereact/treenode';

export interface TreeItemType {
    frameDomain: string;
    data: string;
    description: string;
    position?: number[];
    color?: string | null;
    children?: TreeItemType[];
}

interface TreeTableViewProps {
    data: TreeItemType[];
    onRowClick: (item: TreeItemType) => void;
}

interface ExtendedTreeNode extends TreeNode {
    originalData?: TreeItemType;
}

const convertToTreeNode = (items: TreeItemType[]): ExtendedTreeNode[] => {
    return items.map((item, index) => {
        const node: ExtendedTreeNode = {
            key: index.toString(),
            data: {
                frameDomain: item.frameDomain,
                data: item.data,
                description: item.description
            },
            originalData: item,
            children: item.children ? convertToTreeNode(item.children) : undefined
        };
        return node;
    });
};

export const TreeTableView: React.FC<TreeTableViewProps> = ({ data, onRowClick }) => {
    const [nodes] = useState<ExtendedTreeNode[]>(convertToTreeNode(data));
    // const [selectedNode, setSelectedNode] = useState<ExtendedTreeNode | null>(null);

    const handleSelectionChange = (e: any ) => {
        // setSelectedNode(e.value);
        if (e.value?.originalData) {
            onRowClick(e.value.originalData);
        }
    };

    return (
        <div className="card w-full h-full">
            <TreeTable
                value={nodes}
                tableStyle={{ minWidth: '50rem' }}
                scrollable
                resizableColumns
                columnResizeMode="expand"
                stateStorage="session"
                selectionMode="single"
                onRowClick={handleSelectionChange}
            >
                <Column
                    field="frameDomain"
                    header="帧域"
                    className="truncate"
                    expander
                />
                <Column
                    field="data"
                    header="数据"
                    className="truncate"
                />
                <Column
                    field="description"
                    header="说明"
                    className="truncate"
                />
            </TreeTable>
        </div>
    );
};