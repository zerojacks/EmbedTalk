// src/components/frameExtractor/AddEditMessageDialog.tsx
import React from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
    setAddDialogOpen,
    setCurrentMessage,
    resetEditingState,
    addMessage,
    updateMessage,
    formatMessageContent
} from '../../store/slices/frameExtractorSlice';
import { X } from 'lucide-react';
import { toast } from '../../context/ToastProvider';

const AddEditMessageDialog: React.FC = () => {
    const dispatch = useAppDispatch();
    const {
        currentEditingMessage: { id: editingMessageId, content: currentMessage }
    } = useAppSelector(state => state.frameExtractor);

    // 关闭对话框
    const closeAddDialog = () => {
        dispatch(setAddDialogOpen(false));
        if (editingMessageId) {
            dispatch(resetEditingState());
        }
    };

    // 添加新报文
    const handleAddMessage = () => {
        if (!currentMessage.trim()) {
            toast.error("请输入报文内容");
            return;
        }

        dispatch(addMessage(currentMessage));
        dispatch(setCurrentMessage(''));
        dispatch(setAddDialogOpen(false));
        toast.success("报文添加成功");
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]"
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
                        onChange={(e) => dispatch(setCurrentMessage(e.target.value))}
                        placeholder="请输入报文内容..."
                        rows={4}
                        autoFocus
                    />

                    <div className="flex justify-between gap-2">
                        <button
                            className="btn btn-outline"
                            onClick={() => dispatch(setCurrentMessage(formatMessageContent(currentMessage)))}
                        >
                            格式化
                        </button>

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