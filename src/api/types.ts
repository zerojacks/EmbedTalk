import { TreeItemType } from "../components/TreeItem";

export interface ParseResponse {
    data: TreeItemType[];
    error?: string;
}

export interface ParseRequest {
    message: string;
    region: string;
}

export interface ApiInterface {
    parseFrame(message: string, region: string): Promise<ParseResponse>;
    getRegion(): Promise<string>;
    setRegion(region: string): Promise<void>;
}

// 协议相关接口
export interface ProtocolConfigRequest {
    item_id: string;
    protocol: string;
    region: string;
    dir?: number;
}

export interface ItemConfigList {
    item: string;
    name?: string;
    protocol?: string;
    region?: string;
    dir?: string;
}

export interface ProtocolListResponse {
    items: ItemConfigList[];
    error?: string;
} 