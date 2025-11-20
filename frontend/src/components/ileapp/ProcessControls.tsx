import { Button } from '../ui';
import { useProcessing } from '../../hooks/useProcessing';
import { useModules } from '../../hooks/useModules';

interface ProcessControlsProps {
  inputFile: string;
  outputFolder: string;
}

export default function ProcessControls({ inputFile, outputFolder }: ProcessControlsProps) {
  const { selectedModules } = useModules();
  const { isProcessing, startProcessing, stopProcessing, appendLog } = useProcessing();

  const handleStart = async () => {
    try {
      await startProcessing(inputFile, outputFolder, selectedModules);
    } catch (error) {
      if (error instanceof Error) {
        appendLog(error.message);
      }
    }
  };

  const handleStop = async () => {
    await stopProcessing();
  };

  const canStart = inputFile && selectedModules.size > 0 && outputFolder && !isProcessing;
  const canStop = isProcessing;

  return (
    <div className="space-y-3">
      <Button
        onClick={isProcessing ? handleStop : handleStart}
        disabled={isProcessing ? !canStop : !canStart}
        className="w-full"
        variant="secondary"
      >
        {isProcessing ? 'Stop Processing' : 'Start Processing'}
      </Button>
    </div>
  );
}