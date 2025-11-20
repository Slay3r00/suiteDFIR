'use client';

import { useState } from 'react';
import { useProcessing } from '../../hooks/useProcessing';
import FileSelector from '../../components/ileapp/FileSelector';
import ModuleSelector from '../../components/ileapp/ModuleSelector';
import ProcessControls from '../../components/ileapp/ProcessControls';
import LogViewer from '../../components/ileapp/LogViewer';

export default function ILEAPP() {
  const [inputFile, setInputFile] = useState('');
  const [outputFolder, setOutputFolder] = useState('');
  const { logs, isProcessing, appendLog } = useProcessing();

  const handleLog = (message: string) => {
    appendLog(message);
  };

  return (
    <div className="h-screen w-screen" style={{backgroundColor: '#151515', color: 'white', display: 'flex', padding: '2rem', gap: '2rem', borderWidth: '0.5px'}}>
      {/* Left Panel - Input & Controls */}
      <div className="w-1/2 h-full flex flex-col gap-6">
        {/* File Input */}
        <FileSelector
          value={inputFile}
          onChange={setInputFile}
          disabled={isProcessing}
          placeholder="Select input file..."
          showFolderOption={true}
        />

        {/* Output Folder */}
        <div className="space-y-2">
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
          onLog={handleLog}
        />

        {/* Process Controls */}
        <ProcessControls
          inputFile={inputFile}
          outputFolder={outputFolder}
          onLog={handleLog}
        />
      </div>

      {/* Right Panel - Logs */}
      <div className="w-1/2 h-full">
        <LogViewer logs={logs} enabled={true} />
      </div>
    </div>
  );
}