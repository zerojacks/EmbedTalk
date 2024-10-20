import { create } from 'zustand';
import { TreeItemType } from '../components/TreeItem'

interface FrameTreeState {
    frame: string,
    selectedRowId: string | null;
    expandedRows: Set<string>;
    tabledata: TreeItemType[];
    selectedCell: { row: number | null; column: number | null };
    isLoading: boolean;
    expandedAll: boolean;
    splitSize: number[];
    selectedframe: number[];
    frameScroll: number[];
    treeScrollPosition: number;

    // Actions to update the state
    setFrame: (frame: string) => void;
    setSelectedRowId: (rowid: string | null) => void;
    setExpandedRows: (rows: Set<string>) => void;
    setTableData: (tabledata: TreeItemType[]) => void;
    setSelectedCell: (cell: {row: number | null; column: number | null} ) => void;
    setIsLoading: (loading: boolean) => void;
    setExpandedAll: (state: boolean) => void;
    setSplitSize: (size: number[]) => void;
    setSelectedFrame: (frame: number[]) => void;
    setFrameScroll: (scroll: number[]) => void;
    setTreeScrollPosition: (position: number) => void;
  }
  
  export const useFrameTreeStore = create<FrameTreeState>((set) => ({
    frame: '',
    selectedRowId: null,
    expandedRows: new Set(),
    tabledata: [],
    selectedCell: { row: null, column: null },
    isLoading: false,
    expandedAll: true,
    splitSize: [30,70],
    selectedframe: [0,0],
    frameScroll: [0,0],
    treeScrollPosition: 0,
    // Actions to update the state
    setFrame: (frame: string) => set({ frame: frame }),
    setSelectedRowId: (rowid: string | null) => set({ selectedRowId: rowid}),
    setExpandedRows: (rows: Set<string>) => set(() => ({ expandedRows: new Set(rows) })), 
    setTableData: (tabledata: TreeItemType[]) => set({ tabledata: tabledata }),
    setSelectedCell: (cell: {row: number | null; column: number | null} ) => set({ selectedCell: cell }),
    setIsLoading: (loading: boolean) => set({ isLoading: loading }),
    setExpandedAll: (state: boolean) => set({ expandedAll: state }),
    setSplitSize: (size: number[]) => set({ splitSize: size }),
    setSelectedFrame: (frame: number[]) => set({ selectedframe: frame }),
    setFrameScroll: (scroll: number[]) => set({ frameScroll: scroll }),
    setTreeScrollPosition: (position: number) => set({ treeScrollPosition: position }),
  }));