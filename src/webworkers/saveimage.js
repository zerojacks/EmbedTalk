// fileWorker.js
import { writeBinaryFile } from '@tauri-apps/plugin-fs';

self.onmessage = async (event) => {
    const { filePath, buffer } = event.data;
    console.log("filePath:", filePath);
    try {
        console.log("save image");
        await writeBinaryFile(filePath, buffer); // 假设 writeBinaryFile 是你在主线程中定义的函数
        self.postMessage({ success: true });
        console.log("save image success");
    } catch (error) {
        self.postMessage({ success: false, error: error.message });
        console.log("save image error:", error.message);
    }
};
