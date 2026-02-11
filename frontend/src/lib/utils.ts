import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import React from "react"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

/**
 * Highlights matching text within a string by wrapping matches in styled spans.
 * Returns React elements with greyscale highlighting.
 */
export function highlightText(
    text: string,
    searchTerms: string[]
): React.ReactNode {
    if (!text || !searchTerms.length) return text

    // Filter out empty terms and escape regex special characters
    const validTerms = searchTerms
        .filter(term => term && term.trim().length > 0)
        .map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))

    if (!validTerms.length) return text

    // Create a regex that matches any of the search terms (case insensitive)
    const pattern = new RegExp(`(${validTerms.join('|')})`, 'gi')
    const parts = text.split(pattern)

    if (parts.length === 1) return text

    return parts.map((part, index) => {
        // Check if this part matches any search term
        const isMatch = validTerms.some(term =>
            part.toLowerCase() === term.toLowerCase()
        )

        if (isMatch) {
            return React.createElement('span', {
                key: index,
                className: 'bg-white/30 text-white font-medium px-0.5'
            }, part)
        }
        return part
    })
}
