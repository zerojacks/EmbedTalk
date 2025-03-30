import { Outlet, Link, useLocation } from "react-router-dom";
import { AiOutlineSetting, AiOutlineHome } from "react-icons/ai";
import { MdOutlineMonitor, MdOutlineDevices } from "react-icons/md";
import { BiNetworkChart } from "react-icons/bi";
import { TbDeviceAnalytics } from "react-icons/tb";
import { BiSolidFileArchive } from "react-icons/bi";
import clsx from "clsx";

export default function Layout() {
  const location = useLocation();

  const selectedClass = "text-accent";
  const defaultClass = "w-5 h-5";
  const linkClass = "hover:text-accent w-10 h-10";

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
    </div>
  );
}
