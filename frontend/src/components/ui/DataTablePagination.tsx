import { Table } from "@tanstack/react-table"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { Button } from "@/components/ui/Button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/Select"
import { Input } from "@/components/ui/Input"
import { useState, useEffect } from "react"

interface DataTablePaginationProps<TData> {
    table: Table<TData>
    totalCount?: number
}

export function DataTablePagination<TData>({
    table,
    totalCount,
}: DataTablePaginationProps<TData>) {
    const { pageIndex, pageSize } = table.getState().pagination
    const pageCount = table.getPageCount()
    const [pageInput, setPageInput] = useState((pageIndex + 1).toString())

    // Sync input with table state
    useEffect(() => {
        setPageInput((pageIndex + 1).toString())
    }, [pageIndex])

    const handleGoToPage = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            const page = Number(pageInput) - 1
            if (!isNaN(page) && page >= 0 && page < pageCount) {
                table.setPageIndex(page)
            } else {
                setPageInput((pageIndex + 1).toString())
            }
        }
    }

    // Calculate visible row range
    const startRow = pageIndex * pageSize + 1
    const endRow = Math.min((pageIndex + 1) * pageSize, totalCount ?? 0)

    return (
        <div className="flex items-center justify-between px-4 py-3 border-t border-white/10 bg-[#212121]">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>
                    {table.getFilteredSelectedRowModel().rows.length} of{" "}
                    {totalCount ?? table.getFilteredRowModel().rows.length} row(s) selected
                </span>
            </div>

            <div className="flex items-center gap-6">
                {/* Page navigation */}
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => table.setPageIndex(0)}
                        disabled={!table.getCanPreviousPage()}
                        className="h-8 w-8 p-0 hover:bg-white/10 disabled:opacity-30"
                    >
                        <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                        className="h-8 w-8 p-0 hover:bg-white/10 disabled:opacity-30"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>

                    <span className="text-sm text-muted-foreground px-2">
                        Page {pageIndex + 1} of {pageCount}
                    </span>

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                        className="h-8 w-8 p-0 hover:bg-white/10 disabled:opacity-30"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => table.setPageIndex(pageCount - 1)}
                        disabled={!table.getCanNextPage()}
                        className="h-8 w-8 p-0 hover:bg-white/10 disabled:opacity-30"
                    >
                        <ChevronsRight className="h-4 w-4" />
                    </Button>
                </div>

                {/* Row range display */}
                <div className="text-sm text-muted-foreground">
                    {startRow}-{endRow} of {totalCount ?? 0}
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Rows per page</span>
                    <Select
                        value={pageSize.toString()}
                        onValueChange={(value) => {
                            table.setPageSize(Number(value))
                        }}
                    >
                        <SelectTrigger className="h-8 w-[70px] bg-[#1A1A1A] dark:bg-input/30 border-white/10 focus:ring-0 focus:ring-offset-0 focus-visible:ring-0">
                            <SelectValue placeholder={pageSize.toString()} />
                        </SelectTrigger>
                        <SelectContent
                            side="top"
                            align="start"
                            className="bg-[#1A1A1A] dark:bg-input/30 backdrop-blur-md border-white/10 min-w-[70px]"
                        >
                            {[10, 25, 50, 100].map((size) => (
                                <SelectItem key={size} value={size.toString()}>
                                    {size}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Go to page */}
                <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Go to page:</span>
                    <Input
                        value={pageInput}
                        onChange={(e) => setPageInput(e.target.value)}
                        onKeyDown={handleGoToPage}
                        className="h-8 w-12 text-center bg-[#1A1A1A] border-white/10"
                    />
                </div>
            </div>
        </div>
    )
}
