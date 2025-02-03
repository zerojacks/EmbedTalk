import ThemeChange from "../settingcomplent/theme";
import Region from "../settingcomplent/region";
import Alert from "../components/alert";
import AboutInfo from "../settingcomplent/about"
import Report from "../settingcomplent/report";
import ConnectBridge from "../settingcomplent/connectbridge";
import ProtocolConfigPath from '../settingcomplent/protocolpath'
import ShortcutSetting from '../settingcomplent/shortcut';
import { useState } from "react";

export default function Settings() {
  const [is_check, setCheck] = useState(false);
  return (
    <div className="flex flex-col h-full w-full p-6 overflow-y-auto hide-scrollbar">
      <div className="dropdown">
        <label className="text-xl flex items-center mt-4 font-bold">连接设置</label>
        <div className="mt-4">
          <ConnectBridge />
        </div>
      </div>

      <div className="dropdown">
        <label className="text-xl flex items-center mt-4 font-bold">协议设置</label>
        <div className="mt-4">
          <Region />
        </div>
        <div className="mt-4">
          <Report />
        </div>
        <div className="mt-4">
          <ProtocolConfigPath />
        </div>
      </div>

      <div className="dropdown">
        <label className="text-xl flex items-center mt-4 font-bold">快捷键设置</label>
        <div className="mt-4">
          <ShortcutSetting />
        </div>
      </div>

      <div className="dropdown">
        <label className="text-xl flex items-center mt-4 font-bold">基础设置</label>
        <div className="mt-4">
          <ThemeChange />
        </div>
        <div className="mt-4">
          <AboutInfo />
        </div>
      </div>
    </div>
  );
}
