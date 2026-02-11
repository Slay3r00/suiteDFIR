import { useState, useEffect, Dispatch, SetStateAction } from 'react';

/**
 * Basic hook that persists state to a given storage.
 */
export function usePersistedState<T>(
    key: string,
    initialState: T | (() => T),
    storage: Storage | null
): [T, Dispatch<SetStateAction<T>>, boolean] {
    const getInitialValue = (): T => {
        return typeof initialState === 'function'
            ? (initialState as () => T)()
            : initialState;
    };

    const [state, setState] = useState<T>(getInitialValue);
    const [isLoaded, setIsLoaded] = useState(false);

    // Load from storage on mount or key change
    useEffect(() => {
        if (!key || !storage) {
            setIsLoaded(true);
            return;
        }

        setIsLoaded(false);

        try {
            const stored = storage.getItem(key);
            if (stored) {
                setState(JSON.parse(stored));
            } else {
                setState(getInitialValue());
            }
        } catch (e) {
            console.error(`Failed to load state for ${key}:`, e);
            setState(getInitialValue());
        }
        setIsLoaded(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);

    // Save to storage when state changes
    useEffect(() => {
        if (!isLoaded || !key || !storage) return;

        try {
            storage.setItem(key, JSON.stringify(state));
        } catch (e) {
            console.error(`Failed to save state for ${key}:`, e);
        }
    }, [state, key, isLoaded, storage]);

    return [state, setState, isLoaded];
}
