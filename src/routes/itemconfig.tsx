import { invoke } from '@tauri-apps/api/core';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { FixedSizeList, ListChildComponentProps } from 'react-window';
import XmlTree, { getDisplayName } from '../components/xmltree';
import XmlConverter from '../components/xmlconvert';
import { CodeIcon, ComponentsIcon } from '../components/Icons';
import { useItemConfigStore, XmlElement, DataItem } from '../stores/useItemConfigStore';

export const CardTitle: React.FC<{ element: XmlElement; className?: string }> = ({ element, className }) => {
  const title = getDisplayName(element.name) + (element.attributes?.id ? ` (${element.attributes.id})` : '');

  return (
    <div className={`flex items-center space-x-2 ${className || ''}`}> {/* 将传入的className应用到最外层div */}
      <h3 className="text-lg font-semibold">
        {title}
      </h3>
      {element.attributes?.region && (
        <div className="badge badge-success" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {element.attributes.id ? ` (${element.attributes.id})` : ''}
      </div>
      )}
      {element.attributes?.protocol && ( // 确保这里检查的是protocol属性，而不是重复region
        <div className="badge badge-success" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {element.attributes.protocol}
        </div>
      )}
    </div>
  );
};

export default function Itemconfig() {
  const {
    isResizing,
    splitPosition,
    searchTerm,
    showDropdown,
    filteredData,
    selectedItem,
    isLoading,
    allitemlist,
    selectXml,
    displaytype,
    allSelectItems,
    setIsResizing,
    setSplitPosition,
    setSearchTerm,
    setShowDropdown,
    setFilteredData,
    setSelectedItem,
    setIsLoading,
    setAllitemlist,
    setSelectXml,
    setDisplaytype,
    setAllSelectItems,
  } = useItemConfigStore();

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
      selectItem({ item: searchTerm } as DataItem);
    }
  };

  const selectItem = async (item: DataItem) => {
    console.log("select item", item);
    isSelecting.current = true;
    setSearchTerm(item.item);
    setSelectedItem(item);
    setShowDropdown(false);
    
    try {
      const element = await invoke<XmlElement>('get_protocol_config_item', { value: JSON.stringify(item) });
      const updatedItem = { ...item, xmlElement: element };
      
      updateItemIntoAllselectItem(updatedItem)
  
      setSelectXml(element);
    } catch (error) {
      console.error('get_protocol_config_item error:', error);
      setSelectXml({} as XmlElement);
    }
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

  const SearchList: React.FC<ListChildComponentProps> = ({ index, style, data}) => {
    const item = data[index];
    console.log("Row", item, data);
    return (
      <div
        className="flex items-center px-4 py-2 hover:bg-base-300 cursor-pointer"
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

  const updateItemIntoAllselectItem = (item: DataItem) => {
    const itemIndex = allSelectItems.findIndex(existingItem => 
      existingItem.item === item.item &&
      existingItem.protocol === item.protocol &&
      existingItem.region === item.region
    );
    
    if (itemIndex === -1) {
      // 如果没有找到，添加新项
      setAllSelectItems([...allSelectItems, item]);
    } else {
      // 如果找到了，更新该项
      const newItems = [...allSelectItems];
      newItems[itemIndex] = item;
      setAllSelectItems(newItems);
    }
  };
  

  const itemConfigSelect = async (item: DataItem) => {
    console.log("itemConfigSelect:", item);
    isSelecting.current = true;
    setSelectedItem(item);
    if (item.xmlElement) {
      setSelectXml(item.xmlElement);
    } else {
      try {
        const element = await invoke<XmlElement>('get_protocol_config_item', { value: JSON.stringify(item) });
        const updatedItem = { ...item, xmlElement: element };
        updateItemIntoAllselectItem(updatedItem)
        setSelectXml(element);
      } catch (error) {
        const updatedItem = { ...item, xmlElement: {} as XmlElement };
        updateItemIntoAllselectItem(updatedItem)
        setSelectXml({} as XmlElement);
      }
    }
  }

  const ItemConfigRow: React.FC<ListChildComponentProps> = ({ index, style, data }) => {
    const item = data[index];

    return (
      <div
        className="flex items-center px-4 py-2 hover:bg-base-300 cursor-pointer"
        style={style}
        onClick={() => itemConfigSelect(item)}
      >
        <span className="mr-2">{item.item}</span>
        {item.name && <span className="mr-2">{item.name}</span>}
        {item.protocol && <span className="mr-2">{item.protocol}</span>}
        {item.region && <span>{item.region}</span>}
      </div>
    );
  };

  const handleXmlElementChange = (newXmlElement: XmlElement) => {
    setSelectXml(newXmlElement); // 假设 setSelectXml 是一个有效的更新函数
    selectedItem.xmlElement = newXmlElement;
    updateItemIntoAllselectItem(selectedItem)
    console.log('Updated XmlElement:', newXmlElement);
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
              <div className="flex flex-col w-full">
                <div className="flex items-center mb-2">
                  <label className="flex-shrink-0 mr-2">数据标识</label>
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
                      <div
                        className="absolute z-10 w-full mt-1 bg-base-200 border select-primary rounded-md shadow-lg textarea-bordered"
                        onMouseLeave={() => setShowDropdown(false)}
                      >
                        <FixedSizeList
                          height={Math.min(200, filteredData.length * 40)}
                          itemCount={filteredData.length}
                          itemSize={40}
                          width="100%"
                          itemData={filteredData}
                        >
                          {SearchList}
                        </FixedSizeList>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-start w-full flex-col mt-4">
                  <p>已选择数据项</p>
                  <div className="w-full h-full p-4 border rounded-md textarea-bordered">
                    <FixedSizeList
                      height={Math.min(200, allSelectItems.length * 40)}
                      itemCount={allSelectItems.length}
                      itemSize={40}
                      width="100%"
                      itemData={allSelectItems}
                    >
                      {ItemConfigRow}
                    </FixedSizeList>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          className="absolute top-0 bottom-0 w-px bg-splize cursor-col-resize hover:bg-blue-500 active:bg-blue-600"
          style={{ left: `${splitPosition}%` }}
          onMouseDown={startResize}
        />

        <div
          className="h-full overflow-auto"
          style={{ width: `${100 - splitPosition}%` }}
        >
          <div className="p-4 w-full h-full flex flex-col">
            {selectXml && (
              <div className="flex mb-4 flex-row justify-between items-center sticky top-0 z-10 bg-base-200 shadow-md">
                <CardTitle element={selectXml} className="ml-2"/>
                <div role="tablist" className="tabs tabs-boxed">
                  <label role="tab" className={`tab ${displaytype === 'compents' ? 'tab-active' : ''}`} onClick={() => setDisplaytype('compents')}>
                    <ComponentsIcon className="w-5 h-5" />
                  </label>                
                  <label role="tab" className={`tab ${displaytype === 'xml' ? 'tab-active' : ''}`} onClick={() => setDisplaytype('xml')}>
                    <CodeIcon  className="w-5 h-5" />
                  </label>  
                </div>
              </div>
            )}
            <div className="flex-1 overflow-y-auto">
              {selectXml && (displaytype === 'compents') && (
                <XmlTree data={selectXml} onUpdate={handleXmlElementChange}/>
              )}
              {selectXml && (displaytype === 'xml') && (
                <div className="relative w-full h-full">
                  <XmlConverter
                    initialXml={selectXml}
                    onXmlElementChange={handleXmlElementChange}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}