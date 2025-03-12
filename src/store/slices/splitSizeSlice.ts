import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '..';

interface SplitSizeState {
    splitSize: number[];
}

const initialState: SplitSizeState = {
    splitSize: [30, 70],
};

export const splitSizeSlice = createSlice({
    name: 'splitSize',
    initialState,
    reducers: {
        setSplitSize: (state, action: PayloadAction<number[]>) => {
            state.splitSize = action.payload;
        },
    },
});

export const { setSplitSize } = splitSizeSlice.actions;
export const selectSplitSize = (state: RootState) => state.splitSize.splitSize;
export default splitSizeSlice.reducer;