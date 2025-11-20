import { Button } from '../ui';
import { useProcessing } from '../../hooks/useProcessing';
import { useModules } from '../../hooks/useModules';

interface ProcessControlsProps {
  inputFile: string;
  outputFolder: string;
  onLog?: (message: string) => void;
}

export default function ProcessControls({ inputFile, outputFolder, onLog }: ProcessControlsProps) {
  const { selectedModules } = useModules();
  const { isProcessing, startProcessing, stopProcessing } = useProcessing();

  const handleStart = async () => {
    try {
      await startProcessing(inputFile, outputFolder, selectedModules, onLog);
    } catch (error) {
      if (error instanceof Error) {
        onLog?.(error.message);
      }
    }
  };

  const handleStop = async () => {
    await stopProcessing();
  };

  const canStart = inputFile && selectedModules.size > 0 && outputFolder && !isProcessing;

  return (
    <div className="space-y-3">
      <Button
        onClick={isProcessing ? handleStop : handleStart}
        disabled={!canStart}
        className="w-full"
        variant="secondary"
      >
        {isProcessing ? 'Stop Processing' : 'Start Processing'}
      </Button>
    </div>
  );
}