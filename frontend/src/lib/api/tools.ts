/**
 * API functions for forensic tools status
 *
 * Tools are now vendored with the application, so this only provides
 * status checking functionality.
 */

import { API } from '@/lib/api';

export interface ToolStatus {
    name: string;
    description: string;
    installed: boolean;
    path: string | null;
    version: string | null;
    installed_at: string | null;
    latest_version?: string;
    update_available?: boolean;
}

export interface ToolsStatusResponse {
    ileapp: ToolStatus;
    aleapp: ToolStatus;
}

/**
 * Get availability status of all forensic tools
 *
 * Tools are vendored with the application, so this only checks
 * if they exist at expected paths.
 */
export async function getToolsStatus(): Promise<ToolsStatusResponse> {
    const response = await fetch(API.path('/tools/status'));

    if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
}
