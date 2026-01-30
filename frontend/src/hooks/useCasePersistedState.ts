import { Dispatch, SetStateAction } from 'react';
import { useCase } from '@/context/CaseContext';
import { usePersistedState } from './usePersistedState';

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

    const storageKey = storageType === 'session'
        ? (selectedCaseId ? `${key}_${selectedCaseId}` : null)
        : key;

    return usePersistedState(storageKey || '', initialState, storage);
}
