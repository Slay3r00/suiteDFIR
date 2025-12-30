'use client';

import { useState, useEffect } from 'react';
import { useProcessing, ProcessingProvider } from '../../hooks/useProcessing';
import { ModulesProvider } from '../../hooks/useModules';
import FileSelector from '../../components/ileapp/FileSelector';
import ModuleSelector from '../../components/ileapp/ModuleSelector';
import ProcessControls from '../../components/ileapp/ProcessControls';
import LogViewer from '../../components/ileapp/LogViewer';
import ToolNotInstalled from '../../components/ui/ToolNotInstalled';

import { Button, Input } from '../../components/ui';
import { useCase } from '@/context/CaseContext';

import { getToolsStatus } from '@/lib/api/tools';

interface LeappPageProps {
    tool: 'ileapp' | 'aleapp';
    logoPath: string;
    toolName: string;
}

function LeappContent({ logoPath, tool }: { logoPath: string; tool: string }) {
    const outputFolder = '';

    const [inputFile, setInputFile] = useState('');
    const [reportName, setReportName] = useState('');
    // const { setTool } = useLeappStore();
    const { logs, isProcessing, clearLogs } = useProcessing();
    const { selectedCaseId } = useCase();

    // aLEAPP logo is 10% smaller than iLEAPP
    const logoHeight = tool === 'aleapp' ? 'h-[57.6px]' : 'h-16';

    return (
        <div className="h-full w-full flex flex-col bg-[#151515] text-white py-[3vh] px-[9vh]">
            {/* Logo */}


            {/* Main Content */}
            <div className="flex-1 flex gap-[9vh] min-h-0">
                {/* Left Panel - Input & Controls */}
                <div className="flex-1 h-full flex flex-col gap-6 min-h-0">
                    {/* Logo */}
                    <div className="flex items-center h-16">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={logoPath} alt="Tool Logo" className={logoHeight} />
                    </div>
                    {/* Input & Report Name Row */}
                    <div className="flex gap-6">
                        {/* Report Name Section */}
                        <div className="flex-1 space-y-2">
                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">Name</label>
                            <div className="flex gap-3">
                                <Input
                                    type="text"
                                    value={reportName}
                                    onChange={(e) => setReportName(e.target.value)}
                                    disabled={isProcessing}
                                    placeholder="Enter report name"
                                    className="w-full"
                                />
                            </div>
                        </div>

                        {/* Input Section */}
                        <div className="flex-[2] space-y-2">
                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">Input</label>
                            <FileSelector
                                value={inputFile}
                                onChange={setInputFile}
                                disabled={isProcessing}
                                placeholder="Select input file..."
                                showFolderOption={true}
                                tool={tool}
                                caseId={selectedCaseId ? parseInt(selectedCaseId) : undefined}
                            />
                        </div>
                    </div>

                    {/* Module Selection */}
                    <ModuleSelector
                        isProcessing={isProcessing}
                    />

                    {/* Process Controls */}
                    <ProcessControls
                        inputFile={inputFile}
                        outputFolder={outputFolder}
                        reportName={reportName}
                        caseId={selectedCaseId ? parseInt(selectedCaseId) : undefined}
                    />
                </div>

                {/* Right Panel - Logs */}
                <div className="flex-1 h-full flex flex-col min-h-0">
                    <div className="flex-1 bg-[#171717] border border-[#333333] rounded-lg overflow-hidden flex flex-col">
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
                            <LogViewer logs={logs} enabled={true} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function LeappPageWithCheck({ tool, logoPath }: LeappPageProps) {
    const [toolInstalled, setToolInstalled] = useState<boolean | null>(null);

    useEffect(() => {

        const checkTool = async () => {
            try {
                const status = await getToolsStatus();
                const toolStatus = status[tool];
                setToolInstalled(toolStatus?.installed ?? false);
            } catch (error) {
                console.error('Failed to check tool status:', error);
                // Assume installed on error to avoid blocking
                setToolInstalled(true);
            }
        };

        checkTool();
    }, [tool]);

    // Loading state
    if (toolInstalled === null) {
        return (
            <div className="h-full w-full flex items-center justify-center bg-[#151515] text-white">
                <div className="text-sm text-gray-500">Loading...</div>
            </div>
        );
    }

    // Tool not installed - show blocking screen
    if (!toolInstalled) {
        return <ToolNotInstalled tool={tool} />;
    }

    // Tool installed - show normal content
    return (
        <ProcessingProvider tool={tool}>
            <ModulesProvider tool={tool}>
                <LeappContent logoPath={logoPath} tool={tool} />
            </ModulesProvider>
        </ProcessingProvider>
    );
}

export default function LeappPage({ tool, logoPath, toolName }: LeappPageProps) {
    return <LeappPageWithCheck tool={tool} logoPath={logoPath} toolName={toolName} />;
}

