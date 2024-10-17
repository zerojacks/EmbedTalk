import { create } from 'zustand';
import { TreeItem } from '../components/TreeItem'

interface FrameTreeState {
    selectedRowId: string | null;
    expandedRows: Set<string>;
    tabledata: TreeItem[];
    selectedCell: { row: number | null; column: number | null };
    isLoading: boolean;
    expandedAll: boolean;
    splitSize: number[];
    
    // Actions to update the state
    setSelectedRowId: (rowid: string | null) => void;
    setExpandedRows: (rows: Set<string>) => void;
    setTableData: (tabledata: TreeItem[]) => void;
    setSelectedCell: (cell: {row: number | null; column: number | null} ) => void;
    setIsLoading: (loading: boolean) => void;
    setExpandedAll: (state: boolean) => void;
    setSplitSize: (size: number[]) => void;
  }
  
  export const useFrameTreeStore = create<FrameTreeState>((set) => ({
    selectedRowId: null,
    expandedRows: new Set(),
    tabledata: [],
    selectedCell: { row: null, column: null },
    isLoading: false,
    expandedAll: true,
    splitSize: [30,70],
    
    // Actions to update the state
    setSelectedRowId: (rowid: string | null) => set({ selectedRowId: rowid}),
    setExpandedRows: (rows: Set<string>) => set({ expandedRows: rows }),
    setTableData: (tabledata: TreeItem[]) => set({ tabledata: tabledata }),
    setSelectedCell: (cell: {row: number | null; column: number | null} ) => set({ selectedCell: cell }),
    setIsLoading: (loading: boolean) => set({ isLoading: loading }),
    setExpandedAll: (state: boolean) => set({ expandedAll: state }),
    setSplitSize: (size: number[]) => set({ splitSize: size }),
  }));