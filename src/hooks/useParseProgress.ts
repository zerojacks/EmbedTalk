import { useState, useCallback, useRef } from 'react';
import { ParseProgressItem } from '../components/ui/ParseProgress';

// 全局解析状态管理，防止重复解析
const globalParsingFiles = new Set<string>();

export const useParseProgress = () => {
    const [progressItems, setProgressItems] = useState<ParseProgressItem[]>([]);
    const processingFiles = useRef<Set<string>>(new Set());

    // 检查文件是否正在处理
    const isFileProcessing = useCallback((filePath: string, type: 'log' | 'frame') => {
        const key = `${filePath}:${type}`;
        return globalParsingFiles.has(key) || processingFiles.current.has(key);
    }, []);

    // 标记文件开始处理
    const markFileProcessing = useCallback((filePath: string, type: 'log' | 'frame') => {
        const key = `${filePath}:${type}`;
        globalParsingFiles.add(key);
        processingFiles.current.add(key);
    }, []);

    // 标记文件处理完成
    const markFileCompleted = useCallback((filePath: string, type: 'log' | 'frame') => {
        const key = `${filePath}:${type}`;
        globalParsingFiles.delete(key);
        processingFiles.current.delete(key);
    }, []);

    const addProgressItem = useCallback((item: Omit<ParseProgressItem, 'id' | 'startTime'>) => {
        // 使用文件路径进行精确去重，如果没有路径则使用文件名
        const identifier = item.filePath || item.fileName;

        // 检查全局处理状态
        if (isFileProcessing(identifier, item.type)) {
            console.warn(`文件正在处理中，跳过重复请求: ${identifier} (${item.type})`);
            return null;
        }

        const existingItem = progressItems.find(existing => {
            const existingIdentifier = existing.filePath || existing.fileName;
            return existingIdentifier === identifier &&
                   existing.type === item.type &&
                   existing.status === 'parsing';
        });

        if (existingItem) {
            console.warn(`进度项已存在: ${identifier} (${item.type})`);
            return existingItem.id;
        }

        // 标记文件开始处理
        markFileProcessing(identifier, item.type);

        const newItem: ParseProgressItem = {
            ...item,
            id: crypto.randomUUID(),
            startTime: Date.now(),
        };

        setProgressItems(prev => [...prev, newItem]);
        return newItem.id;
    }, [progressItems, isFileProcessing, markFileProcessing]);

    const updateProgressItem = useCallback((id: string, updates: Partial<ParseProgressItem>) => {
        setProgressItems(prev => prev.map(item => 
            item.id === id 
                ? { 
                    ...item, 
                    ...updates,
                    endTime: updates.status === 'completed' || updates.status === 'error' 
                        ? Date.now() 
                        : item.endTime
                }
                : item
        ));
    }, []);

    const removeProgressItem = useCallback((id: string) => {
        setProgressItems(prev => prev.filter(item => item.id !== id));
    }, []);

    const clearProgressItems = useCallback(() => {
        setProgressItems([]);
    }, []);

    const clearCompletedItems = useCallback(() => {
        setProgressItems(prev => prev.filter(item =>
            item.status === 'parsing' || item.status === 'error'
        ));
    }, []);

    // 自动清理已完成的项目（5秒后）
    const autoRemoveCompleted = useCallback((id: string) => {
        setTimeout(() => {
            setProgressItems(prev => {
                const item = prev.find(p => p.id === id);
                if (item && (item.status === 'completed' || item.status === 'error')) {
                    return prev.filter(p => p.id !== id);
                }
                return prev;
            });
        }, 5000); // 5秒后自动移除
    }, []);

    // 修改 updateProgressItem 以支持自动清理
    const updateProgressItemWithAutoClean = useCallback((id: string, updates: Partial<ParseProgressItem>) => {
        setProgressItems(prev => prev.map(item => {
            if (item.id === id) {
                const updatedItem = {
                    ...item,
                    ...updates,
                    endTime: updates.status === 'completed' || updates.status === 'error'
                        ? Date.now()
                        : item.endTime
                };

                // 如果状态变为完成或错误，标记文件处理完成
                if (updates.status === 'completed' || updates.status === 'error') {
                    const identifier = item.filePath || item.fileName;
                    markFileCompleted(identifier, item.type);
                    autoRemoveCompleted(id);
                }

                return updatedItem;
            }
            return item;
        }));
    }, [autoRemoveCompleted, markFileCompleted]);

    return {
        progressItems,
        addProgressItem,
        updateProgressItem: updateProgressItemWithAutoClean,
        removeProgressItem,
        clearProgressItems,
        clearCompletedItems,
        isFileProcessing,
        markFileProcessing,
        markFileCompleted,
    };
};
