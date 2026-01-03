"use client"

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { createLeappApi } from '../services/leappApi'
import { Module } from '@/app/(main)/ileapp/types';

interface ProcessingState {
    logs: string[];
    isProcessing: boolean;
    progress: { current: number; total: number };
    taskId: string | null;
    processingReportName: string | null;
    encryptionDetected: boolean;
}

interface ToolConfig {
    inputFile: string;
    reportName: string;
    selectedModules: string[];
    artifactScrollPos: number;
}

interface ToolState {
    config: ToolConfig;
    processing: ProcessingState;
    modules: Module[];
    isLoadingModules: boolean;
}

interface LeappContextType {
    states: Record<string, ToolState>;
    updateConfig: (tool: string, updates: Partial<ToolConfig>) => void;
    fetchModules: (tool: string) => Promise<void>;
    toggleModule: (tool: string, name: string, selected: boolean) => Promise<void>;
    selectAll: (tool: string) => Promise<void>;
    selectNone: (tool: string) => Promise<void>;
    startProcessing: (tool: string, inputFile: string, outputFolder: string, reportName?: string, password?: string, caseId?: number) => Promise<void>;
    stopProcessing: (tool: string) => Promise<void>;
    clearLogs: (tool: string) => void;
    clearProcessingReportName: (tool: string) => void;
}

const LeappContext = createContext<LeappContextType | undefined>(undefined)

const STORAGE_KEY = 'vdf_leapp_configs';

const INITIAL_PROCESSING: ProcessingState = {
    logs: [],
    isProcessing: false,
    progress: { current: 0, total: 0 },
    taskId: null,
    processingReportName: null,
    encryptionDetected: false
};

const INITIAL_CONFIG: ToolConfig = {
    inputFile: '',
    reportName: '',
    selectedModules: [],
    artifactScrollPos: 0
};

export function LeappProvider({ children }: { children: ReactNode }) {
    const [states, setStates] = useState<Record<string, ToolState>>({
        ileapp: { config: { ...INITIAL_CONFIG }, processing: { ...INITIAL_PROCESSING }, modules: [], isLoadingModules: false },
        aleapp: { config: { ...INITIAL_CONFIG }, processing: { ...INITIAL_PROCESSING }, modules: [], isLoadingModules: false }
    });

    const [isLoaded, setIsLoaded] = useState(false);

    // Load configs from sessionStorage
    useEffect(() => {
        try {
            const stored = sessionStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsedConfigs = JSON.parse(stored);
                setStates(prev => {
                    const next = { ...prev };
                    Object.keys(parsedConfigs).forEach(tool => {
                        if (next[tool]) {
                            next[tool] = {
                                ...next[tool],
                                config: { ...next[tool].config, ...parsedConfigs[tool] }
                            };
                        }
                    });
                    return next;
                });
            }
        } catch (e) {
            console.error('Failed to load LEAPP configs:', e);
        }
        setIsLoaded(true);
    }, []);

    // Save configs to sessionStorage
    useEffect(() => {
        if (!isLoaded) return;
        const configs = {
            ileapp: states.ileapp.config,
            aleapp: states.aleapp.config
        };
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
    }, [states.ileapp.config, states.aleapp.config, isLoaded]);

    const updateConfig = useCallback((tool: string, updates: Partial<ToolConfig>) => {
        setStates(prev => ({
            ...prev,
            [tool]: {
                ...prev[tool],
                config: { ...prev[tool].config, ...updates }
            }
        }));
    }, []);

    const updateProcessing = useCallback((tool: string, updates: Partial<ProcessingState>) => {
        setStates(prev => ({
            ...prev,
            [tool]: {
                ...prev[tool],
                processing: { ...prev[tool].processing, ...updates }
            }
        }));
    }, []);

    const fetchModules = useCallback(async (tool: string) => {
        // Prevent redundant fetches
        let alreadyLoading = false;
        setStates(prev => {
            if (prev[tool].isLoadingModules || prev[tool].modules.length > 0) {
                alreadyLoading = true;
                return prev;
            }
            return { ...prev, [tool]: { ...prev[tool], isLoadingModules: true } };
        });

        if (alreadyLoading) return;

        try {
            const api = createLeappApi(tool);
            const data = await api.modules.getAll();
            const selectedModuleNames = data.modules.filter(m => m.selected).map(m => m.name);

            setStates(prev => ({
                ...prev,
                [tool]: {
                    ...prev[tool],
                    modules: data.modules,
                    isLoadingModules: false,
                    config: { ...prev[tool].config, selectedModules: selectedModuleNames }
                }
            }));
        } catch (error) {
            console.error(`Failed to load modules for ${tool}:`, error);
            setStates(prev => ({ ...prev, [tool]: { ...prev[tool], isLoadingModules: false } }));
        }
    }, []);

    const toggleModule = useCallback(async (tool: string, name: string, selected: boolean) => {
        setStates(prev => {
            const currentSelected = new Set(prev[tool].config.selectedModules);
            if (selected) currentSelected.add(name);
            else currentSelected.delete(name);

            return {
                ...prev,
                [tool]: {
                    ...prev[tool],
                    config: { ...prev[tool].config, selectedModules: Array.from(currentSelected) }
                }
            };
        });

        const api = createLeappApi(tool);
        try {
            await api.modules.select({ [name]: selected });
        } catch (error) {
            console.error(`Failed to update module ${name} for ${tool}:`, error);
        }
    }, []);

    const selectAll = useCallback(async (tool: string) => {
        const toolState = states[tool];
        const allModuleNames = toolState.modules.map(m => m.name);

        updateConfig(tool, { selectedModules: allModuleNames });

        const api = createLeappApi(tool);
        const selectionUpdates: Record<string, boolean> = {};
        allModuleNames.forEach(name => selectionUpdates[name] = true);

        try {
            await api.modules.select(selectionUpdates);
        } catch (error) {
            console.error(`Failed to select all modules for ${tool}:`, error);
        }
    }, [states, updateConfig]);

    const selectNone = useCallback(async (tool: string) => {
        const toolState = states[tool];
        updateConfig(tool, { selectedModules: [] });

        const api = createLeappApi(tool);
        const selectionUpdates: Record<string, boolean> = {};
        toolState.modules.forEach(m => selectionUpdates[m.name] = false);

        try {
            await api.modules.select(selectionUpdates);
        } catch (error) {
            console.error(`Failed to select none for ${tool}:`, error);
        }
    }, [updateConfig]);

    const startProcessing = async (
        tool: string,
        inputFile: string,
        outputFolder: string,
        reportName?: string,
        password?: string,
        caseId?: number
    ) => {
        const selectedModules = states[tool].config.selectedModules;
        const api = createLeappApi(tool);
        const currentTaskId = states[tool].processing.taskId;

        // Reset state
        updateProcessing(tool, {
            logs: [],
            progress: { current: 0, total: 0 },
            encryptionDetected: false,
            isProcessing: true,
            processingReportName: reportName || null
        });

        try {
            if (currentTaskId) {
                try { await api.processing.stop(currentTaskId); } catch (e) { console.warn("Failed to stop previous task", e); }
            }

            const response = await api.processing.start(inputFile, outputFolder, selectedModules, reportName, password, caseId);
            updateProcessing(tool, { taskId: response.task_id });

            const eventSource = api.processing.createEventSource(response.task_id);

            eventSource.onmessage = (event: MessageEvent) => {
                const message = event.data;
                if (message && message !== 'Stream ended') {
                    setStates(prev => {
                        const toolState = prev[tool];
                        const nextLogs = [...toolState.processing.logs, message];
                        let nextProgress = toolState.processing.progress;
                        let nextEnc = toolState.processing.encryptionDetected;

                        if (message.includes("Detected encrypted iTunes backup") && !password) {
                            nextEnc = true;
                        }

                        const match = message.match(/\[(\d+)\/(\d+)\]/);
                        if (match) {
                            nextProgress = {
                                current: parseInt(match[1], 10),
                                total: parseInt(match[2], 10)
                            };
                        }

                        return {
                            ...prev,
                            [tool]: {
                                ...toolState,
                                processing: {
                                    ...toolState.processing,
                                    logs: nextLogs,
                                    progress: nextProgress,
                                    encryptionDetected: nextEnc
                                }
                            }
                        };
                    });
                }
            };

            eventSource.addEventListener('close', () => {
                eventSource.close();
                updateProcessing(tool, { isProcessing: false });
            });

            eventSource.onerror = () => {
                eventSource.close();
                updateProcessing(tool, {
                    isProcessing: false,
                    processingReportName: null,
                    logs: [...states[tool].processing.logs, 'Error: Connection to server lost']
                });
            };
        } catch (error) {
            updateProcessing(tool, {
                isProcessing: false,
                processingReportName: null,
                logs: [...states[tool].processing.logs, `Error: ${error instanceof Error ? error.message : 'Unknown error'}`]
            });
        }
    };

    const stopProcessing = async (tool: string) => {
        const taskId = states[tool].processing.taskId;
        if (!taskId) return;

        const api = createLeappApi(tool);
        try {
            await api.processing.stop(taskId);
            updateProcessing(tool, {
                isProcessing: false,
                processingReportName: null,
                logs: [...states[tool].processing.logs, 'Processing stopped by user']
            });
        } catch (error) {
            console.error('Failed to stop processing:', error);
        }
    };

    const clearLogs = (tool: string) => {
        updateProcessing(tool, {
            logs: [],
            progress: { current: 0, total: 0 }
        });
    };

    const clearProcessingReportName = (tool: string) => {
        updateProcessing(tool, { processingReportName: null });
    };

    return (
        <LeappContext.Provider value={{
            states,
            updateConfig,
            fetchModules,
            toggleModule,
            selectAll,
            selectNone,
            startProcessing,
            stopProcessing,
            clearLogs,
            clearProcessingReportName
        }}>
            {children}
        </LeappContext.Provider>
    );
}

export function useLeapp() {
    const context = useContext(LeappContext);
    if (context === undefined) {
        throw new Error('useLeapp must be used within a LeappProvider');
    }
    return context;
}
