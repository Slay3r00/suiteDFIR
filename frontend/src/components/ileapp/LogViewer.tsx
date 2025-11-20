import { useAutoScroll } from '../../hooks/useAutoScroll';

interface LogViewerProps {
  logs: string[];
  enabled?: boolean;
}

export default function LogViewer({ logs, enabled = true }: LogViewerProps) {
  const { logsRef, handleScroll } = useAutoScroll(logs, enabled);

  return (
    <div
      ref={logsRef}
      onScroll={handleScroll}
      className="h-full rounded-lg overflow-y-auto font-mono text-xs leading-relaxed border border-gray-800 p-4"
      style={{ backgroundColor: '#171717', color: 'white', borderColor: '#f2f2f2', borderWidth: '0.5px' }}
    >
      {logs.length > 0 ? (
        logs.map((log, index) => <div key={index}>{log}</div>)
      ) : (
        <div className="flex items-center justify-center h-full text-white">
          <p>No logs yet. Start processing to see output.</p>
        </div>
      )}
    </div>
  );
}