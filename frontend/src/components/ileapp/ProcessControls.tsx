import { useState } from 'react';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Input } from '../ui';
import { useProcessing } from '../../hooks/useProcessing';
import { useModules } from '../../hooks/useModules';
import { Square, Lock } from 'lucide-react';
import { createLeappApi } from '../../services/leappApi';
import { useToast } from '../../hooks/use-toast';

interface ProcessControlsProps {
  inputFile: string;
  outputFolder: string;
  reportName?: string;
  caseId?: number;
}

export default function ProcessControls({ inputFile, outputFolder, reportName, caseId }: ProcessControlsProps) {
  const { selectedModules } = useModules();
  const { isProcessing, startProcessing, stopProcessing, progress } = useProcessing();
  const { toast } = useToast();

  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [password, setPassword] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  const handleStart = async () => {
    if (!inputFile) {
      toast({
        title: "Error",
        description: "Please select an input file or folder first.",
        variant: "destructive"
      });
      return;
    }

    // Only validate for iOS/iLEAPP
    // We can infer it's iLEAPP if the path looks like a backup or if we are on the iLEAPP page
    // But for now, let's just try to validate if it's a directory
    // Actually, the API is tool-specific. We should know which tool we are using.
    // The current context doesn't explicitly say "ileapp" vs "aleapp" here, but ProcessControls is in `ileapp` folder.
    // Let's assume iLEAPP for now or check if we can pass the tool prop.
    // Ideally ProcessControls should take a `tool` prop.
    // For now, I'll use 'ios' for validation as implemented in the backend.

    setIsValidating(true);
    try {
      const api = createLeappApi('ios');
      const validation = await api.processing.validateBackup(inputFile);

      if (validation.encrypted) {
        setShowPasswordDialog(true);
      } else {
        // Not encrypted, proceed normally
        await startProcessing(inputFile, outputFolder, Array.from(selectedModules), reportName, undefined, caseId);
      }
    } catch (error) {
      console.error("Validation failed:", error);
      // If validation fails (e.g. not a backup folder), just try to process anyway
      // It might be a zip or tar that the validator doesn't handle yet
      await startProcessing(inputFile, outputFolder, Array.from(selectedModules), reportName, undefined, caseId);
    } finally {
      setIsValidating(false);
    }
  };

  const handlePasswordSubmit = async () => {
    setShowPasswordDialog(false);
    try {
      await startProcessing(inputFile, outputFolder, Array.from(selectedModules), reportName, password, caseId);
      setPassword(''); // Clear password after sending
    } catch (error) {
      console.error("Processing failed:", error);
    }
  };

  const canStart = !isProcessing && selectedModules.size > 0 && !!reportName;

  return (
    <>
      <div className="w-full">
        {isProcessing ? (
          <Button
            variant="destructive"
            onClick={stopProcessing}
            className="w-full relative overflow-hidden"
          >
            <div
              className="absolute inset-0 bg-black/20 transition-all duration-500"
              style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
            />
            <div className="relative z-10 flex items-center justify-center gap-2">
              <Square className="h-4 w-4" />
              <span>Stop Processing ({Math.round(progress.total > 0 ? (progress.current / progress.total) * 100 : 0)}%)</span>
            </div>
          </Button>
        ) : (
          <Button
            onClick={handleStart}
            disabled={!canStart || isValidating}
            className="w-full"
          >
            {isValidating ? (
              "Checking Backup..."
            ) : (
              "Start Processing"
            )}
          </Button>
        )}
      </div>

      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Encrypted Backup Detected</DialogTitle>
            <DialogDescription>
              This iTunes backup is encrypted. Please enter the password to decrypt and analyze it.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="relative">
              <Lock className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="password"
                placeholder="Backup Password"
                className="pl-9"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handlePasswordSubmit();
                }}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handlePasswordSubmit} disabled={!password}>
              Unlock & Process
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}