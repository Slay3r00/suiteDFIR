import { useState, createContext, useContext, ReactNode } from 'react';
import { createLeappApi } from '../services/leappApi';

interface ProcessingContextType {
  logs: string[];
  isProcessing: boolean;
  progress: { current: number; total: number };
  taskId: string | null;
  startProcessing: (inputFile: string, outputFolder: string, selectedModules: string[], reportName?: string) => Promise<void>;
  stopProcessing: () => Promise<void>;
  clearLogs: () => void;
  tool: string;
}

const ProcessingContext = createContext<ProcessingContextType | undefined>(undefined);

export function ProcessingProvider({ children, tool }: { children: ReactNode; tool: string }) {
  const [logs, setLogs] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const api = createLeappApi(tool);

  const startProcessing = async (
    inputFile: string,
    outputFolder: string,
    selectedModules: string[],
    reportName?: string
  ) => {
    // Clear logs and progress at the start
    setLogs([]);
    setProgress({ current: 0, total: 0 });
    setIsProcessing(true);

    try {
      const response = await api.processing.start(inputFile, outputFolder, selectedModules, reportName);
      setTaskId(response.task_id);

      // Set up EventSource for streaming logs
      const eventSource = api.processing.createEventSource(response.task_id);

      eventSource.onmessage = (event: MessageEvent) => {
        const message = event.data;
        if (message && message !== 'Stream ended') {
          setLogs((prev) => [...prev, message]);

          // Parse progress from log message: [x/y]
          const match = message.match(/\[(\d+)\/(\d+)\]/);
          if (match) {
            setProgress({
              current: parseInt(match[1], 10),
              total: parseInt(match[2], 10)
            });
          }
        }
      };

      eventSource.addEventListener('close', () => {
        eventSource.close();
        setIsProcessing(false);
      });

      eventSource.onerror = () => {
        eventSource.close();
        setIsProcessing(false);
        setLogs((prev) => [...prev, 'Error: Connection to server lost']);
      };
    } catch (error) {
      setIsProcessing(false);
      setLogs((prev) => [...prev, `Error: ${error instanceof Error ? error.message : 'Unknown error'}`]);
    }
  };

  const clearLogs = () => {
    setLogs([]);
    setProgress({ current: 0, total: 0 });
  };

  const stopProcessing = async () => {
    if (!taskId) return;

    try {
      await api.processing.stop(taskId);
      setIsProcessing(false);
      setLogs((prev) => [...prev, 'Processing stopped by user']);
    } catch (error) {
      console.error('Failed to stop processing:', error);
    }
  };

  return (
    <ProcessingContext.Provider
      value={{
        logs,
        isProcessing,
        progress,
        taskId,
        startProcessing,
        stopProcessing,
        clearLogs,
        tool,
      }}
    >
      {children}
    </ProcessingContext.Provider>
  );
}

export function useProcessing() {
  const context = useContext(ProcessingContext);
  if (context === undefined) {
    throw new Error('useProcessing must be used within a ProcessingProvider');
  }
  return context;
}