import { useEffect, useMemo, useRef } from 'react'
import { createLeappApi } from '@/services/leappApi'
import { RefreshCw, Smartphone, Trash2, ChevronDown, FolderOpen, Download, FileText, HardDrive } from 'lucide-react'
import { Card, CardContent } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Dropdown } from "@/components/ui"
import { LibraryCard } from "@/components/ui/LibraryCard"
import { useDropdown, useConfirmDialog } from "@/hooks"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import Iphone15Pro from "@/components/ui/shadcn-io/iphone-15-pro"
import LogViewer from "@/components/ileapp/LogViewer"
import { useToast } from "@/hooks/use-toast"
import { useCase } from "@/context/CaseContext"
import { useBackup } from "@/context/BackupContext"
import { Device, Backup } from "@/types/backup"
import { cn } from "@/lib/utils"
import { API } from "@/lib/api"
import { getUniqueName } from "@/lib/naming"


interface ExtractionPageProps {
    type: 'ios' | 'android';
}

export default function ExtractionPage({ type }: ExtractionPageProps) {
    const {
        config,
        devices,
        backups,
        logs,
        progressLogs,
        isBackingUp,
        isLoadingDevices,
        updateConfig,
        fetchDevices,
        fetchBackups,
        startBackup,
        stopBackup,
        clearLogs
    } = useBackup();

    const { backupName, selectedDevice, isEncrypted, backupPassword } = config;

    // Filter devices and backups by platform type
    const platformDevices = useMemo(() => {
        return devices.filter(d => d.type === type);
    }, [devices, type]);

    const platformBackups = useMemo(() => {
        return backups.filter(b => b.type === type);
    }, [backups, type]);

    const deviceDropdown = useDropdown()
    const { toast } = useToast()
    const { selectedCaseId } = useCase()
    const { config: confirmConfig, show: showConfirm, hide: hideConfirm, handleConfirm } = useConfirmDialog();

    // Initial fetch on mount for this specific page
    useEffect(() => {
        fetchBackups(selectedCaseId || undefined);
    }, [selectedCaseId, fetchBackups]);


    const handleStartBackup = async () => {
        if (!selectedDevice || !backupName) return

        const uniqueName = getUniqueName(backupName, platformBackups.map(b => b.name));

        try {
            await startBackup(selectedDevice, uniqueName, selectedCaseId ? parseInt(selectedCaseId) : undefined)
            toast({
                title: "Backup Started",
                description: `Backup '${uniqueName}' has started in the background.`,
            })
            updateConfig({ backupName: '' })
        } catch (error) {
            console.error('Failed to start backup:', error)
            toast({
                title: "Error",
                description: "Failed to start backup process",
                variant: "destructive"
            })
        }
    }

    const handleStopBackup = async (backupId: number) => {
        try {
            await stopBackup(backupId)
            toast({
                title: "Backup Stopping",
                description: "Backup cancellation requested...",
            })
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
            await fetch(API.path(`/backups/open?path=${encodeURIComponent(path)}`), {
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
        window.location.href = API.path(`/ios/backup/download?path=${encodeURIComponent(path)}`);
    };

    const handleDeleteBackup = async (id: number) => {
        try {
            const api = createLeappApi('ios');
            await api.backup.deleteBackup(id)
            toast({
                title: "Backup Deleted",
                description: "Backup files have been removed.",
            })
            fetchBackups(selectedCaseId || undefined)
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
        <div className="h-full w-full flex flex-col bg-[#151515] text-white py-[3vh] px-[9vh] dark">
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
                                    <Iphone15Pro className="h-[378px] w-auto drop-shadow-2xl">
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
                                            onChange={(e) => updateConfig({ backupName: e.target.value })}
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
                                                    <span className="truncate flex items-center gap-2">
                                                        {selectedDevice ? (
                                                            <>
                                                                {platformDevices.find(d => d.udid === selectedDevice)?.name || "Unknown Device"}
                                                                {platformDevices.find(d => d.udid === selectedDevice)?.is_rooted && (
                                                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 uppercase">
                                                                        Rooted
                                                                    </span>
                                                                )}
                                                            </>
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

                                {/* Encryption Options (iOS Only) */}
                                {type === 'ios' && (
                                    <div className="pt-2">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer select-none group">
                                                    <div className="relative">
                                                        <input
                                                            type="checkbox"
                                                            checked={isEncrypted || (selectedDevice && platformDevices.find(d => d.udid === selectedDevice)?.is_encrypted) || false}
                                                            onChange={(e) => {
                                                                const device = platformDevices.find(d => d.udid === selectedDevice);
                                                                if (device?.is_encrypted) return;
                                                                updateConfig({ isEncrypted: e.target.checked });
                                                            }}
                                                            disabled={isBackingUp || (selectedDevice && platformDevices.find(d => d.udid === selectedDevice)?.is_encrypted) || false}
                                                            className="appearance-none w-3.5 h-3.5 rounded border border-white/40 group-hover:border-white transition-colors focus:ring-0 focus:outline-none"
                                                            style={{
                                                                borderWidth: '1px',
                                                                backgroundColor: (isEncrypted || (selectedDevice && platformDevices.find(d => d.udid === selectedDevice)?.is_encrypted)) ? '#262626' : 'transparent'
                                                            }}
                                                        />
                                                        {(isEncrypted || (selectedDevice && platformDevices.find(d => d.udid === selectedDevice)?.is_encrypted)) && (
                                                            <svg className="absolute w-2.5 h-2.5 text-white pointer-events-none" style={{ top: '2px', left: '2px' }} viewBox="0 0 20 20" fill="currentColor">
                                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                            </svg>
                                                        )}
                                                    </div>
                                                    Encrypt Backup
                                                </label>
                                                {selectedDevice && platformDevices.find(d => d.udid === selectedDevice)?.is_encrypted && (
                                                    <span
                                                        className="text-[10px] font-medium px-1.5 py-0 rounded border border-white"
                                                        style={{ borderWidth: '0.5px', backgroundColor: '#262626', color: 'white' }}
                                                    >
                                                        ENABLED ON DEVICE
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {isEncrypted && !((selectedDevice && platformDevices.find(d => d.udid === selectedDevice)?.is_encrypted)) && (
                                            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                                                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1 mb-1.5 block">
                                                    Set Backup Password
                                                </label>
                                                <Input
                                                    type="password"
                                                    value={backupPassword}
                                                    onChange={(e) => updateConfig({ backupPassword: e.target.value })}
                                                    placeholder="Enter password..."
                                                    disabled={isBackingUp}
                                                    className="w-full bg-[#1A1A1A] border-[#333] focus:border-blue-500/50 transition-colors"
                                                />
                                            </div>
                                        )}

                                        {selectedDevice && platformDevices.find(d => d.udid === selectedDevice)?.is_encrypted && (
                                            <div className="animate-in fade-in slide-in-from-top-2 duration-200 mt-2">
                                                <p className="text-[10px] text-gray-500 ml-1">
                                                    This device is already encrypted. You will need the existing password to analyze this backup later.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Action Button */}
                                <div className="mt-auto pt-3">
                                    {platformBackups.find(b => b.status === 'in_progress' && b.device_udid === selectedDevice) ? (
                                        <div className="w-full">
                                            {(() => {
                                                const activeBackup = platformBackups.find(b => b.status === 'in_progress' && b.device_udid === selectedDevice);
                                                return (
                                                    <Button
                                                        variant="secondary"
                                                        onClick={() => activeBackup && handleStopBackup(activeBackup.id)}
                                                        className="w-full relative overflow-hidden bg-[#e5e5e5] text-black hover:bg-[#d4d4d4] border-none"
                                                    >
                                                        {(() => {
                                                            let progressVal = 0;
                                                            if (progressLogs && progressLogs['overall']) {
                                                                const match = progressLogs['overall'].match(/(\d+)%/);
                                                                if (match && match[1]) {
                                                                    progressVal = parseInt(match[1], 10);
                                                                }
                                                            }
                                                            return (
                                                                <>
                                                                    <div
                                                                        className="absolute inset-0 bg-black/5 transition-all duration-500"
                                                                        style={{ width: `${progressVal}%` }}
                                                                    />
                                                                    <div className="relative z-10 flex items-center justify-center gap-2">
                                                                        <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse" />
                                                                        <span>Stop Backup ({progressVal}%)</span>
                                                                    </div>
                                                                </>
                                                            );
                                                        })()}
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
                                onClick={clearLogs}
                                variant="secondary"
                                className="px-3 py-1 h-auto text-xs"
                            >
                                Clear Logs
                            </Button>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <LogViewer logs={logs} progressLogs={progressLogs} />
                        </div>
                    </div>

                    {/* Backup Library - Bottom 1/3 */}
                    <div className="flex-1 flex flex-col min-h-0 bg-[#171717] border border-[#333333] rounded-lg overflow-hidden mt-4">
                        <div className="px-4 py-2 border-b border-[#333333] bg-[#1A1A1A]">
                            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Backup Library</h3>
                        </div>
                        <Card className="flex-1 flex flex-col bg-transparent border-none shadow-none min-h-0">
                            <CardContent className="flex-1 flex flex-col p-0 min-h-0 overflow-hidden">
                                {platformBackups.filter(b => b.status !== 'cancelled').length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-500">
                                        <p className="text-sm font-medium">No backups found</p>
                                        <p className="text-xs text-gray-600 mt-1">Created backups will appear here</p>
                                    </div>
                                ) : (
                                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                        {platformBackups.filter(b => b.status !== 'cancelled').map((backup) => (
                                            <LibraryCard
                                                key={backup.id}
                                                title={backup.name}
                                                subtitle={
                                                    <span className="flex items-center gap-0.5">
                                                        <Smartphone size={9} />
                                                        {backup.device_name}
                                                    </span>
                                                }
                                                status={backup.status !== 'completed' ? {
                                                    state: backup.status === 'in_progress' ? 'processing' :
                                                        backup.status === 'failed' ? 'error' : 'default',
                                                    label: backup.status === 'in_progress' ? 'PROCESSING' :
                                                        backup.status.toUpperCase().replace('_', ' '),
                                                    progress: backup.progress !== undefined ? backup.progress : 0
                                                } : undefined}
                                                actions={[
                                                    {
                                                        icon: FolderOpen,
                                                        label: 'Open Location',
                                                        disabled: backup.status === 'in_progress',
                                                        onClick: () => {
                                                            showConfirm({
                                                                title: 'Open Location',
                                                                message: 'Open backup location in Finder?',
                                                                confirmLabel: 'Open',
                                                                onConfirm: () => handleOpenLocation(backup.path)
                                                            });
                                                        }
                                                    },
                                                    {
                                                        icon: Trash2,
                                                        label: 'Delete Backup',
                                                        disabled: backup.status === 'in_progress',
                                                        variant: 'destructive',
                                                        onClick: () => {
                                                            showConfirm({
                                                                title: 'Delete Backup',
                                                                message: 'Are you sure you want to delete this backup? This action cannot be undone.',
                                                                variant: 'destructive',
                                                                confirmLabel: 'Delete',
                                                                onConfirm: () => handleDeleteBackup(backup.id)
                                                            });
                                                        }
                                                    }
                                                ]}
                                                className="w-full"
                                            />
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
            <ConfirmDialog
                config={confirmConfig}
                onClose={hideConfirm}
                onConfirm={handleConfirm}
            />
        </div>
    )
}
