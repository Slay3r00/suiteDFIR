'use client';

import { useState } from 'react';
import { useProcessing, ProcessingProvider } from '../../hooks/useProcessing';
import { ModulesProvider } from '../../hooks/useModules';
import FileSelector from '../../components/ileapp/FileSelector';
import ModuleSelector from '../../components/ileapp/ModuleSelector';
import ProcessControls from '../../components/ileapp/ProcessControls';
import LogViewer from '../../components/ileapp/LogViewer';

import { Button } from '../../components/ui';

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
            <div className="flex items-center mb-[3vh] h-16">
                <img src={logoPath} alt="Tool Logo" className={logoHeight} />
            </div>

            {/* Main Content */}
            <div className="flex-1 flex gap-[9vh] min-h-0">
                {/* Left Panel - Input & Controls */}
                <div className="flex-1 h-full flex flex-col gap-6 min-h-0">
                    {/* Input & Report Name Row */}
                    <div className="flex gap-6">
                        {/* Report Name Section */}
                        <div className="flex-1 space-y-2">
                            <h2 className="text-xl font-semibold">Name</h2>
                            <div className="flex gap-3">
                                <input
                                    type="text"
                                    value={reportName}
                                    onChange={(e) => setReportName(e.target.value)}
                                    disabled={isProcessing}
                                    placeholder="Enter report name"
                                    className="w-full bg-[#212121] border border-[#333] rounded-md px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
                                />
                            </div>
                        </div>

                        {/* Input Section */}
                        <div className="flex-[2] space-y-2">
                            <h2 className="text-xl font-semibold">Input</h2>
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
                <div className="flex-1 h-full flex flex-col gap-4 min-h-0">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-semibold">Processing Log</h2>
                        <Button
                            onClick={clearLogs}
                            variant="secondary"
                            className="px-4 py-2"
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
