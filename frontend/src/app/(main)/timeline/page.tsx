"use client"

import { useState, useEffect } from "react"
import EnhancedTable, { TimelineEvent } from "@/components/ui/MUITable"
import { useCases } from "@/hooks/useCases"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/Select"

interface Report {
    name: string
    path: string
    tool: string
    created_at: string
}

export default function Timeline() {
    const { currentCase } = useCases()
    const [data, setData] = useState<TimelineEvent[]>([])
    const [totalCount, setTotalCount] = useState(0)
    const [isLoading, setIsLoading] = useState(false)
    const [reports, setReports] = useState<Report[]>([])
    const [selectedReport, setSelectedReport] = useState<string>("all")

    // MRT State
    const [pagination, setPagination] = useState({
        pageIndex: 0,
        pageSize: 50,
    })
    const [sorting, setSorting] = useState([{ id: 'date', desc: true }])
    const [globalFilter, setGlobalFilter] = useState('')
    const [columnFilters, setColumnFilters] = useState<{ id: string; value: unknown }[]>([])

    // Fetch Reports
    useEffect(() => {
        if (!currentCase) return

        const fetchReports = async () => {
            try {
                const res = await fetch(`http://localhost:8000/api/reports?case_id=${currentCase.id}`)
                if (res.ok) {
                    const data = await res.json()
                    setReports(data)
                }
            } catch (error) {
                console.error("Error fetching reports:", error)
            }
        }
        fetchReports()
    }, [currentCase])

    // Fetch Timeline Data
    useEffect(() => {
        if (!currentCase) return

        const fetchData = async () => {
            setIsLoading(true)
            try {
                const sortField = sorting.length > 0 ? sorting[0].id : 'date'
                const sortOrder = sorting.length > 0 && sorting[0].desc ? 'desc' : 'asc'

                let url = `http://localhost:8000/api/cases/${currentCase.id}/timeline?page=${pagination.pageIndex}&limit=${pagination.pageSize}&sort_by=${sortField}&sort_order=${sortOrder}`

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
                    setData(result.data)
                    setTotalCount(result.total_count)
                }
            } catch (error) {
                console.error("Error fetching timeline:", error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchData()
    }, [currentCase, pagination, sorting, selectedReport, globalFilter, columnFilters])

    const handleExportAll = async () => {
        if (!currentCase) return
        try {
            setIsLoading(true)
            const sortField = sorting.length > 0 ? sorting[0].id : 'date'
            const sortOrder = sorting.length > 0 && sorting[0].desc ? 'desc' : 'asc'

            let url = `http://localhost:8000/api/cases/${currentCase.id}/timeline?page=0&limit=-1&sort_by=${sortField}&sort_order=${sortOrder}`

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
                return result.data
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
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#1A1A1A]">
                <div className="flex items-center gap-4">
                    <h2 className="text-sm font-medium text-gray-400">Filter by Report:</h2>
                    <Select value={selectedReport} onValueChange={setSelectedReport}>
                        <SelectTrigger className="w-[300px] bg-[#212121] border-white/10 text-white">
                            <SelectValue placeholder="Select a report">
                                {selectedReport === "all"
                                    ? "All Reports"
                                    : reports.find(r => r.path === selectedReport)
                                        ? `${reports.find(r => r.path === selectedReport)?.name} (${reports.find(r => r.path === selectedReport)?.tool})`
                                        : "Select a report"
                                }
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="bg-[#212121] border-white/10 text-white">
                            <SelectItem value="all">All Reports</SelectItem>
                            {reports.map((report) => (
                                <SelectItem key={report.path} value={report.path}>
                                    {report.name} ({report.tool})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="flex-1 min-h-0">
                <EnhancedTable
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
                />
            </div>
        </div>
    )
}
