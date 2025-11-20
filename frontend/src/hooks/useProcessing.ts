import { useState } from 'react';
import { ileappApi } from '../services/ileappApi';
import { Status } from '../app/ileapp/types';

export function useProcessing() {
  const [status, setStatus] = useState<Status>('idle');
  const [taskId, setTaskId] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);

  const appendLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const startProcessing = async (
    inputFile: string,
    outputFolder: string,
    selectedModules: Set<string>,
    onLog?: (log: string) => void
  ) => {
    if (!inputFile || selectedModules.size === 0 || !outputFolder) {
      throw new Error('Select file, output folder, and modules');
    }

    setStatus('processing');
    setLogs([]);
    appendLog('Starting iLEAPP...');

    try {
      const data = await ileappApi.processing.start(
        inputFile,
        outputFolder,
        Array.from(selectedModules)
      );

      const newTaskId = data.task_id;
      setTaskId(newTaskId);
      appendLog(`Task: ${newTaskId}`);

      const eventSource = ileappApi.processing.createEventSource(newTaskId);

      eventSource.onmessage = (e) => {
        const msg = e.data;
        appendLog(msg);
        onLog?.(msg);

        if (msg.includes('Processing completed')) {
          setStatus('completed');
          eventSource.close();
        } else if (msg.includes('Processing stopped')) {
          setStatus('stopped');
          eventSource.close();
        }
      };

      eventSource.onerror = () => {
        appendLog('Stream error');
        onLog?.('Stream error');
      };

      return newTaskId;
    } catch (error) {
      setStatus('error');
      appendLog('Processing failed');
      onLog?.('Processing failed');
      throw error;
    }
  };

  const stopProcessing = async () => {
    if (!taskId) return;

    try {
      await ileappApi.processing.stop(taskId);
      setStatus('stopped');
      appendLog('Processing stopped');
    } catch (error) {
      appendLog('Stop failed');
    }
  };

  const reset = () => {
    setStatus('idle');
    setTaskId('');
    setLogs([]);
  };

  return {
    status,
    taskId,
    logs,
    isProcessing: status === 'processing',
    startProcessing,
    stopProcessing,
    reset,
    appendLog,
  };
}