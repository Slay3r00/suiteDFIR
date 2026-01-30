import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './Dialog';
import { Button } from './Button';
import { cn } from '@/lib/utils';
import { ConfirmDialogConfig } from '@/hooks/useConfirmDialog';

interface ConfirmDialogProps {
    config: ConfirmDialogConfig;
    onClose: () => void;
    onConfirm: () => Promise<void>;
}

export function ConfirmDialog({ config, onClose, onConfirm }: ConfirmDialogProps) {
    return (
        <Dialog open={config.isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-[340px] p-5 bg-[#1A1A1A] border-[#333333]">
                <DialogHeader>
                    <DialogTitle className="text-sm font-semibold text-white tracking-wide uppercase">
                        {config.title}
                    </DialogTitle>
                </DialogHeader>
                <div className="py-2">
                    <p className="text-[11px] text-gray-400 leading-relaxed">
                        {config.message}
                    </p>
                </div>
                <DialogFooter className="mt-2 flex gap-2">
                    <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1 h-8 text-[11px]"
                        onClick={onClose}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant={config.variant === 'destructive' ? 'destructive' : 'default'}
                        size="sm"
                        className={cn(
                            "flex-1 h-8 text-[11px]",
                            config.variant === 'destructive'
                                ? "bg-red-900/20 hover:bg-red-900/40 text-white border border-red-900/30"
                                : "bg-[#333333] hover:bg-[#404040] text-white border border-white/10"
                        )}
                        onClick={onConfirm}
                    >
                        {config.confirmLabel || 'Confirm'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
