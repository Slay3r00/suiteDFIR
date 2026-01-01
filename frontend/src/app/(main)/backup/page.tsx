
"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createLeappApi } from '@/services/leappApi'
import { RefreshCw, Smartphone, Trash2, ChevronDown, FolderOpen, Download, FileText, HardDrive } from 'lucide-react'
import { Card, CardContent } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Dropdown } from "@/components/ui"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/Dialog"
import { useDropdown } from "@/hooks"
import Iphone15Pro from "@/components/ui/shadcn-io/iphone-15-pro"
import LogViewer from "@/components/ileapp/LogViewer"
import { useToast } from "@/hooks/use-toast"
import { useCase } from "@/context/CaseContext"
import { cn } from "@/lib/utils"

interface Device {
    udid: string
    name: string
    type: string
    is_encrypted?: boolean
}

interface Backup {
    id: number
    name: string
    device_udid: string
    device_name: string
    path: string
    created_at: string
    status: 'completed' | 'failed' | 'in_progress' | 'cancelled'
    size?: string
    progress?: number
}

export default function BackupPage() {
    const [devices, setDevices] = useState<Device[]>([])
    const [backups, setBackups] = useState<Backup[]>([])
    const [selectedDevice, setSelectedDevice] = useState<string>('')
    const [backupName, setBackupName] = useState('')
    const [isEncrypted, setIsEncrypted] = useState(false)
    const [backupPassword, setBackupPassword] = useState('')
    const [isBackingUp, setIsBackingUp] = useState(false)
    const [isLoadingDevices, setIsLoadingDevices] = useState(false)
    const [logs, setLogs] = useState<string[]>([])
    const deviceDropdown = useDropdown()
    const { toast } = useToast()
    const { selectedCaseId } = useCase()
    const [confirmConfig, setConfirmConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void | Promise<void>;
        variant?: 'destructive' | 'default';
        confirmLabel?: string;
    }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    const api = useMemo(() => createLeappApi('ios'), []);
    const selectedDeviceRef = useRef(selectedDevice);

    // Keep ref in sync with state
    useEffect(() => {
        selectedDeviceRef.current = selectedDevice;
    }, [selectedDevice]);

    const fetchDevices = useCallback(async () => {
        setIsLoadingDevices(true)
        try {
            const data = await api.backup.getDevices()
            setDevices(data)

            // Auto-select logic (using ref to avoid stale closure)
            if (data.length > 0) {
                const currentDeviceStillConnected = data.find((d: Device) => d.udid === selectedDeviceRef.current)
                if (!selectedDeviceRef.current || !currentDeviceStillConnected) {
                    setSelectedDevice(data[0].udid)
                }
            } else {
                setSelectedDevice('')
            }
        } catch (error) {
            console.error('Failed to fetch devices:', error)
            toast({
                title: "Error",
                description: "Failed to detect connected devices",
                variant: "destructive"
            })
        } finally {
            setIsLoadingDevices(false)
        }
    }, [api, toast]);

    const fetchBackups = useCallback(async () => {
        try {
            const data = await api.backup.getBackups(selectedCaseId ? parseInt(selectedCaseId) : undefined)
            setBackups(data)
        } catch (error) {
            console.error('Failed to fetch backups:', error)
        }
    }, [api, selectedCaseId]);

    useEffect(() => {
        let isMounted = true;
        // Initial fetch
        fetchDevices()
        fetchBackups()

        // Connect to unified SSE stream
        const eventSource = new EventSource('http://localhost:8000/api/stream');

        eventSource.onmessage = (event) => {
            if (!isMounted) return;
            try {
                const message = JSON.parse(event.data);

                if (message.type === 'device_update') {
                    const data = message.data;
                    setDevices(data);

                    // Auto-select logic (using ref to avoid infinite loop)
                    if (data.length > 0) {
                        const currentDeviceStillConnected = data.find((d: Device) => d.udid === selectedDeviceRef.current)
                        if (!selectedDeviceRef.current || !currentDeviceStillConnected) {
                            setSelectedDevice(data[0].udid)
                        }
                    } else {
                        setSelectedDevice('')
                    }
                } else if (message.type === 'backup_update') {
                    fetchBackups();
                }
            } catch (error) {
                console.error('Failed to parse SSE message:', error);
            }
        };

        eventSource.onerror = (error) => {
            if (!isMounted) return;
            // Only log if it's not a clean close
            if (eventSource.readyState !== EventSource.CLOSED) {
                console.error('SSE connection error:', error);
            }
            eventSource.close();
        };

        return () => {
            isMounted = false;
            eventSource.close()
        }
    }, [fetchBackups, fetchDevices])

    const connectToLogStream = useCallback((backupId: number, keepExistingLogs = false) => {
        if (!keepExistingLogs) {
            setLogs([]) // Clear previous logs only if requested
        }

        const eventSource = new EventSource(`http://localhost:8000/api/ios/backup/stream/${backupId}`)

        eventSource.onmessage = (event) => {
            const message = event.data
            setLogs(prev => [...prev, message])
        }

        // Listen for custom "close" event from backend
        eventSource.addEventListener('close', () => {
            eventSource.close()
            setIsBackingUp(false)
            fetchBackups() // Refresh list to show final status
        })

        eventSource.onerror = (error) => {
            // Only log error if stream wasn't closed intentionally (readyState 2 is CLOSED)
            if (eventSource.readyState !== 2) {
                console.error('EventSource failed:', error)
            }
            eventSource.close()

            // If stream errors out, we should probably check status
            // But don't immediately set isBackingUp(false) as it might be a temporary network blip
            // However, if the backend closed the connection without a 'close' event, we might get stuck
            // Let's rely on polling to eventually catch the status change, 
            // OR set a timeout to check status?
            // For now, let's assume if error happens, we should re-fetch backups to see if it's done
            fetchBackups()
        }

        return eventSource
    }, [fetchBackups])

    // Reconnect to log stream if backup is in progress on mount/refresh
    useEffect(() => {
        const activeBackup = backups.find(b => b.status === 'in_progress')
        if (activeBackup) {
            setIsBackingUp(true)
            // Only connect if we haven't already (or if it's a different backup)
            // We check logs.length > 2 to allow for the initial "Initializing..." messages
            // But we need a way to track WHICH backup we are connected to.
            // For now, let's just check if we are already backing up.
            // Actually, the issue is that this effect runs when 'backups' updates (polling),
            // and calls connectToLogStream, which defaults keepExistingLogs=false.

            // We should track the current backup ID in a ref or state to avoid reconnecting
            // But for now, let's just pass true to keep logs if we are already backing up
            connectToLogStream(activeBackup.id, true)
        } else if (isBackingUp) {
            // If we think we're backing up but the list says otherwise, check if we just finished
            // This handles the case where the backup finishes/fails/cancels and we need to reset UI
            // But we should be careful not to reset if we just started and the list hasn't updated yet
            // The 'close' event from SSE usually handles this, but this is a fallback
        }
    }, [backups, connectToLogStream, isBackingUp])

    const handleStartBackup = async () => {
        if (!selectedDevice || !backupName) return

        const name = backupName // Name is now required

        setIsBackingUp(true)
        setLogs([
            "Initializing backup process...",
            "Please wait while we prepare the device...",
            "NOTE: You may see a prompt on your device to enter your passcode to trust this computer."
        ])
        try {
            const response = await api.backup.startBackup(selectedDevice, name, selectedCaseId ? parseInt(selectedCaseId) : undefined)
            toast({
                title: "Backup Started",
                description: `Backup '${name}' has started in the background.`,
            })
            setBackupName('')

            // Connect to log stream immediately with the backup_id from response
            if (response.backup_id) {
                connectToLogStream(response.backup_id, true) // Keep the "Initializing..." logs
            }

            fetchBackups()
        } catch (error) {
            console.error('Failed to start backup:', error)
            setIsBackingUp(false) // Only reset on error
            toast({
                title: "Error",
                description: "Failed to start backup process",
                variant: "destructive"
            })
        }
    }

    const handleStopBackup = async (backupId: number) => {
        try {
            await fetch(`http://localhost:8000/api/ios/backup/${backupId}/stop`, {
                method: 'POST'
            })
            toast({
                title: "Backup Stopping",
                description: "Backup cancellation requested...",
            })
            // Force immediate refresh
            fetchBackups()
        } catch (error) {
            console.error('Failed to stop backup:', error)
            toast({
                title: "Error",
                description: "Failed to stop backup",
                variant: "destructive"
            })
        }
    }

    const handleOpenLocation = async (path: string) => {
        try {
            await fetch(`http://localhost:8000/api/ios/backup/open?path=${encodeURIComponent(path)}`, {
                method: 'POST'
            });
        } catch (error) {
            console.error('Failed to open location:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to open backup location",
            })
        }
    };

    const handleExport = async (path: string) => {
        // Use the dedicated backup download endpoint
        window.location.href = `http://localhost:8000/api/ios/backup/download?path=${encodeURIComponent(path)}`;
    };

    const handleDeleteBackup = async (id: number) => {
        try {
            await api.backup.deleteBackup(id)
            toast({
                title: "Backup Deleted",
                description: "Backup files have been removed.",
            })
            fetchBackups()
        } catch (error) {
            console.error('Failed to delete backup:', error)
            toast({
                title: "Error",
                description: "Failed to delete backup",
                variant: "destructive"
            })
        }
    }

    return (
        <div className="h-full w-full flex flex-col bg-[#151515] text-white py-[3vh] px-[9vh]">
            <div className="flex-1 min-h-0 flex gap-[9vh]">
                {/* Left Section - Device Configuration */}
                <div className="flex-1 flex flex-col min-h-0">
                    <Card className="flex-1 h-full bg-transparent border-none shadow-none text-white flex flex-col relative overflow-hidden group">
                        <CardContent className="flex flex-col h-full relative z-10 p-0">
                            {/* Device Visualization Section - Grows to fill space */}
                            <div className="flex-1 flex flex-col items-center justify-center relative min-h-0">
                                {/* Glow effect behind device (always visible but subtle) */}
                                <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full blur-3xl transition-all duration-700 ${selectedDevice ? 'bg-blue-500/10 opacity-50' : 'bg-gray-500/5 opacity-30'}`} />

                                <div className="relative transform transition-transform duration-700 hover:scale-[1.02]">
                                    <Iphone15Pro
                                        className="h-[420px] w-auto drop-shadow-2xl"
                                    >
                                        {!selectedDevice && (
                                            <div className="h-full w-full flex flex-col items-center justify-center bg-[#050505] text-gray-500 space-y-4">
                                                <p className="text-2xl font-light tracking-wide text-gray-400">Not Connected</p>
                                            </div>
                                        )}
                                        {selectedDevice && (
                                            <div className="h-full w-full bg-black flex items-center justify-center">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src="/apple-logo.svg"
                                                    alt="Connected"
                                                    className="w-24 h-24 opacity-80"
                                                    style={{ filter: 'invert(1)' }}
                                                />
                                            </div>
                                        )}
                                    </Iphone15Pro>
                                </div>
                            </div>

                            {/* Form Controls - Anchored at bottom */}
                            <div className="space-y-3 pt-6 mt-auto">
                                {/* Name and Target Device Row */}
                                <div className="flex gap-3">
                                    {/* Name Input - Left side */}
                                    <div className="flex-1 space-y-3">
                                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">
                                            Name
                                        </label>
                                        <Input
                                            type="text"
                                            value={backupName}
                                            onChange={(e) => setBackupName(e.target.value)}
                                            placeholder="Enter backup name..."
                                            disabled={isBackingUp}
                                            className="w-full"
                                        />
                                    </div>

                                    {/* Target Device - Right side */}
                                    <div className="flex-1 space-y-3">
                                        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">
                                            Target Device
                                        </label>
                                        <div className="flex gap-2 w-full">
                                            <div className="flex-1 relative">
                                                <div className="w-full bg-[#262626] border border-[#333] text-white h-9 flex items-center px-3 rounded-md text-sm">
                                                    <span className="truncate">
                                                        {selectedDevice ? (
                                                            devices.find(d => d.udid === selectedDevice)?.name || "Unknown Device"
                                                        ) : (
                                                            <span className="text-gray-500 font-normal">No device connected</span>
                                                        )}
                                                    </span>
                                                </div>
                                            </div>
                                            <Button
                                                onClick={fetchDevices}
                                                variant="outline"
                                                size="icon"
                                                className="h-9 w-9 border-[#333] bg-[#262626] hover:bg-[#333] hover:text-white shrink-0"
                                            >
                                                <RefreshCw className={`h-4 w-4 ${isLoadingDevices ? 'animate-spin' : ''}`} />
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                {/* Encryption Options */}
                                <div className="pt-2">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer select-none group">
                                                <div className="relative">
                                                    <input
                                                        type="checkbox"
                                                        checked={isEncrypted || (selectedDevice && devices.find(d => d.udid === selectedDevice)?.is_encrypted) || false}
                                                        onChange={(e) => {
                                                            const device = devices.find(d => d.udid === selectedDevice);
                                                            if (device?.is_encrypted) return;
                                                            setIsEncrypted(e.target.checked);
                                                        }}
                                                        disabled={isBackingUp || (selectedDevice && devices.find(d => d.udid === selectedDevice)?.is_encrypted) || false}
                                                        className="appearance-none w-3.5 h-3.5 rounded border border-white/40 group-hover:border-white transition-colors focus:ring-0 focus:outline-none"
                                                        style={{
                                                            borderWidth: '1px',
                                                            backgroundColor: (isEncrypted || (selectedDevice && devices.find(d => d.udid === selectedDevice)?.is_encrypted)) ? '#262626' : 'transparent'
                                                        }}
                                                    />
                                                    {(isEncrypted || (selectedDevice && devices.find(d => d.udid === selectedDevice)?.is_encrypted)) && (
                                                        <svg className="absolute w-2.5 h-2.5 text-white pointer-events-none" style={{ top: '2px', left: '2px' }} viewBox="0 0 20 20" fill="currentColor">
                                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                        </svg>
                                                    )}
                                                </div>
                                                Encrypt Backup
                                            </label>
                                            {selectedDevice && devices.find(d => d.udid === selectedDevice)?.is_encrypted && (
                                                <span
                                                    className="text-[10px] font-medium px-1.5 py-0 rounded border border-white"
                                                    style={{ borderWidth: '0.5px', backgroundColor: '#262626', color: 'white' }}
                                                >
                                                    ENABLED ON DEVICE
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {isEncrypted && !((selectedDevice && devices.find(d => d.udid === selectedDevice)?.is_encrypted)) && (
                                        <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1 mb-1.5 block">
                                                Set Backup Password
                                            </label>
                                            <Input
                                                type="password"
                                                value={backupPassword}
                                                onChange={(e) => setBackupPassword(e.target.value)}
                                                placeholder="Enter password..."
                                                disabled={isBackingUp}
                                                className="w-full bg-[#1A1A1A] border-[#333] focus:border-blue-500/50 transition-colors"
                                            />
                                        </div>
                                    )}

                                    {selectedDevice && devices.find(d => d.udid === selectedDevice)?.is_encrypted && (
                                        <div className="animate-in fade-in slide-in-from-top-2 duration-200 mt-2">
                                            <p className="text-[10px] text-gray-500 ml-1">
                                                This device is already encrypted. You will need the existing password to analyze this backup later.
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Action Button */}
                                <div className="mt-auto pt-3">
                                    {backups.find(b => b.status === 'in_progress' && b.device_udid === selectedDevice) ? (
                                        <div className="w-full">
                                            {(() => {
                                                const activeBackup = backups.find(b => b.status === 'in_progress' && b.device_udid === selectedDevice);
                                                return (
                                                    <Button
                                                        variant="secondary"
                                                        onClick={() => activeBackup && handleStopBackup(activeBackup.id)}
                                                        className="w-full relative overflow-hidden bg-[#e5e5e5] text-black hover:bg-[#d4d4d4]"
                                                    >
                                                        <div className="relative z-10 flex items-center justify-center gap-2">
                                                            <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse" />
                                                            <span>Stop Backup</span>
                                                        </div>
                                                    </Button>
                                                );
                                            })()}
                                        </div>
                                    ) : (
                                        <Button
                                            className="w-full bg-white text-black hover:bg-gray-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                            onClick={handleStartBackup}
                                            disabled={!selectedDevice || !backupName || isBackingUp}
                                        >
                                            {isBackingUp ? "Starting..." : "Start Backup"}
                                        </Button>
                                    )}
                                </div>
                            </div>





                        </CardContent>
                    </Card>
                </div>

                {/* Right Section - Processing Log & Backup Library */}
                <div className="flex-1 flex flex-col min-h-0">
                    {/* Processing Log - Top 2/3 */}
                    <div className="flex-[2] min-h-0 bg-[#171717] border border-[#333333] rounded-lg overflow-hidden flex flex-col">
                        <div className="px-4 py-2 border-b border-[#333333] bg-[#1A1A1A] flex justify-between items-center">
                            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Processing Log</h3>
                            <Button
                                onClick={() => setLogs([])}
                                variant="secondary"
                                className="px-3 py-1 h-auto text-xs"
                            >
                                Clear Logs
                            </Button>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <LogViewer logs={logs} />
                        </div>
                    </div>

                    {/* Backup Library - Bottom 1/3 */}
                    <div className="flex-1 flex flex-col min-h-0 bg-[#171717] border border-[#333333] rounded-lg overflow-hidden mt-4">
                        <div className="px-4 py-2 border-b border-[#333333] bg-[#1A1A1A]">
                            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Backup Library</h3>
                        </div>
                        <Card className="flex-1 flex flex-col bg-transparent border-none shadow-none min-h-0">
                            <CardContent className="flex-1 flex flex-col p-0 min-h-0 overflow-hidden">
                                {backups.filter(b => b.status !== 'cancelled').length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-500">
                                        <p className="text-sm font-medium">No backups found</p>
                                        <p className="text-xs text-gray-600 mt-1">Created backups will appear here</p>
                                    </div>
                                ) : (
                                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                        {backups.filter(b => b.status !== 'cancelled').map((backup) => (
                                            <div
                                                key={backup.id}
                                                className="group flex-shrink-0 w-full rounded-lg p-2 flex items-center gap-2 border transition-colors bg-[#1A1A1A] border-white/10 hover:border-white/20"
                                            >
                                                {/* Info */}
                                                <div className="flex-1 min-w-0 flex flex-col justify-center items-start">
                                                    <h3 className="text-white font-medium truncate text-xs text-left">{backup.name}</h3>
                                                    <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
                                                        <span className="flex items-center gap-0.5">
                                                            <Smartphone size={9} />
                                                            {backup.device_name}
                                                        </span>
                                                    </div>
                                                </div>

                                                {backup.status !== 'completed' && (
                                                    <span className={`
                                                    shrink-0 text-[10px] font-medium px-1.5 py-0 rounded border border-white mr-2
                                                    ${backup.status === 'failed' || backup.status === 'cancelled' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                                            'bg-white/10 text-white border-white/20 animate-pulse'}
                                                    `}
                                                        style={{ borderWidth: '0.5px' }}
                                                    >
                                                        {backup.status.toUpperCase().replace('_', ' ')}
                                                    </span>
                                                )}

                                                {/* Actions */}
                                                <div className={`flex items-center gap-0.5 transition-opacity ${backup.status === 'in_progress' ? 'opacity-50' : ''}`}>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        disabled={backup.status === 'in_progress'}
                                                        onClick={() => {
                                                            setConfirmConfig({
                                                                isOpen: true,
                                                                title: 'Open Location',
                                                                message: 'Open backup location in Finder?',
                                                                confirmLabel: 'Open',
                                                                onConfirm: () => handleOpenLocation(backup.path)
                                                            });
                                                        }}
                                                        title="Open Location"
                                                        className="h-7 w-7 hover:bg-white/20 text-white"
                                                    >
                                                        <FolderOpen size={12} />
                                                    </Button>

                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        disabled={backup.status === 'in_progress'}
                                                        onClick={() => {
                                                            setConfirmConfig({
                                                                isOpen: true,
                                                                title: 'Delete Backup',
                                                                message: 'Are you sure you want to delete this backup? This action cannot be undone.',
                                                                variant: 'destructive',
                                                                confirmLabel: 'Delete',
                                                                onConfirm: () => handleDeleteBackup(backup.id)
                                                            });
                                                        }}
                                                        title="Delete Backup"
                                                        className="h-7 w-7 hover:bg-red-900/30 text-white hover:text-red-400"
                                                    >
                                                        <Trash2 size={12} />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
            <Dialog open={confirmConfig.isOpen} onOpenChange={(open) => !open && setConfirmConfig(prev => ({ ...prev, isOpen: false }))}>
                <DialogContent className="max-w-[340px] p-5 bg-[#1A1A1A] border-[#333333]">
                    <DialogHeader>
                        <DialogTitle className="text-sm font-semibold text-white tracking-wide uppercase">{confirmConfig.title}</DialogTitle>
                    </DialogHeader>
                    <div className="py-2">
                        <p className="text-[11px] text-gray-400 leading-relaxed">
                            {confirmConfig.message}
                        </p>
                    </div>
                    <DialogFooter className="mt-2 flex gap-2">
                        <Button
                            variant="secondary"
                            size="sm"
                            className="flex-1 h-8 text-[11px]"
                            onClick={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant={confirmConfig.variant === 'destructive' ? 'destructive' : 'default'}
                            size="sm"
                            className={cn(
                                "flex-1 h-8 text-[11px]",
                                confirmConfig.variant === 'destructive'
                                    ? "bg-red-900/20 hover:bg-red-900/40 text-white border border-red-900/30"
                                    : "bg-[#333333] hover:bg-[#404040] text-white border border-white/10"
                            )}
                            onClick={async () => {
                                await confirmConfig.onConfirm();
                                setConfirmConfig(prev => ({ ...prev, isOpen: false }));
                            }}
                        >
                            {confirmConfig.confirmLabel || "Confirm"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
