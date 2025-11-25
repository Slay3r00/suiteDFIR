"use client"

import { useState, useRef, useEffect } from "react"
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
    onDataUpload: (data: any) => void
    onKmlSelect: (kmlUrl: string, selected: boolean) => void
    currentLayer: 'normal' | 'satellite' | 'hybrid'
    selectedCaseId: string | null
}

export default function MapControls({ onSearch, onLayerChange, onDataUpload, onKmlSelect, currentLayer, selectedCaseId }: MapControlsProps) {
    const [searchQuery, setSearchQuery] = useState("")
    const [isSearching, setIsSearching] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [showLayerMenu, setShowLayerMenu] = useState(false)
    const [showKmlMenu, setShowKmlMenu] = useState(false)
    const [kmlFiles, setKmlFiles] = useState<Record<string, KmlFile[]>>({})
    const [selectedKmls, setSelectedKmls] = useState<Set<string>>(new Set())
    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (showKmlMenu) {
            fetchKmlFiles()
        }
    }, [showKmlMenu, selectedCaseId])

    const fetchKmlFiles = async () => {
        try {
            const url = selectedCaseId
                ? `http://localhost:8000/api/spatial/kml-files?case_id=${selectedCaseId}`
                : 'http://localhost:8000/api/spatial/kml-files';
            const res = await fetch(url)
            if (res.ok) {
                const data = await res.json()
                setKmlFiles(data)
            }
        } catch (error) {
            console.error("Failed to fetch KML files:", error)
        }
    }

    const toggleKmlSelection = (file: KmlFile) => {
        const newSelected = new Set(selectedKmls)
        const isSelected = newSelected.has(file.path)

        if (isSelected) {
            newSelected.delete(file.path)
        } else {
            newSelected.add(file.path)
        }

        setSelectedKmls(newSelected)
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
                        className="pl-9 !bg-background border border-border h-10"
                    />
                    {isSearching && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4 animate-spin" />
                    )}
                </form>
            </div>

            {/* Right Controls */}
            <div className="flex gap-2 pointer-events-auto">
                {/* Layer Switcher */}
                <div className="relative">
                    <Button
                        variant="secondary"
                        size="icon"
                        className="!bg-background border border-border shadow-lg hover:bg-accent"
                        onClick={() => setShowLayerMenu(!showLayerMenu)}
                    >
                        <Layers className="h-4 w-4" />
                    </Button>

                    {showLayerMenu && (
                        <div className="absolute top-12 right-0 !bg-background border border-border rounded-lg shadow-xl p-2 min-w-[140px] flex flex-col gap-1">
                            <button
                                onClick={() => { onLayerChange('normal'); setShowLayerMenu(false) }}
                                className={cn(
                                    "flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors hover:bg-accent",
                                    currentLayer === 'normal' && "bg-accent text-accent-foreground"
                                )}
                            >
                                <MapIcon className="h-4 w-4" />
                                Normal
                            </button>
                            <button
                                onClick={() => { onLayerChange('satellite'); setShowLayerMenu(false) }}
                                className={cn(
                                    "flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors hover:bg-accent",
                                    currentLayer === 'satellite' && "bg-accent text-accent-foreground"
                                )}
                            >
                                <Satellite className="h-4 w-4" />
                                Satellite
                            </button>
                            <button
                                onClick={() => { onLayerChange('hybrid'); setShowLayerMenu(false) }}
                                className={cn(
                                    "flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors hover:bg-accent",
                                    currentLayer === 'hybrid' && "bg-accent text-accent-foreground"
                                )}
                            >
                                <Globe className="h-4 w-4" />
                                Hybrid
                            </button>
                        </div>
                    )}
                </div>

                {/* Upload Button */}
                <Button
                    variant="secondary"
                    size="icon"
                    className="!bg-background border border-border shadow-lg hover:bg-accent"
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
                <div className="relative">
                    <Button
                        variant="secondary"
                        size="icon"
                        className="!bg-background border border-border shadow-lg hover:bg-accent"
                        onClick={() => setShowKmlMenu(!showKmlMenu)}
                        title="Browse KML Exports"
                    >
                        <Folder className="h-4 w-4" />
                    </Button>

                    {showKmlMenu && (
                        <div className="absolute top-12 right-0 !bg-background border border-border rounded-lg shadow-xl p-0 min-w-[300px] max-h-[400px] flex flex-col overflow-hidden">
                            <div className="p-2 border-b border-border bg-muted/50">
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">KML Exports</h3>
                            </div>
                            <div className="overflow-y-auto custom-scrollbar p-2 space-y-4">
                                {Object.entries(kmlFiles).length === 0 ? (
                                    <div className="text-sm text-muted-foreground text-center py-4">No KML files found</div>
                                ) : (
                                    Object.entries(kmlFiles).map(([groupName, files]) => (
                                        <div key={groupName}>
                                            <h4 className="text-xs font-medium text-primary mb-2 px-1">{groupName}</h4>
                                            <div className="space-y-1">
                                                {files.map((file) => (
                                                    <div
                                                        key={file.path}
                                                        className={cn(
                                                            "flex items-center gap-2 px-2 py-1.5 rounded-md text-sm cursor-pointer transition-colors hover:bg-accent",
                                                            selectedKmls.has(file.path) && "bg-accent text-accent-foreground"
                                                        )}
                                                        onClick={() => toggleKmlSelection(file)}
                                                    >
                                                        <div className={cn(
                                                            "w-4 h-4 border rounded flex items-center justify-center transition-colors",
                                                            selectedKmls.has(file.path) ? "bg-primary border-primary" : "border-muted-foreground"
                                                        )}>
                                                            {selectedKmls.has(file.path) && <Check className="h-3 w-3 text-primary-foreground" />}
                                                        </div>
                                                        <span className="truncate flex-1" title={file.name}>{file.name}</span>
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
