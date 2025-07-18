import React from 'react';
import { Provider } from 'react-redux';
import { store } from '../store/index';
import FrameExtractorPage from './frameExtractor/FrameExtractorPage';

const FrameExtractor: React.FC = () => {
    return (
        <Provider store={store}>
            <div className="flex-1 min-w-0 flex w-full h-full">
                <FrameExtractorPage />
            </div>
        </Provider>
    );
};

export default FrameExtractor;