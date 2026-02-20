import L from "leaflet"
import type { Feature } from 'geojson'

/**
 * Attaches a popup with formatted metadata to each feature on the map.
 * This function parses descriptions (tables/strings) and other properties to create a rich popup.
 */
export function onEachFeature(feature: Feature, layer: L.Layer) {
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
