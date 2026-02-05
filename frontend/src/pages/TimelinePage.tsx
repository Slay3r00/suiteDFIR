import { useState, useEffect, useMemo, useRef } from "react"
import { DataTable, TimelineEvent } from "@/components/ui/DataTable"
import { useCase } from "@/context/CaseContext"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/Select"
import { Input } from "@/components/ui/Input"
import { useTimeline } from "@/context/TimelineContext"
import { API } from "@/lib/api"
import { LoadingPage } from "@/components/ui/LoadingPage"

interface Report {
    id: number
    name: string
    path: string
    tool: string
    created_at: string
}

export default function Timeline() {
    const { selectedCaseId } = useCase()
    const { config, updateConfig, isLoaded } = useTimeline()

    const {
        selectedReportId: selectedReport,
        selectedTimezone,
        pagination,
        sorting,
        globalFilter,
        columnFilters
    } = config

    const [data, setData] = useState<TimelineEvent[]>([])
    const [totalCount, setTotalCount] = useState(0)
    const [isLoading, setIsLoading] = useState(false)
    const [reports, setReports] = useState<Report[]>([])
    const [tzSearch, setTzSearch] = useState("")
    const [openDropdown, setOpenDropdown] = useState<'report' | 'timezone' | null>(null)
    const hasInitiallyLoaded = useRef(false)

    const timezonesWithOffsets = useMemo(() => {
        let tzs: string[] = [];
        try {
            tzs = (Intl as any).supportedValuesOf('timeZone') as string[];
        } catch (e) {
            tzs = ["UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Europe/London", "Asia/Tokyo"];
        }

        // Ensure UTC is included and at the top for quick access
        if (!tzs.includes("UTC")) {
            tzs = ["UTC", ...tzs];
        } else {
            tzs = ["UTC", ...tzs.filter(t => t !== "UTC")];
        }

        return tzs.map(tz => {
            try {
                const parts = new Intl.DateTimeFormat('en-US', {
                    timeZone: tz,
                    timeZoneName: 'shortOffset'
                }).formatToParts(new Date());
                const offset = parts.find(p => p.type === 'timeZoneName')?.value || 'GMT+0';

                // Format GMT to UTC for display consistency
                const displayOffset = offset === 'GMT' ? 'UTC+0' : offset.replace('GMT', 'UTC');

                // Extract minutes for sorting
                const m = displayOffset.match(/([+-])(\d+):?(\d+)?/);
                let offsetValue = 0;
                if (m) {
                    const mins = parseInt(m[2]) * 60 + (m[3] ? parseInt(m[3]) : 0);
                    offsetValue = m[1] === '+' ? mins : -mins;
                }

                return {
                    id: tz,
                    offset: displayOffset,
                    label: `${tz} (${displayOffset})`,
                    offsetValue
                };
            } catch {
                return { id: tz, offset: "UTC+0", label: `${tz} (UTC+0)`, offsetValue: 0 };
            }
        });
    }, []);

    const filteredTimezones = useMemo(() => {
        if (!tzSearch) return timezonesWithOffsets;
        const searchLower = tzSearch.toLowerCase();
        return timezonesWithOffsets.filter(tz =>
            tz.id.toLowerCase().includes(searchLower) ||
            tz.offset.toLowerCase().includes(searchLower)
        );
    }, [timezonesWithOffsets, tzSearch]);

    // Reset search when dropdown closes
    useEffect(() => {
        // Since Select doesn't expose open state easily to parent without refactoring Select itself,
        // we can either refactor Select or just let the search persist.
        // For simplicity, let's just let it persist for now, or use a local 'open' state if needed.
    }, []);

    // MRT State Handlers
    const setPagination = (updater: any) => {
        const next = typeof updater === 'function' ? updater(pagination) : updater
        updateConfig({ pagination: next })
    }
    const setSorting = (updater: any) => {
        const next = typeof updater === 'function' ? updater(sorting) : updater
        updateConfig({ sorting: next })
    }
    const setGlobalFilter = (val: string) => updateConfig({ globalFilter: val })
    const setColumnFilters = (updater: any) => {
        const next = typeof updater === 'function' ? updater(columnFilters) : updater
        updateConfig({ columnFilters: next })
    }

    // Fetch Reports
    useEffect(() => {
        if (!selectedCaseId) return

        const fetchReports = async () => {
            try {
                const res = await fetch(API.path(`/reports?case_id=${selectedCaseId}`))
                if (res.ok) {
                    const data = await res.json()
                    setReports(data)
                }
            } catch (error) {
                console.error("Error fetching reports:", error)
            }
        }
        fetchReports()
    }, [selectedCaseId])

    // Fetch Timeline Data
    useEffect(() => {
        if (!selectedCaseId || !isLoaded) return

        const fetchData = async () => {
            setIsLoading(true)
            try {
                const sortField = sorting.length > 0 ? sorting[0].id : 'date'
                const sortOrder = sorting.length > 0 && sorting[0].desc ? 'desc' : 'asc'

                let url = API.path(`/cases/${selectedCaseId}/timeline?page=${pagination.pageIndex}&limit=${pagination.pageSize}&sort_by=${sortField}&sort_order=${sortOrder}`)

                if (globalFilter) {
                    url += `&search=${encodeURIComponent(globalFilter)}`
                }

                if (columnFilters.length > 0) {
                    url += `&filters=${encodeURIComponent(JSON.stringify(columnFilters))}`
                }

                if (selectedReport && selectedReport !== "all") {
                    url += `&report_id=${encodeURIComponent(selectedReport)}`
                }

                const res = await fetch(url)
                if (res.ok) {
                    const result = await res.json()
                    setData(result.events || [])
                    setTotalCount(result.total || 0)
                    hasInitiallyLoaded.current = true
                }
            } catch (error) {
                console.error("Error fetching timeline:", error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchData()
    }, [selectedCaseId, pagination, sorting, selectedReport, globalFilter, columnFilters, isLoaded])

    // Show unified loading state during initial load only
    // Show LoadingPage until we've successfully loaded data at least once
    if (!hasInitiallyLoaded.current && (!isLoaded || !selectedCaseId || isLoading || data.length === 0)) {
        return <LoadingPage />
    }

    const handleExportAll = async () => {
        if (!selectedCaseId) return
        try {
            setIsLoading(true)
            const sortField = sorting.length > 0 ? sorting[0].id : 'date'
            const sortOrder = sorting.length > 0 && sorting[0].desc ? 'desc' : 'asc'

            let url = API.path(`/cases/${selectedCaseId}/timeline?page=0&limit=-1&sort_by=${sortField}&sort_order=${sortOrder}`)

            if (globalFilter) {
                url += `&search=${encodeURIComponent(globalFilter)}`
            }

            if (columnFilters.length > 0) {
                url += `&filters=${encodeURIComponent(JSON.stringify(columnFilters))}`
            }

            if (selectedReport && selectedReport !== "all") {
                url += `&report_id=${encodeURIComponent(selectedReport)}`
            }

            const res = await fetch(url)
            if (res.ok) {
                const result = await res.json()
                // We need to use the generateCsv function from export-to-csv, but it's not imported here.
                // Instead, we can pass the data to EnhancedTable via a callback or just return it?
                // Actually, EnhancedTable handles the CSV generation.
                // Let's pass this data to EnhancedTable? No, EnhancedTable expects 'rows' prop for display.
                // Better: Pass a function to EnhancedTable that returns a Promise of all data?
                // Or just pass the data to a new prop on EnhancedTable?
                // Wait, EnhancedTable has the csvConfig.
                // Let's just pass this function to EnhancedTable, and EnhancedTable will call it, await the data, and then generate CSV.
                return result.events || []
            }
        } catch (error) {
            console.error("Error exporting all data:", error)
        } finally {
            setIsLoading(false)
        }
        return []



    }

    return (
        <div className="h-full w-full flex flex-col bg-[#151515] overflow-hidden">
            <div className="flex-1 min-h-0">
                <DataTable
                    rows={data}
                    isLoading={isLoading}
                    totalCount={totalCount}
                    pagination={pagination}
                    sorting={sorting}
                    onPaginationChange={setPagination}
                    onSortingChange={setSorting}
                    globalFilter={globalFilter}
                    onGlobalFilterChange={setGlobalFilter}
                    columnFilters={columnFilters}
                    onColumnFiltersChange={setColumnFilters}
                    onExportAll={handleExportAll}
                    selectedTimezone={selectedTimezone}
                    density={config.density}
                    onDensityChange={(updater) => {
                        const next = typeof updater === 'function' ? updater(config.density) : updater;
                        updateConfig({ density: next });
                    }}
                    scrollPosition={config.scrollPosition}
                    onScroll={(pos) => updateConfig({ scrollPosition: pos })}
                    selectedEvent={data.find(e => e.id === config.selectedEventId) ?? null}
                    onRowClick={(event) => updateConfig({ selectedEventId: event.id })}
                    onCloseSidebar={() => updateConfig({ selectedEventId: null })}
                    renderRightToolbar={() => (
                        <div className="flex items-center gap-4">
                            {/* Report Filter */}
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-gray-400 whitespace-nowrap">Report:</span>
                                <Select
                                    value={String(selectedReport)}
                                    onValueChange={(val) => updateConfig({ selectedReportId: val === "all" ? "all" : parseInt(val) })}
                                    open={openDropdown === 'report'}
                                    onOpenChange={(open) => setOpenDropdown(open ? 'report' : null)}
                                >
                                    <SelectTrigger
                                        data-sidebar-ignore="true"
                                        className="h-8 w-fit min-w-[140px] max-w-[250px] bg-[#2b2b2b] border-white/10 text-xs focus:!ring-0 focus:!ring-offset-0 px-2"
                                    >
                                        <SelectValue placeholder="All Reports">
                                            {selectedReport === "all"
                                                ? "All Reports"
                                                : reports.find(r => r.id === selectedReport)
                                                    ? `${reports.find(r => r.id === selectedReport)?.name} (${reports.find(r => r.id === selectedReport)?.tool})`
                                                    : "All Reports"
                                            }
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent
                                        data-sidebar-ignore="true"
                                        className="min-w-[200px] max-h-[300px] overflow-y-auto bg-[#2b2b2b] border-white/10 text-white"
                                    >
                                        <SelectItem value="all">All Reports</SelectItem>
                                        {reports.map((report) => (
                                            <SelectItem key={report.id} value={String(report.id)}>
                                                {report.name} ({report.tool})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Timezone Filter */}
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-gray-400 whitespace-nowrap">TZ:</span>
                                <Select
                                    value={selectedTimezone}
                                    onValueChange={(val) => {
                                        updateConfig({ selectedTimezone: val });
                                        setTzSearch("");
                                    }}
                                    open={openDropdown === 'timezone'}
                                    onOpenChange={(open) => setOpenDropdown(open ? 'timezone' : null)}
                                >
                                    <SelectTrigger
                                        data-sidebar-ignore="true"
                                        className="h-8 w-fit min-w-[120px] max-w-[240px] bg-[#2b2b2b] border-white/10 text-xs focus:!ring-0 focus:!ring-offset-0 px-2"
                                    >
                                        <SelectValue placeholder="UTC">
                                            {timezonesWithOffsets.find(t => t.id === selectedTimezone)?.label || selectedTimezone}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent
                                        data-sidebar-ignore="true"
                                        className="w-[250px] bg-[#2b2b2b] border-white/10 text-white p-0"
                                    >
                                        <div className="p-2 border-b border-white/5 sticky top-0 bg-transparent z-10">
                                            <Input
                                                placeholder="Search timezones..."
                                                value={tzSearch}
                                                onChange={(e) => setTzSearch(e.target.value)}
                                                onClick={(e) => e.stopPropagation()}
                                                className="h-8 bg-[#2b2b2b] border-white/10 text-xs"
                                            />
                                        </div>
                                        <div className="max-h-[300px] overflow-y-auto p-1">
                                            {filteredTimezones.length > 0 ? (
                                                filteredTimezones.map((tz) => (
                                                    <SelectItem key={tz.id} value={tz.id}>
                                                        {tz.label}
                                                    </SelectItem>
                                                ))
                                            ) : (
                                                <div className="px-2 py-4 text-xs text-gray-500 text-center">
                                                    No results
                                                </div>
                                            )}
                                        </div>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}
                />
            </div>
        </div>
    )
}
