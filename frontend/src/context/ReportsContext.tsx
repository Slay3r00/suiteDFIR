"use client"

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'

interface ReportViewState {
    scrollPosition: number;
    timestamp: number;
}

// Enhanced iframe state for session-based tracking (not persisted to localStorage)
export interface ReportIframeState {
    mainScrollY: number;
    sidebarScrollY: number;
    currentPage: string;  // Current artifact page within the report
    dtPage?: number;      // Current DataTables page index (optional)
}

interface ReportsContextType {
    // Current UI state (persisted to localStorage)
    selectedReportPath: string | null;
    filter: 'all' | 'ileapp' | 'aleapp';
    sort: 'newest' | 'oldest' | 'name';
    searchQuery: string;

    // Actions for UI state
    setSelectedReportPath: (path: string | null) => void;
    setFilter: (filter: 'all' | 'ileapp' | 'aleapp') => void;
    setSort: (sort: 'newest' | 'oldest' | 'name') => void;
    setSearchQuery: (query: string) => void;

    // Legacy scroll position management (localStorage)
    saveReportScrollPosition: (reportPath: string, scrollY: number) => void;
    getReportScrollPosition: (reportPath: string) => number;

    // Enhanced iframe state management (session-only)
    saveReportIframeState: (reportPath: string, state: ReportIframeState) => void;
    getReportIframeState: (reportPath: string) => ReportIframeState | null;

    // Initialization state
    isStateLoaded: boolean;
}

const ReportsContext = createContext<ReportsContextType | undefined>(undefined)

const STORAGE_KEY = 'vdf_reports_state';
const MAX_STORED_REPORTS = 50; // Limit stored scroll positions to prevent localStorage bloat

interface StoredState {
    selectedReportPath: string | null;
    filter: 'all' | 'ileapp' | 'aleapp';
    sort: 'newest' | 'oldest' | 'name';
    searchQuery: string;
    reportViewStates: Record<string, ReportViewState>;
}

// Helper to load initial state from sessionStorage
function getInitialState(): StoredState | null {
    if (typeof window === 'undefined') return null;
    try {
        const stored = sessionStorage.getItem(STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (error) {
        console.error('Failed to load reports state from sessionStorage:', error);
    }
    return null;
}

export function ReportsProvider({ children }: { children: React.ReactNode }) {
    // Initialize with default/null to match SSR
    const [selectedReportPath, setSelectedReportPath] = useState<string | null>(null);

    const [filter, setFilter] = useState<'all' | 'ileapp' | 'aleapp'>('all');

    const [sort, setSort] = useState<'newest' | 'oldest' | 'name'>('newest');

    const [searchQuery, setSearchQuery] = useState('');

    const [reportViewStates, setReportViewStates] = useState<Map<string, ReportViewState>>(new Map());

    const [isStateLoaded, setIsStateLoaded] = useState(false);

    // Load state from localStorage on mount
    // Load state from localStorage on mount
    useEffect(() => {
        const stored = getInitialState();
        if (stored) {
            if (stored.selectedReportPath) {
                setSelectedReportPath(stored.selectedReportPath);
            }
            if (stored.filter) setFilter(stored.filter);
            if (stored.sort) setSort(stored.sort);
            if (stored.searchQuery) setSearchQuery(stored.searchQuery);
            // Intentionally NOT restoring reportViewStates to ensure session-only scroll tracking
        }
        setIsStateLoaded(true);
    }, []);

    // Save state to sessionStorage whenever it changes
    useEffect(() => {
        if (!isStateLoaded) return;

        try {
            const state: StoredState = {
                selectedReportPath,
                filter,
                sort,
                searchQuery,
                reportViewStates: {} // Don't persist scroll positions (session only)
            };

            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (error) {
            console.error('Failed to save reports state to sessionStorage:', error);
        }
    }, [selectedReportPath, filter, sort, searchQuery, reportViewStates, isStateLoaded]);

    const saveReportScrollPosition = useCallback((reportPath: string, scrollY: number) => {
        setReportViewStates(prev => {
            const next = new Map(prev);
            next.set(reportPath, {
                scrollPosition: scrollY,
                timestamp: Date.now()
            });
            return next;
        });
    }, []);

    const getReportScrollPosition = useCallback((reportPath: string): number => {
        return reportViewStates.get(reportPath)?.scrollPosition ?? 0;
    }, [reportViewStates]);

    // Session-only enhanced iframe state (not persisted to localStorage)
    const iframeStatesRef = useRef<Map<string, ReportIframeState>>(new Map());

    const saveReportIframeState = useCallback((reportPath: string, state: ReportIframeState) => {
        iframeStatesRef.current.set(reportPath, state);
    }, []);

    const getReportIframeState = useCallback((reportPath: string) => {
        const state = iframeStatesRef.current.get(reportPath) ?? null;
        return state;
    }, []);

    return (
        <ReportsContext.Provider value={{
            selectedReportPath,
            filter,
            sort,
            searchQuery,
            isStateLoaded,
            setSelectedReportPath,
            setFilter,
            setSort,
            setSearchQuery,
            saveReportScrollPosition,
            getReportScrollPosition,
            saveReportIframeState,
            getReportIframeState
        }}>
            {children}
        </ReportsContext.Provider>
    )
}

export function useReports() {
    const context = useContext(ReportsContext)
    if (context === undefined) {
        throw new Error('useReports must be used within a ReportsProvider')
    }
    return context
}
