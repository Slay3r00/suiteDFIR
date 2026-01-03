"use client"

import React, { useState, useRef, useEffect } from "react"
import { Search, Layers, Upload, Loader2, Map as MapIcon, Satellite, Globe, Folder, Check } from "lucide-react"
import { Input } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import { cn } from "@/lib/utils"
import * as toGeoJSON from "@mapbox/togeojson"
import JSZip from "jszip"

interface KmlFile {
    name: string
    url: string
    path: string
}

interface MapControlsProps {
    onSearch: (lat: number, lon: number) => void
    onLayerChange: (layer: 'normal' | 'satellite' | 'hybrid') => void
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onDataUpload: (data: any) => void
    onKmlSelect: (kmlUrl: string, selected: boolean) => void
    currentLayer: 'normal' | 'satellite' | 'hybrid'
    selectedCaseId: string | null
}

import { useSpatial } from "@/context/SpatialContext"

export default function MapControls({ onSearch, onLayerChange, onDataUpload, onKmlSelect, currentLayer, selectedCaseId }: MapControlsProps) {
    const { selectedKmlsPaths, setSelectedKmlsPaths, searchQuery, setSearchQuery } = useSpatial()
    const [isSearching, setIsSearching] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [showLayerMenu, setShowLayerMenu] = useState(false)
    const [showKmlMenu, setShowKmlMenu] = useState(false)
    const [kmlFiles, setKmlFiles] = useState<Record<string, KmlFile[]>>({})
    const fileInputRef = useRef<HTMLInputElement>(null)

    const layerMenuRef = useRef<HTMLDivElement>(null)
    const kmlMenuRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (layerMenuRef.current && !layerMenuRef.current.contains(event.target as Node)) {
                setShowLayerMenu(false)
            }
            if (kmlMenuRef.current && !kmlMenuRef.current.contains(event.target as Node)) {
                setShowKmlMenu(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    const fetchKmlFiles = React.useCallback(async () => {
        try {
            const baseUrl = selectedCaseId
                ? `http://localhost:8000/api/spatial/kml-files?case_id=${selectedCaseId}`
                : 'http://localhost:8000/api/spatial/kml-files';
            const url = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}t=${new Date().getTime()}`;
            const res = await fetch(url)
            if (res.ok) {
                const data = await res.json()
                setKmlFiles(data)
            }
        } catch (error) {
            console.error("Failed to fetch KML files:", error)
        }
    }, [selectedCaseId])

    useEffect(() => {
        if (showKmlMenu) {
            fetchKmlFiles()
        }
    }, [showKmlMenu, selectedCaseId, fetchKmlFiles])

    const toggleKmlSelection = (file: KmlFile) => {
        const isSelected = selectedKmlsPaths.includes(file.url)

        if (isSelected) {
            setSelectedKmlsPaths(selectedKmlsPaths.filter(p => p !== file.url))
        } else {
            setSelectedKmlsPaths([...selectedKmlsPaths, file.url])
        }

        onKmlSelect(file.url, !isSelected)
    }

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!searchQuery.trim()) return

        setIsSearching(true)
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`)
            const data = await res.json()
            if (data && data.length > 0) {
                const { lat, lon } = data[0]
                onSearch(parseFloat(lat), parseFloat(lon))
            }
        } catch (error) {
            console.error("Search failed:", error)
        } finally {
            setIsSearching(false)
        }
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setIsUploading(true)
        try {
            if (file.name.endsWith('.kml')) {
                const text = await file.text()
                const parser = new DOMParser()
                const kml = parser.parseFromString(text, 'text/xml')
                const geojson = toGeoJSON.kml(kml)
                onDataUpload(geojson)
            } else if (file.name.endsWith('.kmz')) {
                const zip = await JSZip.loadAsync(file)
                const kmlFile = Object.values(zip.files).find(f => f.name.endsWith('.kml'))
                if (kmlFile) {
                    const text = await kmlFile.async('string')
                    const parser = new DOMParser()
                    const kml = parser.parseFromString(text, 'text/xml')
                    const geojson = toGeoJSON.kml(kml)
                    onDataUpload(geojson)
                }
            }
        } catch (error) {
            console.error("Upload failed:", error)
        } finally {
            setIsUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    return (
        <div className="absolute top-4 left-4 right-4 z-[1000] flex justify-between items-start pointer-events-none">
            {/* Search Bar */}
            <div className="pointer-events-auto w-full max-w-md shadow-lg">
                <form onSubmit={handleSearch} className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search location..."
                        className="pl-9 h-8 !bg-[#1f1f1f] hover:!bg-[#262626] focus:!bg-[#262626] !border-[#414141] text-white placeholder:text-muted-foreground placeholder:text-[11px] text-xs focus-visible:ring-0 focus-visible:ring-offset-0 transition-colors shadow-md"
                    />
                    {isSearching && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4 animate-spin" />
                    )}
                </form>
            </div>

            {/* Right Controls */}
            <div className="flex gap-2 pointer-events-auto">
                {/* Layer Switcher */}
                <div className="relative" ref={layerMenuRef}>
                    <Button
                        variant="secondary"
                        size="icon-sm"
                        className="!bg-[#1f1f1f] border border-[#414141] shadow-lg hover:!bg-[#333333] !text-[#fafafa]"
                        onClick={() => {
                            setShowLayerMenu(!showLayerMenu)
                            setShowKmlMenu(false)
                        }}
                    >
                        <Layers className="h-4 w-4" />
                    </Button>

                    {showLayerMenu && (
                        <div className="absolute top-10 right-0 bg-[#1A1A1A] border border-[#414141] rounded-lg shadow-xl overflow-hidden min-w-[140px] flex flex-col">
                            <div className="bg-[#212121] px-3 py-2 text-[10px] font-medium text-gray-400 uppercase tracking-wider border-b border-[#414141]">
                                Map Layers
                            </div>
                            <button
                                onClick={() => { onLayerChange('normal') }}
                                className={cn(
                                    "flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors hover:bg-[#2a2a2a] border-b border-[#262626]",
                                    currentLayer === 'normal' ? "text-white bg-[#262626]" : "text-gray-300 hover:text-white"
                                )}
                            >
                                <MapIcon className="h-3.5 w-3.5" />
                                Standard
                            </button>
                            <button
                                onClick={() => { onLayerChange('satellite') }}
                                className={cn(
                                    "flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors hover:bg-[#2a2a2a] border-b border-[#262626]",
                                    currentLayer === 'satellite' ? "text-white bg-[#262626]" : "text-gray-300 hover:text-white"
                                )}
                            >
                                <Satellite className="h-3.5 w-3.5" />
                                Satellite
                            </button>
                            <button
                                onClick={() => { onLayerChange('hybrid') }}
                                className={cn(
                                    "flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors hover:bg-[#2a2a2a] last:border-b-0",
                                    currentLayer === 'hybrid' ? "text-white bg-[#262626]" : "text-gray-300 hover:text-white"
                                )}
                            >
                                <Globe className="h-3.5 w-3.5" />
                                Hybrid
                            </button>
                        </div>
                    )}
                </div>

                {/* Upload Button */}
                <Button
                    variant="secondary"
                    size="icon-sm"
                    className="!bg-[#1f1f1f] border border-[#414141] shadow-lg hover:!bg-[#333333] !text-[#fafafa]"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    title="Upload KML/KMZ"
                >
                    {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                </Button>
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".kml,.kmz"
                    onChange={handleFileUpload}
                />

                {/* KML Browser Button */}
                <div className="relative" ref={kmlMenuRef}>
                    <Button
                        variant="secondary"
                        size="icon-sm"
                        className="!bg-[#1f1f1f] border border-[#414141] shadow-lg hover:!bg-[#333333] !text-[#fafafa]"
                        onClick={() => {
                            setShowKmlMenu(!showKmlMenu)
                            setShowLayerMenu(false)
                        }}
                        title="Browse KML Exports"
                    >
                        <Folder className="h-4 w-4" />
                    </Button>

                    {showKmlMenu && (
                        <div className="absolute top-10 right-0 bg-[#1A1A1A] border border-[#414141] rounded-lg shadow-xl p-0 min-w-[300px] max-h-[400px] flex flex-col overflow-hidden">
                            <div className="bg-[#212121] px-3 py-2 text-[10px] font-medium text-gray-400 uppercase tracking-wider border-b border-[#414141]">
                                KML Exports
                            </div>
                            <div className="overflow-y-auto custom-scrollbar bg-[#1A1A1A]">
                                {Object.entries(kmlFiles).length === 0 ? (
                                    <div className="text-xs text-gray-500 text-center py-6">No KML files found</div>
                                ) : (
                                    Object.entries(kmlFiles).map(([groupName, files]) => (
                                        <div key={groupName} className="border-b border-[#262626] last:border-b-0">
                                            <div className="bg-[#1f1f1f] px-3 py-1.5 text-[9px] font-bold text-gray-400/70 uppercase tracking-widest border-b border-[#262626]/50">
                                                {(() => {
                                                    // Clean up potential duplicates from backend (e.g. "Name (Name)")
                                                    // Only remove the suffix if it exactly matches the prefix
                                                    const match = groupName.match(/^(.+)\s\(\1\)$/);
                                                    return match ? match[1] : groupName;
                                                })()}
                                            </div>
                                            <div className="divide-y divide-[#262626]/30">
                                                {files.map((file) => (
                                                    <div
                                                        key={file.path}
                                                        className={cn(
                                                            "flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors hover:bg-[#2a2a2a]",
                                                            selectedKmlsPaths.includes(file.url) && "bg-[#262626]"
                                                        )}
                                                        onClick={() => toggleKmlSelection(file)}
                                                    >
                                                        <div className={cn(
                                                            "w-3.5 h-3.5 border flex items-center justify-center transition-colors rounded",
                                                            selectedKmlsPaths.includes(file.url) ? "bg-white border-white" : "border-gray-500 hover:border-gray-400"
                                                        )}
                                                            style={{ borderWidth: '0.5px' }}
                                                        >
                                                            {selectedKmlsPaths.includes(file.url) && <Check className="h-2.5 w-2.5 text-black" strokeWidth={4} />}
                                                        </div>
                                                        <span className={cn(
                                                            "text-xs truncate flex-1 font-medium",
                                                            selectedKmlsPaths.includes(file.url) ? "text-white" : "text-gray-300 hover:text-white"
                                                        )} title={file.name}>{file.name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
