export const getRegions = () => {
    return ["南网", "云南", "广东", "深圳", "广西", "贵州", "海南", "topo"]; // 这是一个静态的数组
};

export function cleanAndUppercase(targetRegion: string) {
    let cleaned = targetRegion;
    cleaned = cleaned.replace(/"/g, '');
    cleaned = cleaned.toUpperCase();
    return cleaned;
}