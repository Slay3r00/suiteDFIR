
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import type {
    MRT_PaginationState,
    MRT_SortingState,
    MRT_ColumnFiltersState,
    MRT_DensityState
} from 'material-react-table'

interface TimelineConfig {
    selectedReportId: number | 'all';
    selectedTimezone: string;
    pagination: MRT_PaginationState;
    sorting: MRT_SortingState;
    globalFilter: string;
    columnFilters: MRT_ColumnFiltersState;
    density: MRT_DensityState;
    scrollPosition: number;
}

interface TimelineState {
    config: TimelineConfig;
    isLoaded: boolean;
}

interface TimelineContextType extends TimelineState {
    updateConfig: (updates: Partial<TimelineConfig>) => void;
}

const TimelineContext = createContext<TimelineContextType | undefined>(undefined);

import { useCase } from './CaseContext';

const STORAGE_KEY_PREFIX = 'vdf_timeline_state_v2_';

const INITIAL_CONFIG: TimelineConfig = {
    selectedReportId: 'all',
    selectedTimezone: 'UTC',
    pagination: { pageIndex: 0, pageSize: 50 },
    sorting: [{ id: 'date', desc: true }],
    globalFilter: '',
    columnFilters: [],
    density: 'compact',
    scrollPosition: 0,
};

export function TimelineProvider({ children }: { children: ReactNode }) {
    const { selectedCaseId } = useCase();
    const [config, setConfig] = useState<TimelineConfig>(INITIAL_CONFIG);
    const [isLoaded, setIsLoaded] = useState(false);

    // Load from sessionStorage when selectedCaseId changes
    useEffect(() => {
        if (!selectedCaseId) {
            setIsLoaded(true);
            return;
        }

        setIsLoaded(false);

        const stored = sessionStorage.getItem(`${STORAGE_KEY_PREFIX}${selectedCaseId}`);
        if (stored) {
            try {
                setConfig(prev => ({ ...prev, ...JSON.parse(stored) }));
            } catch (e) {
                console.error('Failed to parse timeline state:', e);
                setConfig(INITIAL_CONFIG);
            }
        } else {
            setConfig(INITIAL_CONFIG);
        }
        setIsLoaded(true);
    }, [selectedCaseId]);

    // Save to sessionStorage
    useEffect(() => {
        if (isLoaded && selectedCaseId) {
            sessionStorage.setItem(`${STORAGE_KEY_PREFIX}${selectedCaseId}`, JSON.stringify(config));
        }
    }, [config, isLoaded, selectedCaseId]);

    const updateConfig = useCallback((updates: Partial<TimelineConfig>) => {
        setConfig(prev => ({ ...prev, ...updates }));
    }, []);

    return (
        <TimelineContext.Provider value={{
            config,
            isLoaded,
            updateConfig
        }}>
            {children}
        </TimelineContext.Provider>
    );
}

export function useTimeline() {
    const context = useContext(TimelineContext);
    if (context === undefined) {
        throw new Error('useTimeline must be used within a TimelineProvider');
    }
    return context;
}
