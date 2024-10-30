import { useState, useEffect, useRef, ChangeEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { relaunch } from '@tauri-apps/plugin-process';
import { SetFileIcon } from '../components/Icons';
import { open, confirm } from '@tauri-apps/plugin-dialog';

interface Protocol {
    id: 'nanwang13' | 'dlt645' | 'nanwang16';
    name: string;
}

interface FileInfo {
    path: string;
}

interface SelectedFiles {
    nanwang13: FileInfo;
    dlt645: FileInfo;
    nanwang16: FileInfo;
}

const ConfigFilePathCom: React.FC = () => {
    const [selectedFiles, setSelectedFiles] = useState<SelectedFiles>({
        nanwang13: { path: '' },
        dlt645: { path: '' },
        nanwang16: { path: '' }
    });

    useEffect(() => {
        async function get_report_config() {
            try {
                const fileinfo = await invoke<SelectedFiles>("get_config_value_async", {
                    section: "ProtocolSetting", 
                    key: "protocolfile"
                });
                if (fileinfo) {
                    setSelectedFiles(fileinfo);
                } else {
                    throw new Error('获取配置文件失败');
                }
            } catch (err) {}
        }
        get_report_config();
    }, []);

    const handleFileChange = (protocol: Protocol['id']) => async (): Promise<void> => {
        try {
            // 使用 dialog.open 来获取实际文件路径
            const selected = await open({
                multiple: false,
                filters: [{
                    name: 'Config Files',
                    extensions: ['xml']
                }],
                // 如果有当前路径，设置为默认目录
                defaultPath: selectedFiles[protocol].path 
                    ? selectedFiles[protocol].path.substring(0, selectedFiles[protocol].path.lastIndexOf('/'))
                    : undefined
            });

            if (selected && typeof selected === 'string') {
                const path = selected.replace(/\\/g, '/');
                setSelectedFiles(prev => ({
                    ...prev,
                    [protocol]: { path }
                }));
                const fileinfo = {...selectedFiles, [protocol]: { path }};
                save_config(fileinfo)
            }
            const result = await confirm("重启以使配置文件生效?", {cancelLabel: '取消', okLabel: '确定'});
            console.log("重启结果: ", result);
            if (result) {
                await relaunch();
            } else {
                return;
            }
        } catch (err) {
            console.error(err);
        }
    };

    async function save_config(save_config: SelectedFiles) {
        try {
            await invoke("set_config_value_async", {
                section: "ProtocolSetting", 
                key: "protocolfile", 
                value: JSON.stringify(save_config)
            });
        } catch (err) {
            console.error('保存配置文件失败', err);
        }
    }

    const renderFileInfo = (fileInfo: FileInfo): string => {
        if (!fileInfo.path) return '点击选择文件';
        
        // 获取文件名
        const fileName = fileInfo.path.split('/').pop() || fileInfo.path;
        
        // 如果路径太长，只显示文件名
        if (fileInfo.path.length > 40) {
            return `.../${fileName}`;
        }
        
        // 如果路径较短，显示完整路径
        return fileInfo.path;
    };

    const protocols: Protocol[] = [
        { id: 'nanwang13', name: '南网13协议' },
        { id: 'dlt645', name: 'DLT/645协议' },
        { id: 'nanwang16', name: '南网16协议' }
    ];

    return (
        <div className="mt-2 space-y-3">
            {protocols.map((protocol: Protocol) => (
                <div key={protocol.id} className="flex items-center w-16">
                    <label className="inline-flex items-center min-w-32 text-sm">
                        {protocol.name}
                    </label>
                    <div className="ml-2 flex-1 w-10">
                        <span
                            className="cursor-pointer text-blue-600 hover:text-blue-800 hover:underline text-sm block"
                            onClick={handleFileChange(protocol.id)}
                            title={selectedFiles[protocol.id].path}
                        >
                            {renderFileInfo(selectedFiles[protocol.id])}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
};

const ProtocolConfigPath = () => {
    const [is_check, setCheck] = useState<boolean>(false);

    return (
        <div className="join join-vertical collapse bg-base-200 shadow-md w-full">
            <div className="collapse collapse-arrow join-item border-base-300 border">
                <input type="radio" name="my-accordion-4" checked={is_check} onClick={() => setCheck(!is_check)} />
                <div className="collapse-title flex items-center ">
                    <SetFileIcon className="size-6" />
                    <p className="ml-2">配置文件</p> {/* 添加左侧间距 */}
                </div>
                <div className="collapse-content bg-base-100">
                    <ConfigFilePathCom/ >
                </div>
            </div>
        </div>
    );
}

export default ProtocolConfigPath;