import { invoke } from "@tauri-apps/api/core";
import { ApiInterface, ParseResponse, ProtocolConfigRequest, ProtocolListResponse } from './types';

class DesktopApi implements ApiInterface {
    async parseFrame(message: string, region: string): Promise<ParseResponse> {
        return await invoke<ParseResponse>('prase_frame', { message, region });
    }

    async getRegion(): Promise<string> {
        return await invoke<string>('get_region_value');
    }

    async setRegion(region: string): Promise<void> {
        await invoke('set_region_value', { region });
    }

    // 协议相关API
    async getProtocolConfig(request: ProtocolConfigRequest): Promise<any> {
        return await invoke('get_protocol_config', { request });
    }

    async getAllProtocolList(): Promise<ProtocolListResponse> {
        return await invoke<ProtocolListResponse>('get_protocol_list');
    }

    async getCSG13List(): Promise<ProtocolListResponse> {
        return await invoke<ProtocolListResponse>('get_csg13_list');
    }

    async getCSG16List(): Promise<ProtocolListResponse> {
        return await invoke<ProtocolListResponse>('get_csg16_list');
    }

    async getDLT645List(): Promise<ProtocolListResponse> {
        return await invoke<ProtocolListResponse>('get_dlt645_list');
    }

    async getModuleList(): Promise<ProtocolListResponse> {
        return await invoke<ProtocolListResponse>('get_module_list');
    }
}

export const desktopApi = new DesktopApi(); 