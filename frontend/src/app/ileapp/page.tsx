'use client';

import { useState } from 'react';
import { useProcessing, ProcessingProvider } from '../../hooks/useProcessing';
import { ModulesProvider } from '../../hooks/useModules';
import FileSelector from '../../components/ileapp/FileSelector';
import ModuleSelector from '../../components/ileapp/ModuleSelector';
import ProcessControls from '../../components/ileapp/ProcessControls';
import LogViewer from '../../components/ileapp/LogViewer';

import { Button } from '../../components/ui';

function ILEAPPContent() {
  const [inputFile, setInputFile] = useState('');
  const [outputFolder, setOutputFolder] = useState('');
  const { logs, isProcessing, clearLogs } = useProcessing();

  return (
    <div className="h-full w-full flex flex-col bg-[#151515] text-white p-[9vh]">
      {/* Logo */}
      <div className="flex items-center mb-[3vh]">
        <img src="/iLEAPP-logo.png" alt="iLEAPP Logo" className="h-16" />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-[9vh] min-h-0">
        {/* Left Panel - Input & Controls */}
        <div className="flex-1 h-full flex flex-col gap-6 min-h-0">
          {/* Input Section */}
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Input</h2>
            <FileSelector
              value={inputFile}
              onChange={setInputFile}
              disabled={isProcessing}
              placeholder="Select input file..."
              showFolderOption={true}
            />
          </div>

          {/* Output Section */}
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Output</h2>
            <FileSelector
              value={outputFolder}
              onChange={setOutputFolder}
              disabled={isProcessing}
              placeholder="Select output folder..."
              showFolderOption={false}
            />
          </div>

          {/* Module Selection */}
          <ModuleSelector
            isProcessing={isProcessing}
          />

          {/* Process Controls */}
          <ProcessControls
            inputFile={inputFile}
            outputFolder={outputFolder}
          />
        </div>

        {/* Right Panel - Logs */}
        <div className="flex-1 h-full flex flex-col gap-4 min-h-0">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">iLEAPP Log</h2>
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

export default function ILEAPP() {
  return (
    <ProcessingProvider>
      <ModulesProvider>
        <ILEAPPContent />
      </ModulesProvider>
    </ProcessingProvider>
  );
}