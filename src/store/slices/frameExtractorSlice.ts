// src/store/slices/frameExtractorSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { invoke } from "@tauri-apps/api/core";
import { TreeItemType } from '../../components/TreeItem';

// 定义类型
export interface ExtractedDataChild {
    frameDomain: string;
    data: string;
    description: string;
}

export interface ExtractedData {
    id: string;
    da: string;
    di: string;
    content: string;
    time?: string;
    children?: ExtractedDataChild[];
    isExpanded?: boolean;
    uniqueId: string;
    level?: number;
}

export interface FrameMessage {
    id: string;
    message: string;
    createdAt: string;
    selected?: boolean;
}

export type FilterType = 'contains' | 'startsWith' | 'endsWith' | 'equals';

export interface FilterValue {
    type: FilterType;
    value: string;
}

// slice 状态接口
interface FrameExtractorState {
    messages: FrameMessage[];
    extractedData: ExtractedData[];
    isLoading: boolean;
    parsingMessageIds: string[]; // 新增：正在解析的报文ID列表
    error: string | null;
    currentEditingMessage: {
        id: string | null;
        content: string;
    };
    ui: {
        isDialogOpen: boolean;
        isAddDialogOpen: boolean;
        exportLoading: boolean;
        activeFilterPanel: string | null;
        filterSettings: {
            column: string;
            type: FilterType;
            value: string;
        } | null;
        selectedRows: string[]; // 保存选中行的 uniqueId
        lastSelectedRow: string | null;
        columnFilters: {
            id: string;
            value: FilterValue;
        }[];
        sorting: {
            id: string;
            desc: boolean;
        }[];
        shouldAlignRight: Record<string, boolean>;
    };
}

// 初始状态
const initialState: FrameExtractorState = {
    messages: [],
    extractedData: [],
    isLoading: false,
    parsingMessageIds: [], // 新增：初始化为空数组
    error: null,
    currentEditingMessage: {
        id: null,
        content: '',
    },
    ui: {
        isDialogOpen: false,
        isAddDialogOpen: false,
        exportLoading: false,
        activeFilterPanel: null,
        filterSettings: null,
        selectedRows: [],
        lastSelectedRow: null,
        columnFilters: [],
        sorting: [],
        shouldAlignRight: {},
    }
};

// 过滤器类型标签
export const FILTER_TYPE_LABELS: Record<FilterType, string> = {
    'contains': '包含',
    'startsWith': '开头是',
    'endsWith': '结尾是',
    'equals': '等于'
};

// 异步 thunks
export const parseFrameMessage = createAsyncThunk(
    'frameExtractor/parseFrameMessage',
    async (message: { id: string; content: string }, { rejectWithValue }) => {
        try {
            // 格式化报文内容
            const formattedValue = message.content
                .replace(/\s+/g, '')
                .replace(/(.{2})/g, '$1 ')
                .trim()
                .toUpperCase();

            const result = await invoke<{ data: TreeItemType[]; error?: string }>('on_text_change', {
                message: formattedValue,
                region: "南网"
            });

            if (result.error) {
                return rejectWithValue(`解析报文失败：${result.error}`);
            }

            return { id: message.id, data: result.data };
        } catch (error) {
            return rejectWithValue(error instanceof Error ? error.message : '未知错误');
        }
    }
);

export const parseSelectedMessages = createAsyncThunk(
    'frameExtractor/parseSelectedMessages',
    async (_, { getState, dispatch, rejectWithValue }) => {
        const state = getState() as { frameExtractor: FrameExtractorState };
        const selectedMessages = state.frameExtractor.messages.filter(msg => msg.selected);
        
        if (selectedMessages.length === 0) {
            return rejectWithValue("请先选择要解析的报文");
        }

        try {
            const results: TreeItemType[][] = [];
            
            // 为每个选中的消息创建一个解析任务
            for (const messageItem of selectedMessages) {
                const result = await dispatch(parseFrameMessage({
                    id: messageItem.id,
                    content: messageItem.message
                })).unwrap();
                results.push(result.data);
            }
            
            return results;
        } catch (error) {
            return rejectWithValue(error instanceof Error ? error.message : '解析失败');
        }
    }
);

export const parseAllMessages = createAsyncThunk(
    'frameExtractor/parseAllMessages',
    async (_, { getState, dispatch, rejectWithValue }) => {
        const state = getState() as { frameExtractor: FrameExtractorState };
        const { messages } = state.frameExtractor;
        
        if (messages.length === 0) {
            return rejectWithValue("没有报文可解析");
        }

        try {
            const results: TreeItemType[][] = [];
            
            // 为每个消息创建一个解析任务
            for (const messageItem of messages) {
                const result = await dispatch(parseFrameMessage({
                    id: messageItem.id,
                    content: messageItem.message
                })).unwrap();
                results.push(result.data);
            }
            
            return results;
        } catch (error) {
            return rejectWithValue(error instanceof Error ? error.message : '解析失败');
        }
    }
);

// 帮助函数 - 解析数据
const extractData = (items: TreeItemType[]): ExtractedData[] => {
    const result: ExtractedData[] = [];

    // 递归遍历函数
    const traverseItems = (items: TreeItemType[]) => {
        for (let i = 0; i < items.length; i++) {
            const currentItem = items[i];
            const nextItem = items[i + 1];
            const dataitem = items[i + 2];
            const timeitem = items[i + 3];

            // 检查当前项是否包含信息点标识DA
            if (currentItem.frameDomain.includes('信息点标识DA')) {
                let da = '';
                
                // 情况1：Pn=测量点：0(终端)
                if (currentItem.description.includes('Pn=测量点：0(终端)')) {
                    da = '0';
                }
                // 情况2：Pn=第X测量点
                else {
                    const daMatch = currentItem.description.match(/Pn=第(\d+)测量点/);
                    da = daMatch ? daMatch[1] : currentItem.data || '';
                }

                // 检查下一项是否包含数据标识编码DI
                if (nextItem && nextItem.frameDomain.includes('数据标识编码DI')) {
                    // 检查DI的data格式，如果是XX 03 00 E0这种格式则跳过（XX为任意值）
                    const diData = nextItem.data || '';
                    if (diData.match(/^[0-9A-F]{2} 03 00 E0$/i)) {
                        continue; // 跳过当前循环，继续遍历
                    }

                    const diMatch = nextItem.description.match(/数据标识编码：\[(.*?)\]/);
                    const di = diMatch ? diMatch[1] : nextItem.frameDomain || '';

                    // 查找数据内容
                    let content = '';
                    if (dataitem && dataitem.frameDomain.includes('数据内容')) {
                        content = dataitem.data;
                    }

                    let time = '';
                    if (timeitem && timeitem.frameDomain.includes('数据时间')) {
                        time =  timeitem.data;
                    }

                    if (timeitem.frameDomain.includes('任务数据时间')) {
                        da=''
                    }
                    
                    // 提取子项
                    const children: ExtractedDataChild[] = [];
                    if (dataitem?.children) {
                        dataitem.children.forEach(child => {
                            if (child.children) {
                                child.children.forEach(grandChild => {
                                    if (grandChild.children) {
                                        grandChild.children.forEach(greatGrandChild => {
                                            children.push({
                                                frameDomain: greatGrandChild.frameDomain,
                                                data: greatGrandChild.data,
                                                description: greatGrandChild.description
                                            });
                                        });
                                    } else {
                                        children.push({
                                            frameDomain: grandChild.frameDomain,
                                            data: grandChild.data,
                                            description: grandChild.description
                                        });
                                    }
                                });
                            } else {
                                children.push({
                                    frameDomain: child?.frameDomain || "",
                                    data: child?.data || "",
                                    description: child?.description || ""
                                });
                            }
                        });
                    } else {
                        children.push({
                            frameDomain: dataitem?.frameDomain || "",
                            data: dataitem?.data || "",
                            description: dataitem?.description || ""
                        });
                    }

                    // 只有当DA和DI存在时才添加数据
                    if (da && di) {
                        const uniqueId = `${da}-${di}-${content}-${time}-${Math.random().toString(36).substr(2, 9)}`;
                        const extractedItem: ExtractedData = {
                            id: uniqueId,
                            da,
                            di,
                            content,
                            time,
                            children,
                            isExpanded: false,
                            uniqueId
                        };
                        result.push(extractedItem);
                    }
                }
            }

            // 递归处理子项
            if (currentItem.children) {
                traverseItems(currentItem.children);
            }
        }
    };

    // 开始遍历
    traverseItems(items);
    return result;
};

// 格式化报文内容
export const formatMessageContent = (message: string): string => {
    // 移除所有空格和换行符，并转为大写
    const cleanedMessage = message.replace(/\s+/g, '').toUpperCase();
    
    // 验证是否只包含有效的十六进制字符 (0-9, A-F)
    const isValidHex = /^[0-9A-F]+$/.test(cleanedMessage);
    
    if (!isValidHex) {
        // 过滤掉非十六进制字符
        return cleanedMessage.replace(/[^0-9A-F]/g, '');
    }
    
    return cleanedMessage;
};

// 创建slice
const frameExtractorSlice = createSlice({
    name: 'frameExtractor',
    initialState,
    reducers: {
        // UI状态更新
        setDialogOpen: (state, action: PayloadAction<boolean>) => {
            state.ui.isDialogOpen = action.payload;
        },
        setAddDialogOpen: (state, action: PayloadAction<boolean>) => {
            state.ui.isAddDialogOpen = action.payload;
        },
        setCurrentMessage: (state, action: PayloadAction<string>) => {
            state.currentEditingMessage.content = action.payload;
        },
        setEditingMessageId: (state, action: PayloadAction<string | null>) => {
            state.currentEditingMessage.id = action.payload;
        },
        resetEditingState: (state) => {
            state.currentEditingMessage = {
                id: null,
                content: '',
            };
        },
        
        // 报文管理
        addMessage: (state, action: PayloadAction<string>) => {
            const newMessage: FrameMessage = {
                id: crypto.randomUUID(),
                message: action.payload,
                createdAt: new Date().toISOString(),
                selected: false
            };
            state.messages.push(newMessage);
        },
        updateMessage: (state, action: PayloadAction<{id: string, message: string}>) => {
            const { id, message } = action.payload;
            const formattedMessage = formatMessageContent(message.trim());
            const index = state.messages.findIndex(msg => msg.id === id);
            if (index !== -1) {
                state.messages[index].message = formattedMessage;
            }
        },
        deleteMessage: (state, action: PayloadAction<string>) => {
            state.messages = state.messages.filter(msg => msg.id !== action.payload);
        },
        toggleMessageSelection: (state, action: PayloadAction<string>) => {
            const index = state.messages.findIndex(msg => msg.id === action.payload);
            if (index !== -1) {
                state.messages[index].selected = !state.messages[index].selected;
            }
        },
        toggleSelectAll: (state) => {
            const allSelected = state.messages.every(msg => msg.selected);
            state.messages = state.messages.map(msg => ({
                ...msg,
                selected: !allSelected
            }));
        },
        
        // 表格数据管理
        clearExtractedData: (state) => {
            state.extractedData = [];
            state.ui.selectedRows = [];
            state.ui.lastSelectedRow = null;
        },
        toggleRowExpand: (state, action: PayloadAction<string>) => {
            const index = state.extractedData.findIndex(item => item.uniqueId === action.payload);
            if (index !== -1) {
                state.extractedData[index].isExpanded = !state.extractedData[index].isExpanded;
            }
        },
        
        // 行选择
        selectRows: (state, action: PayloadAction<string[]>) => {
            state.ui.selectedRows = action.payload;
        },
        setLastSelectedRow: (state, action: PayloadAction<string | null>) => {
            state.ui.lastSelectedRow = action.payload;
        },
        clearSelectedRows: (state) => {
            state.ui.selectedRows = [];
        },
        
        // 过滤和排序
        setSorting: (state, action: PayloadAction<{id: string, desc: boolean}[]>) => {
            state.ui.sorting = action.payload;
        },
        setColumnFilters: (state, action: PayloadAction<{id: string, value: FilterValue}[]>) => {
            state.ui.columnFilters = action.payload;
        },
        clearFilter: (state, action: PayloadAction<string>) => {
            state.ui.columnFilters = state.ui.columnFilters.filter(filter => filter.id !== action.payload);
        },
        clearAllFilters: (state) => {
            state.ui.columnFilters = [];
        },
        setActiveFilterPanel: (state, action: PayloadAction<string | null>) => {
            state.ui.activeFilterPanel = action.payload;
        },
        setFilterSettings: (state, action: PayloadAction<{
            column: string;
            type: FilterType;
            value: string;
        } | null>) => {
            state.ui.filterSettings = action.payload;
        },
        setShouldAlignRight: (state, action: PayloadAction<{columnId: string, value: boolean}>) => {
            const { columnId, value } = action.payload;
            state.ui.shouldAlignRight = {
                ...state.ui.shouldAlignRight,
                [columnId]: value
            };
        },
        
        // Excel导出
        setExportLoading: (state, action: PayloadAction<boolean>) => {
            state.ui.exportLoading = action.payload;
        },

        // 选择报文
        selectMessage: (state, action: PayloadAction<{ id: string; selected: boolean; clearOthers?: boolean }>) => {
            const { id, selected, clearOthers } = action.payload;
            if (clearOthers) {
                state.messages.forEach(msg => msg.selected = false);
            }
            const message = state.messages.find(msg => msg.id === id);
            if (message) {
                message.selected = selected;
            }
        },

        // 删除选中的报文
        deleteSelectedMessages: (state) => {
            state.messages = state.messages.filter(msg => !msg.selected);
        },

        // 清除所有选中状态
        clearSelectedMessages: (state) => {
            state.messages.forEach(msg => msg.selected = false);
        },

        // 新增：添加正在解析的报文ID
        addParsingMessageId: (state, action: PayloadAction<string>) => {
            if (!state.parsingMessageIds.includes(action.payload)) {
                state.parsingMessageIds.push(action.payload);
            }
        },
        // 新增：移除已完成解析的报文ID
        removeParsingMessageId: (state, action: PayloadAction<string>) => {
            state.parsingMessageIds = state.parsingMessageIds.filter(id => id !== action.payload);
        },
    },
    extraReducers: (builder) => {
        // 处理单条报文解析
        builder
            .addCase(parseFrameMessage.pending, (state, action) => {
                const messageId = (action.meta.arg as { id: string }).id;
                if (!state.parsingMessageIds.includes(messageId)) {
                    state.parsingMessageIds.push(messageId);
                }
                state.error = null;
            })
            .addCase(parseFrameMessage.fulfilled, (state, action) => {
                const messageId = action.payload.id;
                state.parsingMessageIds = state.parsingMessageIds.filter(id => id !== messageId);
                // 解析并更新 extractedData，同时清空选中的行和过滤条件
                const extracted = extractData(action.payload.data);
                state.extractedData = extracted;
                state.ui.selectedRows = [];
                state.ui.lastSelectedRow = null;
                state.ui.columnFilters = [];
            })
            .addCase(parseFrameMessage.rejected, (state, action) => {
                const messageId = (action.meta.arg as { id: string }).id;
                state.parsingMessageIds = state.parsingMessageIds.filter(id => id !== messageId);
                state.error = action.payload as string || "解析报文失败";
            });
        
        // 处理选中的报文解析
        builder
            .addCase(parseSelectedMessages.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(parseSelectedMessages.fulfilled, (state, action) => {
                state.isLoading = false;
                const allExtractedData: ExtractedData[] = [];
                
                // 处理所有解析结果
                for (const treeItems of action.payload) {
                    const extracted = extractData(treeItems);
                    allExtractedData.push(...extracted);
                }
                
                state.extractedData = allExtractedData;
                state.ui.selectedRows = [];
                state.ui.lastSelectedRow = null;
                state.ui.columnFilters = [];
                state.ui.isDialogOpen = false;
            })
            .addCase(parseSelectedMessages.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload as string || "解析选中报文失败";
            });
        
        // 处理所有报文解析
        builder
            .addCase(parseAllMessages.pending, (state) => {
                state.isLoading = true;
                state.error = null;
            })
            .addCase(parseAllMessages.fulfilled, (state, action) => {
                state.isLoading = false;
                const allExtractedData: ExtractedData[] = [];
                
                // 处理所有解析结果
                for (const treeItems of action.payload) {
                    const extracted = extractData(treeItems);
                    allExtractedData.push(...extracted);
                }
                
                state.extractedData = allExtractedData;
                state.ui.selectedRows = [];
                state.ui.lastSelectedRow = null;
                state.ui.columnFilters = [];
                state.ui.isDialogOpen = false;
            })
            .addCase(parseAllMessages.rejected, (state, action) => {
                state.isLoading = false;
                state.error = action.payload as string || "解析所有报文失败";
            });
    }
});

// 导出actions
export const {
    setDialogOpen,
    setAddDialogOpen,
    setCurrentMessage,
    setEditingMessageId,
    resetEditingState,
    addMessage,
    updateMessage,
    deleteMessage,
    toggleMessageSelection,
    toggleSelectAll,
    clearExtractedData,
    toggleRowExpand,
    selectRows,
    setLastSelectedRow,
    clearSelectedRows,
    setSorting,
    setColumnFilters,
    clearFilter,
    clearAllFilters,
    setActiveFilterPanel,
    setFilterSettings,
    setShouldAlignRight,
    setExportLoading,
    selectMessage,
    deleteSelectedMessages,
    clearSelectedMessages,
    addParsingMessageId,
    removeParsingMessageId,
} = frameExtractorSlice.actions;

// 导出reducer
export default frameExtractorSlice.reducer;