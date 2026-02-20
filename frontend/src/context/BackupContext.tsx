
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react'
import { useCase } from './CaseContext';
import { createLeappApi } from '../services/leappApi'
import { API } from '@/lib/api'

import { Device, Backup } from '../types/backup'

interface BackupConfig {
    backupName: string;
    selectedDevice: string;
    isEncrypted: boolean;
    backupPassword: string;
}

interface BackupState {
    config: BackupConfig;
    devices: Device[];
    backups: Backup[];
    logs: string[];
    isBackingUp: boolean;
    isLoadingDevices: boolean;
    activeBackupId: number | null;
}

interface BackupContextType extends BackupState {
    updateConfig: (updates: Partial<BackupConfig>) => void;
    fetchDevices: () => Promise<void>;
    fetchBackups: (caseId?: string) => Promise<void>;
    startBackup: (udid: string, name: string, caseId?: number) => Promise<void>;
    stopBackup: (backupId: number) => Promise<void>;
    clearLogs: () => void;
}

const BackupContext = createContext<BackupContextType | undefined>(undefined);

import { useCasePersistedState } from '@/hooks/useCasePersistedState';

const STORAGE_KEY_PREFIX = 'vdf_backup_config_';

interface BackupPersistedState {
    config: BackupConfig;
    logs: string[];
    isBackingUp: boolean;
    activeBackupId: number | null;
}

const INITIAL_CONFIG: BackupConfig = {
    backupName: '',
    selectedDevice: '',
    isEncrypted: false,
    backupPassword: ''
};

const INITIAL_STATE: BackupPersistedState = {
    config: INITIAL_CONFIG,
    logs: [],
    isBackingUp: false,
    activeBackupId: null
};

export function BackupProvider({ children }: { children: ReactNode }) {
    const [state, setState, isLoaded] = useCasePersistedState<BackupPersistedState>(
        STORAGE_KEY_PREFIX,
        INITIAL_STATE
    );

    const { config, logs, isBackingUp, activeBackupId } = state;

    const setConfig = useCallback((updates: Partial<BackupConfig>) => {
        setState(prev => ({ ...prev, config: { ...prev.config, ...updates } }));
    }, [setState]);

    const setLogs = useCallback((val: string[] | ((prev: string[]) => string[])) => {
        setState(prev => ({ ...prev, logs: typeof val === 'function' ? val(prev.logs) : val }));
    }, [setState]);

    const setIsBackingUp = useCallback((val: boolean) => {
        setState(prev => ({ ...prev, isBackingUp: val }));
    }, [setState]);

    const setActiveBackupId = useCallback((val: number | null) => {
        setState(prev => ({ ...prev, activeBackupId: val }));
    }, [setState]);

    const [devices, setDevices] = useState<Device[]>([]);
    const [backups, setBackups] = useState<Backup[]>([]);
    const [hasFetchedBackups, setHasFetchedBackups] = useState(false);
    const [isLoadingDevices, setIsLoadingDevices] = useState(false);

    const { selectedCaseId } = useCase(); // Get selected case ID

    const api = React.useMemo(() => createLeappApi('ios'), []);
    const logStreamRef = useRef<EventSource | null>(null);
    const selectedDeviceRef = useRef(config.selectedDevice);

    // Sync ref for SSE auto-selection
    useEffect(() => {
        selectedDeviceRef.current = config.selectedDevice;
    }, [config.selectedDevice]);

    const updateConfig = setConfig;

    const fetchDevices = useCallback(async () => {
        setIsLoadingDevices(true);
        try {
            const data = await api.backup.getDevices();
            setDevices(data);
            if (data.length > 0) {
                const currentStillConnected = data.find((d: Device) => d.udid === selectedDeviceRef.current);
                if (!selectedDeviceRef.current || !currentStillConnected) {
                    updateConfig({ selectedDevice: data[0].udid });
                }
            } else {
                updateConfig({ selectedDevice: '' });
            }
        } catch (error) {
            console.error('Failed to fetch devices:', error);
        } finally {
            setIsLoadingDevices(false);
        }
    }, [api, updateConfig]);

    const fetchBackups = useCallback(async (caseId?: string) => {
        // Use provided caseId or fall back to selectedCaseId from context
        const targetCaseId = caseId || selectedCaseId;

        try {
            const data = await api.backup.getBackups(targetCaseId ? parseInt(targetCaseId) : undefined);
            setBackups(data);
        } catch (error) {
            console.error('Failed to fetch backups:', error);
        } finally {
            setHasFetchedBackups(true);
        }
    }, [api, selectedCaseId]);

    // unified stream for background updates
    useEffect(() => {
        fetchDevices();
        fetchBackups();

        const eventSource = new EventSource(API.path('/stream'));

        eventSource.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                if (message.type === 'device_update') {
                    const data = message.data;
                    setDevices(data);
                    if (data.length > 0) {
                        const currentStillConnected = data.find((d: Device) => d.udid === selectedDeviceRef.current);
                        if (!selectedDeviceRef.current || !currentStillConnected) {
                            updateConfig({ selectedDevice: data[0].udid });
                        }
                    } else {
                        updateConfig({ selectedDevice: '' });
                    }
                } else if (message.type === 'backup_update') {
                    fetchBackups();
                }
            } catch (error) {
                console.error('Failed to parse SSE message:', error);
            }
        };

        return () => eventSource.close();
    }, [fetchDevices, fetchBackups, updateConfig]);

    const connectToLogStream = useCallback((backupId: number, keepExisting = false) => {
        if (logStreamRef.current) {
            logStreamRef.current.close();
        }

        if (!keepExisting) setLogs([]);

        const eventSource = new EventSource(API.path(`/backups/${backupId}/stream`));
        logStreamRef.current = eventSource;

        eventSource.onmessage = (event) => {
            setLogs(prev => [...prev, event.data]);
        };

        eventSource.addEventListener('close', () => {
            eventSource.close();
            setIsBackingUp(false);
            setActiveBackupId(null);
            fetchBackups();
        });

        eventSource.onerror = () => {
            if (eventSource.readyState !== 2) {
                console.error('Backup log stream failed');
            }
            eventSource.close();
            // We don't necessarily stop isBackingUp here, polling will catch it
            fetchBackups();
        };

        return eventSource;
    }, [fetchBackups]);

    const startBackup = async (udid: string, name: string, caseId?: number) => {
        setIsBackingUp(true);
        setLogs([
            "Initializing backup process...",
            "Please wait while we prepare the device...",
            "NOTE: You may see a prompt on your device to enter your passcode to trust this computer."
        ]);
        try {
            const password = config.isEncrypted ? config.backupPassword : undefined;
            const response = await api.backup.startBackup(udid, name, caseId, password);
            if (response.backup_id) {
                setActiveBackupId(response.backup_id);
                connectToLogStream(response.backup_id, true);
            }
            fetchBackups(caseId?.toString());
            // Clear encryption state after successful start
            updateConfig({ isEncrypted: false, backupPassword: '' });
        } catch (error) {
            console.error('Failed to start backup:', error);
            setIsBackingUp(false);
            throw error;
        }
    };

    const stopBackup = async (backupId: number) => {
        try {
            await fetch(API.path(`/backups/${backupId}/stop`), { method: 'POST' });
            setIsBackingUp(false);
            setActiveBackupId(null);
            if (logStreamRef.current) {
                logStreamRef.current.close();
                logStreamRef.current = null;
            }
            fetchBackups();
        } catch (error) {
            console.error('Failed to stop backup:', error);
            throw error;
        }
    };

    const clearLogs = () => setLogs([]);

    // Auto-reconnect to log stream if backup is in progress
    useEffect(() => {
        // We only want to evaluate this when backups list updates and is somewhat reliable
        if (!hasFetchedBackups) return;

        const activeBackup = backups.find(b => b.status === 'in_progress');

        if (activeBackup && !logStreamRef.current) {
            setIsBackingUp(true);
            setActiveBackupId(activeBackup.id);
            connectToLogStream(activeBackup.id, true);
        } else if (!activeBackup && isBackingUp) {
            // Fallback: If we think we are backing up, but the API says no backups are active, reset
            setIsBackingUp(false);
            setActiveBackupId(null);
            if (logStreamRef.current) {
                logStreamRef.current.close();
                logStreamRef.current = null;
            }
        }
    }, [backups, isBackingUp, hasFetchedBackups, connectToLogStream, setIsBackingUp, setActiveBackupId]);

    return (
        <BackupContext.Provider value={{
            config,
            devices,
            backups,
            logs,
            isBackingUp,
            isLoadingDevices,
            activeBackupId,
            updateConfig,
            fetchDevices,
            fetchBackups,
            startBackup,
            stopBackup,
            clearLogs
        }}>
            {children}
        </BackupContext.Provider>
    );
}

export function useBackup() {
    const context = useContext(BackupContext);
    if (context === undefined) {
        throw new Error('useBackup must be used within a BackupProvider');
    }
    return context;
}
