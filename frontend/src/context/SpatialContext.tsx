"use client"

import React, { createContext, useContext, useState, useEffect } from 'react'

interface SpatialContextType {
    center: [number, number];
    zoom: number;
    layer: 'normal' | 'satellite' | 'hybrid';
    selectedKmlsPaths: string[];
    geoJsonData: any;
    searchQuery: string;

    setCenter: (center: [number, number]) => void;
    setZoom: (zoom: number) => void;
    setLayer: (layer: 'normal' | 'satellite' | 'hybrid') => void;
    setSelectedKmlsPaths: (paths: string[]) => void;
    setGeoJsonData: (data: any) => void;
    setSearchQuery: (query: string) => void;

    // Tracking for auto-fitting
    fittedPaths: Set<string>;
    markPathFitted: (path: string) => void;

    isStateLoaded: boolean;
}

const SpatialContext = createContext<SpatialContextType | undefined>(undefined)

import { useCase } from './CaseContext';

const STORAGE_KEY_PREFIX = 'vdf_spatial_state_';

interface StoredState {
    center: [number, number];
    zoom: number;
    layer: 'normal' | 'satellite' | 'hybrid';
    selectedKmlsPaths: string[];
    searchQuery?: string;
}

export function SpatialProvider({ children }: { children: React.ReactNode }) {
    const { selectedCaseId } = useCase();
    const [center, setCenter] = useState<[number, number]>([40.7128, -74.0060]);
    const [zoom, setZoom] = useState(13);
    const [layer, setLayer] = useState<'normal' | 'satellite' | 'hybrid'>('normal');
    const [selectedKmlsPaths, setSelectedKmlsPaths] = useState<string[]>([]);
    const [geoJsonData, setGeoJsonData] = useState<any>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [isStateLoaded, setIsStateLoaded] = useState(false);

    const [fittedPaths, setFittedPaths] = useState<Set<string>>(new Set());

    const markPathFitted = (path: string) => {
        setFittedPaths(prev => new Set(prev).add(path));
    };

    // Load state from sessionStorage when selectedCaseId changes
    useEffect(() => {
        if (!selectedCaseId) {
            setIsStateLoaded(true); // Allow component to render even if no case is selected
            return;
        }

        setIsStateLoaded(false); // Reset loading state while switching

        try {
            const stored = sessionStorage.getItem(`${STORAGE_KEY_PREFIX}${selectedCaseId}`);
            if (stored) {
                const parsed: StoredState = JSON.parse(stored);
                if (parsed.center) setCenter(parsed.center);
                if (parsed.zoom !== undefined) setZoom(parsed.zoom);
                if (parsed.layer) setLayer(parsed.layer);
                if (parsed.selectedKmlsPaths) {
                    setSelectedKmlsPaths(parsed.selectedKmlsPaths);
                    setFittedPaths(new Set(parsed.selectedKmlsPaths));
                } else {
                    setSelectedKmlsPaths([]);
                    setFittedPaths(new Set());
                }
                if (parsed.searchQuery) setSearchQuery(parsed.searchQuery);
                else setSearchQuery("");
            } else {
                // Reset to defaults if no saved state for this case
                setCenter([40.7128, -74.0060]);
                setZoom(13);
                setLayer('normal');
                setSelectedKmlsPaths([]);
                setFittedPaths(new Set());
                setSearchQuery("");
                setGeoJsonData(null);
            }
        } catch (error) {
            console.error('Failed to load spatial state:', error);
            // Fallback reset on error
            setCenter([40.7128, -74.0060]);
            setZoom(13);
            setLayer('normal');
            setSelectedKmlsPaths([]);
            setFittedPaths(new Set());
            setSearchQuery("");
            setGeoJsonData(null);
        }
        setIsStateLoaded(true);
    }, [selectedCaseId]);

    // Save state to sessionStorage on change
    useEffect(() => {
        if (!isStateLoaded || !selectedCaseId) return;

        try {
            const state: StoredState = {
                center,
                zoom,
                layer,
                selectedKmlsPaths,
                searchQuery
            };
            sessionStorage.setItem(`${STORAGE_KEY_PREFIX}${selectedCaseId}`, JSON.stringify(state));
        } catch (error) {
            console.error('Failed to save spatial state:', error);
        }
    }, [center, zoom, layer, selectedKmlsPaths, searchQuery, isStateLoaded, selectedCaseId]);

    return (
        <SpatialContext.Provider value={{
            center,
            zoom,
            layer,
            selectedKmlsPaths,
            geoJsonData,
            searchQuery,
            setCenter,
            setZoom,
            setLayer,
            setSelectedKmlsPaths,
            setGeoJsonData,
            setSearchQuery,
            fittedPaths,
            markPathFitted,
            isStateLoaded
        }}>
            {children}
        </SpatialContext.Provider>
    )
}

export function useSpatial() {
    const context = useContext(SpatialContext)
    if (context === undefined) {
        throw new Error('useSpatial must be used within a SpatialProvider')
    }
    return context
}
