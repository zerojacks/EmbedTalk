import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { FixedSizeList, ListChildComponentProps } from 'react-window';

interface DataItem {
  id: number;
  name: string;
}

const DATA: DataItem[] = [
  { id: 1, name: 'Item 1' },
  { id: 2, name: 'Item 2' },
  { id: 3, name: 'Item 3' },
  { id: 4, name: 'Item 4' },
  { id: 5, name: 'Different 5' },
  { id: 6, name: 'Something 6' },
  { id: 7, name: 'Another 7' },
  { id: 8, name: 'Last 8' },
];

export default function Itemconfig() {
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [splitPosition, setSplitPosition] = useState<number>(50);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const [filteredData, setFilteredData] = useState<DataItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // 模拟异步搜索函数
  const asyncSearch = async (term: string): Promise<DataItem[]> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const results = DATA.filter(item => 
          item.name.toLowerCase().includes(term.toLowerCase())
        );
        resolve(results);
      }, 300); // 模拟网络延迟
    });
  };

  // 使用防抖进行异步搜索
  useEffect(() => {
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
      setSelectedItem(searchTerm);
      setShowDropdown(false);
    }
  };

  const selectItem = (item: DataItem) => {
    setSearchTerm(item.name);
    setSelectedItem(item.name);
    setShowDropdown(false);
  };

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

  const Row: React.FC<ListChildComponentProps> = ({ index, style }) => (
    <div 
      className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
      style={style}
      onClick={() => selectItem(filteredData[index])}
    >
      {filteredData[index].name}
    </div>
  );

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
                  <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg">
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
          className="absolute top-0 bottom-0 w-px bg-gray-200 cursor-col-resize hover:bg-blue-500 active:bg-blue-600"
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
              <p className="p-2 bg-gray-100 rounded">{selectedItem}</p>
            ) : (
              <p className="text-gray-500">尚未选择任何内容</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}