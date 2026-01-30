import { useState, useCallback } from 'react';

export interface ConfirmDialogConfig {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
    variant?: 'destructive' | 'default';
    confirmLabel?: string;
}

const INITIAL_CONFIG: ConfirmDialogConfig = {
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
    variant: 'default',
    confirmLabel: 'Confirm'
};

export function useConfirmDialog() {
    const [config, setConfig] = useState<ConfirmDialogConfig>(INITIAL_CONFIG);

    const show = useCallback((options: Omit<ConfirmDialogConfig, 'isOpen'>) => {
        setConfig({ ...options, isOpen: true });
    }, []);

    const hide = useCallback(() => {
        setConfig(prev => ({ ...prev, isOpen: false }));
    }, []);

    const handleConfirm = useCallback(async () => {
        await config.onConfirm();
        hide();
    }, [config, hide]);

    return { config, show, hide, handleConfirm };
}
