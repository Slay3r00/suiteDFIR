"use client"

import { useEffect, useState } from "react"
import { MapContainer, TileLayer, useMap, GeoJSON } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import L from "leaflet"
import MapControls from "./MapControls"
import type { Feature, GeoJsonObject } from 'geojson'

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

// Component to handle map flying
function MapUpdater({ center, zoom }: { center: [number, number], zoom: number }) {
    const map = useMap()
    useEffect(() => {
        map.flyTo(center, zoom, { duration: 1.5 })
    }, [center, zoom, map])
    return null
}

// Component to fit bounds to GeoJSON data

function AutoFitBounds({ data }: { data: GeoJsonObject | null }) {
    const map = useMap()
    useEffect(() => {
        if (data) {
            // @ts-expect-error: Leaflet types mismatch
            const geoJsonLayer = L.geoJSON(data)
            if (geoJsonLayer.getLayers().length > 0) {
                map.flyToBounds(geoJsonLayer.getBounds(), { padding: [50, 50], duration: 1.5 })
            }
        }
    }, [data, map])
    return null
}

import { useCase } from "@/context/CaseContext"

export default function SpatialMap() {
    const [center, setCenter] = useState<[number, number]>([40.7128, -74.0060]) // NYC default
    const [zoom, setZoom] = useState(13)
    const [layer, setLayer] = useState<'normal' | 'satellite' | 'hybrid'>('normal')
    const [geoJsonData, setGeoJsonData] = useState<GeoJsonObject | null>(null)
    const [browsedKmls, setBrowsedKmls] = useState<Record<string, GeoJsonObject>>({})
    const { selectedCaseId } = useCase()

    const handleSearch = (lat: number, lon: number) => {
        setCenter([lat, lon])
        setZoom(16)
    }

    const handleKmlSelect = async (kmlUrl: string, selected: boolean) => {
        if (!selected) {
            const newKmls = { ...browsedKmls }
            delete newKmls[kmlUrl]
            setBrowsedKmls(newKmls)
            return
        }

        try {
            // Fetch enriched KML data from backend
            const res = await fetch(`http://localhost:8000/api/spatial/kml-data?path=${encodeURIComponent(kmlUrl)}`)
            if (res.ok) {
                const text = await res.text()
                const parser = new DOMParser()
                const kml = parser.parseFromString(text, 'text/xml')
                // @ts-expect-error: External library types mismatch
                const toGeoJSON = await import("@mapbox/togeojson")
                const geojson = toGeoJSON.kml(kml)

                if (geojson.features.length === 0) {
                    console.warn('No features found in KML')
                }

                // Add to map
                setBrowsedKmls(prev => ({
                    ...prev,
                    [kmlUrl]: geojson
                }))
            } else {
                console.error('Failed to fetch KML:', res.status, res.statusText)
            }
        } catch (error) {
            console.error("Failed to load KML:", error)
        }
    }

    const getTileLayer = () => {
        switch (layer) {
            case 'satellite':
                return (
                    // @ts-expect-error: External library types mismatch
                    <TileLayer
                        attribution='&copy; Google Maps'
                        url="https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
                        subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                    />
                )
            case 'hybrid':
                return (
                    <>
                        {/* @ts-expect-error: External library types mismatch */}
                        <TileLayer
                            attribution='&copy; Google Maps'
                            url="https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
                            subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                            opacity={0.5}
                        />
                        {/* @ts-expect-error: External library types mismatch */}
                        <TileLayer
                            attribution='&copy; Google Maps'
                            url="https://{s}.google.com/vt/lyrs=h&x={x}&y={y}&z={z}"
                            subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                        />
                    </>
                )
            case 'normal':
            default:
                return (
                    // @ts-expect-error: External library types mismatch
                    <TileLayer
                        attribution='&copy; Google Maps'
                        url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                        subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                    />
                )
        }
    }

    function onEachFeature(feature: Feature, layer: L.Layer) {
        if (feature.properties) {
            let content = ''
            let artifactName = feature.properties.name || 'Artifact'
            const description = feature.properties.description

            const metadata: Record<string, string> = {}
            const name = feature.properties.name
            // Parse description HTML if available
            if (description) {
                const parser = new DOMParser()
                const doc = parser.parseFromString(description, 'text/html')

                // Extract Artifact Name (usually in a header or specific row)
                // Common pattern in LEAPP tools: Table with "Artifact" row
                const rows = doc.querySelectorAll('tr')
                rows.forEach(row => {
                    const cells = row.querySelectorAll('td, th')
                    if (cells.length >= 2) {
                        const key = cells[0].textContent?.trim().replace(/:$/, '') || ''
                        let value = cells[1].textContent?.trim() || ''

                        if (key.toLowerCase() === 'artifact') {
                            artifactName = value
                        } else if (key && value) {
                            // Format dates
                            if (key.toLowerCase().includes('time') || key.toLowerCase().includes('date')) {
                                try {
                                    const date = new Date(value)
                                    if (!isNaN(date.getTime())) {
                                        value = date.toLocaleString(undefined, {
                                            year: 'numeric',
                                            month: 'short',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                            second: '2-digit',
                                            hour12: true
                                        })
                                    }
                                } catch {
                                    // Keep original value if parsing fails
                                }
                            }
                            metadata[key] = value
                        }
                    }
                })
            } else {
                // Fallback to properties if no description HTML
                Object.entries(feature.properties).forEach(([key, value]) => {
                    if (key !== 'name' && key !== 'description' && key !== 'styleUrl' && key !== 'styleHash') {
                        metadata[key] = String(value)
                    }
                })
            }

            // Build Popup Content
            content = `
                <div class="p-3 min-w-[300px] max-w-[400px]">
                    <div class="mb-3 border-b border-gray-200 pb-2">
                        <h3 class="font-bold text-base text-gray-900">${artifactName}</h3>
                        ${name && name !== artifactName ? `<div class="text-sm text-gray-500 mt-1">${name}</div>` : ''}
                    </div>
                    <div class="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar">
                        ${Object.entries(metadata).map(([key, value]) => `
                            <div class="flex flex-col gap-1">
                                <span class="font-semibold text-xs text-gray-500 uppercase tracking-wide">${key}</span>
                                <span class="text-sm text-gray-800 break-words whitespace-pre-wrap">${value}</span>
                            </div>
                        `).join('')}
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

            {/* @ts-expect-error: External library types mismatch */}
            <MapContainer
                center={center}
                zoom={zoom}
                className="h-full w-full z-0"
                zoomControl={false}
            >
                <MapUpdater center={center} zoom={zoom} />
                <AutoFitBounds data={geoJsonData} />
                {/* Auto-fit for browsed KMLs */}
                {Object.values(browsedKmls).map((data, i) => (
                    <AutoFitBounds key={`autofit-${i}`} data={data} />
                ))}

                {getTileLayer()}

                {/* Uploaded Data */}
                {geoJsonData && (
                    /* @ts-expect-error: External library types mismatch */
                    <GeoJSON
                        data={geoJsonData}
                        onEachFeature={onEachFeature}
                        style={() => ({
                            color: "#a855f7", // Purple
                            weight: 2,
                            opacity: 1,
                            fillOpacity: 0.2
                        })}
                    />
                )}

                {/* Browsed KML Data */}
                {Object.entries(browsedKmls).map(([url, data]) => (
                    /* @ts-expect-error: External library types mismatch */
                    <GeoJSON
                        key={url}
                        data={data}
                        onEachFeature={onEachFeature}
                        style={() => ({
                            color: "#3b82f6", // Blue for browsed items
                            weight: 2,
                            opacity: 1,
                            fillOpacity: 0.2
                        })}
                    />
                ))}
            </MapContainer>
        </div>
    )
}
