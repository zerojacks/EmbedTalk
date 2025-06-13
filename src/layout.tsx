import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { AiOutlineSetting, AiOutlineHome } from "react-icons/ai";
import { MdOutlineMonitor, MdOutlineDevices } from "react-icons/md";
import { BiNetworkChart } from "react-icons/bi";
import { TbDeviceAnalytics, TbReportAnalytics, TbFileAnalytics } from "react-icons/tb";
import { BiSolidFileArchive } from "react-icons/bi";
import { FiTool,FiDatabase } from "react-icons/fi";
import { VscOutput } from "react-icons/vsc";
import { IoLogoApple } from "react-icons/io";
import clsx from "clsx";
import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import AboutDialog from "./components/AboutDialog";
import { SettingsDrawer } from "./components/SettingsDrawer";
import { useSettingsContext } from "./context/SettingsProvider";
import { usePlatform } from './context/PlatformProvider';

export default function Layout() {
  const location = useLocation();
  const [isAboutDialogOpen, setIsAboutDialogOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { theme, setTheme } = useSettingsContext();
  const { isWeb } = usePlatform();
  useEffect(() => {
    // 监听来自托盘的关于对话框显示事件
    const unlisten = listen("show-about-dialog", () => {
      setIsAboutDialogOpen(true);
    });

    return () => {
      unlisten.then(unlistenFn => unlistenFn());
    };
  }, []);

  const handleThemeToggle = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const selectedClass = "text-accent";
  const defaultClass = "w-5 h-5";

  // Web环境下的布局
  if (isWeb) {
    let linkClass = "hover:text-accent flex items-center gap-2 px-3 py-2";

    return (
      <div className="flex flex-col h-screen border textarea-bordered shadow-lg w-full">
        <div className="flex flex-col flex-grow overflow-hidden">
          {/* 导航栏 - 修改为水平布局 */}
          <div className="h-12 bg-base-200 flex flex-row items-center px-2 shadow-lg">
            <Link to="/" className="text-xl font-semibold hover:text-accent px-3">
              EmbedTalk
            </Link>
            <div className="flex-grow" />
            <label className="swap swap-rotate mr-2">
              <input 
                type="checkbox" 
                checked={theme === 'dark'}
                onChange={handleThemeToggle}
              />
              {/* 太阳图标 */}
              <svg className="swap-on fill-current w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path d="M5.64,17l-.71.71a1,1,0,0,0,0,1.41,1,1,0,0,0,1.41,0l.71-.71A1,1,0,0,0,5.64,17ZM5,12a1,1,0,0,0-1-1H3a1,1,0,0,0,0,2H4A1,1,0,0,0,5,12Zm7-7a1,1,0,0,0,1-1V3a1,1,0,0,0-2,0V4A1,1,0,0,0,12,5ZM5.64,7.05a1,1,0,0,0,.7.29,1,1,0,0,0,.71-.29,1,1,0,0,0,0-1.41l-.71-.71A1,1,0,0,0,4.93,6.34Zm12,.29a1,1,0,0,0,.7-.29l.71-.71a1,1,0,1,0-1.41-1.41L17,5.64a1,1,0,0,0,0,1.41A1,1,0,0,0,17.66,7.34ZM21,11H20a1,1,0,0,0,0,2h1a1,1,0,0,0,0-2Zm-9,8a1,1,0,0,0-1,1v1a1,1,0,0,0,2,0V20A1,1,0,0,0,12,19ZM18.36,17A1,1,0,0,0,17,18.36l.71.71a1,1,0,0,0,1.41,0,1,1,0,0,0,0-1.41ZM12,6.5A5.5,5.5,0,1,0,17.5,12,5.51,5.51,0,0,0,12,6.5Zm0,9A3.5,3.5,0,1,1,15.5,12,3.5,3.5,0,0,1,12,15.5Z" />
              </svg>
              {/* 月亮图标 */}
              <svg className="swap-off fill-current w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path d="M21.64,13a1,1,0,0,0-1.05-.14,8.05,8.05,0,0,1-3.37.73A8.15,8.15,0,0,1,9.08,5.49a8.59,8.59,0,0,1,.25-2A1,1,0,0,0,8,2.36,10.14,10.14,0,1,0,22,14.05,1,1,0,0,0,21.64,13Zm-9.5,6.69A8.14,8.14,0,0,1,7.08,5.22v.27A10.15,10.15,0,0,0,17.22,15.63a9.79,9.79,0,0,0,2.1-.22A8.11,8.11,0,0,1,12.14,19.73Z" />
              </svg>
            </label>
            <button 
              className="btn btn-ghost btn-circle"
              onClick={() => setIsSettingsOpen(true)}
            >
              <AiOutlineSetting className="w-5 h-5" />
            </button>
          </div>

          {/* 主要内容区域 */}
          <div className="flex-grow">
            <Outlet />
          </div>
        </div>

        {/* 设置抽屉 */}
        <SettingsDrawer 
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />
      </div>
    );
  }

  // 桌面端保持原有布局
  let linkClass = "hover:text-accent w-10 h-10";

  return (
    <div className="flex flex-col h-screen border textarea-bordered shadow-lg w-full">
      <div className="flex flex-row flex-grow overflow-hidden">
        <div className="w-10 bg-base-200 flex flex-col gap-3 px-2 pt-3">
          <Link className={linkClass} to="/">
            <AiOutlineHome
              className={clsx(defaultClass, {
                [selectedClass]: location.pathname === "/",
              })}
              title="首页"
            />
          </Link>
          <Link className={linkClass} to="/channelmonitor">
            <MdOutlineMonitor
              className={clsx(defaultClass, {
                [selectedClass]: location.pathname === "/channelmonitor",
              })}
              title="通道监控"
            />
          </Link>
          <Link className={linkClass} to="/itemconfig">
            <BiNetworkChart
              className={clsx(defaultClass, {
                [selectedClass]: location.pathname === "/itemconfig",
              })}
              title="项目配置"
            />
          </Link>
          {/* <Link className={linkClass} to="/dlt645-test">
            <TbDeviceAnalytics
              className={clsx(defaultClass, {
                [selectedClass]: location.pathname === "/dlt645-test",
              })}
              title="DLT645测试"
            />
          </Link> */}
          <Link className={linkClass} to="/file-parse">
            <BiSolidFileArchive
              className={clsx(defaultClass, {
                [selectedClass]: location.pathname === "/file-parse",
              })}
              title="文件解析"
            />
          </Link>
          <Link className={linkClass} to="/tools">
            <FiTool
              className={clsx(defaultClass, {
                [selectedClass]: location.pathname === "/tools",
              })}
              title="工具集合"
            />
          </Link>
          <Link className={linkClass} to="/frame-extractor">
            <FiDatabase
              className={clsx(defaultClass, {
                [selectedClass]: location.pathname === "/frame-extractor",
              })}
              title="数据提取"
            />
          </Link>
          <Link className={linkClass} to="/task-analysis">
            <TbReportAnalytics
              className={clsx(defaultClass, {
                [selectedClass]: location.pathname === "/task-analysis",
              })}
              title="任务分析"
            />
          </Link>
          <Link className={linkClass} to="/log-parse">
            <VscOutput
              className={clsx(defaultClass, {
                [selectedClass]: location.pathname === "/log-parse",
              })}
              title="日志解析"
            />
          </Link>
          <Link className={linkClass} to="/frame-parse">
            <TbFileAnalytics
              className={clsx(defaultClass, {
                [selectedClass]: location.pathname === "/frame-parse",
              })}
              title="报文解析"
            />
          </Link>
          <div className="flex-grow" />
          <Link className={linkClass} to="/settings">
            <AiOutlineSetting
              className={clsx(defaultClass, {
                [selectedClass]: location.pathname === "/settings",
              })}
              title="设置"
            />
          </Link>
        </div>
        <div className="flex-grow">
          <Outlet />
        </div>
      </div>

      {/* 关于对话框 */}
      <AboutDialog 
        isOpen={isAboutDialogOpen} 
        onClose={() => setIsAboutDialogOpen(false)} 
      />
    </div>
  );
}
