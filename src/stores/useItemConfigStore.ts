import { create } from 'zustand';

export interface DataItem {
    item: string;
    name?: string;
    protocol?: string;
    region?: string;
    dir?: string;
    xmlElement?: XmlElement;
}
  
export interface XmlElement {
  name: string;
  attributes: { [key: string]: string };
  value: string | null;
  children: XmlElement[];
}
  
export type DisplayType = "compents" | "xml";

interface ItemConfigState {
  searchTerm: string;
  showDropdown: boolean;
  selectedItem: DataItem;
  filteredData: DataItem[];
  isLoading: boolean;
  allitemlist: DataItem[];
  displaytype: DisplayType;
  allSelectItems: DataItem[];
  splitSize: number[];
  
  // Actions to update the state
  setSearchTerm: (term: string) => void;
  setShowDropdown: (show: boolean) => void;
  setFilteredData: (items: DataItem[]) => void;
  setSelectedItem: (item: DataItem) => void;
  setIsLoading: (loading: boolean) => void;
  setAllitemlist: (items: DataItem[]) => void;
  setDisplaytype: (type: DisplayType) => void;
  setAllSelectItems: (items: DataItem[]) => void;
  setSplitSize: (size: number[]) => void;
}

export const useItemConfigStore = create<ItemConfigState>((set) => ({
  searchTerm: '',
  showDropdown: false,
  selectedItem: {} as DataItem,
  filteredData: [],
  isLoading: false,
  allitemlist: [],
  displaytype: 'compents',
  allSelectItems: [],
  splitSize: [50,50],

  // Actions to update the state
  setSearchTerm: (term: string) => set({ searchTerm: term }),
  setShowDropdown: (show: boolean) => set({ showDropdown: show }),
  setFilteredData: (items: DataItem[]) => set({ filteredData: items }),
  setSelectedItem: (item: DataItem) => set({ selectedItem: item }),
  setIsLoading: (loading: boolean) => set({ isLoading: loading }),
  setAllitemlist: (items: DataItem[]) => set({ allitemlist: items }),
  setDisplaytype: (type: DisplayType) => set({ displaytype: type }),
  setAllSelectItems: (items: DataItem[]) => set({ allSelectItems: items }),
  setSplitSize: (size: number[]) => set({ splitSize: size }),
}));
