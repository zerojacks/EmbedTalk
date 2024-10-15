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
  isResizing: boolean;
  splitPosition: number;
  searchTerm: string;
  showDropdown: boolean;
  filteredData: DataItem[];
  selectedItem: DataItem;
  isLoading: boolean;
  allitemlist: DataItem[];
  selectXml: XmlElement;
  displaytype: DisplayType;
  allSelectItems: DataItem[];
  
  // Actions to update the state
  setIsResizing: (isResizing: boolean) => void;
  setSplitPosition: (position: number) => void;
  setSearchTerm: (term: string) => void;
  setShowDropdown: (show: boolean) => void;
  setFilteredData: (data: DataItem[]) => void;
  setSelectedItem: (item: DataItem) => void;
  setIsLoading: (loading: boolean) => void;
  setAllitemlist: (items: DataItem[]) => void;
  setSelectXml: (xml: XmlElement) => void;
  setDisplaytype: (type: DisplayType) => void;
  setAllSelectItems: (items: DataItem[]) => void;
}

export const useItemConfigStore = create<ItemConfigState>((set) => ({
  isResizing: false,
  splitPosition: 50,
  searchTerm: '',
  showDropdown: false,
  filteredData: [],
  selectedItem: {} as DataItem,
  isLoading: false,
  allitemlist: [],
  selectXml: {} as XmlElement,
  displaytype: 'xml',
  allSelectItems: [],

  // Actions to update the state
  setIsResizing: (isResizing: boolean) => set({ isResizing }),
  setSplitPosition: (position: number) => set({ splitPosition: position }),
  setSearchTerm: (term: string) => set({ searchTerm: term }),
  setShowDropdown: (show: boolean) => set({ showDropdown: show }),
  setFilteredData: (data: DataItem[]) => set({ filteredData: data }),
  setSelectedItem: (item: DataItem) => set({ selectedItem: item }),
  setIsLoading: (loading: boolean) => set({ isLoading: loading }),
  setAllitemlist: (items: DataItem[]) => set({ allitemlist: items }),
  setSelectXml: (xml: XmlElement) => set({ selectXml: xml }),
  setDisplaytype: (type: DisplayType) => set({ displaytype: type }),
  setAllSelectItems: (items: DataItem[]) => set({ allSelectItems: items }),
}));
