// src/services/frameExtractorService.ts
import { invoke } from "@tauri-apps/api/core";
import { TreeItemType } from "../components/TreeItem";
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { ExtractedData } from "../store/slices/frameExtractorSlice";

export class FrameExtractorService {
    /**
     * 解析报文
     * @param message 报文内容
     * @returns 解析结果
     */
    static async parseMessage(message: string): Promise<TreeItemType[]> {
        // 格式化报文内容
        const formattedValue = message
            .replace(/\s+/g, '')
            .replace(/(.{2})/g, '$1 ')
            .trim()
            .toUpperCase();

        try {
            const result = await invoke<{ data: TreeItemType[]; error?: string }>('on_text_change', {
                message: formattedValue,
                region: "南网"
            });

            if (result.error) {
                throw new Error(`解析报文失败：${result.error}`);
            }

            return result.data;
        } catch (error) {
            throw error;
        }
    }

    /**
     * 导出数据到Excel
     * @param data 要导出的数据
     */
    static async exportToExcel(data: Uint8Array): Promise<void> {
        try {
            // 生成文件名
            const now = new Date();
            const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
            const fileName = `数据导出_${timestamp}.xlsx`;

            // 打开保存文件对话框
            const filePath = await save({
                title: '保存Excel文件',
                defaultPath: fileName,
                filters: [{
                    name: 'Excel文件',
                    extensions: ['xlsx']
                }]
            });

            if (filePath) {
                // 写入文件
                await writeFile(filePath, data);
                return;
            } else {
                throw new Error("用户取消了保存操作");
            }
        } catch (error) {
            throw error;
        }
    }
}