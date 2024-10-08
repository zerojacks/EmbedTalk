import domtoimage from 'dom-to-image';

self.onmessage = async (event) => {
    const { elementData } = event.data;

    try {
        const dataUrl = await generateImage(elementData);
        self.postMessage({ dataUrl });
    } catch (error) {
        self.postMessage({ error: error.message });
    }
};

const generateImage = async (elementData) => {
    // 创建一个临时的 DOM 元素
    const tempElement = document.createElement('div');
    tempElement.innerHTML = elementData;

    // 使用 dom-to-image 生成图像
    const dataUrl = await domtoimage.toSvg(tempElement, {
        quality: 1,
        bgcolor: '#ffffff', // 背景色
        style: {
            'font-size': '16px',
            'letter-spacing': '0.05em',
            'line-height': '1.5',
            'fill': 'black',
        },
    });

    return dataUrl;
};
