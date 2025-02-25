import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Layout from "./layout";
import ErrorPage from "./error-page";
import Home from "./routes/home";
import Settings from "./routes/settings";
import { TauriProvider } from "./context/TauriProvider";
import "./styles.css";
import { SettingsProvider } from "./context/SettingsProvider";
import { ToastProvider, initializeToast  } from './context/ToastProvider';
import { ShortcutProvider } from './context/ShortcutProvider';
import { Menu, MenuItem } from "@tauri-apps/api/menu";
import Itemconfig from "./routes/itemconfig"
import ChannelMonitor from "./routes/ChannelMonitor";
import QuickParse from "./routes/quick-parse";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    errorElement: <ErrorPage />,
    children: [
      {
        index: true,
        element: <Home />,
      },
      {
        path: "/channelmonitor",
        element: <ChannelMonitor />
      },
      {
        path: "/itemconfig",
        element: <Itemconfig />
      },
      {
        path: "/settings",
        element: <Settings />,
      },
    ],
  },
  {
    path: "/quick-parse",
    element: <QuickParse />,
  }
]);

// async function creatmen() {
//   const file = await MenuItem.new({
//     text: "file",
//     id: "file",
//     action: async () => {
//       console.log("file clicked");
//     },
//   });
//   const appmenu = await Menu.new({items: [file]});
//   await appmenu.setAsWindowMenu();
// }

// creatmen();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <TauriProvider>
      <SettingsProvider>
        <ToastProvider>
          <ShortcutProvider>
            <RouterProvider router={router} />
          </ShortcutProvider>
        </ToastProvider>
      </SettingsProvider>
    </TauriProvider>
  </React.StrictMode>
);
initializeToast();