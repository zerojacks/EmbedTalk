import { ApiInterface, ParseResponse, ProtocolConfigRequest, ProtocolListResponse } from './types';

const WEB_API_BASE = 'http://localhost:3000';

class WebApi implements ApiInterface {
    async parseFrame(message: string, region: string): Promise<ParseResponse> {
        const response = await fetch(`${WEB_API_BASE}/api/parse`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message, region }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    }

    async getRegion(): Promise<string> {
        const response = await fetch(`${WEB_API_BASE}/api/region`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    }

    async setRegion(region: string): Promise<void> {
        const response = await fetch(`${WEB_API_BASE}/api/region`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(region),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
    }

    // 协议相关API
    async getProtocolConfig(request: ProtocolConfigRequest): Promise<any> {
        const response = await fetch(`${WEB_API_BASE}/api/protocol/config`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(request),
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    }

    async getAllProtocolList(): Promise<ProtocolListResponse> {
        const response = await fetch(`${WEB_API_BASE}/api/protocol/list`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    }

    async getCSG13List(): Promise<ProtocolListResponse> {
        const response = await fetch(`${WEB_API_BASE}/api/protocol/list/csg13`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    }

    async getCSG16List(): Promise<ProtocolListResponse> {
        const response = await fetch(`${WEB_API_BASE}/api/protocol/list/csg16`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    }

    async getDLT645List(): Promise<ProtocolListResponse> {
        const response = await fetch(`${WEB_API_BASE}/api/protocol/list/dlt645`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    }

    async getModuleList(): Promise<ProtocolListResponse> {
        const response = await fetch(`${WEB_API_BASE}/api/protocol/list/module`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    }
}

export const webApi = new WebApi(); 