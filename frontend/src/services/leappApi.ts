import { Module, Profile } from '../app/ileapp/types';

const API_BASE = 'http://localhost:8000/api';

async function handleApiResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
    }
    return response.json();
}

/**
 * Create a tool-specific API client
 * @param tool - The tool identifier (e.g., 'ileapp', 'aleapp')
 */
export function createLeappApi(tool: string) {
    return {
        modules: {
            getAll: async (): Promise<{ modules: Module[] }> => {
                const response = await fetch(`${API_BASE}/${tool}/modules`);
                return handleApiResponse(response);
            },

            select: async (selections: Record<string, boolean>): Promise<void> => {
                await fetch(`${API_BASE}/${tool}/modules/select`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(selections),
                });
            },
        },

        profiles: {
            getAll: async (): Promise<Profile[]> => {
                const response = await fetch(`${API_BASE}/${tool}/profiles`);
                return handleApiResponse(response);
            },

            load: async (profileId: number): Promise<{ message: string }> => {
                const response = await fetch(` ${API_BASE}/${tool}/profiles/${profileId}/load`, {
                    method: 'POST',
                });
                return handleApiResponse(response);
            },

            save: async (name: string, modules: string[]): Promise<{ name: string }> => {
                const response = await fetch(`${API_BASE}/${tool}/profiles`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, modules }),
                });
                return handleApiResponse(response);
            },

            delete: async (profileId: number): Promise<{ message: string }> => {
                const response = await fetch(`${API_BASE}/${tool}/profiles/${profileId}`, {
                    method: 'DELETE',
                });
                return handleApiResponse(response);
            },
        },

        browser: {
            browseFiles: async (): Promise<{ success: boolean; file_path: string }> => {
                const response = await fetch(`${API_BASE}/browse-files`, { method: 'POST' });
                return handleApiResponse(response);
            },

            browseFolders: async (): Promise<{ success: boolean; file_path: string }> => {
                const response = await fetch(`${API_BASE}/browse-folders`, { method: 'POST' });
                return handleApiResponse(response);
            },
        },

        processing: {
            start: async (
                inputPath: string,
                outputFolder: string,
                selectedModules: string[],
                reportName?: string,
                password?: string
            ): Promise<{ task_id: string }> => {
                const response = await fetch(`${API_BASE}/${tool}/process`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        input_path: inputPath,
                        output_folder: outputFolder,
                        selected_modules: selectedModules,
                        report_name: reportName,
                        password: password
                    }),
                });
                return handleApiResponse(response);
            },

            stop: async (taskId: string): Promise<void> => {
                const response = await fetch(`${API_BASE}/${tool}/stop/${taskId}`, {
                    method: 'POST',
                });
                return handleApiResponse(response);
            },

            validateBackup: async (inputPath: string): Promise<{ encrypted: boolean, type: string, supported: boolean, message?: string }> => {
                const response = await fetch(`${API_BASE}/ios/validate-backup`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ input_path: inputPath }),
                });
                return handleApiResponse(response);
            },

            createEventSource: (taskId: string): EventSource => {
                return new EventSource(`${API_BASE}/process/stream/${taskId}`);
            },
        },
        backup: {
            getDevices: async () => {
                const response = await fetch(`${API_BASE}/ios/devices`);
                if (!response.ok) throw new Error('Failed to fetch devices');
                return response.json();
            },
            startBackup: async (udid: string, name: string) => {
                const response = await fetch(`${API_BASE}/ios/backup`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ udid, name }),
                });
                if (!response.ok) throw new Error('Failed to start backup');
                return response.json();
            },
            getBackups: async () => {
                const response = await fetch(`${API_BASE}/backups`);
                if (!response.ok) throw new Error('Failed to fetch backups');
                return response.json();
            },
            deleteBackup: async (id: number) => {
                const response = await fetch(`${API_BASE}/backups/${id}`, {
                    method: 'DELETE',
                });
                if (!response.ok) throw new Error('Failed to delete backup');
                return response.json();
            },
        },
    };
}

// Keep backward compatibility - default to i LEAPP
export const ileappApi = createLeappApi('ileapp');
