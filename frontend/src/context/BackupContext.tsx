"use client"

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react'
import { createLeappApi, API_BASE } from '../services/leappApi'

import { Device, Backup } from '../types/backup'

interface BackupConfig {
    backupName: string;
    selectedDevice: string;
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

const STORAGE_KEY = 'vdf_backup_config';

const INITIAL_CONFIG: BackupConfig = {
    backupName: '',
    selectedDevice: ''
};

export function BackupProvider({ children }: { children: ReactNode }) {
    const [config, setConfig] = useState<BackupConfig>(INITIAL_CONFIG);
    const [devices, setDevices] = useState<Device[]>([]);
    const [backups, setBackups] = useState<Backup[]>([]);
    const [logs, setLogs] = useState<string[]>([]);
    const [isBackingUp, setIsBackingUp] = useState(false);
    const [isLoadingDevices, setIsLoadingDevices] = useState(false);
    const [activeBackupId, setActiveBackupId] = useState<number | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);

    const api = React.useMemo(() => createLeappApi('ios'), []);
    const logStreamRef = useRef<EventSource | null>(null);
    const selectedDeviceRef = useRef(config.selectedDevice);

    // Sync ref for SSE auto-selection
    useEffect(() => {
        selectedDeviceRef.current = config.selectedDevice;
    }, [config.selectedDevice]);

    // Load from localStorage
    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                setConfig(JSON.parse(stored));
            } catch (e) {
                console.error('Failed to parse backup config:', e);
            }
        }
        setIsLoaded(true);
    }, []);

    // Save to localStorage
    useEffect(() => {
        if (isLoaded) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
        }
    }, [config, isLoaded]);

    const updateConfig = useCallback((updates: Partial<BackupConfig>) => {
        setConfig(prev => ({ ...prev, ...updates }));
    }, []);

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
        try {
            const data = await api.backup.getBackups(caseId ? parseInt(caseId) : undefined);
            setBackups(data);
        } catch (error) {
            console.error('Failed to fetch backups:', error);
        }
    }, [api]);

    // unified stream for background updates
    useEffect(() => {
        fetchDevices();
        fetchBackups();

        const eventSource = new EventSource(`${API_BASE}/stream`);

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

        const eventSource = new EventSource(`${API_BASE}/ios/backup/stream/${backupId}`);
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
            const response = await api.backup.startBackup(udid, name, caseId);
            if (response.backup_id) {
                setActiveBackupId(response.backup_id);
                connectToLogStream(response.backup_id, true);
            }
            fetchBackups(caseId?.toString());
        } catch (error) {
            console.error('Failed to start backup:', error);
            setIsBackingUp(false);
            throw error;
        }
    };

    const stopBackup = async (backupId: number) => {
        try {
            await fetch(`${API_BASE}/ios/backup/${backupId}/stop`, { method: 'POST' });
            fetchBackups();
        } catch (error) {
            console.error('Failed to stop backup:', error);
            throw error;
        }
    };

    const clearLogs = () => setLogs([]);

    // Auto-reconnect to log stream if backup is in progress
    useEffect(() => {
        const activeBackup = backups.find(b => b.status === 'in_progress');
        if (activeBackup && !logStreamRef.current && !isBackingUp) {
            setIsBackingUp(true);
            setActiveBackupId(activeBackup.id);
            connectToLogStream(activeBackup.id, true);
        }
    }, [backups, isBackingUp, connectToLogStream]);

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
