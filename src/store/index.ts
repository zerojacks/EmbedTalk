import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import channelReducer, { loadChannelConfig, initializeChannelService } from './slices/channelSlice';
import themeReducer, { initTheme } from './slices/themeSlice';
import splitSizeReducer from './slices/splitSizeSlice';
import fileParseReducer from './slices/fileParseSlice';
import frameExtractorReducer from './slices/frameExtractorSlice';
import TaskAnalysisReducer, { taskAnalysisSlice } from './slices/taskAnalysisSlice';
import logParseReducer from './slices/logParseSlice';
// 合并所有 reducer
const rootReducer = combineReducers({
  channel: channelReducer,
  theme: themeReducer,
  splitSize: splitSizeReducer,
  fileParse: fileParseReducer,
  frameExtractor: frameExtractorReducer,
  taskAnalysis: TaskAnalysisReducer,
  logParse: logParseReducer,
  // 可以在这里添加其他 reducer
});

// Redux Persist 配置
const persistConfig = {
  key: 'root',
  storage,
  whitelist: [], // 不持久化任何状态，配置由 channelSlice 管理
};

// 创建持久化的 reducer
const persistedReducer = persistReducer(persistConfig, rootReducer);

// 创建 store
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

// 初始化主题
initTheme(store);

// 创建持久化的 store
export const persistor = persistStore(store, null, () => {
  // store 准备就绪后初始化
  console.log('Redux store is ready, initializing channel configuration...');
  
  // 加载通道配置
  store.dispatch(loadChannelConfig())
    .then(() => {
      console.log('Channel configuration loaded, initializing channel service...');
      // 初始化通道服务
      return store.dispatch(initializeChannelService());
    })
    .catch(error => {
      console.error('Error during store initialization:', error);
    });
});

// 导出类型
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
