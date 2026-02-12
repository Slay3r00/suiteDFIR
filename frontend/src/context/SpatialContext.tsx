
import React, { createContext, useContext, useState, useEffect } from 'react'
import type { GeoJsonObject } from 'geojson'

interface SpatialContextType {
    center: [number, number];
    zoom: number;
    layer: 'normal' | 'satellite' | 'hybrid';
    selectedKmlsPaths: string[];
    geoJsonData: GeoJsonObject | null;
    searchQuery: string;

    setCenter: (center: [number, number]) => void;
    setZoom: (zoom: number) => void;
    setLayer: (layer: 'normal' | 'satellite' | 'hybrid') => void;
    setSelectedKmlsPaths: (paths: string[]) => void;
    setGeoJsonData: (data: GeoJsonObject | null) => void;
    setSearchQuery: (query: string) => void;

    // Tracking for auto-fitting
    fittedPaths: Set<string>;
    markPathFitted: (path: string) => void;

    isStateLoaded: boolean;
}

const SpatialContext = createContext<SpatialContextType | undefined>(undefined)

import { useCase } from './CaseContext';

import { useCasePersistedState } from '@/hooks/useCasePersistedState';

const STORAGE_KEY_PREFIX = 'vdf_spatial_state_';

interface StoredState {
    center: [number, number];
    zoom: number;
    layer: 'normal' | 'satellite' | 'hybrid';
    selectedKmlsPaths: string[];
    searchQuery: string;
}

const INITIAL_STATE: StoredState = {
    center: [40.7128, -74.0060],
    zoom: 13,
    layer: 'normal',
    selectedKmlsPaths: [],
    searchQuery: ""
};

export function SpatialProvider({ children }: { children: React.ReactNode }) {
    const [state, setState, isStateLoaded] = useCasePersistedState<StoredState>(
        STORAGE_KEY_PREFIX,
        INITIAL_STATE
    );

    const { center, zoom, layer, selectedKmlsPaths, searchQuery } = state;

    const setCenter = (val: [number, number]) => setState(prev => ({ ...prev, center: val }));
    const setZoom = (val: number) => setState(prev => ({ ...prev, zoom: val }));
    const setLayer = (val: 'normal' | 'satellite' | 'hybrid') => setState(prev => ({ ...prev, layer: val }));
    const setSelectedKmlsPaths = (val: string[]) => setState(prev => ({ ...prev, selectedKmlsPaths: val }));
    const setSearchQuery = (val: string) => setState(prev => ({ ...prev, searchQuery: val }));

    const [geoJsonData, setGeoJsonData] = useState<GeoJsonObject | null>(null);
    const [fittedPaths, setFittedPaths] = useState<Set<string>>(new Set());

    const markPathFitted = (path: string) => {
        setFittedPaths(prev => new Set(prev).add(path));
    };

    // Auto-sync fittedPaths with selectedKmlsPaths when state is loaded
    // Only remove paths from fittedPaths if they are no longer selected
    // Do NOT auto-add them; let SpatialMap handle that after flying to bounds
    useEffect(() => {
        if (isStateLoaded) {
            setFittedPaths(prev => {
                const next = new Set(prev);
                let changed = false;
                for (const path of next) {
                    if (!selectedKmlsPaths.includes(path)) {
                        next.delete(path);
                        changed = true;
                    }
                }
                return changed ? next : prev;
            });
        }
    }, [isStateLoaded, selectedKmlsPaths]);

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
