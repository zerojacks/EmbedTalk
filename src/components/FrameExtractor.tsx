import React from 'react';
import { Provider } from 'react-redux';
import { store } from '../store';
import FrameExtractorPage from './frameExtractor/FrameExtractorPage';

const FrameExtractor: React.FC = () => {
        return (
    <Provider store={store}>
      <FrameExtractorPage />
    </Provider>
    );
};

export default FrameExtractor;