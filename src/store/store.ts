import { configureStore } from '@reduxjs/toolkit';
import splitSizeReducer from './slices/splitSizeSlice';
import fileParseReducer from './slices/fileParseSlice';

export const store = configureStore({
    reducer: {
        splitSize: splitSizeReducer,
        fileParse: fileParseReducer,
    },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
