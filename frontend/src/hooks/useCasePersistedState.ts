import { useState, useEffect, Dispatch, SetStateAction } from 'react';
import { useCase } from '@/context/CaseContext';

/**
 * Hook that persists state to sessionStorage, scoped by the currently selected case.
 * 
 * @param key - Base storage key (will be suffixed with case ID)
 * @param initialState - Initial state value or factory function
 * @returns [state, setState, isLoaded] - Similar to useState but with persistence
 */
export function useCasePersistedState<T>(
    key: string,
    initialState: T | (() => T)
): [T, Dispatch<SetStateAction<T>>, boolean] {
    const { selectedCaseId } = useCase();

    const getInitialValue = (): T => {
        return typeof initialState === 'function'
            ? (initialState as () => T)()
            : initialState;
    };

    const [state, setState] = useState<T>(getInitialValue);
    const [isLoaded, setIsLoaded] = useState(false);

    const storageKey = selectedCaseId ? `${key}_${selectedCaseId}` : null;

    // Load from sessionStorage when case changes
    useEffect(() => {
        if (!storageKey) {
            setIsLoaded(true);
            return;
        }

        setIsLoaded(false);

        try {
            const stored = sessionStorage.getItem(storageKey);
            if (stored) {
                setState(JSON.parse(stored));
            } else {
                // Reset to initial state for new case
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
            sessionStorage.setItem(storageKey, JSON.stringify(state));
        } catch (e) {
            console.error(`Failed to save state for ${key}:`, e);
        }
    }, [state, storageKey, isLoaded, key]);

    return [state, setState, isLoaded];
}
