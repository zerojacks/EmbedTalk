import ThemeChange from "../settingcomplent/theme";
import Region from "../settingcomplent/region";
import Alert from "../components/alert";
import AboutInfo from "../settingcomplent/about"
import Report from "../settingcomplent/report";
import ConnectBridge from "../settingcomplent/connectbridge";

export default function Settings() {
  return (
    <div className="flex flex-col h-full w-full p-6 overflow-y-auto">
      <div className="dropdown">
        <label className="text-xl flex items-center mt-4 font-bold">连接设置</label>
        <div className="mt-4">
          <ConnectBridge></ConnectBridge>
        </div>
      </div>

      <div className="dropdown">
        <label className="text-xl flex items-center mt-4 font-bold">协议设置</label>
        <div className="mt-4">
          <Region></Region>
        </div>
        <div className="mt-4">
          <Report></Report>
        </div>
      </div>

      <div className="dropdown">
        <label className="text-xl flex items-center mt-4 font-bold">基础设置</label>
        <div className="mt-4">
          <ThemeChange></ThemeChange>
        </div>
        <div className="mt-4">
          <AboutInfo></AboutInfo>
        </div>
      </div>
    </div>
  );
}
