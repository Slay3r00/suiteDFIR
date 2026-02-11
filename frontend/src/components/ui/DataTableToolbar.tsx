import { Table } from "@tanstack/react-table"
import { Download, Rows3, Rows4, LayoutList, Search } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/Select"
import { cn } from "@/lib/utils"
import type { MRT_DensityState } from "./DataTable"

interface DataTableToolbarProps<TData> {
    table: Table<TData>
    globalFilter: string
    onGlobalFilterChange: (value: string) => void
    onExportAll?: () => void
    onExportPage?: () => void
    onExportSelected?: () => void
    density?: MRT_DensityState
    onDensityChange?: (density: MRT_DensityState) => void
    renderLeftToolbar?: () => React.ReactNode
    renderRightToolbar?: () => React.ReactNode
}

export function DataTableToolbar<TData>({
    table,
    globalFilter,
    onGlobalFilterChange,
    onExportAll,
    onExportPage,
    onExportSelected,
    density = "compact",
    onDensityChange,
    renderLeftToolbar,
    renderRightToolbar,
}: DataTableToolbarProps<TData>) {
    const selectedRowCount = table.getFilteredSelectedRowModel().rows.length

    return (
        <div className="flex items-center justify-between gap-4 px-4 py-3 bg-[#212121] border-b border-white/10">
            {/* Left side - custom content and Export buttons */}
            <div className="flex items-center gap-4">
                {renderLeftToolbar?.()}
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onExportAll?.()}
                        className="h-8 text-white text-xs hover:bg-white/10"
                    >
                        <Download className="h-3.5 w-3.5 mr-1.5" />
                        Export All
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onExportPage}
                        disabled={table.getRowModel().rows.length === 0}
                        className="h-8 text-white text-xs hover:bg-white/10 disabled:opacity-30"
                    >
                        <Download className="h-3.5 w-3.5 mr-1.5" />
                        Export Page
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onExportSelected}
                        disabled={selectedRowCount === 0}
                        className="h-8 text-white text-xs hover:bg-white/10 disabled:opacity-30"
                    >
                        <Download className="h-3.5 w-3.5 mr-1.5" />
                        Export Selected
                    </Button>
                </div>
            </div>

            {/* Right side - Search and density */}
            <div className="flex items-center gap-4">
                {renderRightToolbar?.()}

                {/* Global search */}
                <div className="relative">
                    <Search className={cn(
                        "absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors",
                        globalFilter ? "text-white fill-white" : "text-muted-foreground"
                    )} />
                    <Input
                        placeholder="Search..."
                        value={globalFilter}
                        onChange={(e) => onGlobalFilterChange(e.target.value)}
                        className="h-8 w-[200px] pl-8 bg-[#2b2b2b] border-white/10"
                    />
                </div>

                {/* Density toggle */}
                {onDensityChange && (
                    <Button
                        variant="ghost"
                        size="sm"
                        data-sidebar-ignore="true"
                        className="h-8 w-8 p-0 bg-transparent border-none text-white/70 hover:text-white hover:bg-transparent flex items-center justify-center focus:ring-0 focus-visible:ring-0 shadow-none transition-colors"
                        onClick={() => onDensityChange(density === "compact" ? "comfortable" : "compact")}
                        aria-label={`Switch to ${density === "compact" ? "Normal" : "Compact"} density`}
                    >
                        {density === "compact" ? <Rows4 className="h-4 w-4" /> : <Rows3 className="h-4 w-4" />}
                    </Button>
                )}
            </div>
        </div>
    )
}
