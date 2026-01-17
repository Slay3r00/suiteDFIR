"use client"

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { useCase } from './CaseContext';
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
    selectedModules: string[] | null;
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

const STORAGE_KEY_PREFIX = 'vdf_leapp_configs_';

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
    selectedModules: null,
    artifactScrollPos: 0
};

export function LeappProvider({ children }: { children: ReactNode }) {
    const [states, setStates] = useState<Record<string, ToolState>>({
        ileapp: { config: { ...INITIAL_CONFIG }, processing: { ...INITIAL_PROCESSING }, modules: [], isLoadingModules: false },
        aleapp: { config: { ...INITIAL_CONFIG }, processing: { ...INITIAL_PROCESSING }, modules: [], isLoadingModules: false }
    });

    const [isLoaded, setIsLoaded] = useState(false);

    const { selectedCaseId } = useCase();

    // Load configs from sessionStorage when selectedCaseId changes
    useEffect(() => {
        if (!selectedCaseId) {
            setIsLoaded(true);
            return;
        }

        setIsLoaded(false);

        try {
            const stored = sessionStorage.getItem(`${STORAGE_KEY_PREFIX}${selectedCaseId}`);
            if (stored) {
                const parsedConfigs = JSON.parse(stored);
                setStates(prev => {
                    const next = { ...prev };
                    Object.keys(parsedConfigs).forEach(tool => {
                        if (next[tool]) {
                            next[tool] = {
                                ...next[tool],
                                config: { ...next[tool].config, ...parsedConfigs[tool].config },
                                processing: {
                                    ...INITIAL_PROCESSING,
                                    ...(parsedConfigs[tool].processing || {})
                                }
                            };
                        }
                    });
                    return next;
                });
            } else {
                // Reset to defaults if no saved state for this case
                setStates({
                    ileapp: { config: { ...INITIAL_CONFIG }, processing: { ...INITIAL_PROCESSING }, modules: [], isLoadingModules: false },
                    aleapp: { config: { ...INITIAL_CONFIG }, processing: { ...INITIAL_PROCESSING }, modules: [], isLoadingModules: false }
                });
            }
        } catch (e) {
            console.error('Failed to load LEAPP configs:', e);
            // Fallback reset
            setStates({
                ileapp: { config: { ...INITIAL_CONFIG }, processing: { ...INITIAL_PROCESSING }, modules: [], isLoadingModules: false },
                aleapp: { config: { ...INITIAL_CONFIG }, processing: { ...INITIAL_PROCESSING }, modules: [], isLoadingModules: false }
            });
        }
        setIsLoaded(true);
    }, [selectedCaseId]);

    // Save configs and processing state to sessionStorage
    useEffect(() => {
        if (!isLoaded || !selectedCaseId) return;
        const stateToSave = {
            ileapp: { config: states.ileapp.config, processing: states.ileapp.processing },
            aleapp: { config: states.aleapp.config, processing: states.aleapp.processing }
        };
        sessionStorage.setItem(`${STORAGE_KEY_PREFIX}${selectedCaseId}`, JSON.stringify(stateToSave));
    }, [states.ileapp.config, states.aleapp.config, states.ileapp.processing, states.aleapp.processing, isLoaded, selectedCaseId]);

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

            setStates(prev => {
                const currentSelection = prev[tool].config.selectedModules;
                const serverSelected = selectedModuleNames;

                // Merge policy: if we have local selections (even an empty list), prefer them.
                // Otherwise use server defaults.
                const finalSelected = currentSelection !== null
                    ? currentSelection
                    : serverSelected;

                return {
                    ...prev,
                    [tool]: {
                        ...prev[tool],
                        modules: data.modules,
                        isLoadingModules: false,
                        config: { ...prev[tool].config, selectedModules: finalSelected }
                    }
                };
            });
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

    const connectToStream = useCallback((tool: string, taskId: string, reportName?: string | null) => {
        const api = createLeappApi(tool);
        const eventSource = api.processing.createEventSource(taskId);

        eventSource.onmessage = (event: MessageEvent) => {
            const message = event.data;
            if (message && message !== 'Stream ended') {
                setStates(prev => {
                    const toolState = prev[tool];
                    const nextLogs = [...toolState.processing.logs, message];
                    let nextProgress = toolState.processing.progress;
                    let nextEnc = toolState.processing.encryptionDetected;

                    if (message.includes("Detected encrypted iTunes backup")) {
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

        return eventSource;
    }, [states, updateProcessing]);

    // Reconnect to active processing tasks on mount or case switch
    useEffect(() => {
        if (!isLoaded) return;

        ['ileapp', 'aleapp'].forEach(tool => {
            const { isProcessing, taskId, processingReportName } = states[tool].processing;
            if (isProcessing && taskId) {
                console.log(`Reconnecting to ${tool} processing task: ${taskId}`);
                connectToStream(tool, taskId, processingReportName);
            }
        });
    }, [isLoaded, selectedCaseId]); // Only run when state is loaded or case changes

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

            const response = await api.processing.start(inputFile, outputFolder, selectedModules || [], reportName, password, caseId);
            updateProcessing(tool, { taskId: response.task_id });

            connectToStream(tool, response.task_id, reportName);
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
