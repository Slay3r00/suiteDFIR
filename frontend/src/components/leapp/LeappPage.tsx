'use client';

import { useState } from 'react';
import { useProcessing, ProcessingProvider } from '../../hooks/useProcessing';
import { ModulesProvider } from '../../hooks/useModules';
import FileSelector from '../../components/ileapp/FileSelector';
import ModuleSelector from '../../components/ileapp/ModuleSelector';
import ProcessControls from '../../components/ileapp/ProcessControls';
import LogViewer from '../../components/ileapp/LogViewer';

import { Button, Input } from '../../components/ui';

interface LeappPageProps {
    tool: 'ileapp' | 'aleapp';
    logoPath: string;
    toolName: string;
}

function LeappContent({ logoPath, tool }: { logoPath: string; tool: string }) {
    const defaultOutputPath = tool === 'ileapp'
        ? '/Users/jacobcontreras/vdf-tools/backend/reports/ileapp-reports'
        : '/Users/jacobcontreras/vdf-tools/backend/reports/aleapp-reports';

    const [inputFile, setInputFile] = useState('');
    const [reportName, setReportName] = useState('');
    const [outputFolder, setOutputFolder] = useState(defaultOutputPath);
    const { logs, isProcessing, clearLogs } = useProcessing();

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

export default function LeappPage({ tool, logoPath, toolName }: LeappPageProps) {
    return (
        <ProcessingProvider tool={tool}>
            <ModulesProvider tool={tool}>
                <LeappContent logoPath={logoPath} tool={tool} />
            </ModulesProvider>
        </ProcessingProvider>
    );
}
