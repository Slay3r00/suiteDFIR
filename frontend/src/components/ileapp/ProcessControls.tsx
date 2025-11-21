import { Button } from '../ui';
import { useProcessing } from '../../hooks/useProcessing';
import { useModules } from '../../hooks/useModules';
import { Square } from 'lucide-react';

interface ProcessControlsProps {
  inputFile: string;
  outputFolder: string;
}

export default function ProcessControls({ inputFile, outputFolder }: ProcessControlsProps) {
  const { selectedModules } = useModules();
  const { isProcessing, startProcessing, stopProcessing, progress } = useProcessing();

  const handleStart = async () => {
    try {
      // Convert Set to Array for the API
      await startProcessing(inputFile, outputFolder, Array.from(selectedModules));
    } catch (error) {
      console.error('Failed to start processing:', error);
    }
  };

  const handleStop = async () => {
    try {
      await stopProcessing();
    } catch (error) {
      console.error('Failed to stop processing:', error);
    }
  };

  const canStart = inputFile && selectedModules.size > 0 && outputFolder && !isProcessing;

  // Calculate progress percentage
  const progressPercent = progress.total > 0
    ? Math.min(100, Math.round((progress.current / progress.total) * 100))
    : 0;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button
          onClick={isProcessing ? handleStop : handleStart}
          disabled={isProcessing ? false : !canStart}
          className="w-full relative overflow-hidden"
          variant="secondary"
        >
          {isProcessing && (
            <div
              className="absolute left-0 top-0 bottom-0 bg-white/10 transition-all duration-300 ease-in-out"
              style={{ width: `${progressPercent}%` }}
            />
          )}

          <div className="relative z-10 flex items-center gap-2">
            {isProcessing ? (
              <>
                <Square className="h-4 w-4 fill-current" />
                <span className="text-xs font-mono opacity-90">
                  {progress.current} / {progress.total}
                </span>
              </>
            ) : (
              'Start Processing'
            )}
          </div>
        </Button>
      </div>
    </div>
  );
}