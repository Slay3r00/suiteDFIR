import { useAutoScroll } from '../../hooks/useAutoScroll';
// import { useMemo } from 'react';

interface LogViewerProps {
  logs: string[];
  enabled?: boolean;
}

export default function LogViewer({ logs, enabled = true }: LogViewerProps) {
  const { logsRef, handleScroll } = useAutoScroll(logs, enabled);

  // Helper to format log lines with syntax highlighting
  const formatLogLine = (log: string, index: number) => {
    // Error lines
    if (log.toLowerCase().includes('error') || log.toLowerCase().includes('exception') || log.toLowerCase().includes('traceback')) {
      return <div key={index} className="text-white bg-white/5 whitespace-pre-wrap break-all border-l-2 border-white pl-2">{log}</div>;
    }

    // Progress [x/y]
    const progressMatch = log.match(/^\[(\d+\/\d+)\]/);
    if (progressMatch) {
      const restOfLine = log.substring(progressMatch[0].length);
      return (
        <div key={index} className="whitespace-pre-wrap break-all text-gray-400">
          <span className="text-white font-bold">{progressMatch[0]}</span>
          {restOfLine.split(' ').map((word, i) => {
            if (word.includes('started')) return <span key={i} className="text-gray-300"> {word}</span>;
            if (word.startsWith('[') && word.endsWith(']')) return <span key={i} className="text-gray-200 font-semibold"> {word}</span>;
            return <span key={i}> {word}</span>;
          })}
        </div>
      );
    }

    // Completion
    if (log.includes('artifact completed')) {
      return (
        <div key={index} className="whitespace-pre-wrap break-all text-gray-500">
          {log}
        </div>
      );
    }

    // idevicebackup2 Progress
    if (log.includes('%') && (log.includes('[') || log.includes(']'))) {
      return (
        <div key={index} className="whitespace-pre-wrap break-all text-gray-500 font-mono">
          {log.split(' ').map((word, i) => {
            if (word.includes('%')) return <span key={i} className="text-white font-bold"> {word}</span>;
            return <span key={i}> {word}</span>;
          })}
        </div>
      );
    }

    // idevicebackup2 Status
    if (log.includes('Backup Successful') || log.includes('Receiving') || log.includes('Initializing') || log.includes('Backup')) {
      return <div key={index} className="whitespace-pre-wrap break-all text-gray-300 font-semibold">{log}</div>;
    }

    // Data found
    if (log.includes('Found') && log.includes('records')) {
      return (
        <div key={index} className="whitespace-pre-wrap break-all text-gray-300">
          {log}
        </div>
      );
    }

    // Metadata / Info
    if (log.startsWith('Processing:') || log.startsWith('Output folder:') || log.startsWith('Selected modules:') || log.startsWith('Info:')) {
      return <div key={index} className="whitespace-pre-wrap break-all text-gray-300 font-semibold">{log}</div>;
    }

    // Default
    return <div key={index} className="whitespace-pre-wrap break-all text-gray-500">{log}</div>;
  };

  return (
    <div
      ref={logsRef}
      onScroll={handleScroll}
      className="h-full overflow-y-auto font-mono text-[10px] leading-tight p-4 bg-[#171717]"
    >
      {logs.length > 0 ? (
        <div className="flex flex-col gap-0.5">
          {logs.map((log, index) => formatLogLine(log, index))}
        </div>
      ) : (
        <div className="flex items-center justify-center h-full text-gray-500">
          <p>No logs yet. Start processing to see output.</p>
        </div>
      )}
    </div>
  );
}