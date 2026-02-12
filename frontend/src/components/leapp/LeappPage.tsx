
import { useState, useEffect, useCallback } from 'react';
import LogViewer from '../../components/ileapp/LogViewer';
import FileSelector from '../../components/ileapp/FileSelector';
import ModuleSelector from '../../components/ileapp/ModuleSelector';
import ProcessControls from '../../components/ileapp/ProcessControls';
import { useLeapp } from '@/context/LeappContext';

import { Button, Input, ConfirmDialog, LibraryCard } from '@/components/ui';
import { useCase } from '@/context/CaseContext';
import { FolderOpen, Calendar, Trash2, Loader2, Download } from 'lucide-react';
import { LoadingPage } from '../ui/LoadingPage';
import { useConfirmDialog } from '@/hooks';

import { cn } from '../../lib/utils';
import { API } from '@/lib/api';

interface LeappPageProps {
    tool: 'ileapp' | 'aleapp';
    toolName: string;
}

interface Report {
    id: number;
    name: string;
    path: string;
    url: string;
    tool: 'ileapp' | 'aleapp';
    created_at: string;
    size: string;
}

function LeappContent({ tool }: { tool: 'ileapp' | 'aleapp' }) {
    const outputFolder = '';
    const { states, updateConfig, clearLogs, clearProcessingReportName, fetchModules } = useLeapp();
    const toolState = states[tool];
    const { config, processing } = toolState;
    const { inputFile, reportName } = config;
    const { logs, isProcessing, processingReportName } = processing;

    const [reports, setReports] = useState<Report[]>([]);
    const { selectedCaseId } = useCase();
    const { config: confirmConfig, show: showConfirm, hide: hideConfirm, handleConfirm } = useConfirmDialog();



    // Fetch reports for the current tool
    const fetchReports = useCallback(async () => {
        try {
            const url = selectedCaseId
                ? API.path(`/reports?case_id=${selectedCaseId}`)
                : API.path('/reports');
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                // Filter to only show reports for the current tool
                setReports(data.filter((r: Report) => r.tool === tool));
            }
        } catch (error) {
            console.error('Failed to fetch reports:', error);
        }
    }, [selectedCaseId, tool]);

    // Fetch reports on mount and when case changes
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchReports();
    }, [fetchReports]);

    // Refresh reports when processing completes
    useEffect(() => {
        if (!isProcessing && logs.length > 0) {
            // Small delay to ensure backend has updated
            const timer = setTimeout(fetchReports, 1000);
            return () => clearTimeout(timer);
        }
    }, [isProcessing, logs.length, fetchReports]);

    useEffect(() => {
        if (processingReportName && reports.some(r => r.name === processingReportName)) {
            clearProcessingReportName(tool);
        }
    }, [reports, processingReportName, clearProcessingReportName, tool]);

    // Fetch modules once on mount or when tool/case changes
    useEffect(() => {
        const currentToolState = states[tool];
        // Only fetch if not currently processing AND not already loaded
        if (currentToolState.modules.length === 0 && !currentToolState.isLoadingModules) {
            fetchModules(tool);
        }
    }, [tool, fetchModules, states]);



    const handleOpenLocation = (id: number) => {
        showConfirm({
            title: 'Open Location',
            message: 'Open report location in Finder?',
            confirmLabel: 'Open',
            onConfirm: async () => {
                try {
                    await fetch(API.path(`/reports/${id}/open`), {
                        method: 'POST'
                    });
                } catch (error) {
                    console.error('Failed to open location:', error);
                }
            }
        });
    };

    const handleDeleteReport = (id: number) => {
        showConfirm({
            title: 'Delete Report',
            message: 'Are you sure you want to delete this report? This action cannot be undone.',
            variant: 'destructive',
            confirmLabel: 'Delete',
            onConfirm: async () => {
                try {
                    const response = await fetch(API.path(`/reports/${id}`), {
                        method: 'DELETE'
                    });
                    if (response.ok) {
                        fetchReports();
                    }
                } catch (error) {
                    console.error('Failed to delete report:', error);
                }
            }
        });
    };

    return (
        <div className="h-full w-full flex flex-col bg-[#151515] text-white py-[3vh] px-[9vh]">
            {/* Logo */}


            {/* Main Content */}
            <div className="flex-1 flex gap-[9vh] min-h-0">
                {/* Left Panel - Input & Controls */}
                <div className="flex-1 basis-0 min-w-0 h-full flex flex-col gap-6 min-h-0">

                    {/* Input & Report Name Row */}
                    <div className="flex gap-6">
                        {/* Report Name Section */}
                        <div className="flex-1 space-y-2 min-w-0">
                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">Name</label>
                            <Input
                                type="text"
                                value={reportName}
                                onChange={(e) => updateConfig(tool, { reportName: e.target.value })}
                                disabled={isProcessing}
                                placeholder="Enter report name..."
                                className="w-full h-8 text-xs"
                            />
                        </div>

                        <FileSelector
                            label="Input"
                            value={inputFile}
                            onChange={(val) => updateConfig(tool, { inputFile: val })}
                            disabled={isProcessing}
                            placeholder="Select input..."
                            showFolderOption={true}
                            tool={tool}
                            caseId={selectedCaseId ? parseInt(selectedCaseId) : undefined}
                        />
                    </div>

                    {/* Module Selection */}
                    <ModuleSelector
                        tool={tool}
                        isProcessing={isProcessing}
                    />

                    {/* Process Controls */}
                    <ProcessControls
                        tool={tool}
                        inputFile={inputFile}
                        outputFolder={outputFolder}
                        reportName={reportName}
                        caseId={selectedCaseId ? parseInt(selectedCaseId) : undefined}
                        existingNames={[...reports.map(r => r.name), ...(processingReportName ? [processingReportName] : [])]}
                    />
                </div>

                {/* Right Panel - Logs & Report Library */}
                <div className="flex-1 basis-0 min-w-0 h-full flex flex-col min-h-0 gap-4">
                    {/* Processing Log - Top 2/3 */}
                    <div className="flex-[2] bg-[#171717] border border-[#333333] rounded-lg overflow-hidden flex flex-col min-h-0">
                        <div className="px-4 py-2 border-b border-[#333333] bg-[#1A1A1A] flex justify-between items-center">
                            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Processing Log</h3>
                            <Button
                                onClick={() => clearLogs(tool)}
                                variant="secondary"
                                className="px-3 py-1 h-auto text-xs"
                            >
                                Clear Logs
                            </Button>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <LogViewer logs={logs} enabled={true} />
                        </div>
                    </div>

                    {/* Report Library - Bottom 1/3 */}
                    <div className="flex-1 flex flex-col min-h-0 bg-[#171717] border border-[#333333] rounded-lg overflow-hidden">
                        <div className="px-4 py-2 border-b border-[#333333] bg-[#1A1A1A]">
                            <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Report Library</h3>
                        </div>
                        <div className="flex-1 flex flex-col p-0 min-h-0 overflow-hidden">
                            {reports.length === 0 && !isProcessing && !processingReportName ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-500">
                                    <p className="text-sm font-medium">No reports found</p>
                                    <p className="text-xs text-gray-600 mt-1">Generated reports will appear here</p>
                                </div>
                            ) : (
                                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                                    {/* Processing Report Entry */}
                                    {processingReportName && (
                                        <LibraryCard
                                            title={processingReportName}
                                            subtitle={
                                                <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
                                                    <span className="flex items-center gap-0.5">
                                                        <Calendar size={9} />
                                                        {new Date().toLocaleDateString()}
                                                    </span>
                                                    {!isProcessing && (
                                                        <>
                                                            <span>•</span>
                                                            <span>Saving report...</span>
                                                        </>
                                                    )}
                                                </div>
                                            }
                                            status={{
                                                state: 'processing',
                                                label: isProcessing ? 'Processing' : 'Completing',
                                                progress: 100 // Use indeterminate via CSS or full bar
                                            }}
                                            actions={[
                                                { icon: FolderOpen, label: 'Open', onClick: () => { }, disabled: true },
                                                { icon: Download, label: 'Download', onClick: () => { }, disabled: true },
                                                { icon: Trash2, label: 'Delete', onClick: () => { }, disabled: true }
                                            ]}
                                            className="w-full"
                                        />
                                    )}

                                    {/* Existing Reports */}
                                    {reports.map((report) => (
                                        <LibraryCard
                                            key={report.id}
                                            title={report.name}
                                            subtitle={
                                                <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
                                                    <span className="flex items-center gap-0.5">
                                                        <Calendar size={9} />
                                                        {new Date(report.created_at).toLocaleDateString()}
                                                    </span>
                                                    <span>•</span>
                                                    <span>{report.size}</span>
                                                </div>
                                            }
                                            actions={[
                                                {
                                                    icon: FolderOpen,
                                                    label: 'Open Location',
                                                    onClick: () => handleOpenLocation(report.id)
                                                },
                                                {
                                                    icon: Trash2,
                                                    label: 'Delete Report',
                                                    variant: 'destructive',
                                                    onClick: () => handleDeleteReport(report.id)
                                                }
                                            ]}
                                            className="w-full"
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            {/* Confirmation Dialog */}
            <ConfirmDialog
                config={confirmConfig}
                onClose={hideConfirm}
                onConfirm={handleConfirm}
            />
        </div>
    );
}

export default function LeappPage({ tool, toolName }: LeappPageProps) {
    return <LeappContent tool={tool} />;
}

