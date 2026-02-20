import type { GeoJsonObject } from "geojson"
import * as toGeoJSON from "@mapbox/togeojson"

/**
 * Parse a KML text string into a GeoJSON object.
 * Centralises the DOMParser + togeojson pattern used across the spatial components.
 */
export function parseKmlText(text: string): GeoJsonObject {
    const parser = new DOMParser()
    const kml = parser.parseFromString(text, "text/xml")
    return toGeoJSON.kml(kml) as GeoJsonObject
}
