import { FRM_RECORD_FLAG } from './frameParser';
import { LOG_RECORD_FLAG } from './logParser'

export enum FileType {
    LOG = 'LOG',
    FRAME = 'FRAME',
    UNKNOWN = 'UNKNOWN'
}

/**
 * 检测文件类型
 * @param buffer 文件内容
 */
export function detectFileType(buffer: Uint8Array): FileType {
    if (!buffer || buffer.length < 4) return FileType.UNKNOWN;

    try {
        // 检查文件头的标志
        const flag = new DataView(buffer.buffer).getUint32(0, true);
        
        if (flag === LOG_RECORD_FLAG) {
            return FileType.LOG;
        } else if (flag === FRM_RECORD_FLAG) {
            return FileType.FRAME;
        }
    } catch (error) {
        console.error('检测文件类型时出错:', error);
    }

    return FileType.UNKNOWN;
}

/**
 * 读取文件内容
 * @param file File对象
 */
export function readFile(file: File): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = () => {
            if (reader.result instanceof ArrayBuffer) {
                resolve(new Uint8Array(reader.result));
            } else {
                reject(new Error('读取文件失败'));
            }
        };
        
        reader.onerror = () => {
            reject(reader.error);
        };
        
        reader.readAsArrayBuffer(file);
    });
}