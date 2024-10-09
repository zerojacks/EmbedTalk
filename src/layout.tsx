import { Outlet, Link, useLocation } from "react-router-dom";
import { AiOutlineSetting, AiOutlineHome } from "react-icons/ai";
import clsx from "clsx";
import { CustomTitleBar } from './components/CustomTitleBar'; // Assuming you have this component
import { useSettingsContext } from "./context/SettingsProvider"; 

export default function Layout() {
  const location = useLocation();
  const { theme, setTheme } = useSettingsContext();

  const selectedClass = "text-accent";
  const defaultClass = "w-5 h-5";
  const linkClass = "hover:text-accent w-10 h-10";

  return (
    <div className="flex flex-col h-screen border textarea-bordered shadow-lg">
      {/* <CustomTitleBar theme={theme} />  */}
      <div className="flex flex-row flex-grow overflow-hidden">
        <div className="w-10 bg-base-200 flex flex-col gap-3 px-2 pt-3">
          <Link className={linkClass} to="/">
            <AiOutlineHome
              className={clsx(defaultClass, {
                [selectedClass]: location.pathname === "/",
              })}
            />
          </Link>
          <Link className={linkClass} to="/itemconfig">
            <AiOutlineHome
              className={clsx(defaultClass, {
                [selectedClass]: location.pathname === "/itemconfig",
              })}
            />
          </Link>
          <div className="flex-grow" />
          <Link className={linkClass} to="/settings">
            <AiOutlineSetting
              className={clsx(defaultClass, {
                [selectedClass]: location.pathname === "/settings",
              })}
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
