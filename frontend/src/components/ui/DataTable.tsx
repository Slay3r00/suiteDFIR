import { useState, useEffect, useMemo, useRef } from "react"
import {
    useReactTable,
    getCoreRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    flexRender,
    type ColumnDef,
    type PaginationState,
    type SortingState,
    type ColumnFiltersState,
    type Updater,
    type RowSelectionState,
} from "@tanstack/react-table"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "./table"
import { DataTablePagination } from "./DataTablePagination"
import { DataTableToolbar } from "./DataTableToolbar"
import { Checkbox } from "./Checkbox"
import { Button } from "./Button"
import { Input } from "./Input"
import { ArrowUp, ArrowDown, ArrowUpDown, Filter, X } from "lucide-react"
import { formatInTimeZone } from "date-fns-tz"
import { mkConfig, generateCsv, download } from "export-to-csv"
import { cn, highlightText } from "@/lib/utils"
import { type Column } from "@tanstack/react-table"
import { TimelineDetailSidebar } from "./TimelineDetailSidebar"

// Re-export the density type for compatibility
export type MRT_DensityState = "compact" | "comfortable"

/**
 * Column Filter Header Component
 * Displays a filter icon that opens a popover input on click
 */
function ColumnFilterHeader<TData>({
    column,
    title,
    align = "left",
}: {
    column: Column<TData, unknown>
    title: React.ReactNode | string
    align?: "left" | "right"
}) {
    const [isOpen, setIsOpen] = useState(false)
    const [localValue, setLocalValue] = useState((column.getFilterValue() as string) ?? "")
    const filterValue = column.getFilterValue() as string
    const hasFilter = !!filterValue && filterValue.length > 0
    const inputRef = useRef<HTMLInputElement>(null)
    const popoverRef = useRef<HTMLDivElement>(null)

    // Focus input when popover opens
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus()
        }
    }, [isOpen])

    // Close popover when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                setIsOpen(false)
            }
        }
        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside)
            return () => document.removeEventListener("mousedown", handleClickOutside)
        }
    }, [isOpen])

    // Debounced filter update
    useEffect(() => {
        const timer = setTimeout(() => {
            column.setFilterValue(localValue || undefined)
        }, 300)
        return () => clearTimeout(timer)
    }, [localValue, column])

    // Sync local value with column filter value
    useEffect(() => {
        setLocalValue((column.getFilterValue() as string) ?? "")
    }, [column])

    return (
        <div className="flex items-center gap-1">
            <span>{title}</span>
            <div className="relative" ref={popoverRef}>
                <button
                    onClick={(e) => {
                        e.stopPropagation()
                        setIsOpen(!isOpen)
                    }}
                    className={cn(
                        "p-0.5 rounded hover:bg-white/10 transition-colors",
                        hasFilter ? "text-white" : "text-white/40 hover:text-white/70"
                    )}
                    aria-label={`Filter ${title}`}
                >
                    <Filter className={cn(
                        "h-3.5 w-3.5 transition-colors",
                        hasFilter && "fill-white"
                    )} />
                </button>
                {isOpen && (
                    <div className={cn(
                        "absolute z-50 top-full mt-1 p-2 bg-[#2b2b2b] border border-white/10 rounded-md shadow-lg min-w-[180px]",
                        align === "right" ? "right-0" : "left-0"
                    )}>
                        <div className="flex items-center gap-1">
                            <Input
                                ref={inputRef}
                                value={localValue}
                                onChange={(e) => setLocalValue(e.target.value)}
                                placeholder={`Filter ${title}...`}
                                className="h-7 text-xs bg-[#2b2b2b] border-white/10 focus:ring-0"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") setIsOpen(false)
                                    if (e.key === "Escape") {
                                        setLocalValue("")
                                        setIsOpen(false)
                                    }
                                }}
                            />
                            {localValue && (
                                <button
                                    onClick={() => {
                                        setLocalValue("")
                                        column.setFilterValue(undefined)
                                    }}
                                    className="p-1 text-white/50 hover:text-white transition-colors"
                                    aria-label="Clear filter"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export interface TimelineEvent {
    id: number
    date: string
    artifact: string
    description: string
    source: string
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

const csvConfig = mkConfig({
    fieldSeparator: ",",
    decimalSeparator: ".",
    useKeysAsHeaders: true,
})

interface DataTableProps {
    rows: TimelineEvent[]
    isLoading?: boolean
    totalCount?: number
    pagination?: PaginationState
    sorting?: SortingState
    onPaginationChange?: (updaterOrValue: Updater<PaginationState>) => void
    onSortingChange?: (updaterOrValue: Updater<SortingState>) => void
    globalFilter?: string
    onGlobalFilterChange?: (globalFilter: string) => void
    columnFilters?: ColumnFiltersState
    onColumnFiltersChange?: (updaterOrValue: Updater<ColumnFiltersState>) => void
    onExportAll?: () => Promise<TimelineEvent[]>
    selectedTimezone?: string
    density?: MRT_DensityState
    onDensityChange?: (updaterOrValue: Updater<MRT_DensityState>) => void
    scrollPosition?: number
    onScroll?: (pos: number) => void
    renderLeftToolbar?: () => React.ReactNode
    renderRightToolbar?: () => React.ReactNode
    // Sidebar props
    selectedEvent?: TimelineEvent | null
    onRowClick?: (event: TimelineEvent) => void
    onCloseSidebar?: () => void
}

export function DataTable({
    rows,
    isLoading,
    totalCount,
    pagination = { pageIndex: 0, pageSize: 25 },
    sorting = [],
    onPaginationChange,
    onSortingChange,
    globalFilter = "",
    onGlobalFilterChange,
    columnFilters = [],
    onColumnFiltersChange,
    onExportAll,
    selectedTimezone,
    density = "compact",
    onDensityChange,
    scrollPosition,
    onScroll,
    renderLeftToolbar,
    renderRightToolbar,
    selectedEvent,
    onRowClick,
    onCloseSidebar,
}: DataTableProps) {
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
    const tableContainerRef = useRef<HTMLDivElement>(null)
    const hasRestoredScroll = useRef(false)
    const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    // Build search terms array for highlighting - use ref to avoid column recreation
    const searchTermsRef = useRef<string[]>([])
    const searchTerms = useMemo(() => {
        const terms: string[] = []
        if (globalFilter) terms.push(globalFilter)
        columnFilters.forEach(f => {
            if (f.value && typeof f.value === 'string') terms.push(f.value)
        })
        return terms
    }, [globalFilter, columnFilters])

    // Update ref whenever searchTerms changes - the ref is read by cell renderers
    searchTermsRef.current = searchTerms

    // Build columns with timezone-aware date formatting
    const columns = useMemo<ColumnDef<TimelineEvent>[]>(
        () => [
            {
                id: "select",
                header: ({ table }) => (
                    <Checkbox
                        checked={
                            table.getIsAllPageRowsSelected() ||
                            (table.getIsSomePageRowsSelected() && "indeterminate")
                        }
                        onCheckedChange={(value: boolean) => table.toggleAllPageRowsSelected(value)}
                        aria-label="Select all"
                        className="translate-y-[2px]"
                    />
                ),
                cell: ({ row }) => (
                    <Checkbox
                        checked={row.getIsSelected()}
                        onCheckedChange={(value: boolean) => row.toggleSelected(value)}
                        aria-label="Select row"
                        className="translate-y-[2px]"
                    />
                ),
                enableSorting: false,
                enableHiding: false,
                size: 40,
            },
            {
                accessorKey: "id",
                header: "ID",
                size: 60,
                enableSorting: false,
            },
            {
                accessorKey: "date",
                header: ({ column }) => (
                    <ColumnFilterHeader
                        column={column}
                        title={
                            <button
                                className="flex items-center gap-1 hover:text-white transition-colors"
                                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                            >
                                Date
                                {column.getIsSorted() === "asc" ? (
                                    <ArrowUp className="h-4 w-4" />
                                ) : column.getIsSorted() === "desc" ? (
                                    <ArrowDown className="h-4 w-4" />
                                ) : (
                                    <ArrowUpDown className="h-4 w-4 opacity-50" />
                                )}
                            </button>
                        }
                    />
                ),
                cell: ({ cell }) => {
                    const val = cell.getValue<string>()
                    if (!val) return ""

                    const date = parseForensicDate(val)
                    if (isNaN(date.getTime())) return highlightText(val, searchTermsRef.current)

                    let formatted: string
                    if (selectedTimezone) {
                        try {
                            formatted = formatInTimeZone(date, selectedTimezone, "MMM d, yyyy h:mm:ss a zzz")
                        } catch {
                            formatted = date.toLocaleString()
                        }
                    } else {
                        formatted = date.toLocaleString()
                    }
                    return highlightText(formatted, searchTermsRef.current)
                },
                size: 220,
            },
            {
                accessorKey: "artifact",
                header: ({ column }) => <ColumnFilterHeader column={column} title="Artifact" />,
                size: 150,
                enableSorting: false,
                cell: ({ cell }) => {
                    const val = cell.getValue<string>()
                    return val ? highlightText(val, searchTermsRef.current) : ""
                },
            },
            {
                accessorKey: "description",
                header: ({ column }) => <ColumnFilterHeader column={column} title="Description" />,
                size: 400,
                enableSorting: false,
                cell: ({ cell }) => {
                    const val = cell.getValue<string>()
                    if (!val) return ""

                    let data: Record<string, unknown>
                    try {
                        data = JSON.parse(val)
                    } catch {
                        return val
                    }

                    if (typeof data !== "object" || data === null) return val

                    const formatValue = (v: unknown) => {
                        if (typeof v === "string" && v.length >= 8) {
                            if (v === "None" || v === "") return v

                            if (/[-/:]/.test(v) || /^[0-9]+ [A-Za-z]+ [0-9]+/.test(v)) {
                                const date = parseForensicDate(v)
                                if (!isNaN(date.getTime())) {
                                    if (selectedTimezone) {
                                        try {
                                            return formatInTimeZone(
                                                date,
                                                selectedTimezone,
                                                "MMM d, yyyy h:mm:ss a zzz"
                                            )
                                        } catch {
                                            return date.toLocaleString()
                                        }
                                    }
                                    return date.toLocaleString()
                                }
                            }
                        }
                        return String(v)
                    }

                    const entries = Object.entries(data).filter(
                        ([, v]) => v !== null && v !== "None" && v !== ""
                    )

                    return (
                        <div className="text-sm leading-relaxed">
                            {entries.map(([k, v], i) => (
                                <span key={k}>
                                    <span className="font-semibold text-muted-foreground mr-1">
                                        {k}:
                                    </span>
                                    <span className="text-foreground">{highlightText(formatValue(v), searchTermsRef.current)}</span>
                                    {i < entries.length - 1 ? ", " : ""}
                                </span>
                            ))}
                        </div>
                    )
                },
            },
            {
                accessorKey: "source",
                header: ({ column }) => <ColumnFilterHeader column={column} title="Source" align="right" />,
                enableSorting: false,
                size: 120,
                cell: ({ cell }) => {
                    const val = cell.getValue<string>()
                    return val ? highlightText(val, searchTermsRef.current) : ""
                },
            },
        ],
        [selectedTimezone]
    )

    const table = useReactTable({
        data: rows,
        columns,
        pageCount: Math.ceil((totalCount ?? 0) / pagination.pageSize),
        state: {
            pagination,
            sorting,
            columnFilters,
            rowSelection,
        },
        enableRowSelection: true,
        onRowSelectionChange: setRowSelection,
        onPaginationChange,
        onSortingChange,
        onColumnFiltersChange,
        manualPagination: true,
        manualSorting: true,
        manualFiltering: true,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
    })

    const handleExportPage = () => {
        const rowData = table.getRowModel().rows.map((row) => row.original)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const csv = generateCsv(csvConfig)(rowData as any)
        download(csvConfig)(csv)
    }

    const handleExportSelected = () => {
        const rowData = table.getFilteredSelectedRowModel().rows.map((row) => row.original)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const csv = generateCsv(csvConfig)(rowData as any)
        download(csvConfig)(csv)
    }

    const handleExportAll = async () => {
        if (onExportAll) {
            const allData = await onExportAll()
            if (allData && allData.length > 0) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const csv = generateCsv(csvConfig)(allData as any)
                download(csvConfig)(csv)
            }
        }
    }

    // Scroll persistence
    useEffect(() => {
        const container = tableContainerRef.current
        if (!container) return

        const handleScroll = () => {
            if (scrollTimeoutRef.current) return
            scrollTimeoutRef.current = setTimeout(() => {
                onScroll?.(container.scrollTop)
                scrollTimeoutRef.current = null
            }, 100)
        }

        container.addEventListener("scroll", handleScroll, { passive: true })

        // Restore scroll position once when data loads
        if (!isLoading && rows.length > 0 && !hasRestoredScroll.current) {
            if (scrollPosition !== undefined && scrollPosition > 0) {
                setTimeout(() => {
                    container.scrollTo({ top: scrollPosition })
                    hasRestoredScroll.current = true
                }, 100)
            } else {
                hasRestoredScroll.current = true
            }
        }

        return () => {
            container.removeEventListener("scroll", handleScroll)
            if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current)
        }
    }, [isLoading, rows.length, scrollPosition, onScroll])

    // Density-based styling - matching MRT behavior
    const densityStyles = useMemo(() => {
        switch (density) {
            case "compact":
                return {
                    rowClass: "h-[37px]",
                    cellClass: "py-1 px-3 whitespace-nowrap", // Single line, no truncation
                    fontSize: "text-xs",
                }
            case "comfortable":
                return {
                    rowClass: "min-h-[53px]",
                    cellClass: "py-2 px-3", // Wraps naturally
                    fontSize: "text-sm",
                }
            default:
                return {
                    rowClass: "h-[37px]",
                    cellClass: "py-1 px-3 whitespace-nowrap",
                    fontSize: "text-xs",
                }
        }
    }, [density])

    return (
        <div className="flex flex-col h-full bg-[#1A1A1A]">
            {/* Toolbar */}
            <DataTableToolbar
                table={table}
                globalFilter={globalFilter}
                onGlobalFilterChange={onGlobalFilterChange ?? (() => { })}
                onExportAll={handleExportAll}
                onExportPage={handleExportPage}
                onExportSelected={handleExportSelected}
                density={density}
                onDensityChange={(newDensity) => {
                    if (onDensityChange) {
                        onDensityChange(newDensity)
                    }
                }}
                renderLeftToolbar={renderLeftToolbar}
                renderRightToolbar={renderRightToolbar}
            />

            {/* Table container with scroll and sidebar */}
            <div className="flex-1 min-h-0 relative overflow-hidden">
                <div
                    ref={tableContainerRef}
                    className={cn(
                        "h-full overflow-auto custom-scrollbar",
                        selectedEvent ? "pr-[400px]" : ""
                    )}
                >
                    <Table style={{ tableLayout: density === "compact" ? "auto" : "fixed" }}>
                        <TableHeader className="bg-[#212121] z-20">
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id} className="border-none hover:bg-transparent">
                                    {headerGroup.headers.map((header) => (
                                        <TableHead
                                            key={header.id}
                                            style={{ width: density === "compact" ? "auto" : header.getSize() }}
                                            className="bg-[#212121] text-white border-b border-white/10 sticky top-0 z-20 focus-within:z-30 shadow-[0_1px_0_rgba(255,255,255,0.1)] whitespace-nowrap"
                                        >
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody key={searchTerms.join('|')}>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={columns.length}
                                        className="h-24 text-center text-muted-foreground"
                                    >
                                        Loading...
                                    </TableCell>
                                </TableRow>
                            ) : table.getRowModel().rows?.length ? (
                                table.getRowModel().rows.map((row) => (
                                    <TableRow
                                        key={row.id}
                                        data-row-id={row.original.id}
                                        data-state={row.getIsSelected() && "selected"}
                                        onClick={() => onRowClick?.(row.original)}
                                        className={cn(
                                            "bg-[#1A1A1A] transition-all cursor-pointer",
                                            densityStyles.rowClass,
                                            selectedEvent?.id === row.original.id && "bg-white/5",
                                            "hover:bg-white/[0.03]"
                                        )}
                                    >
                                        {row.getVisibleCells().map((cell) => (
                                            <TableCell
                                                key={cell.id}
                                                style={{ width: density === "compact" ? "auto" : cell.column.getSize() }}
                                                className={cn(densityStyles.cellClass, densityStyles.fontSize)}
                                            >
                                                {flexRender(
                                                    cell.column.columnDef.cell,
                                                    cell.getContext()
                                                )}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell
                                        colSpan={columns.length}
                                        className="h-24 text-center text-muted-foreground"
                                    >
                                        No results.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Detail Sidebar */}
                <TimelineDetailSidebar
                    event={selectedEvent ?? null}
                    isOpen={!!selectedEvent}
                    onClose={() => onCloseSidebar?.()}
                    selectedTimezone={selectedTimezone}
                />
            </div>

            {/* Pagination */}
            <DataTablePagination table={table} totalCount={totalCount} />
        </div>
    )
}

export default DataTable
