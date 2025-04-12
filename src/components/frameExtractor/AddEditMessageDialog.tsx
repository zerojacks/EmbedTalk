// src/components/frameExtractor/AddEditMessageDialog.tsx
import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
    setAddDialogOpen,
    setCurrentMessage,
    resetEditingState,
    addMessage,
    updateMessage,
    formatMessageContent
} from '../../store/slices/frameExtractorSlice';
import { X, Scissors } from 'lucide-react';
import { toast } from '../../context/ToastProvider';

const AddEditMessageDialog: React.FC = () => {
    const dispatch = useAppDispatch();
    const {
        currentEditingMessage: { id: editingMessageId, content: currentMessage }
    } = useAppSelector(state => state.frameExtractor);

    // 拆分后的报文列表状态
    const [splitMessages, setSplitMessages] = useState<string[]>([]);

    // 关闭对话框
    const closeAddDialog = () => {
        dispatch(setAddDialogOpen(false));
        if (editingMessageId) {
            dispatch(resetEditingState());
        }
        setSplitMessages([]); // 清空拆分的报文列表
    };

    // 拆分报文
    const handleSplitMessages = () => {
        if (!currentMessage.trim()) {
            toast.error("请输入报文内容");
            return;
        }

        // 按换行符拆分，并过滤掉空行
        const messages = currentMessage
            .split('\n')
            .map(msg => msg.trim())
            .filter(msg => msg.length > 0);

        if (messages.length <= 1) {
            toast.info("没有可拆分的报文");
            return;
        }

        setSplitMessages(messages);
    };

    // 添加新报文
    const handleAddMessage = () => {
        if (!currentMessage.trim()) {
            toast.error("请输入报文内容");
            return;
        }

        // 如果有拆分的报文，则添加所有拆分的报文
        if (splitMessages.length > 0) {
            splitMessages.forEach(msg => {
                dispatch(addMessage(msg));
            });
            toast.success(`成功添加 ${splitMessages.length} 条报文`);
        } else {
            // 否则添加单条报文
            dispatch(addMessage(currentMessage));
            toast.success("报文添加成功");
        }

        dispatch(setCurrentMessage(''));
        dispatch(setAddDialogOpen(false));
        setSplitMessages([]); // 清空拆分的报文列表
    };

    // 更新编辑中的报文
    const handleUpdateMessage = () => {
        if (!editingMessageId || !currentMessage.trim()) {
            toast.error("请输入报文内容");
            return;
        }

        dispatch(updateMessage({
            id: editingMessageId,
            message: currentMessage
        }));
        dispatch(resetEditingState());
        dispatch(setAddDialogOpen(false));
        toast.success("报文更新成功");
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[3000]"
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    closeAddDialog();
                }
            }}
        >
            <div className="bg-base-100 rounded-lg shadow-xl w-11/12 max-w-xl p-6"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">
                        {editingMessageId ? '编辑报文' : '添加新报文'}
                    </h2>
                    <button
                        className="btn btn-sm btn-circle btn-ghost"
                        onClick={closeAddDialog}
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="form-control">
                    <textarea
                        className="textarea textarea-bordered font-mono w-full mb-4"
                        value={currentMessage}
                        onChange={(e) => {
                            dispatch(setCurrentMessage(e.target.value));
                            setSplitMessages([]); // 当内容改变时，清空拆分的报文列表
                        }}
                        placeholder="请输入报文内容，如果有多条报文请换行分隔..."
                        rows={4}
                        autoFocus
                    />

                    {/* 拆分后的报文预览 */}
                    {splitMessages.length > 0 && (
                        <div className="mb-4">
                            <div className="text-sm font-medium mb-2">已拆分 {splitMessages.length} 条报文：</div>
                            <div className="max-h-40 overflow-auto border border-base-300 rounded-lg">
                                {splitMessages.map((msg, index) => (
                                    <div key={index} className="p-2 font-mono text-xs border-b border-base-200 last:border-b-0">
                                        {msg}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex justify-between gap-2">
                        <div className="flex gap-2">
                            <button
                                className="btn btn-outline"
                                onClick={() => dispatch(setCurrentMessage(formatMessageContent(currentMessage)))}
                            >
                                格式化
                            </button>
                            {!editingMessageId && (
                                <button
                                    className="btn btn-outline gap-2"
                                    onClick={handleSplitMessages}
                                >
                                    <Scissors className="w-4 h-4" />
                                    拆分报文
                                </button>
                            )}
                        </div>

                        <div className="flex gap-2">
                            <button
                                className="btn"
                                onClick={closeAddDialog}
                            >
                                取消
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={editingMessageId ? handleUpdateMessage : handleAddMessage}
                            >
                                {editingMessageId ? '保存' : '添加'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AddEditMessageDialog;