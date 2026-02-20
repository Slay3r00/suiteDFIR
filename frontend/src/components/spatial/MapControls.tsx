import React, { useState, useRef, useEffect, useCallback } from "react"
import { Search, Upload, Loader2, Folder, Check, Trash2, MapPin, X, FileText, Eye, Save } from "lucide-react"
import { Input } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import { cn } from "@/lib/utils"
import { API } from "@/lib/api"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import { useConfirmDialog } from "@/hooks"
import { useSpatial } from "@/context/SpatialContext"
import { parseKmlText } from "@/lib/kmlUtils"
import JSZip from "jszip"
import type { GeoJsonObject } from 'geojson'

interface KmlFile {
    name: string
    url: string
    path: string
    is_deletable?: boolean
    is_temporary?: boolean
    data?: GeoJsonObject // For temporary files
}

interface PlaceSuggestion {
    placeId: string
    mainText: string
    secondaryText: string
}

interface LayerOption {
    id: 'normal' | 'satellite' | 'hybrid'
    label: string
    image?: string
}

const LAYER_OPTIONS: LayerOption[] = [
    { id: 'normal', label: 'Default', image: '/default.webp' },
    { id: 'satellite', label: 'Satellite', image: '/satellite.webp' },
    { id: 'hybrid', label: 'Hybrid', image: '/hybrid.webp' },
]

// Layer preview component using static images
const LayerPreview = ({ type, size = 'sm' }: { type: 'normal' | 'satellite' | 'hybrid', size?: 'sm' | 'lg' }) => {
    const option = LAYER_OPTIONS.find(o => o.id === type)
    const dims = size === 'lg' ? { w: 60, h: 52 } : { w: 48, h: 42 }

    return (
        <img
            src={option?.image}
            alt={option?.label}
            width={dims.w}
            height={dims.h}
            className="w-full h-full object-cover"
            draggable={false}
        />
    )
}

interface MapControlsProps {
    onSearch: (lat: number, lon: number) => void
    onLayerChange: (layer: 'normal' | 'satellite' | 'hybrid') => void
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onDataUpload: (data: any) => void
    onAddKmlData: (url: string, data: any) => void
    onRemoveKmlData: (url: string) => void
    currentLayer: 'normal' | 'satellite' | 'hybrid'
    selectedCaseId: string | null
}

export default function MapControls({ onSearch, onLayerChange, onDataUpload, onAddKmlData, onRemoveKmlData, currentLayer, selectedCaseId }: MapControlsProps) {
    const { selectedKmlsPaths, setSelectedKmlsPaths, searchQuery, setSearchQuery, setSearchPin } = useSpatial()
    const [isSearching, setIsSearching] = useState(false)
    const [showLayerMenu, setShowLayerMenu] = useState(false)
    const [showKmlMenu, setShowKmlMenu] = useState(false)
    const [showImportMenu, setShowImportMenu] = useState(false)
    const [kmlFiles, setKmlFiles] = useState<Record<string, KmlFile[]>>({})
    const [temporaryKmls, setTemporaryKmls] = useState<KmlFile[]>([])
    const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false)
    // Import dropdown state
    const [importFiles, setImportFiles] = useState<File[]>([])
    const [isDraggingImport, setIsDraggingImport] = useState(false)
    const [isProcessingImport, setIsProcessingImport] = useState(false)
    const { config: confirmConfig, show: showConfirm, hide: hideConfirm, handleConfirm } = useConfirmDialog()

    const layerMenuRef = useRef<HTMLDivElement>(null)
    const kmlMenuRef = useRef<HTMLDivElement>(null)
    const searchRef = useRef<HTMLDivElement>(null)
    const importMenuRef = useRef<HTMLDivElement>(null)
    const importFileInputRef = useRef<HTMLInputElement>(null)
    const debounceRef = useRef<NodeJS.Timeout | null>(null)

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            // Do not close menus if a confirmation dialog is open
            if (confirmConfig.isOpen) return;

            if (layerMenuRef.current && !layerMenuRef.current.contains(event.target as Node)) {
                setShowLayerMenu(false)
            }
            if (kmlMenuRef.current && !kmlMenuRef.current.contains(event.target as Node)) {
                setShowKmlMenu(false)
            }
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowSuggestions(false)
            }
            if (importMenuRef.current && !importMenuRef.current.contains(event.target as Node)) {
                setShowImportMenu(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [confirmConfig.isOpen])

    // Debounced autocomplete fetch
    const fetchSuggestions = useCallback(async (query: string) => {
        if (query.trim().length < 2) {
            setSuggestions([])
            return
        }
        setIsFetchingSuggestions(true)
        try {
            const res = await fetch(API.path(`/spatial/autocomplete?q=${encodeURIComponent(query)}`))
            if (res.ok) {
                const data = await res.json()
                setSuggestions(data)
                setShowSuggestions(data.length > 0)
            }
        } catch {
            setSuggestions([])
        } finally {
            setIsFetchingSuggestions(false)
        }
    }, [])

    // Trigger autocomplete on input change
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(() => {
            fetchSuggestions(searchQuery)
        }, 300)
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
        }
    }, [searchQuery, fetchSuggestions])

    const fetchKmlFiles = React.useCallback(async () => {
        try {
            const baseUrl = selectedCaseId
                ? API.path(`/spatial/kml-files?case_id=${selectedCaseId}`)
                : API.path('/spatial/kml-files');
            const url = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}t=${new Date().getTime()}`;
            const res = await fetch(url)
            if (res.ok) {
                const data = await res.json()
                setKmlFiles(data.files)
                return data.files;
            }
        } catch (error) {
            console.error("Failed to fetch KML files:", error)
        }
        return null;
    }, [selectedCaseId])

    useEffect(() => {
        if (showKmlMenu) {
            fetchKmlFiles()
        }
    }, [showKmlMenu, selectedCaseId, fetchKmlFiles])

    // Import file handlers
    const handleImportDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDraggingImport(true)
    }

    const handleImportDragLeave = () => {
        setIsDraggingImport(false)
    }

    const handleImportDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDraggingImport(false)
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            validateAndAddFiles(Array.from(e.dataTransfer.files))
        }
    }

    const handleImportFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            validateAndAddFiles(Array.from(e.target.files))
        }
    }

    const validateAndAddFiles = (selectedFiles: File[]) => {
        const validFiles = selectedFiles.filter(file => {
            const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
            return ['.kml', '.kmz'].includes(ext)
        })
        if (validFiles.length > 0) {
            setImportFiles(prev => [...prev, ...validFiles])
        }
    }

    const removeImportFile = (index: number) => {
        setImportFiles(prev => prev.filter((_, i) => i !== index))
    }

    const handleViewTemporarily = async () => {
        if (importFiles.length === 0) return
        setIsProcessingImport(true)

        try {
            for (const file of importFiles) {
                let kmlText = ""
                if (file.name.endsWith('.kml')) {
                    kmlText = await file.text()
                } else if (file.name.endsWith('.kmz')) {
                    const zip = await JSZip.loadAsync(file)
                    const kmlFile = Object.values(zip.files).find(f => f.name.endsWith('.kml'))
                    if (kmlFile) {
                        kmlText = await kmlFile.async('string')
                    }
                }
                const geojson = parseKmlText(kmlText)
                const tempFile: KmlFile = {
                    name: file.name,
                    url: `temp://${Date.now()}-${file.name}`,
                    path: "",
                    is_deletable: true,
                    is_temporary: true,
                    data: geojson
                }
                setTemporaryKmls(prev => [...prev, tempFile])
            }
            resetImport()
            setShowKmlMenu(true)
        } catch (error) {
            console.error("Failed to parse file:", error)
        } finally {
            setIsProcessingImport(false)
        }
    }

    const handleSaveAndView = async () => {
        if (importFiles.length === 0) return
        setIsProcessingImport(true)

        try {
            const uploadedFileNames = importFiles.map(f => f.name)

            for (const file of importFiles) {
                const formData = new FormData()
                formData.append("file", file)
                await fetch(API.path("/spatial/import"), {
                    method: "POST",
                    body: formData
                })
            }
            resetImport()
            setShowKmlMenu(true)

            await fetchKmlFiles()
        } catch (error) {
            console.error("Failed to save files:", error)
        } finally {
            setIsProcessingImport(false)
        }
    }

    const resetImport = () => {
        setImportFiles([])
        setShowImportMenu(false)
        if (importFileInputRef.current) importFileInputRef.current.value = ''
    }

    const toggleKmlSelection = (file: KmlFile) => {
        const isSelected = selectedKmlsPaths.includes(file.url)

        if (isSelected) {
            setSelectedKmlsPaths(selectedKmlsPaths.filter(p => p !== file.url))
        } else {
            setSelectedKmlsPaths([...selectedKmlsPaths, file.url])
            // For temporary files, ensure data is in browsedKmls (may already be there)
            if (file.is_temporary && file.data) {
                onAddKmlData(file.url, file.data)
            }
        }
    }

    const handleDeleteKml = (e: React.MouseEvent, file: KmlFile) => {
        e.stopPropagation() // Prevent row click

        const executeDelete = async () => {
            if (file.is_temporary) {
                setTemporaryKmls(prev => prev.filter(f => f.url !== file.url))
                if (selectedKmlsPaths.includes(file.url)) {
                    setSelectedKmlsPaths(selectedKmlsPaths.filter(p => p !== file.url))
                }
                // Remove from map data
                onRemoveKmlData(file.url)
                return
            }

            try {
                const res = await fetch(API.path(`/spatial/import/${encodeURIComponent(file.name)}`), {
                    method: 'DELETE'
                })

                if (res.ok) {
                    // Remove from selection if it was selected
                    if (selectedKmlsPaths.includes(file.url)) {
                        setSelectedKmlsPaths(selectedKmlsPaths.filter(p => p !== file.url))
                    }
                    // Refresh list
                    fetchKmlFiles()
                }
            } catch (error) {
                console.error("Failed to delete KML:", error)
            }
        }

        showConfirm({
            title: file.is_temporary ? 'Remove KML' : 'Delete KML',
            message: file.is_temporary
                ? `Remove ${file.name} from this session? It will not be deleted from disk.`
                : `Are you sure you want to delete ${file.name}? This action cannot be undone.`,
            variant: 'destructive',
            confirmLabel: file.is_temporary ? 'Remove' : 'Delete',
            onConfirm: executeDelete
        })
    }

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!searchQuery.trim()) return

        setShowSuggestions(false)
        setIsSearching(true)
        try {
            const res = await fetch(API.path(`/spatial/search?q=${encodeURIComponent(searchQuery)}`))
            if (res.ok) {
                const data = await res.json()
                if (data && data.length > 0) {
                    const { lat, lon } = data[0]
                    onSearch(parseFloat(lat), parseFloat(lon))
                }
            }
        } catch (error) {
            console.error("Search failed:", error)
        } finally {
            setIsSearching(false)
        }
    }

    const handleSelectSuggestion = async (suggestion: PlaceSuggestion) => {
        setSearchQuery(suggestion.mainText)
        setIsSearching(true)
        try {
            // Use the main text to geocode
            const res = await fetch(API.path(`/spatial/search?q=${encodeURIComponent(suggestion.mainText + ', ' + suggestion.secondaryText)}`))
            if (res.ok) {
                const data = await res.json()
                if (data && data.length > 0) {
                    const { lat, lon } = data[0]
                    onSearch(parseFloat(lat), parseFloat(lon))
                }
            }
        } catch (error) {
            console.error("Geocode failed:", error)
        } finally {
            setIsSearching(false)
        }
    }

    // Merge temporary files into the "Imported Files" group or create it
    const getDisplayFiles = () => {
        const displayFiles = { ...kmlFiles }
        if (temporaryKmls.length > 0) {
            const importedGroup = displayFiles["Imported Files"] || []
            // Combine and deduplicate by URL just in case
            const combined = [...importedGroup]
            temporaryKmls.forEach(temp => {
                if (!combined.find(f => f.url === temp.url)) {
                    combined.push(temp)
                }
            })
            displayFiles["Imported Files"] = combined
        }
        return displayFiles
    }

    const displayKmlFiles = getDisplayFiles()

    return (
        <>
            {/* Top Controls */}
            <div className="absolute top-4 left-4 right-4 z-[1000] flex justify-between items-start pointer-events-none">
                {/* Search Bar */}
                <div ref={searchRef} className="pointer-events-auto w-full max-w-[270px] shadow-lg relative">
                    <form onSubmit={handleSearch} className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                        <Input
                            value={searchQuery}
                            onChange={(e) => {
                                const newQuery = e.target.value;
                                setSearchQuery(newQuery);
                                if (!newQuery.trim()) {
                                    setSearchPin(null);
                                }
                            }}
                            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                            placeholder="Search location..."
                            className="pl-9 h-8 !bg-[#1f1f1f] hover:!bg-[#262626] focus:!bg-[#262626] !border-[#414141] text-white placeholder:text-muted-foreground placeholder:text-[11px] text-xs focus-visible:ring-0 focus-visible:ring-offset-0 transition-colors shadow-md"
                        />
                        {(isSearching || isFetchingSuggestions) && (
                            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4 animate-spin" />
                        )}
                    </form>

                    {/* Autocomplete Dropdown */}
                    {showSuggestions && suggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-[#1A1A1A] border border-[#414141] rounded-lg shadow-xl overflow-hidden z-50">
                            {suggestions.map((s, i) => (
                                <button
                                    key={s.placeId || i}
                                    onClick={() => handleSelectSuggestion(s)}
                                    className="w-full px-3 py-2 flex items-start gap-2 hover:bg-[#262626] transition-colors text-left border-b border-[#262626] last:border-b-0"
                                >
                                    <MapPin className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                                    <div className="min-w-0">
                                        <div className="text-xs font-medium text-gray-200 truncate">{s.mainText}</div>
                                        <div className="text-[10px] text-gray-500 truncate">{s.secondaryText}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Right Controls */}
                <div className="flex gap-2 pointer-events-auto">
                    {/* Import Button */}
                    <div className="relative" ref={importMenuRef}>
                        <Button
                            variant="secondary"
                            size="icon-sm"
                            className="!bg-[#1f1f1f] border border-[#414141] shadow-lg hover:!bg-[#333333] !text-[#fafafa]"
                            onClick={() => setShowImportMenu(!showImportMenu)}
                            title="Import KML/KMZ"
                        >
                            {isProcessingImport ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        </Button>

                        {showImportMenu && (
                            <div className="absolute top-10 right-0 bg-[#1A1A1A] border border-[#414141] rounded-lg shadow-xl min-w-[320px] max-w-[360px] flex flex-col overflow-hidden">
                                <div className="bg-[#212121] px-3 py-2 text-[10px] font-medium text-gray-400 uppercase tracking-wider border-b border-[#414141]">
                                    Import Spatial Data
                                </div>
                                <div className="p-3">
                                    {importFiles.length === 0 ? (
                                        <div
                                            onDragOver={handleImportDragOver}
                                            onDragLeave={handleImportDragLeave}
                                            onDrop={handleImportDrop}
                                            onClick={() => importFileInputRef.current?.click()}
                                            className={cn(
                                                "border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 group",
                                                isDraggingImport
                                                    ? "border-gray-500 bg-[#262626]"
                                                    : "border-[#333] hover:border-[#444] hover:bg-[#1f1f1f]"
                                            )}
                                        >
                                            <input
                                                ref={importFileInputRef}
                                                type="file"
                                                accept=".kml,.kmz"
                                                multiple
                                                className="hidden"
                                                onChange={handleImportFileSelect}
                                            />
                                            <div className="w-10 h-10 rounded-full bg-[#262626] flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                                                <Upload className="w-4 h-4 text-gray-500 group-hover:text-gray-300" />
                                            </div>
                                            <p className="text-xs font-medium text-gray-400">Click to upload or drag & drop</p>
                                            <p className="text-[10px] text-gray-600 mt-1">.kml, .kmz (multiple files)</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] text-gray-500">
                                                    {importFiles.length} file{importFiles.length !== 1 ? 's' : ''} ({(importFiles.reduce((s, f) => s + f.size, 0) / 1024).toFixed(1)} KB)
                                                </span>
                                                <button
                                                    onClick={() => setImportFiles([])}
                                                    className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
                                                >
                                                    Clear
                                                </button>
                                            </div>
                                            <div className="max-h-[120px] overflow-y-auto space-y-1 custom-scrollbar">
                                                {importFiles.map((file, index) => (
                                                    <div
                                                        key={`${file.name}-${index}`}
                                                        className="bg-[#212121] rounded-md p-2 border border-[#333] flex items-center justify-between"
                                                    >
                                                        <div className="flex items-center gap-2 overflow-hidden">
                                                            <div className="w-6 h-6 rounded bg-[#262626] flex items-center justify-center flex-shrink-0">
                                                                <FileText className="w-3 h-3 text-gray-400" />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-[10px] font-medium text-gray-300 truncate">{file.name}</p>
                                                                <p className="text-[9px] text-gray-600">{(file.size / 1024).toFixed(1)} KB</p>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => removeImportFile(index)}
                                                            className="p-1 hover:bg-[#333] rounded-full transition-colors"
                                                        >
                                                            <X className="w-3 h-3 text-gray-500 hover:text-gray-300" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                            <button
                                                onClick={() => importFileInputRef.current?.click()}
                                                className="w-full py-1.5 text-[10px] text-gray-500 hover:text-gray-300 border border-[#333] hover:border-[#444] rounded-md transition-colors"
                                            >
                                                + Add more
                                            </button>
                                            <input
                                                ref={importFileInputRef}
                                                type="file"
                                                accept=".kml,.kmz"
                                                multiple
                                                className="hidden"
                                                onChange={handleImportFileSelect}
                                            />
                                        </div>
                                    )}

                                    <div className="mt-3 flex gap-2">
                                        <Button
                                            onClick={handleViewTemporarily}
                                            disabled={importFiles.length === 0 || isProcessingImport}
                                            variant="secondary"
                                            size="sm"
                                            className="flex-1 !bg-[#262626] hover:!bg-[#333] text-gray-300 !border-[#444] !h-8 !text-[10px]"
                                        >
                                            <Eye className="w-3 h-3 mr-1" />
                                            Temporary
                                        </Button>
                                        <Button
                                            onClick={handleSaveAndView}
                                            disabled={importFiles.length === 0 || isProcessingImport}
                                            size="sm"
                                            className="flex-1 !bg-[#333] hover:!bg-[#444] text-gray-200 !border-[#555] !h-8 !text-[10px]"
                                        >
                                            {isProcessingImport ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
                                            Save to Case
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* KML Browser Button */}
                    <div className="relative" ref={kmlMenuRef}>
                        <Button
                            variant="secondary"
                            size="icon-sm"
                            className="!bg-[#1f1f1f] border border-[#414141] shadow-lg hover:!bg-[#333333] !text-[#fafafa]"
                            onClick={() => setShowKmlMenu(!showKmlMenu)}
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
                                    {Object.entries(displayKmlFiles).length === 0 ? (
                                        <div className="text-xs text-gray-500 text-center py-6">No KML files found</div>
                                    ) : (
                                        Object.entries(displayKmlFiles)
                                            .sort(([a], [b]) => {
                                                if (a === 'Imported Files') return 1;
                                                if (b === 'Imported Files') return -1;
                                                return a.localeCompare(b);
                                            })
                                            .map(([groupName, files]) => (
                                                <div key={groupName} className="border-b border-[#262626] last:border-b-0">
                                                    <div className="bg-[#1f1f1f] px-3 py-1.5 text-[9px] font-bold text-gray-400/70 uppercase tracking-widest border-b border-[#262626]/50">
                                                        {(() => {
                                                            const match = groupName.match(/^(.+)\s\(\1\)$/);
                                                            return match ? match[1] : groupName;
                                                        })()}
                                                    </div>
                                                    <div className="divide-y divide-[#262626]/30">
                                                        {files.map((file) => {
                                                            const isSelected = selectedKmlsPaths.includes(file.url)
                                                            return (
                                                                <div
                                                                    key={file.url}
                                                                    className={cn(
                                                                        "flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors hover:bg-[#2a2a2a] group",
                                                                        isSelected && "bg-[#262626]"
                                                                    )}
                                                                    onClick={() => toggleKmlSelection(file)}
                                                                >
                                                                    <div className={cn(
                                                                        "w-3.5 h-3.5 border flex items-center justify-center transition-colors rounded flex-shrink-0",
                                                                        isSelected ? "bg-white border-white" : "border-gray-500 hover:border-gray-400"
                                                                    )}
                                                                        style={{ borderWidth: '0.5px' }}
                                                                    >
                                                                        {isSelected && <Check className="h-2.5 w-2.5 text-black" strokeWidth={4} />}
                                                                    </div>

                                                                    <div className="flex-1 min-w-0 flex items-center gap-2">
                                                                        <span className={cn(
                                                                            "text-xs truncate font-medium",
                                                                            isSelected ? "text-white" : "text-gray-300 hover:text-white"
                                                                        )} title={file.name}>{file.name}</span>

                                                                        {file.is_temporary && (
                                                                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#333] text-gray-400 border border-[#444] border-opacity-50">
                                                                                Temporary
                                                                            </span>
                                                                        )}
                                                                    </div>

                                                                    {file.is_deletable && (
                                                                        <button
                                                                            onClick={(e) => handleDeleteKml(e, file)}
                                                                            className="p-1 rounded hover:bg-neutral-700 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                            title={file.is_temporary ? "Remove from session" : "Delete file"}
                                                                        >
                                                                            <Trash2 className="w-3.5 h-3.5 text-red-400 hover:text-red-300" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )
                                                        })}
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

            {/* Bottom Left - Layer Switcher (Google Maps Style) */}
            <div ref={layerMenuRef} className="absolute bottom-6 left-4 z-[1000] pointer-events-auto">
                <div className="flex items-center gap-3">
                    {/* Current Layer Preview (Primary Toggle) */}
                    <button
                        onClick={() => setShowLayerMenu(!showLayerMenu)}
                        className="bg-[#1A1A1A]/90 border border-[#333] rounded-lg p-1.5 shadow-xl transition-all duration-200 hover:shadow-2xl"
                    >
                        <div className="rounded-md overflow-hidden" style={{ width: 52, height: 46 }}>
                            <LayerPreview type={currentLayer} size="lg" />
                        </div>
                        <span className="block text-[9px] font-medium text-white text-center mt-1">
                            {LAYER_OPTIONS.find(l => l.id === currentLayer)?.label}
                        </span>
                    </button>

                    {/* Expanded Layer Options (Ribbon) */}
                    <div className={cn(
                        "transition-all duration-200 overflow-hidden",
                        showLayerMenu ? "opacity-100 max-w-[250px]" : "opacity-0 max-w-0"
                    )}>
                        <div className="bg-[#1A1A1A]/90 border border-[#333] rounded-lg p-1.5 shadow-xl">
                            <div className="flex items-center gap-2">
                                {LAYER_OPTIONS.map((option) => (
                                    <button
                                        key={option.id}
                                        onClick={() => {
                                            onLayerChange(option.id)
                                            setShowLayerMenu(false)
                                        }}
                                        className={cn(
                                            "transition-all duration-150 hover:scale-105"
                                        )}
                                    >
                                        <div className="rounded-md overflow-hidden shadow-md" style={{ width: 50, height: 44 }}>
                                            <LayerPreview type={option.id} size="sm" />
                                        </div>
                                        <span className="block text-[8px] font-medium text-white text-center mt-1">{option.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <ConfirmDialog
                config={confirmConfig}
                onClose={hideConfirm}
                onConfirm={handleConfirm}
            />
        </>
    )
}
