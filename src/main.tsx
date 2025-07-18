import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { TauriProvider } from "./context/TauriProvider";
import { PlatformProvider } from './context/PlatformProvider';
import "./styles.css";
import { SettingsProvider } from "./context/SettingsProvider";
import { ToastProvider, initializeToast  } from './context/ToastProvider';
import { ShortcutProvider } from './context/ShortcutProvider';
import { TrayProvider } from './context/TrayProvider';
import { UpdateProvider } from './context/UpdateProvider';

import { store, persistor } from './store';
import Layout from "./layout";
import ErrorPage from "./error-page";
import Home from "./routes/home";
import Settings from "./routes/settings";
import Itemconfig from "./routes/itemconfig"
import ChannelMonitorRedux from "./routes/ChannelMonitorRedux";
import QuickParse from "./routes/quick-parse";
import DLT645Test from "./routes/dlt645-test";
import FileParse from "./routes/file-parse";
import Tools from "./routes/tools";
import FrameExtractorPage from './routes/frame-extractor';
import TaskAnalysis from './routes/task-analysis';
import LogParse from './routes/log-parse';
import UpdateProgress from './components/UpdateProgress';
import FrameView from "./routes/FrameView";
import FrameParse from "./routes/frame-parse";

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
        element: <ChannelMonitorRedux />
      },
      {
        path: "/itemconfig",
        element: <Itemconfig />
      },
      {
        path: "/settings",
        element: <Settings />,
      },
      {
        path: "/dlt645-test",
        element: <DLT645Test />,
      },
      {
        path: "/file-parse",
        element: <FileParse />,
      },
      {
        path: "/tools",
        element: <Tools />,
      },
      {
        path:"/frame-extractor",
        element: <FrameExtractorPage />
      },
      // {
      //   path: "/task-analysis",
      //   element: <TaskAnalysis />
      // },
      {
        path: "/log-parse",
        element: <LogParse />
      },
      {
        path: "/frame-view",
        element: <FrameView />
      }
    ],
  },
  {
    path: "/quick-parse",
    element: <QuickParse />,
  },
  {
    path: "/frame-parse",
    element: <FrameParse />,
  }
]);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Provider store={store}>
      <PersistGate persistor={persistor}>
        <PlatformProvider>
          <TauriProvider>
            <SettingsProvider>
              <ToastProvider>
                <UpdateProvider>
                  <ShortcutProvider>
                    <TrayProvider>
                      <>
                        <RouterProvider router={router} />
                        <UpdateProgress />
                      </>
                    </TrayProvider>
                  </ShortcutProvider>
                </UpdateProvider>
              </ToastProvider>
            </SettingsProvider>
          </TauriProvider>
        </PlatformProvider>
      </PersistGate>
    </Provider>
  </React.StrictMode>
);
initializeToast();