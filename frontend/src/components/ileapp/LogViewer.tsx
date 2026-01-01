import { useAutoScroll } from '../../hooks/useAutoScroll';
// import { useMemo } from 'react';

interface LogViewerProps {
  logs: string[];
  enabled?: boolean;
}

export default function LogViewer({ logs, enabled = true }: LogViewerProps) {
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
    <div
      ref={logsRef}
      onScroll={handleScroll}
      className="h-full overflow-y-auto font-mono text-[10px] leading-tight p-4 bg-[#171717] custom-scrollbar"
    >
      {logs.length > 0 ? (
        <div className="flex flex-col gap-0.5">
          {logs.map((log, index) => formatLogLine(log, index))}
        </div>
      ) : (
        <div className="h-full flex flex-col items-center justify-center text-gray-500 select-none font-sans">
          <p className="text-sm font-medium">No logs yet</p>
          <p className="text-xs text-gray-600 mt-1">Start processing to see output</p>
        </div>
      )}
    </div>
  );
}