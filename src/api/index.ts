import { isPlatform } from "../utils/platform";
import { webApi } from "./web";
import { desktopApi } from "./desktop";
import { ApiInterface } from "./types";

export * from "./types";

// 根据平台选择合适的API实现
const api: ApiInterface = isPlatform.isDesktop ? desktopApi : webApi;

export default api; 