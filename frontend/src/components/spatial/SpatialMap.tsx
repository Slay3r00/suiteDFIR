
import { useEffect, useState, useRef } from "react"
import { MapContainer, TileLayer, useMap, GeoJSON } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import L from "leaflet"
import MapControls from "./MapControls"
import type { Feature, GeoJsonObject } from 'geojson'
import { API } from "@/lib/api"

// Fix for default marker icons in Next.js
const iconUrl = 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png'
const iconRetinaUrl = 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png'
const shadowUrl = 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png'

const DefaultIcon = L.icon({
    iconUrl,
    iconRetinaUrl,
    shadowUrl,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    tooltipAnchor: [16, -28],
    shadowSize: [41, 41]
})

L.Marker.prototype.options.icon = DefaultIcon

// Component to handle map flying for external updates (like search)
function MapUpdater({ center, zoom }: { center: [number, number], zoom: number }) {
    const map = useMap()
    useEffect(() => {
        const currentCenter = map.getCenter()
        const currentZoom = map.getZoom()

        // Only fly if coordinates are significantly different (prevents loop during manual pan)
        const latDiff = Math.abs(currentCenter.lat - center[0])
        const lngDiff = Math.abs(currentCenter.lng - center[1])
        const zoomDiff = Math.abs(currentZoom - zoom)

        if (latDiff > 0.001 || lngDiff > 0.001 || zoomDiff > 0.5) {
            map.flyTo(center, zoom, { duration: 1.5 })
        }
    }, [center, zoom, map])
    return null
}

import { useMapEvents } from "react-leaflet"

// Component to track user movement and sync back to context
function ViewStateTracker({ onUpdate }: { onUpdate: (center: [number, number], zoom: number) => void }) {
    const map = useMapEvents({
        moveend: () => {
            const center = map.getCenter()
            onUpdate([center.lat, center.lng], map.getZoom())
        },
        zoomend: () => {
            const center = map.getCenter()
            onUpdate([center.lat, center.lng], map.getZoom())
        }
    })
    return null
}

// Component to fit bounds to GeoJSON data
function AutoFitBounds({ data, path }: { data: GeoJsonObject | null, path?: string }) {
    const map = useMap()
    const { fittedPaths, markPathFitted } = useSpatial()
    const lastDataRef = useRef<GeoJsonObject | null>(null)

    useEffect(() => {
        if (data && data !== lastDataRef.current) {
            // If path provided, check if it's already been fitted in this session/state load
            if (path && fittedPaths.has(path)) {
                lastDataRef.current = data;
                return;
            }

            const geoJsonLayer = L.geoJSON(data)
            if (geoJsonLayer.getLayers().length > 0) {
                map.flyToBounds(geoJsonLayer.getBounds(), { padding: [50, 50], duration: 1.5 })
                if (path) markPathFitted(path);
            }
            lastDataRef.current = data
        }
    }, [data, map, path, fittedPaths, markPathFitted])
    return null
}

import { useCase } from "@/context/CaseContext"
import { useSpatial } from "@/context/SpatialContext"

export default function SpatialMap() {
    const {
        center, setCenter,
        zoom, setZoom,
        layer, setLayer,
        selectedKmlsPaths, setSelectedKmlsPaths,
        geoJsonData, setGeoJsonData,
        isStateLoaded
    } = useSpatial()

    const [browsedKmls, setBrowsedKmls] = useState<Record<string, GeoJsonObject>>({})
    const { selectedCaseId } = useCase()

    // Fetch GeoJSON for selected KML paths
    useEffect(() => {
        if (!isStateLoaded) return;

        const loadKmlData = async (path: string) => {
            if (browsedKmls[path]) return; // Already loaded

            try {
                const res = await fetch(API.path(`/spatial/kml-data?path=${encodeURIComponent(path)}`))
                if (res.ok) {
                    const text = await res.text()
                    const parser = new DOMParser()
                    const kml = parser.parseFromString(text, 'text/xml')
                    const toGeoJSON = await import("@mapbox/togeojson")
                    const geojson = toGeoJSON.kml(kml) as GeoJsonObject & { features: unknown[] }

                    setBrowsedKmls(prev => ({
                        ...prev,
                        [path]: geojson
                    }))
                }
            } catch (error) {
                console.error("Failed to load KML:", error)
            }
        }

        // Load new selections
        selectedKmlsPaths.forEach(path => loadKmlData(path));

        // Cleanup unselected data to save memory
        setBrowsedKmls(prev => {
            const next = { ...prev };
            let changed = false;
            Object.keys(next).forEach(path => {
                if (!selectedKmlsPaths.includes(path)) {
                    delete next[path];
                    changed = true;
                }
            });
            return changed ? next : prev;
        });
    }, [selectedKmlsPaths, isStateLoaded, browsedKmls]);

    const handleSearch = (lat: number, lon: number) => {
        setCenter([lat, lon])
        setZoom(16)
    }

    const handleKmlSelect = (kmlUrl: string, selected: boolean) => {
        if (selected) {
            if (!selectedKmlsPaths.includes(kmlUrl)) {
                setSelectedKmlsPaths([...selectedKmlsPaths, kmlUrl]);
            }
        } else {
            setSelectedKmlsPaths(selectedKmlsPaths.filter(p => p !== kmlUrl));
        }
    }

    const getTileLayer = () => {
        switch (layer) {
            case 'satellite':
                return (
                    <TileLayer
                        key="satellite"
                        attribution='&copy; Google Maps'
                        url="https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
                        subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                        maxZoom={22}
                    />
                )
            case 'hybrid':
                return (
                    <TileLayer
                        key="hybrid"
                        attribution='&copy; Google Maps'
                        url="https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&scale=2"
                        subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                        maxZoom={22}
                    />
                )
            case 'normal':
            default:
                return (
                    <TileLayer
                        key="normal"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                        subdomains='abcd'
                        maxZoom={22}
                    />
                )
        }
    }

    function onEachFeature(feature: Feature, layer: L.Layer) {
        if (feature.properties) {
            let artifactName = feature.properties.name || 'Artifact'
            const description = feature.properties.description
            const metadata: Record<string, string> = {}
            const name = feature.properties.name

            // 1. Parse Description (Table or String)
            if (description) {
                const isTable = description.includes('<table') || description.includes('<tr')
                
                if (isTable) {
                    const parser = new DOMParser()
                    const doc = parser.parseFromString(description, 'text/html')
                    const rows = doc.querySelectorAll('tr')
                    
                    rows.forEach(row => {
                        const cells = row.querySelectorAll('td, th')
                        if (cells.length >= 2) {
                            const key = cells[0].textContent?.trim().replace(/:$/, '') || ''
                            let value = cells[1].textContent?.trim() || ''

                            if (key.toLowerCase() === 'artifact') {
                                artifactName = value
                            } else if (key && value) {
                                metadata[key] = value
                            }
                        }
                    })
                } else if (typeof description === 'string') {
                    // Handle raw strings (e.g., "Timestamp: Value - Source - Category")
                    // Split by common delimiters
                    const parts = description.split(/\s+-\s+/)
                    parts.forEach(part => {
                        if (part.includes(': ')) {
                            const [key, ...valParts] = part.split(': ')
                            metadata[key.trim()] = valParts.join(': ').trim()
                        } else if (!metadata['Description']) {
                            metadata['Info'] = part.trim()
                        }
                    })
                }
            }

            // 2. Discover all other properties (ExtendedData / SimpleData)
            Object.entries(feature.properties).forEach(([key, value]) => {
                // Skip internal/redundant keys
                const internalKeys = ['name', 'description', 'styleUrl', 'styleHash', 'styleMapHash', 'icon']
                if (internalKeys.includes(key)) return
                if (value === null || value === undefined || value === '') return

                // Beautify the key (e.g., "horizontal_accuracy" -> "Horizontal Accuracy")
                const cleanKey = key
                    .split(/[_-]/)
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ')

                // Avoid adding if we already captured it from description
                if (!metadata[cleanKey] && !metadata[key]) {
                    metadata[cleanKey] = String(value)
                }
            })

            // 3. Post-process Metadata (Dates and Redundancy)
            Object.keys(metadata).forEach(key => {
                let value = metadata[key]
                
                // Format dates for readability
                if (key.toLowerCase().includes('time') || key.toLowerCase().includes('date')) {
                    try {
                        const date = new Date(value)
                        if (!isNaN(date.getTime()) && value.length > 5) {
                            metadata[key] = date.toLocaleString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                                hour12: true
                            })
                        }
                    } catch { /* keep original */ }
                }

                // If a value is identical to the header name, it's redundant
                if (value === name && key.toLowerCase() !== 'timestamp') {
                    delete metadata[key]
                }
            })

            // 4. Build Popup Content
            const content = `
                <div class="p-3 min-w-[300px] max-w-[400px]">
                    <div class="mb-3 border-b border-gray-200 pb-2">
                        <h3 class="font-bold text-base text-gray-900">${artifactName}</h3>
                        ${name && name !== artifactName ? `<div class="text-sm text-gray-500 mt-1">${name}</div>` : ''}
                    </div>
                    <div class="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar">
                        ${Object.entries(metadata).length > 0 ? 
                            Object.entries(metadata).map(([key, value]) => `
                                <div class="flex flex-col gap-1">
                                    <span class="font-semibold text-xs text-gray-500 uppercase tracking-wide">${key}</span>
                                    <span class="text-sm text-gray-800 break-words whitespace-pre-wrap">${value}</span>
                                </div>
                            `).join('') :
                            `<div class="text-sm text-gray-400 italic">No additional metadata available</div>`
                        }
                    </div>
                </div>
            `
            layer.bindPopup(content, { className: 'custom-popup' })
        }
    }

    return (
        <div className="relative h-full w-full bg-black">
            <MapControls
                onSearch={handleSearch}
                onLayerChange={setLayer}
                onDataUpload={setGeoJsonData}
                onKmlSelect={handleKmlSelect}
                currentLayer={layer}
                selectedCaseId={selectedCaseId}
            />

            <MapContainer
                center={center}
                zoom={zoom}
                className="h-full w-full z-0"
                zoomControl={false}
                maxZoom={22}
            >
                <ViewStateTracker onUpdate={(c, z) => {
                    setCenter(c)
                    setZoom(z)
                }} />
                <MapUpdater center={center} zoom={zoom} />
                <AutoFitBounds data={geoJsonData} />
                {/* Auto-fit for browsed KMLs */}
                {Object.entries(browsedKmls).map(([url, data], i) => (
                    <AutoFitBounds key={`autofit-${i}`} data={data} path={url} />
                ))}

                {getTileLayer()}

                {/* Uploaded Data */}
                {geoJsonData && (
                    <GeoJSON
                        data={geoJsonData}
                        onEachFeature={onEachFeature}
                        style={() => ({
                            color: "#af52de", // Apple System Purple
                            weight: 3,
                            opacity: 0.8,
                            fillOpacity: 0.15
                        })}
                    />
                )}

                {/* Browsed KML Data */}
                {Object.entries(browsedKmls).map(([url, data]) => (
                    <GeoJSON
                        key={url}
                        data={data}
                        onEachFeature={onEachFeature}
                        style={() => ({
                            color: "#007aff", // Apple System Blue
                            weight: 3,
                            opacity: 0.8,
                            fillOpacity: 0.15
                        })}
                    />
                ))}
            </MapContainer>
        </div>
    )
}
