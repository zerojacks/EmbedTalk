import { invoke } from '@tauri-apps/api/core';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { FixedSizeList, ListChildComponentProps } from 'react-window';

interface DataItem {
  item: string,
  name?: string,
  protocol?: string,
  region?: string,
  dir?: string,
}


export interface XmlElement {
  name: string;
  attributes: { [key: string]: string };
  value: string | null;
  children: XmlElement[];
}

export default function Itemconfig() {
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [splitPosition, setSplitPosition] = useState<number>(50);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const [filteredData, setFilteredData] = useState<DataItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<DataItem>({} as DataItem);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [allitemlist, setAllitemlist] = useState<DataItem[]>([]);
  
  // Add a ref to track whether the search term change is from selection
  const isSelecting = useRef(false);

  const asyncSearch = async (term: string): Promise<DataItem[]> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const isHex = /^[0-9a-fA-F]+$/.test(term);
  
        const results = allitemlist.filter(item => {
          if (isHex) {
            const regex = new RegExp(`^${term}`, 'i');
            return regex.test(item.item);
          } else {
            return item.name && item.name.toLowerCase().includes(term.toLowerCase());
          }
        });
  
        resolve(results);
      }, 300);
    });
  };

  useEffect(() => {
    async function getallitemlist() {
      try {
        const allitemlist = await invoke<DataItem[]>('get_all_config_item_lists');
        setAllitemlist(allitemlist);
      } catch (error) {
        console.error('get_all_config_item_lists error:', error);
      }
    }
    getallitemlist();
  }, []);

  // Modified search effect to use isSelecting ref
  useEffect(() => {
    if (isSelecting.current) {
      isSelecting.current = false;
      return;
    }

    let debounceTimeout: NodeJS.Timeout;

    const performSearch = async () => {
      if (searchTerm.trim() === '') {
        setFilteredData([]);
        setShowDropdown(false);
        return;
      }

      setIsLoading(true);
      try {
        const results = await asyncSearch(searchTerm);
        setFilteredData(results);
        setShowDropdown(true);
      } catch (error) {
        console.error('Search error:', error);
        setFilteredData([]);
      } finally {
        setIsLoading(false);
      }
    };

    debounceTimeout = setTimeout(performSearch, 300);

    return () => {
      clearTimeout(debounceTimeout);
    };
  }, [searchTerm]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      selectItem({ item: searchTerm });
    }
  };

  const selectItem = (item: DataItem) => {
    isSelecting.current = true; // Set the ref before updating state
    setSearchTerm(item.item);
    setSelectedItem(item);
    setShowDropdown(false);
  };


  useEffect(() => {
    async function get_selected_config_item() {
      try {
        console.log(selectedItem);
        const element = await invoke<XmlElement>('get_protocol_config_item', { value: JSON.stringify(selectedItem) });
        console.log(element);
      } catch (error) {
          console.error('get_selected_config_item error:', error);
        }
      }
      get_selected_config_item();
  }, [selectedItem]);


  const startResize = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    setIsResizing(true);
    e.preventDefault();
  }, []);

  const stopResize = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isResizing) {
      const container = e.currentTarget;
      const containerRect = container.getBoundingClientRect();
      const newPosition = ((e.clientX - containerRect.left) / containerRect.width) * 100;
      setSplitPosition(Math.min(Math.max(newPosition, 30), 80));
    }
  }, [isResizing]);

  const Row: React.FC<ListChildComponentProps> = ({ index, style }) => {
    const item = filteredData[index];
  
    return (
      <div
        className="flex items-center px-4 py-2 hover:bg-gray-100 cursor-pointer"
        style={style}
        onClick={() => selectItem(item)}
      >
        <span className="mr-2">{item.item}</span>
        {item.name && <span className="mr-2">{item.name}</span>}
        {item.protocol && <span className="mr-2">{item.protocol}</span>}
        {item.region && <span>{item.region}</span>}
      </div>
    );
  };

  return (
    <div className="w-full h-full">
      <div
        className="relative w-full h-full flex"
        onMouseMove={resize}
        onMouseUp={stopResize}
        onMouseLeave={stopResize}
      >
        <div
          className="h-full overflow-auto"
          style={{ width: `${splitPosition}%` }}
        >
          <div className="p-4">
            <div className="flex items-center gap-2 m-2 relative">
              <label className="flex-shrink-0">数据标识</label>
              <div className="relative flex-grow">
                <label className="input input-bordered flex items-center gap-2 w-full">
                  <input 
                    type="text" 
                    className="grow" 
                    placeholder="Search" 
                    value={searchTerm}
                    onChange={handleTextChange}
                    onKeyDown={handleKeyDown}
                    onFocus={() => searchTerm.trim() !== '' && setShowDropdown(true)}
                  />
                  {isLoading ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-500 border-t-transparent" />
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                      className="h-4 w-4 opacity-70"
                    >
                      <path
                        fillRule="evenodd"
                        d="M9.965 11.026a5 5 0 1 1 1.06-1.06l2.755 2.754a.75.75 0 1 1-1.06 1.06l-2.755-2.754ZM10.5 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </label>
                {showDropdown && filteredData.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-transparent border rounded-md shadow-lg">
                    <FixedSizeList
                      height={Math.min(200, filteredData.length * 40)}
                      itemCount={filteredData.length}
                      itemSize={40}
                      width="100%"
                    >
                      {Row}
                    </FixedSizeList>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div
          className="absolute top-0 bottom-0 w-0.5 bg-gray-200 cursor-col-resize hover:bg-blue-500 active:bg-blue-600"
          style={{ left: `${splitPosition}%` }}
          onMouseDown={startResize}
        />

        <div
          className="h-full overflow-auto"
          style={{ width: `${100 - splitPosition}%` }}
        >
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-2">选中的内容</h2>
            {selectedItem ? (
              <p className="p-2  rounded">{selectedItem.item}</p>
            ) : (
              <p className="text-gray-500">尚未选择任何内容</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}