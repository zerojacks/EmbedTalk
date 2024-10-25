// treeTableStore.ts
import { create } from 'zustand';
import { ExtendedTreeNode } from '../components/TreeTable'
interface ColumnWidth {
    frameDomain: number;
    data: number;
    description: number;
    [key: string]: number;  // 为了支持动态列名
}

interface TreeTableState {
    selectedCell: string | null;
    selectNode: ExtendedTreeNode | null;
    expandedKeys: { [key: string]: boolean };
    columnWidths: ColumnWidth;
    expandAll: boolean;

    setSelectedCell: (cell: string | null) => void;
    setSelectNode: (node: ExtendedTreeNode | null) => void;
    setExpandedKeys: (keys: { [key: string]: boolean }) => void;
    setColumnWidth: (column: keyof ColumnWidth, width: number) => void;
    resetState: () => void;
    setExpandAll: (state: boolean) => void;
}

const defaultColumnWidths: ColumnWidth = {
    frameDomain: 200,
    data: 150,
    description: 300,
};

export const useTreeTableStore = create<TreeTableState>((set) => ({
    selectedCell: null,
    selectNode: null,
    expandedKeys: {},
    columnWidths: defaultColumnWidths,
    expandAll: true,

    setSelectedCell: (cell) => set({ selectedCell: cell }),
    setSelectNode: (node) => set({ selectNode: node }),
    setExpandedKeys: (keys) => set({ expandedKeys: keys }),

    setColumnWidth: (column, width) =>
        set((state) => ({
            columnWidths: {
                ...state.columnWidths,
                [column]: width,
            },
        })),

    resetState: () => set({
        selectedCell: null,
        selectNode: null,
        expandedKeys: {},
        columnWidths: defaultColumnWidths,
        expandAll: true,
    }),
    setExpandAll: (state) => set({ expandAll:  state}),
}));
