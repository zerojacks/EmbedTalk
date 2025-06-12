import { configureStore } from '@reduxjs/toolkit';
import splitSizeReducer from './slices/splitSizeSlice';
import fileParseReducer from './slices/fileParseSlice';
import frameParseReducer from './slices/frameParseSlice'
import settingsReducer from './slices/settingsSlice';

export const store = configureStore({
    reducer: {
        splitSize: splitSizeReducer,
        fileParse: fileParseReducer,
        frameParse: frameParseReducer,
        settings: settingsReducer,
    },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
