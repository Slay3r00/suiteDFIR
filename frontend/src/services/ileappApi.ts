import { Module, Profile } from '../app/ileapp/types';

const API_BASE = 'http://localhost:8000/api';

async function handleApiResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }
  return response.json();
}

export const ileappApi = {
  modules: {
    getAll: async (): Promise<{ modules: Module[] }> => {
      const response = await fetch(`${API_BASE}/modules`);
      return handleApiResponse(response);
    },

    select: async (selections: Record<string, boolean>): Promise<void> => {
      await fetch(`${API_BASE}/modules/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selections),
      });
    },
  },

  profiles: {
    getAll: async (): Promise<Profile[]> => {
      const response = await fetch(`${API_BASE}/profiles`);
      return handleApiResponse(response);
    },

    load: async (profileId: number): Promise<{ message: string }> => {
      const response = await fetch(`${API_BASE}/profiles/${profileId}/load`, {
        method: 'POST',
      });
      return handleApiResponse(response);
    },

    save: async (name: string, modules: string[]): Promise<{ name: string }> => {
      const response = await fetch(`${API_BASE}/profiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, modules }),
      });
      return handleApiResponse(response);
    },

    delete: async (profileId: number): Promise<{ message: string }> => {
      const response = await fetch(`${API_BASE}/profiles/${profileId}`, {
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
    start: async (inputPath: string, outputFolder: string, selectedModules: string[]): Promise<{ task_id: string }> => {
      const response = await fetch(`${API_BASE}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input_path: inputPath,
          output_folder: outputFolder,
          selected_modules: selectedModules,
          timezone_offset: 'UTC'
        }),
      });
      return handleApiResponse(response);
    },

    stop: async (taskId: string): Promise<void> => {
      await fetch(`${API_BASE}/process/stop/${taskId}`, { method: 'POST' });
    },

    createEventSource: (taskId: string): EventSource => {
      return new EventSource(`${API_BASE}/process/stream/${taskId}`);
    },
  },
};