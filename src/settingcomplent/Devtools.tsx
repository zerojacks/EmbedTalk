import { Terminal} from 'lucide-react';
import { invoke } from "@tauri-apps/api/core";
const Devtools = () => {

    const handleOpenDevTools = async () => {
        try {
          await invoke('open_devtools');
        } catch (error) {
          console.error('Failed to open devtools:', error);
        }
      };

    return (
        <div className="join join-vertical collapse bg-base-200 shadow-md w-full">
            <div className="collapse-title text-base flex items-center w-full pr-0">
                <div className="flex items-center">
                    <Terminal className="size-6" />
                    <p className="ml-2">开发者工具</p> {/* 添加左侧间距 */}
                </div>
                <div className="form-control flex ml-auto mr-3">
                    <button onClick={handleOpenDevTools}>开发者工具</button>
                </div>
            </div>
        </div>
    );
}

export default Devtools;