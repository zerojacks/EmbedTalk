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
import { Menu, MenuItem } from "@tauri-apps/api/menu";
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
        path: "/settings",
        element: <Settings />,
      },
    ],
  },
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
      <ToastProvider>
        <SettingsProvider>
          <RouterProvider router={router} />
        </SettingsProvider>
      </ToastProvider>
    </TauriProvider>
  </React.StrictMode>
);
initializeToast();