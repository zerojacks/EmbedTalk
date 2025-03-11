import { useState, useEffect, useRef, ChangeEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { relaunch } from '@tauri-apps/plugin-process';
import { SetFileIcon } from '../components/Icons';
import { open, confirm } from '@tauri-apps/plugin-dialog';
import { exists } from '@tauri-apps/plugin-fs';
import { resolveResource } from '@tauri-apps/api/path';

interface Protocol {
    id: 'nanwang13' | 'dlt645' | 'nanwang16' | 'moudle';
    name: string;
}

interface FileInfo {
    path: string;
}

interface SelectedFiles {
    nanwang13: FileInfo;
    dlt645: FileInfo;
    nanwang16: FileInfo;
    moudle: FileInfo;
}

interface ProtocolMap {
    [key: string]: string;
}

const protocolmap: ProtocolMap = {
    nanwang13: 'CSG13',
    dlt645: 'DLT645',
    nanwang16: 'CSG16',
    moudle: 'MOUDLE'
};

const ConfigFilePathCom: React.FC = () => {
    const [selectedFiles, setSelectedFiles] = useState<SelectedFiles>({
        nanwang13: { path: '' },
        dlt645: { path: '' },
        nanwang16: { path: '' },
        moudle: { path: '' }
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
            } catch (err) {
                const updates: Record<string, { path: string }> = {};
                for (const key of Object.keys(protocolmap)) {
                    const relativeFilePath = `resources/protocolconfig/${protocolmap[key]}.xml`;
                    try{
                        // 使用 resolveResource 获取实际路径
                        const resolvedPath = await resolveResource(relativeFilePath);
                        const isexist = await exists(resolvedPath);
                        console.log(isexist, resolvedPath);
                        updates[key] = { path: isexist ? resolvedPath : '' };
                    } catch (error) {
                        console.error(`Error checking file for ${key}:`, error);
                        updates[key] = { path: '' };
                    }
                }
            
                setSelectedFiles(prev => ({
                    ...prev,
                    ...updates
                }));
                const fileinfo = {...selectedFiles, ...updates};
                save_config(fileinfo)
            }
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
                defaultPath: selectedFiles[protocol]?.path 
                    ? selectedFiles[protocol].path.substring(0, selectedFiles[protocol].path.lastIndexOf('/'))
                    : undefined
            });

            if (selected && typeof selected === 'string') {
                const path = selected.replace(/\\/g, '/');
                // Create updated state object
                const updatedFiles = {
                    ...selectedFiles,
                    [protocol]: { path }
                };
                
                // Update state
                setSelectedFiles(updatedFiles);
                
                // Save the updated config
                await save_config(updatedFiles);
                
                const result = await confirm("重启以使配置文件生效?", {cancelLabel: '取消', okLabel: '确定'});
                console.log("重启结果: ", result);
                if (result) {
                    await relaunch();
                }
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
        if (!fileInfo || !fileInfo.path) return '点击选择文件';
    
        // 获取文件名
        console.log(fileInfo.path);
    
        // 使用正则表达式来匹配文件名
        const match = fileInfo.path.match(/[^\\\/]+$/);
        const fileName = match ? match[0] : fileInfo.path;
    
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
        { id: 'nanwang16', name: '南网16协议' },
        { id: 'moudle', name: '模组协议' }
    ];

    return (
        <div className="mt-2 space-y-3">
            {protocols.map((protocol: Protocol) => (
                <div key={protocol.id} className="flex items-center w-16">
                    <label className="inline-flex items-center min-w-32 text-sm">
                        {protocol.name}
                    </label>
                    <div className="ml-2 flex-1 w-20">
                        <span
                            className="cursor-pointer text-blue-600 hover:text-blue-800 hover:underline text-sm block shrink-0 whitespace-nowrap"
                            onClick={handleFileChange(protocol.id)}
                            title={selectedFiles[protocol.id]?.path || ''}
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
                <input 
                    type="checkbox" 
                    name="my-accordion-4" 
                    checked={is_check} 
                    onChange={() => setCheck(!is_check)} 
                />
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