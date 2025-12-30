/**
 * API functions for managing forensic tools
 */

const API_BASE = 'http://localhost:8000';

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
 * Get installation status of all tools
 */
export async function getToolsStatus(): Promise<ToolsStatusResponse> {
    const response = await fetch(`${API_BASE}/api/tools/status`);

    if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
}

/**
 * Install a tool with progress updates
 */
export async function installTool(
    toolName: string,
    onProgress?: (progress: number, message: string) => void
): Promise<{ success: boolean; error?: string }> {

    // Try streaming endpoint first
    try {
        const response = await fetch(`${API_BASE}/api/tools/install/${toolName}`, {
            method: 'POST',
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
            throw new Error('No response body');
        }

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const text = decoder.decode(value);
            const lines = text.split('\n').filter(line => line.startsWith('data: '));

            for (const line of lines) {
                try {
                    const data = JSON.parse(line.slice(6));

                    if (onProgress) {
                        onProgress(data.progress, data.message);
                    }

                    if (data.error) {
                        return { success: false, error: data.message };
                    }

                    if (data.complete) {
                        return { success: true };
                    }
                } catch {
                    // Ignore parse errors
                }
            }
        }

        return { success: true };
    } catch (error) {
        // Fallback to sync endpoint
        try {
            const response = await fetch(`${API_BASE}/api/tools/install/${toolName}/sync`, {
                method: 'POST',
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                return { success: false, error: data.detail || 'Installation failed' };
            }

            return { success: true };
        } catch (syncError) {
            return { success: false, error: String(syncError) };
        }
    }
}

/**
 * Uninstall a tool
 */
export async function uninstallTool(toolName: string): Promise<{ success: boolean; error?: string }> {
    try {
        const response = await fetch(`${API_BASE}/api/tools/${toolName}`, {
            method: 'DELETE',
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            return { success: false, error: data.detail || 'Uninstall failed' };
        }

        return { success: true };
    } catch (error) {
        return { success: false, error: String(error) };
    }
}
