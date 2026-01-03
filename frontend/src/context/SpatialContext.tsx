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

const STORAGE_KEY = 'vdf_spatial_state';

interface StoredState {
    center: [number, number];
    zoom: number;
    layer: 'normal' | 'satellite' | 'hybrid';
    selectedKmlsPaths: string[];
    searchQuery?: string;
}

export function SpatialProvider({ children }: { children: React.ReactNode }) {
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

    // Load state from localStorage on mount
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed: StoredState = JSON.parse(stored);
                if (parsed.center) setCenter(parsed.center);
                if (parsed.zoom !== undefined) setZoom(parsed.zoom);
                if (parsed.layer) setLayer(parsed.layer);
                if (parsed.selectedKmlsPaths) {
                    setSelectedKmlsPaths(parsed.selectedKmlsPaths);
                    // Mark existing paths as "already fitted" so we don't jump on load
                    setFittedPaths(new Set(parsed.selectedKmlsPaths));
                }
                if (parsed.searchQuery) setSearchQuery(parsed.searchQuery);
            }
        } catch (error) {
            console.error('Failed to load spatial state:', error);
        }
        setIsStateLoaded(true);
    }, []);

    // Save state to localStorage on change
    useEffect(() => {
        if (!isStateLoaded) return;

        try {
            const state: StoredState = {
                center,
                zoom,
                layer,
                selectedKmlsPaths,
                searchQuery
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (error) {
            console.error('Failed to save spatial state:', error);
        }
    }, [center, zoom, layer, selectedKmlsPaths, searchQuery, isStateLoaded]);

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
