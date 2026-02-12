
import { useEffect, useState, useRef, useCallback } from "react"
import { MapContainer, TileLayer, useMap, GeoJSON, useMapEvents } from "react-leaflet"
import "leaflet/dist/leaflet.css"
import L from "leaflet"
import MapControls from "./MapControls"
import type { Feature, GeoJsonObject } from 'geojson'
import { API } from "@/lib/api"
import { parseKmlText } from "@/lib/kmlUtils"
import { onEachFeature } from "@/lib/mapUtils"
import { useCase } from "@/context/CaseContext"
import { useSpatial } from "@/context/SpatialContext"

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

    // Keep a ref to browsedKmls to avoid dependency cycle in the effect
    const browsedKmlsRef = useRef(browsedKmls);
    useEffect(() => {
        browsedKmlsRef.current = browsedKmls;
    }, [browsedKmls]);

    // Fetch GeoJSON for selected KML paths
    useEffect(() => {
        if (!isStateLoaded) return;

        const loadKmlData = async (path: string) => {
            if (browsedKmlsRef.current[path]) return; // Already loaded

            try {
                const res = await fetch(API.path(`/spatial/kml-data?path=${encodeURIComponent(path)}`))
                if (res.ok) {
                    const text = await res.text()
                    const geojson = parseKmlText(text) as GeoJsonObject & { features: unknown[] }

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
    }, [selectedKmlsPaths, isStateLoaded]);

    const handleSearch = (lat: number, lon: number) => {
        setCenter([lat, lon])
        setZoom(16)
    }

    const [tileSession, setTileSession] = useState<{
        session: string; key: string; mapType: string
    } | null>(null)

    // Map app layer names to Google Maps Tile API session params
    const getSessionParams = useCallback((appLayer: string) => {
        switch (appLayer) {
            case 'satellite':
                return { mapType: 'satellite' }
            case 'hybrid':
                return { mapType: 'satellite', layerTypes: ['layerRoadmap'], overlay: false }
            case 'normal':
            default:
                return { mapType: 'roadmap' }
        }
    }, [])

    // Fetch a tile session whenever the layer changes
    useEffect(() => {
        let cancelled = false
        const fetchSession = async () => {
            try {
                const params = getSessionParams(layer)
                const res = await fetch(API.path('/spatial/tile-session'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(params),
                })
                if (res.ok && !cancelled) {
                    const data = await res.json()
                    setTileSession({ session: data.session, key: data.key, mapType: params.mapType })
                }
            } catch (err) {
                console.error('Failed to fetch tile session:', err)
            }
        }
        fetchSession()
        return () => { cancelled = true }
    }, [layer, getSessionParams])

    const getTileLayer = () => {
        if (!tileSession) return null

        const tileUrl = `https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?session=${tileSession.session}&key=${tileSession.key}`

        return (
            <TileLayer
                key={`google-${layer}-${tileSession.session}`}
                attribution='&copy; Google Maps'
                url={tileUrl}
                maxZoom={22}
            />
        )
    }



    return (
        <div className="relative h-full w-full bg-black">
            <MapControls
                onSearch={handleSearch}
                onLayerChange={setLayer}
                onDataUpload={setGeoJsonData}
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
                {Object.entries(browsedKmls).map(([url, data]) => (
                    <AutoFitBounds key={url} data={data} path={url} />
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
