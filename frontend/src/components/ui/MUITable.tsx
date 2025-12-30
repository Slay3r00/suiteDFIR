import {
    MaterialReactTable,
    useMaterialReactTable,
    type MRT_Row,
    createMRTColumnHelper,
    type MRT_PaginationState,
    type MRT_SortingState,
    type MRT_ColumnFiltersState,
} from 'material-react-table';
import type { Updater } from '@tanstack/react-table';
import { Box, Button, ThemeProvider, createTheme } from '@mui/material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { mkConfig, generateCsv, download } from 'export-to-csv';

export interface TimelineEvent {
    id: number;
    date: string;
    artifact: string;
    description: string;
    source: string;
}

const columnHelper = createMRTColumnHelper<TimelineEvent>();

const columns = [
    columnHelper.accessor('id', {
        header: 'ID',
        size: 40,
        enableSorting: false,
        enableColumnFilter: false,
        enableColumnActions: false,
    }),
    columnHelper.accessor('date', {
        header: 'Date',
        size: 200,
        Cell: ({ cell }) => {
            const val = cell.getValue<string>();
            if (!val) return '';
            const date = new Date(val);
            return isNaN(date.getTime()) ? val : date.toLocaleString();
        },
    }),
    columnHelper.accessor('artifact', {
        header: 'Artifact',
        size: 150,
    }),
    columnHelper.accessor('description', {
        header: 'Description',
        size: 300,
    }),
    columnHelper.accessor('source', {
        header: 'Source',
        size: 100,
    }),
];

const csvConfig = mkConfig({
    fieldSeparator: ',',
    decimalSeparator: '.',
    useKeysAsHeaders: true,
});

interface EnhancedTableProps {
    rows: TimelineEvent[];
    isLoading?: boolean;
    totalCount?: number;
    pagination?: { pageIndex: number; pageSize: number };
    sorting?: MRT_SortingState;
    onPaginationChange?: (updaterOrValue: Updater<MRT_PaginationState>) => void;
    onSortingChange?: (updaterOrValue: Updater<MRT_SortingState>) => void;
    globalFilter?: string;
    onGlobalFilterChange?: (globalFilter: string) => void;
    columnFilters?: MRT_ColumnFiltersState;
    onColumnFiltersChange?: (updaterOrValue: Updater<MRT_ColumnFiltersState>) => void;
    onExportAll?: () => Promise<TimelineEvent[]>;
}
const EnhancedTable = ({
    rows,
    isLoading,
    totalCount,
    pagination,
    sorting,
    onPaginationChange,
    onSortingChange,
    globalFilter,
    onGlobalFilterChange,
    columnFilters,
    onColumnFiltersChange,
    onExportAll
}: EnhancedTableProps) => {
    const handleExportRows = (rows: MRT_Row<TimelineEvent>[]) => {
        const rowData = rows.map((row) => row.original);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const csv = generateCsv(csvConfig)(rowData as any);
        download(csvConfig)(csv);
    };

    const handleExportAllData = async () => {
        if (onExportAll) {
            const allData = await onExportAll();
            if (allData && allData.length > 0) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const csv = generateCsv(csvConfig)(allData as any);
                download(csvConfig)(csv);
            }
        }
    };

    const theme = createTheme({
        palette: {
            mode: 'dark',
            background: {
                default: '#151515',
                paper: '#1A1A1A',
            },
            text: {
                primary: '#FFFFFF',
                secondary: '#B0B0B0',
            },
        },
        components: {
            MuiPaper: {
                styleOverrides: {
                    root: {
                        backgroundColor: '#1A1A1A !important',
                        backgroundImage: 'none !important',
                        borderRadius: 0,
                    },
                },
            },
            MuiTableHead: {
                styleOverrides: {
                    root: {
                        backgroundColor: '#212121',
                    },
                },
            },
            MuiTableRow: {
                styleOverrides: {
                    root: {
                        '&:hover': {
                            backgroundColor: '#2C2C2C !important',
                        },
                    },
                },
            },
            MuiTableBody: {
                styleOverrides: {
                    root: {
                        backgroundColor: '#1A1A1A',
                    },
                },
            },
            MuiTableCell: {
                styleOverrides: {
                    root: {
                        backgroundColor: '#1A1A1A',
                        color: '#FFFFFF',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                    },
                    head: {
                        backgroundColor: '#212121',
                        color: '#FFFFFF',
                    },
                },
            },
            MuiTableFooter: {
                styleOverrides: {
                    root: {
                        backgroundColor: '#212121',
                    },
                },
            },
            MuiTablePagination: {
                styleOverrides: {
                    root: {
                        backgroundColor: '#212121',
                        color: '#FFFFFF',
                    },
                    select: {
                        color: '#FFFFFF',
                    },
                    selectIcon: {
                        color: '#FFFFFF',
                    },
                    menuItem: {
                        backgroundColor: '#212121',
                        color: '#FFFFFF',
                        '&:hover': {
                            backgroundColor: '#2C2C2C',
                        },
                        '&.Mui-selected': {
                            backgroundColor: '#333333',
                            '&:hover': {
                                backgroundColor: '#3D3D3D',
                            },
                        },
                    },
                },
            },
            MuiToolbar: {
                styleOverrides: {
                    root: {
                        backgroundColor: '#212121',
                        color: '#FFFFFF',
                    },
                },
            },
            MuiInputBase: {
                styleOverrides: {
                    root: {
                        color: '#FFFFFF',
                    },
                },
            },
            MuiIconButton: {
                styleOverrides: {
                    root: {
                        color: '#FFFFFF',
                        '&:disabled': {
                            color: 'rgba(255, 255, 255, 0.3)',
                        },
                    },
                },
            },
            MuiMenu: {
                styleOverrides: {
                    paper: {
                        backgroundColor: '#1A1A1A !important',
                        color: '#FFFFFF',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                    },
                },
            },
            MuiList: {
                styleOverrides: {
                    root: {
                        backgroundColor: '#1A1A1A !important',
                        color: '#FFFFFF',
                    },
                },
            },
            MuiMenuItem: {
                styleOverrides: {
                    root: {
                        color: '#FFFFFF',
                        '&:hover': {
                            backgroundColor: '#2C2C2C',
                        },
                        '&.Mui-selected': {
                            backgroundColor: '#333333',
                            '&:hover': {
                                backgroundColor: '#3D3D3D',
                            },
                        },
                    },
                },
            },
            MuiPopover: {
                styleOverrides: {
                    paper: {
                        backgroundColor: '#1A1A1A !important',
                        color: '#FFFFFF',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                    },
                },
            },
            MuiAutocomplete: {
                styleOverrides: {
                    paper: {
                        backgroundColor: '#1A1A1A !important',
                        color: '#FFFFFF',
                    },
                    listbox: {
                        backgroundColor: '#1A1A1A !important',
                        color: '#FFFFFF',
                        '& .MuiAutocomplete-option': {
                            '&:hover': {
                                backgroundColor: '#2C2C2C',
                            },
                            '&[aria-selected="true"]': {
                                backgroundColor: '#333333',
                                '&:hover': {
                                    backgroundColor: '#3D3D3D',
                                },
                            },
                        },
                    },
                },
            },
            MuiCollapse: {
                styleOverrides: {
                    root: {
                        transition: 'none !important',
                    },
                    wrapper: {
                        transition: 'none !important',
                    },
                },
                defaultProps: {
                    timeout: 0,
                },
            },
        },
    });

    const table = useMaterialReactTable({
        columns,
        data: rows,
        manualPagination: true,
        manualSorting: true,
        manualFiltering: true,
        rowCount: totalCount,
        state: {
            isLoading,
            pagination,
            sorting,
            globalFilter,
            columnFilters,
        },
        onPaginationChange,
        onSortingChange,
        onGlobalFilterChange,
        onColumnFiltersChange,
        enableStickyHeader: true,
        enableSorting: false,
        enableRowSelection: true,
        enableSelectAll: true,
        muiTablePaperProps: {
            sx: {
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 0,
                backgroundColor: '#1A1A1A',
            },
        },
        muiTableProps: {
            sx: {
                backgroundColor: '#1A1A1A',
            },
        },
        muiTableContainerProps: {
            sx: {
                flexGrow: 1,
                overscrollBehavior: 'none',
                backgroundColor: '#1A1A1A',
            },
        },
        muiTableBodyRowProps: {
            sx: {
                backgroundColor: '#1A1A1A',
            },
        },
        muiTopToolbarProps: {
            sx: {
                backgroundColor: '#212121',
            },
        },
        muiBottomToolbarProps: {
            sx: {
                backgroundColor: '#212121',
            },
        },
        muiTableHeadCellProps: {
            sx: {
                backgroundColor: '#212121',
                color: '#FFFFFF',
            },
        },
        muiSearchTextFieldProps: {
            variant: 'outlined',
            size: 'small',
            sx: {
                width: '200px',
                '& .MuiOutlinedInput-root': {
                    color: '#FFFFFF',
                    '& fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                    },
                    '&:hover fieldset': {
                        borderColor: 'rgba(255, 255, 255, 0.3)',
                    },
                    '&.Mui-focused fieldset': {
                        borderColor: '#FFFFFF',
                    },
                },
                '& .MuiInputLabel-root': {
                    color: 'rgba(255, 255, 255, 0.5)',
                    '&.Mui-focused': {
                        color: '#FFFFFF',
                    },
                },
                '& .MuiSvgIcon-root': {
                    color: 'rgba(255, 255, 255, 0.5)',
                },
            },
        },
        columnFilterDisplayMode: 'popover',
        paginationDisplayMode: 'pages',
        positionToolbarAlertBanner: 'bottom',
        renderTopToolbarCustomActions: ({ table }) => (
            <Box
                sx={{
                    display: 'flex',
                    gap: '16px',
                    padding: '8px',
                    flexWrap: 'wrap',
                }}
            >
                <Button
                    onClick={handleExportAllData}
                    startIcon={<FileDownloadIcon />}
                    sx={{ color: 'white', borderColor: 'rgba(255, 255, 255, 0.2)', fontSize: '0.75rem' }}
                    variant="outlined"
                    size="small"
                >
                    Export All Rows
                </Button>
                <Button
                    disabled={table.getRowModel().rows.length === 0}
                    //export all rows as seen on the screen (respects pagination, sorting, filtering, etc.)
                    onClick={() => handleExportRows(table.getRowModel().rows)}
                    startIcon={<FileDownloadIcon />}
                    sx={{ color: 'white', borderColor: 'rgba(255, 255, 255, 0.2)', fontSize: '0.75rem' }}
                    variant="outlined"
                    size="small"
                >
                    Export Page Rows
                </Button>
                <Button
                    disabled={
                        !table.getIsSomeRowsSelected() && !table.getIsAllRowsSelected()
                    }
                    //only export selected rows
                    onClick={() => handleExportRows(table.getSelectedRowModel().rows)}
                    startIcon={<FileDownloadIcon />}
                    sx={{ color: 'white', borderColor: 'rgba(255, 255, 255, 0.2)', fontSize: '0.75rem' }}
                    variant="outlined"
                    size="small"
                >
                    Export Selected Rows
                </Button>
            </Box>
        ),
    });

    return (
        <ThemeProvider theme={theme}>
            <MaterialReactTable table={table} />
        </ThemeProvider>
    );
};

export default EnhancedTable;
