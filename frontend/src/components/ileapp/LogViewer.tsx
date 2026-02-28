import { useAutoScroll } from '../../hooks/useAutoScroll';
// import { useMemo } from 'react';

interface LogViewerProps {
  logs: string[];
  progressLogs?: Record<string, string>;
  enabled?: boolean;
}

export default function LogViewer({ logs, progressLogs = {}, enabled = true }: LogViewerProps) {
  const { logsRef, handleScroll } = useAutoScroll(logs, enabled);

  // Render log lines with uniform color (no highlighting)
  const formatLogLine = (log: string, index: number) => {
    return (
      <div key={index} className="whitespace-pre-wrap break-all text-gray-400">
        {log}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-[#171717] overflow-hidden">
      {logs.length > 0 || Object.keys(progressLogs).length > 0 ? (
        <>
          <div
            ref={logsRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto font-mono text-[10px] leading-tight p-4 custom-scrollbar"
          >
            <div className="flex flex-col gap-0.5">
              {logs.map((log, index) => formatLogLine(log, index))}
            </div>
          </div>

          {Object.keys(progressLogs).length > 0 && (
            <div className="flex-none bg-transparent px-4 pt-3 pb-4 border-t border-[#333] flex flex-col gap-1 font-mono text-[10px] leading-tight relative z-10">
              {Object.entries(progressLogs).map(([type, log]) => (
                <div key={`progress-${type}`} className="whitespace-pre-wrap break-all text-gray-200 font-semibold tracking-wide">
                  {log}
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="h-full flex flex-col items-center justify-center text-gray-500 select-none font-sans">
          <p className="text-sm font-medium">No logs yet</p>
          <p className="text-xs text-gray-600 mt-1">Start processing to see output</p>
        </div>
      )}
    </div>
  );
}