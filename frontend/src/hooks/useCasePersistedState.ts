import { useState, useEffect, Dispatch, SetStateAction } from 'react';
import { useCase } from '@/context/CaseContext';

/**
 * Hook that persists state to storage (session/local), scoped by the currently selected case.
 * 
 * @param key - Base storage key (will be suffixed with case ID if storageType is 'session')
 * @param initialState - Initial state value or factory function
 * @param storageType - 'session' (scoped to case) or 'local' (global)
 * @returns [state, setState, isLoaded] - Similar to useState but with persistence
 */
export function useCasePersistedState<T>(
    key: string,
    initialState: T | (() => T),
    storageType: 'session' | 'local' = 'session'
): [T, Dispatch<SetStateAction<T>>, boolean] {
    const { selectedCaseId } = useCase();
    const storage = typeof window !== 'undefined'
        ? (storageType === 'local' ? localStorage : sessionStorage)
        : null;

    const getInitialValue = (): T => {
        return typeof initialState === 'function'
            ? (initialState as () => T)()
            : initialState;
    };

    const [state, setState] = useState<T>(getInitialValue);
    const [isLoaded, setIsLoaded] = useState(false);

    const storageKey = storageType === 'session'
        ? (selectedCaseId ? `${key}_${selectedCaseId}` : null)
        : key;

    // Load from sessionStorage when case changes
    useEffect(() => {
        if (!storageKey) {
            setIsLoaded(true);
            return;
        }

        setIsLoaded(false);

        try {
            const stored = storage?.getItem(storageKey);
            if (stored) {
                setState(JSON.parse(stored));
            } else {
                // Reset to initial state for new case/key
                setState(getInitialValue());
            }
        } catch (e) {
            console.error(`Failed to load state for ${key}:`, e);
            setState(getInitialValue());
        }
        setIsLoaded(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [storageKey, key]);

    // Save to sessionStorage when state changes
    useEffect(() => {
        if (!isLoaded || !storageKey) return;

        try {
            storage?.setItem(storageKey, JSON.stringify(state));
        } catch (e) {
            console.error(`Failed to save state for ${key}:`, e);
        }
    }, [state, storageKey, isLoaded, key]);

    return [state, setState, isLoaded];
}
