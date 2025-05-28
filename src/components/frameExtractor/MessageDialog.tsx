// src/components/frameExtractor/MessageDialog.tsx
import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
    setDialogOpen,
    setAddDialogOpen,
    setEditingMessageId,
    setCurrentMessage,
    toggleMessageSelection,
    toggleSelectAll,
    deleteMessage,
    resetEditingState,
    parseSelectedMessages,
    parseAllMessages,
    deleteSelectedMessages,
    selectMessage,
    clearSelectedMessages,
    parseFrameMessage,
    addParsingMessageId,
    removeParsingMessageId
} from '../../store/slices/frameExtractorSlice';
import { X, PlusIcon, Edit, Trash2, ArrowRight, Copy, PlayCircle } from 'lucide-react';
import { toast } from '../../context/ToastProvider';
import AddEditMessageDialog from './AddEditMessageDialog';
import ConfirmDialog from '../ConfirmDialog';

const MessageDialog: React.FC = () => {
    const dispatch = useAppDispatch();
    const {
        messages,
        parsingMessageIds,
        ui: { isDialogOpen, isAddDialogOpen },
        currentEditingMessage: { id: editingMessageId }
    } = useAppSelector(state => state.frameExtractor);

    // 删除确认对话框状态
    const [deleteConfirm, setDeleteConfirm] = useState<{
        isOpen: boolean;
        messageId?: string;
        isMultiple?: boolean;
    }>({
        isOpen: false,
        messageId: undefined,
        isMultiple: false
    });

    // 获取选中状态
    // 0: 未选中, 1: 部分选中, 2: 全部选中
    const getSelectAllState = (): number => {
        if (messages.length === 0) return 0;

        const selectedCount = messages.filter(msg => msg.selected).length;

        if (selectedCount === 0) return 0;
        if (selectedCount === messages.length) return 2;
        return 1;
    };

    // 关闭对话框时重置状态
    const closeDialog = () => {
        dispatch(setDialogOpen(false));
    };

    // 处理编辑消息
    const handleEditMessage = (messageId: string, messageContent: string) => {
        dispatch(setEditingMessageId(messageId));
        dispatch(setCurrentMessage(messageContent));
        dispatch(setAddDialogOpen(true));
    };

    // 处理删除消息
    const handleDeleteMessage = (id: string) => {
        setDeleteConfirm({
            isOpen: true,
            messageId: id,
            isMultiple: false
        });
    };

    // 执行删除操作
    const confirmDelete = () => {
        if (deleteConfirm.isMultiple) {
            dispatch(deleteSelectedMessages());
            toast.success('删除成功');
        } else if (deleteConfirm.messageId) {
            dispatch(deleteMessage(deleteConfirm.messageId));
            // 如果删除的是正在编辑的消息，清空编辑状态
            if (editingMessageId === deleteConfirm.messageId) {
                dispatch(resetEditingState());
            }
            toast.success("报文已删除");
        }
    };

    // 复制消息内容到剪贴板
    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
            .then(() => {
                toast.success('报文已复制到剪贴板');
            })
            .catch((err) => {
                console.error('复制失败:', err);
                toast.error('复制失败');
            });
    };

    // 解析单条消息
    const handleParseMessage = async (messageId: string, messageContent: string) => {
        try {
            // 手动添加到正在解析的列表
            dispatch(addParsingMessageId(messageId));
            
            await dispatch(parseFrameMessage({ id: messageId, content: messageContent })).unwrap();
            toast.success('解析成功');
            closeDialog();
        } catch (error) {
            // 确保错误是字符串格式
            const errorMessage = error instanceof Error ? error.message : 
                                typeof error === 'string' ? error : '解析失败';
            toast.error(errorMessage);
        } finally {
            // 无论成功还是失败，都从正在解析的列表中移除
            dispatch(removeParsingMessageId(messageId));
        }
    };

    // 处理报文点击
    const handleMessageClick = (id: string, event: React.MouseEvent) => {
        if (event.ctrlKey || event.metaKey) {
            dispatch(selectMessage({ id, selected: !messages.find(m => m.id === id)?.selected }));
        } else {
            dispatch(selectMessage({ id, selected: true, clearOthers: true }));
        }
    };

    // 删除选中的报文
    const handleDeleteSelected = () => {
        const selectedCount = messages.filter(m => m.selected).length;
        if (selectedCount === 0) {
            toast.error('请先选择要删除的报文');
            return;
        }

        setDeleteConfirm({
            isOpen: true,
            isMultiple: true
        });
    };

    // 清除对话框如果点击ESC或backdrop
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isDialogOpen) {
                closeDialog();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isDialogOpen]);

    return (
        <>
            <dialog className={`modal z-[2000] ${isDialogOpen ? 'modal-open' : ''}`}>
                <div className="modal-box w-11/12 max-w-3xl bg-base-100">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-semibold">报文管理</h2>
                            <div className="flex items-center">
                                <span className="badge badge-ghost badge-sm mr-1">已添加 {messages.length}</span>
                                {messages.some(msg => msg.selected) && (
                                    <span className="badge badge-primary badge-sm">已选中 {messages.filter(msg => msg.selected).length}</span>
                                )}
                            </div>
                        </div>
                        <button
                            className="btn btn-sm btn-circle btn-ghost"
                            onClick={closeDialog}
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* 报文列表 */}
                    <div className="mb-4">
                        <div className="border border-base-200 rounded-lg bg-base-100 overflow-hidden">
                            <div className="bg-base-200/50 p-3 border-b border-base-200 flex justify-between items-center">
                                <div className="flex items-center">
                                    <span className="text-sm font-medium">已选中 {messages.filter(msg => msg.selected).length} / {messages.length}</span>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        className="btn btn-circle btn-sm btn-primary"
                                        onClick={() => dispatch(setAddDialogOpen(true))}
                                        title="添加报文"
                                    >
                                        <PlusIcon className="w-4 h-4" />
                                    </button>
                                    {messages.some(msg => msg.selected) && (
                                        <>
                                            <button
                                                className="btn btn-circle btn-sm btn-success"
                                                onClick={() => {
                                                    dispatch(parseSelectedMessages());
                                                    closeDialog();
                                                }}
                                                disabled={parsingMessageIds.length > 0}
                                                title="解析选中"
                                            >
                                                {parsingMessageIds.length > 0 ? (
                                                    <span className="loading loading-spinner loading-xs"></span>
                                                ) : (
                                                    <PlayCircle className="w-4 h-4" />
                                                )}
                                            </button>
                                            <button
                                                className="btn btn-circle btn-sm btn-primary"
                                                onClick={handleDeleteSelected}
                                                disabled={parsingMessageIds.length > 0}
                                                title="删除选中"
                                            >
                                                {parsingMessageIds.length > 0 ? (
                                                    <span className="loading loading-spinner loading-xs"></span>
                                                ) : (
                                                    <Trash2 className="w-4 h-4" />
                                                )}
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {messages.length === 0 ? (
                                <div className="text-center py-6 text-base-content/70">
                                    暂无报文，请点击 <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-white text-xs">+</span> 添加
                                </div>
                            ) : (
                                <div className="overflow-x-auto max-h-[50vh] overflow-y-auto">
                                    <table className="table table-compact w-full table-fixed">
                                        <colgroup>
                                            <col className="w-10" /><col className="w-12" /><col /><col className="w-28" />
                                        </colgroup>
                                        <thead className="sticky top-0 bg-base-200 z-10">
                                            <tr className="bg-base-200/30">
                                                <th className="text-center p-0 pl-1">
                                                    <label className="cursor-pointer flex justify-center">
                                                        <input
                                                            type="checkbox"
                                                            className="checkbox checkbox-xs checkbox-primary"
                                                            checked={getSelectAllState() === 2}
                                                            ref={input => {
                                                                if (input) {
                                                                    // 设置indeterminate状态
                                                                    input.indeterminate = getSelectAllState() === 1;
                                                                }
                                                            }}
                                                            onChange={() => dispatch(toggleSelectAll())}
                                                        />
                                                    </label>
                                                </th>
                                                <th className="text-center text-xs">序号</th>
                                                <th className="text-xs">报文信息</th>
                                                <th className="text-center text-xs">操作</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {messages.map((msg, index) => (
                                                <tr
                                                    key={msg.id}
                                                    className={`group hover:bg-base-200 border-l-4 ${msg.selected ? 'border-l-primary bg-primary/10' : 'border-l-transparent'}`}
                                                >
                                                    <td className="p-0 pl-1">
                                                        <label className="cursor-pointer flex justify-center">
                                                            <input
                                                                type="checkbox"
                                                                className="checkbox checkbox-xs checkbox-primary"
                                                                checked={msg.selected || false}
                                                                onChange={(e) => {
                                                                    e.stopPropagation();
                                                                    dispatch(toggleMessageSelection(msg.id));
                                                                }}
                                                            />
                                                        </label>
                                                    </td>
                                                    <td className="text-center text-xs">{index + 1}</td>
                                                    <td className="p-0">
                                                        <div className="flex items-center w-full">
                                                            <div className="flex-grow truncate font-mono text-xs py-2 px-2 hover:bg-base-200/50 transition-colors" title={msg.message}>
                                                                {msg.message}
                                                            </div>
                                                            <div className="flex-none w-8 h-full flex items-center justify-center border-l border-base-200">
                                                                <button
                                                                    className="btn btn-xs btn-square btn-ghost"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        copyToClipboard(msg.message);
                                                                    }}
                                                                    title="复制报文"
                                                                >
                                                                    <Copy className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="flex justify-center items-center gap-1">
                                                            <button
                                                                className="btn btn-ghost btn-xs btn-square"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleEditMessage(msg.id, msg.message);
                                                                }}
                                                                title="编辑"
                                                            >
                                                                <Edit className="w-3 h-3" />
                                                            </button>
                                                            <button
                                                                className="btn btn-ghost btn-xs btn-square text-error"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDeleteMessage(msg.id);
                                                                }}
                                                                title="删除"
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                            </button>
                                                            <button
                                                                className="btn btn-ghost btn-xs btn-square text-success"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleParseMessage(msg.id, msg.message);
                                                                }}
                                                                disabled={parsingMessageIds.includes(msg.id)}
                                                                title="解析"
                                                            >
                                                                {parsingMessageIds.includes(msg.id) ? (
                                                                    <span className="loading loading-spinner loading-xs"></span>
                                                                ) : <PlayCircle className="w-3 h-3" />}
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <form method="dialog" className="modal-backdrop">
                    <button onClick={closeDialog}>关闭</button>
                </form>
            </dialog>

            {/* 添加/编辑报文对话框 */}
            {isAddDialogOpen && <AddEditMessageDialog />}

            {/* 删除确认对话框 */}
            <ConfirmDialog
                type="warning"
                title={deleteConfirm.isMultiple 
                    ? `确定要删除选中的 ${messages.filter(m => m.selected).length} 条报文吗？`
                    : "确定要删除这条报文吗？"
                }
                isOpen={deleteConfirm.isOpen}
                onClose={() => setDeleteConfirm({ isOpen: false })}
                onConfirm={confirmDelete}
                confirmText="删除"
            />
        </>
    );
};

export default MessageDialog;