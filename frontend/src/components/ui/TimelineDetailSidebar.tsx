import { useEffect, useRef } from "react"
import { X, Calendar, FileText, Database } from "lucide-react"
import { formatInTimeZone } from "date-fns-tz"
import { cn } from "@/lib/utils"

interface TimelineEvent {
    id: number
    date: string
    artifact: string
    description: string
    source: string
}

interface TimelineDetailSidebarProps {
    event: TimelineEvent | null
    isOpen: boolean
    onClose: () => void
    selectedTimezone?: string
}

/**
 * Parse forensic dates that may lack timezone info (assume UTC)
 */
const parseForensicDate = (val: string): Date => {
    if (!val) return new Date(NaN)

    let processedVal = val.trim()
    if (
        /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(processedVal) &&
        !/[a-zA-Z]/.test(processedVal.replace("T", "")) &&
        !/[+-]\d{2}:?\d{2}$/.test(processedVal) &&
        !processedVal.endsWith("Z")
    ) {
        processedVal += "+00:00"
    }

    return new Date(processedVal)
}

/**
 * Format a date string using the selected timezone
 */
const formatDate = (dateStr: string, timezone?: string): string => {
    if (!dateStr) return "—"

    const date = parseForensicDate(dateStr)
    if (isNaN(date.getTime())) return dateStr

    if (timezone) {
        try {
            return formatInTimeZone(date, timezone, "MMM d, yyyy h:mm:ss a zzz")
        } catch {
            return date.toLocaleString()
        }
    }
    return date.toLocaleString()
}

/**
 * Parse and render a field value with appropriate formatting
 */
const formatFieldValue = (value: unknown, timezone?: string): React.ReactNode => {
    if (value === null || value === undefined || value === "None" || value === "") {
        return <span className="text-muted-foreground italic">—</span>
    }

    if (typeof value === "boolean") {
        return (
            <span className={cn(
                "px-2 py-0.5 rounded-full text-xs font-medium",
                value ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
            )}>
                {value ? "Yes" : "No"}
            </span>
        )
    }

    if (typeof value === "number") {
        return <span className="font-mono">{value.toLocaleString()}</span>
    }

    if (typeof value === "string") {
        // Check if it looks like a date string
        if (value.length >= 8 && /[-/:]/.test(value)) {
            const date = parseForensicDate(value)
            if (!isNaN(date.getTime())) {
                return formatDate(value, timezone)
            }
        }
        return value
    }

    // For objects/arrays, stringify nicely
    if (typeof value === "object") {
        return (
            <pre className="text-xs bg-white/5 rounded p-2 overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(value, null, 2)}
            </pre>
        )
    }

    return String(value)
}

/**
 * Parse description JSON and return structured fields
 */
const parseDescription = (description: string): Record<string, unknown> | null => {
    if (!description) return null

    try {
        const parsed = JSON.parse(description)
        if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
            return parsed as Record<string, unknown>
        }
        return null
    } catch {
        return null
    }
}

export function TimelineDetailSidebar({
    event,
    isOpen,
    onClose,
    selectedTimezone,
}: TimelineDetailSidebarProps) {
    const sidebarRef = useRef<HTMLDivElement>(null)

    // Handle Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isOpen) {
                onClose()
            }
        }
        document.addEventListener("keydown", handleKeyDown)
        return () => document.removeEventListener("keydown", handleKeyDown)
    }, [isOpen, onClose])

    // Handle click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
                const target = e.target as HTMLElement

                // Allow row switching
                if (target.closest("tr[data-row-id]")) {
                    return
                }

                // Allow clicks on specifically marked elements (e.g., density toggle)
                if (target.closest('[data-sidebar-ignore="true"]')) {
                    return
                }

                onClose()
            }
        }

        if (isOpen) {
            // Delay adding listener to prevent immediate close on open click
            const timer = setTimeout(() => {
                document.addEventListener("mousedown", handleClickOutside)
            }, 100)
            return () => {
                clearTimeout(timer)
                document.removeEventListener("mousedown", handleClickOutside)
            }
        }
    }, [isOpen, onClose])

    if (!event) return null

    const parsedDescription = parseDescription(event.description)
    const descriptionFields = parsedDescription
        ? Object.entries(parsedDescription).filter(
            ([, v]) => v !== null && v !== undefined && v !== "None" && v !== ""
        )
        : null

    return (
        <div
            ref={sidebarRef}
            className={cn(
                "absolute top-0 right-0 h-full w-[400px] bg-[#1A1A1A] border-l border-white/10 z-30",
                "flex flex-col shadow-2xl",
                !isOpen && "hidden"
            )}
        >
            {/* Header */}
            <div className="flex items-center justify-between p-4 pb-0 bg-transparent">
                <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-semibold text-white truncate">
                        {event.artifact}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Event #{event.id}
                    </p>
                </div>
                <button
                    onClick={onClose}
                    className="p-1.5 rounded-md hover:bg-white/10 transition-colors text-muted-foreground hover:text-white"
                    aria-label="Close sidebar"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            {/* Header Divider */}
            <div className="border-t border-white/5 mx-4 mt-4" />

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
                {/* Event Info Section */}
                <section>
                    <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">
                        Event Information
                    </h3>
                    <div className="space-y-3">
                        {/* Date */}
                        <div className="flex items-start gap-3">
                            <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">
                                    Date
                                </p>
                                <p className="text-sm text-foreground">
                                    {formatDate(event.date, selectedTimezone)}
                                </p>
                            </div>
                        </div>

                        {/* Source */}
                        <div className="flex items-start gap-3">
                            <Database className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">
                                    Source
                                </p>
                                <p className="text-sm text-foreground break-all">
                                    {event.source || "—"}
                                </p>
                            </div>
                        </div>

                        {/* Artifact */}
                        <div className="flex items-start gap-3">
                            <FileText className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">
                                    Artifact
                                </p>
                                <p className="text-sm text-foreground">
                                    {event.artifact || "—"}
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Divider */}
                <div className="border-t border-white/5" />

                {/* Details Section */}
                <section>
                    <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">
                        Details
                    </h3>

                    {descriptionFields && descriptionFields.length > 0 ? (
                        <div className="space-y-4">
                            {descriptionFields.map(([key, value]) => (
                                <div key={key} className="space-y-1">
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                                        {key}
                                    </p>
                                    <div className="text-sm text-foreground break-words">
                                        {formatFieldValue(value, selectedTimezone)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : event.description ? (
                        // Raw description if not valid JSON
                        <div className="space-y-1">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                                Raw Data
                            </p>
                            <pre className="text-xs text-foreground bg-white/5 rounded p-3 overflow-x-auto whitespace-pre-wrap break-all">
                                {event.description}
                            </pre>
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground italic">
                            No details available
                        </p>
                    )}
                </section>
            </div>
        </div>
    )
}

export default TimelineDetailSidebar
