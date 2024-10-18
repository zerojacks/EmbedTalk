import { create } from 'zustand';

interface ProtocolState {
    region: string;
    isreport: boolean;

    // Actions to update the state
    setRegion: (region: string) => void;
    setIsReport: (isreport: boolean) => void;
}

export const useProtocolInfoStore = create<ProtocolState>((set) => ({
    region: '',
    isreport: true,
    // Actions to update the state
    setRegion: (region: string) => set({ region: region }),
    setIsReport: (isreport: boolean) => set({ isreport: isreport }),
}));