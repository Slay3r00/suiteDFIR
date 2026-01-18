"use client"

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'

interface ReportViewState {
    scrollPosition: number;
    timestamp: number;
}

// DataTable state for each artifact page
export interface DataTableState {
    pageLength: number;  // "Show X entries" dropdown value (10, 25, 50, 100)
    pageNum: number;     // Current pagination page (0-based index)
    searchText: string;  // Search bar text content
}

// Enhanced iframe state for session-based tracking (not persisted to localStorage)
export interface ReportIframeState {
    mainScrollY: number;
    sidebarScrollY: number;
    currentPage: string;  // Current artifact page within the report
    dtStates?: Record<string, DataTableState>;  // Per-artifact DataTable states (URL -> state)
    activeTab?: string;   // Current active tab ID (optional)
}

interface ReportsContextType {
    // Current UI state (persisted to localStorage)
    selectedReportId: number | null;
    filter: 'all' | 'ileapp' | 'aleapp';
    sort: 'newest' | 'oldest' | 'name';
    searchQuery: string;

    // Actions for UI state
    setSelectedReportId: (id: number | null) => void;
    setFilter: (filter: 'all' | 'ileapp' | 'aleapp') => void;
    setSort: (sort: 'newest' | 'oldest' | 'name') => void;
    setSearchQuery: (query: string) => void;

    // Legacy scroll position management (localStorage)
    saveReportScrollPosition: (reportId: number, scrollY: number) => void;
    getReportScrollPosition: (reportId: number) => number;

    // Enhanced iframe state management (session-only)
    saveReportIframeState: (reportId: number, state: ReportIframeState) => void;
    getReportIframeState: (reportId: number) => ReportIframeState | null;

    // Initialization state
    isStateLoaded: boolean;
}

import { useCase } from './CaseContext';

const ReportsContext = createContext<ReportsContextType | undefined>(undefined)

const STORAGE_KEY_PREFIX = 'vdf_reports_state_v2_';
const MAX_STORED_REPORTS = 50; // Limit stored scroll positions to prevent localStorage bloat

interface StoredState {
    selectedReportId: number | null;
    filter: 'all' | 'ileapp' | 'aleapp';
    sort: 'newest' | 'oldest' | 'name';
    searchQuery: string;
    reportViewStates: Record<number, ReportViewState>;
    iframeStates: Record<number, ReportIframeState>;
}

// Helper to load initial state from sessionStorage
function getInitialState(caseId: string | null): StoredState | null {
    if (typeof window === 'undefined' || !caseId) return null;
    try {
        const stored = sessionStorage.getItem(`${STORAGE_KEY_PREFIX}${caseId}`);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (error) {
        console.error('Failed to load reports state from sessionStorage:', error);
    }
    return null;
}

export function ReportsProvider({ children }: { children: React.ReactNode }) {
    const { selectedCaseId } = useCase();
    // Initialize with default/null to match SSR
    const [selectedReportId, setSelectedReportId] = useState<number | null>(null);

    const [filter, setFilter] = useState<'all' | 'ileapp' | 'aleapp'>('all');

    const [sort, setSort] = useState<'newest' | 'oldest' | 'name'>('newest');

    const [searchQuery, setSearchQuery] = useState('');

    const [reportViewStates, setReportViewStates] = useState<Map<number, ReportViewState>>(new Map());

    const [isStateLoaded, setIsStateLoaded] = useState(false);

    // Load state from localStorage on mount
    // Load state from localStorage on mount
    useEffect(() => {
        if (!selectedCaseId) {
            setIsStateLoaded(true);
            return;
        }

        setIsStateLoaded(false);

        const stored = getInitialState(selectedCaseId);
        if (stored) {
            if (stored.selectedReportId) {
                setSelectedReportId(stored.selectedReportId);
            } else {
                setSelectedReportId(null);
            }
            if (stored.filter) setFilter(stored.filter);
            else setFilter('all');
            if (stored.sort) setSort(stored.sort);
            else setSort('newest');
            if (stored.searchQuery) setSearchQuery(stored.searchQuery);
            else setSearchQuery('');

            if (stored.reportViewStates) {
                setReportViewStates(new Map(Object.entries(stored.reportViewStates).map(([k, v]) => [parseInt(k), v])));
            } else {
                setReportViewStates(new Map());
            }

            if (stored.iframeStates) {
                iframeStatesRef.current = new Map(Object.entries(stored.iframeStates).map(([k, v]) => [parseInt(k), v]));
            } else {
                iframeStatesRef.current = new Map();
            }
        } else {
            // Reset to defaults
            setSelectedReportId(null);
            setFilter('all');
            setSort('newest');
            setSearchQuery('');
            setReportViewStates(new Map());
            iframeStatesRef.current = new Map();
        }
        setIsStateLoaded(true);
    }, [selectedCaseId]);

    // Save state to sessionStorage whenever it changes
    useEffect(() => {
        if (!isStateLoaded || !selectedCaseId) return;

        try {
            const state: StoredState = {
                selectedReportId,
                filter,
                sort,
                searchQuery,
                reportViewStates: Object.fromEntries(reportViewStates),
                iframeStates: Object.fromEntries(iframeStatesRef.current)
            };

            sessionStorage.setItem(`${STORAGE_KEY_PREFIX}${selectedCaseId}`, JSON.stringify(state));
        } catch (error) {
            console.error('Failed to save reports state to sessionStorage:', error);
        }
    }, [selectedReportId, filter, sort, searchQuery, reportViewStates, isStateLoaded, selectedCaseId]);

    const saveReportScrollPosition = useCallback((reportId: number, scrollY: number) => {
        setReportViewStates(prev => {
            const next = new Map(prev);
            next.set(reportId, {
                scrollPosition: scrollY,
                timestamp: Date.now()
            });
            return next;
        });
    }, []);

    const getReportScrollPosition = useCallback((reportId: number): number => {
        return reportViewStates.get(reportId)?.scrollPosition ?? 0;
    }, [reportViewStates]);

    // Session-only enhanced iframe state (not persisted to localStorage)
    const iframeStatesRef = useRef<Map<number, ReportIframeState>>(new Map());

    const saveReportIframeState = useCallback((reportId: number, state: ReportIframeState) => {
        iframeStatesRef.current.set(reportId, state);

        // Formulate and save complete state immediately since Ref changes don't trigger useEffect
        if (isStateLoaded && selectedCaseId) {
            try {
                const fullState: StoredState = {
                    selectedReportId,
                    filter,
                    sort,
                    searchQuery,
                    reportViewStates: Object.fromEntries(reportViewStates),
                    iframeStates: Object.fromEntries(iframeStatesRef.current)
                };
                sessionStorage.setItem(`${STORAGE_KEY_PREFIX}${selectedCaseId}`, JSON.stringify(fullState));
            } catch (error) {
                console.error('Failed to save iframe state to sessionStorage:', error);
            }
        }
    }, [isStateLoaded, selectedCaseId, selectedReportId, filter, sort, searchQuery, reportViewStates]);

    const getReportIframeState = useCallback((reportId: number) => {
        const state = iframeStatesRef.current.get(reportId) ?? null;
        return state;
    }, []);

    return (
        <ReportsContext.Provider value={{
            selectedReportId,
            filter,
            sort,
            searchQuery,
            isStateLoaded,
            setSelectedReportId,
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
