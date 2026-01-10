'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, FileText, FolderOpen, Download, Trash2, X, Maximize2 } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, LoadingPage } from '@/components/ui';
import { useCase } from "@/context/CaseContext";
import { ReportsProvider, useReports, ReportIframeState } from '@/context/ReportsContext';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

interface Report {
    name: string;
    path: string;
    url: string;
    tool: 'ileapp' | 'aleapp';
    created_at: string;
    size: string;
    artifact_count: number;
}

export default function Reports() {
    return (
        <Suspense fallback={<LoadingPage />}>
            <ReportsContent />
        </Suspense>
    );
}

function ReportsContent() {
    const [reports, setReports] = useState<Report[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [reportToDelete, setReportToDelete] = useState<Report | null>(null);
    const [reportToOpen, setReportToOpen] = useState<Report | null>(null);
    const [reportToDownload, setReportToDownload] = useState<Report | null>(null);
    const { selectedCaseId } = useCase();
    const searchParams = useSearchParams();

    // Use context for persistent state
    const {
        selectedReportPath,
        setSelectedReportPath,
        filter,
        setFilter,
        sort,
        setSort,
        searchQuery,
        setSearchQuery,
        saveReportScrollPosition,
        getReportScrollPosition,
        saveReportIframeState,
        getReportIframeState,
        isStateLoaded
    } = useReports();

    // Derive selectedReport from reports and selectedReportPath
    const selectedReport = reports.find(r => r.path === selectedReportPath) || null;

    // State-driven iframe URL (to restore artifact page)
    const [iframeUrl, setIframeUrl] = useState<string | null>(() => {
        if (selectedReportPath) {
            const saved = getReportIframeState(selectedReportPath);
            if (saved?.currentPage) return `http://localhost:8000${saved.currentPage}`;
        }
        return null;
    });

    // Drag-to-scroll state
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const scrollbarRef = useRef<HTMLDivElement>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);
    const [scrollProgress, setScrollProgress] = useState(0);
    const [thumbWidth, setThumbWidth] = useState(20);
    const [isScrollbarDragging, setIsScrollbarDragging] = useState(false);

    // Track the previous report path for saving scroll position on switch
    const previousReportPathRef = useRef<string | null>(null);
    const restorationInProgressRef = useRef<boolean>(false);
    const pendingScrollRestoreRef = useRef<number | null>(null);
    // Enhanced state restoration (includes sidebar scroll and current page)
    const pendingIframeRestoreRef = useRef<ReportIframeState | null>(null);
    // Track which report path a pending state save should go to (fixes race condition)
    const pendingStateSavePathRef = useRef<string | null>(null);

    const fetchReports = useCallback(async () => {
        try {
            const url = selectedCaseId
                ? `http://localhost:8000/api/reports?case_id=${selectedCaseId}`
                : 'http://localhost:8000/api/reports';
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                setReports(data);
            }
        } catch (error) {
            console.error('Failed to fetch reports:', error);
        } finally {
            setIsLoading(false);
        }
    }, [selectedCaseId]);

    useEffect(() => {
        fetchReports();
    }, [selectedCaseId, fetchReports]);

    // Handle report selection logic (Deep Linking + Defaults)
    useEffect(() => {
        // Wait for reports to load AND persistent state to be restored
        if (isLoading || reports.length === 0 || !isStateLoaded) {
            return;
        }

        const urlPath = searchParams.get('path');

        // 1. Priority: URL path
        if (urlPath) {
            const normalizedUrlPath = urlPath.replace(/\/$/, '').toLowerCase();
            const targetReport = reports.find(r => r.path.replace(/\/$/, '').toLowerCase() === normalizedUrlPath);

            if (targetReport) {
                setSelectedReportPath(targetReport.path);
                // Scroll to the selected report card
                setTimeout(() => {
                    const el = document.querySelector(`[data-report-path="${CSS.escape(targetReport.path)}"]`);
                    if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                    }
                }, 100);
                return;
            }
        }

        // 2. Fallback: Keep current selection if it still exists (from context)
        if (selectedReportPath) {
            const stillExists = reports.find(r => r.path === selectedReportPath);
            if (stillExists) {
                return;
            }
        }

        // 3. Last Fallback: First report
        if (reports.length > 0) {
            setSelectedReportPath(reports[0].path);
        }
    }, [reports, searchParams, isLoading, selectedReportPath, setSelectedReportPath, isStateLoaded]);

    // Listen for scroll messages from iframe (enhanced state)
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            // Security check - only accept messages from our backend
            if (event.origin !== 'http://localhost:8000') return;

            // Handle enhanced reportState messages
            if (event.data?.type === 'reportState') {
                // Use pending save path if set (for state captured before switch)
                // Otherwise use current selectedReportPath (for continuous scroll tracking)
                const targetPath = pendingStateSavePathRef.current || selectedReportPath;
                if (targetPath) {
                    let newState = {
                        mainScrollY: event.data.mainScrollY,
                        sidebarScrollY: event.data.sidebarScrollY,
                        currentPage: event.data.currentPage,
                        dtPage: event.data.dtPage
                    };

                    // Race condition fix: If we are in the middle of restoring state,
                    // and the incoming update says "Page 0" (default initialization),
                    // but we have a saved state saying "Page X", IGNORE the "Page 0" update.
                    if (restorationInProgressRef.current) {
                        const existingState = getReportIframeState(targetPath);
                        if (existingState && (existingState.dtPage || 0) > 0 && (event.data.dtPage === 0 || event.data.dtPage === undefined)) {
                            // console.log('[ReportsPage] Ignoring "Page 0" update during restoration to preserve Page', existingState.dtPage);
                            newState.dtPage = existingState.dtPage;
                        }
                    }

                    saveReportIframeState(targetPath, newState);
                    // Also save to legacy scroll position for backwards compatibility
                    saveReportScrollPosition(targetPath, event.data.mainScrollY);
                }
                // Clear pending save path after use
                pendingStateSavePathRef.current = null;
            }

            // Legacy scroll message support
            if (event.data?.type === 'scroll' && selectedReportPath) {
                saveReportScrollPosition(selectedReportPath, event.data.scrollY);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [selectedReportPath, saveReportScrollPosition, saveReportIframeState]);

    // Consolidated effect: When switching reports, update URL and restore state
    useEffect(() => {
        if (!selectedReport) return;

        const reportPath = selectedReport.path;

        // Update URL if report changed or not set yet
        if (reportPath !== previousReportPathRef.current || !iframeUrl) {
            // Default to report base URL
            let targetUrl = `http://localhost:8000${selectedReport.url}`;
            let restoreIframeState = null;
            let restoreScroll = null;

            // Try enhanced state first (session-based with sidebar scroll)
            const savedIframeState = getReportIframeState(reportPath);
            if (savedIframeState && savedIframeState.currentPage) {
                restoreIframeState = savedIframeState;
                // Use saved artifact page
                targetUrl = `http://localhost:8000${savedIframeState.currentPage}`;
            } else {
                // Fallback to legacy scroll position
                const savedScroll = getReportScrollPosition(reportPath);
                if (savedScroll > 0) {
                    restoreScroll = savedScroll;
                }
            }

            pendingIframeRestoreRef.current = restoreIframeState;
            pendingScrollRestoreRef.current = restoreScroll;
            previousReportPathRef.current = reportPath;
            restorationInProgressRef.current = true; // Flag that we expect a restore

            setIframeUrl(targetUrl);
        }
    }, [selectedReport, iframeUrl, getReportIframeState, getReportScrollPosition]);

    // Restore scroll/state when iframe loads
    const handleIframeLoad = useCallback(() => {
        if (!iframeRef.current) return;

        // Restore enhanced state (with sidebar scroll)
        if (pendingIframeRestoreRef.current !== null) {
            const state = pendingIframeRestoreRef.current;
            pendingIframeRestoreRef.current = null;
            pendingScrollRestoreRef.current = null;

            setTimeout(() => {
                iframeRef.current?.contentWindow?.postMessage(
                    { type: 'restoreState', mainScrollY: state.mainScrollY, sidebarScrollY: state.sidebarScrollY, dtPage: state.dtPage },
                    'http://localhost:8000'
                );
                // Mark restoration as complete after a short buffer
                setTimeout(() => {
                    restorationInProgressRef.current = false;
                }, 300);
            }, 150);
            return;
        }

        // Fallback: restore legacy scroll position
        if (pendingScrollRestoreRef.current !== null) {
            const scrollY = pendingScrollRestoreRef.current;
            pendingScrollRestoreRef.current = null;

            setTimeout(() => {
                iframeRef.current?.contentWindow?.postMessage(
                    { type: 'scrollTo', scrollY },
                    'http://localhost:8000'
                );
            }, 100);
        }
    }, []);



    // Track scroll position for custom scrollbar
    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const updateScrollProgress = () => {
            const maxScroll = container.scrollWidth - container.clientWidth;
            if (maxScroll > 0) {
                setScrollProgress(container.scrollLeft / maxScroll);
                setThumbWidth(Math.max(20, (container.clientWidth / container.scrollWidth) * 100));
            } else {
                setScrollProgress(0);
                setThumbWidth(100);
            }
        };

        // Use ResizeObserver to catch changes in container size OR content size
        const resizeObserver = new ResizeObserver(() => {
            updateScrollProgress();
        });

        resizeObserver.observe(container);

        // Also observe the first child (if it exists) to catch content shifts
        const content = container.firstElementChild;
        if (content) {
            resizeObserver.observe(content);
        }

        container.addEventListener('scroll', updateScrollProgress);
        updateScrollProgress();

        return () => {
            resizeObserver.disconnect();
            container.removeEventListener('scroll', updateScrollProgress);
        };
    }, [reports, filter, searchQuery, sort]);

    // Scrollbar drag handlers
    const thumbOffsetRef = useRef(0);

    const handleScrollbarMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        if (!scrollbarRef.current) return;

        // Calculate the offset from the left edge of the thumb to where the user clicked
        const rect = scrollbarRef.current.getBoundingClientRect();
        const thumbLeftPercent = scrollProgress * (100 - thumbWidth);
        const thumbLeftPx = (thumbLeftPercent / 100) * rect.width;
        const clickPositionInTrack = e.clientX - rect.left;
        thumbOffsetRef.current = clickPositionInTrack - thumbLeftPx;

        setIsScrollbarDragging(true);
    }, [scrollProgress, thumbWidth]);

    useEffect(() => {
        if (!isScrollbarDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (!scrollContainerRef.current || !scrollbarRef.current) return;

            const rect = scrollbarRef.current.getBoundingClientRect();
            const trackWidth = rect.width;
            const thumbWidthPx = (thumbWidth / 100) * trackWidth;
            const maxThumbLeft = trackWidth - thumbWidthPx;

            // Calculate where the thumb's left edge should be based on cursor position
            const cursorPositionInTrack = e.clientX - rect.left;
            const targetThumbLeft = cursorPositionInTrack - thumbOffsetRef.current;

            // Clamp to valid range
            const clampedThumbLeft = Math.max(0, Math.min(maxThumbLeft, targetThumbLeft));

            // Convert thumb position to scroll position
            const maxScroll = scrollContainerRef.current.scrollWidth - scrollContainerRef.current.clientWidth;
            const scrollPercentage = maxThumbLeft > 0 ? clampedThumbLeft / maxThumbLeft : 0;
            scrollContainerRef.current.scrollLeft = scrollPercentage * maxScroll;
        };

        const handleMouseUp = () => {
            setIsScrollbarDragging(false);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isScrollbarDragging, thumbWidth]);

    const handleOpenClick = (report: Report) => {
        setReportToOpen(report);
    };

    const executeOpen = async () => {
        if (!reportToOpen) return;
        try {
            await fetch(`http://localhost:8000/api/reports/open?path=${encodeURIComponent(reportToOpen.path)}`, {
                method: 'POST'
            });
            setReportToOpen(null);
        } catch (error) {
            console.error('Failed to open report:', error);
        }
    };

    const handleDownloadClick = (report: Report) => {
        setReportToDownload(report);
    };

    const executeDownload = async () => {
        if (!reportToDownload) return;
        window.location.href = `http://localhost:8000/api/reports/download?path=${encodeURIComponent(reportToDownload.path)}`;
        setReportToDownload(null);
    };

    const handleDeleteClick = (report: Report) => {
        setReportToDelete(report);
    };

    const executeDelete = async () => {
        if (!reportToDelete) return;

        try {
            const response = await fetch(`http://localhost:8000/api/reports?path=${encodeURIComponent(reportToDelete.path)}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                // If deleted report was selected, clear selection
                if (selectedReport?.path === reportToDelete.path) {
                    setSelectedReportPath(null);
                }
                fetchReports(); // Refresh list
                setReportToDelete(null); // Close dialog
            }
        } catch (error) {
            console.error('Failed to delete report:', error);
        }
    };

    const handleViewReport = (report: Report) => {
        // Save current report's state before switching
        if (selectedReportPath && iframeRef.current) {
            // Set pending path so async response saves to correct report
            pendingStateSavePathRef.current = selectedReportPath;
            // Request current state (including sidebar scroll, currentPage) from iframe
            iframeRef.current.contentWindow?.postMessage(
                { type: 'getState' },
                'http://localhost:8000'
            );
        }
        setSelectedReportPath(report.path);
    };

    // Drag-to-scroll handlers
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (!scrollContainerRef.current) return;
        setIsDragging(true);
        setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
        setScrollLeft(scrollContainerRef.current.scrollLeft);
    }, []);

    const handleMouseLeave = useCallback(() => {
        setIsDragging(false);
    }, []);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isDragging || !scrollContainerRef.current) return;
        e.preventDefault();
        const x = e.pageX - scrollContainerRef.current.offsetLeft;
        const walk = (x - startX) * 1.5; // Scroll speed multiplier
        scrollContainerRef.current.scrollLeft = scrollLeft - walk;
    }, [isDragging, startX, scrollLeft]);

    const filteredReports = reports
        .filter(r => {
            if (filter !== 'all' && r.tool !== filter) return false;
            if (searchQuery && !r.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
            return true;
        })
        .sort((a, b) => {
            if (sort === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            if (sort === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
            return a.name.localeCompare(b.name);
        });

    return (
        <div className={`h-screen w-full flex flex-col bg-[#151515] text-white ${isFullscreen ? 'p-0' : 'py-[3vh] px-[9vh]'} gap-3`}>
            {/* Top Section - Report Viewer (85% of available height) */}
            <div className={`${isFullscreen ? 'h-screen' : 'flex-[85]'} flex flex-col min-h-0 relative`}>
                {/* Expand/Collapse Button */}
                {selectedReport && (
                    <button
                        onClick={() => setIsFullscreen(!isFullscreen)}
                        className="absolute bottom-4 right-4 z-20 h-8 w-8 bg-[#1A1A1A]/80 hover:bg-[#252525] border border-white/10 rounded-lg flex items-center justify-center transition-all hover:scale-105 backdrop-blur-sm"
                        title={isFullscreen ? 'Exit fullscreen' : 'Expand fullscreen'}
                    >
                        {isFullscreen ? (
                            <X size={16} className="text-white" />
                        ) : (
                            <Maximize2 size={16} className="text-white" />
                        )}
                    </button>
                )}

                {selectedReport ? (
                    <div
                        className={`flex-1 bg-[#1A1A1A] overflow-hidden isolate relative ${isFullscreen ? 'rounded-none' : 'rounded-xl'}`}
                        style={{ WebkitMaskImage: isFullscreen ? 'none' : '-webkit-radial-gradient(white, black)' }}
                    >
                        <iframe
                            ref={iframeRef}
                            src={iframeUrl || `http://localhost:8000${selectedReport.url}`}
                            className={`w-full h-full border-none ${isFullscreen ? 'rounded-none' : 'rounded-xl'}`}
                            title={selectedReport.name}
                            onLoad={handleIframeLoad}
                            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
                        />
                        {/* Border Overlay - physically blocks corner artifacts */}
                        {!isFullscreen && (
                            <div className="absolute inset-0 border border-white/10 rounded-xl pointer-events-none z-10" />
                        )}
                    </div>
                ) : (
                    <div className="flex-1 bg-[#1A1A1A] rounded-lg flex items-center justify-center text-gray-500">
                        <div className="text-center">
                            <p className="text-lg">Select a report to view</p>
                            <p className="text-sm mt-1">Choose from the reports below</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Section - Report List (15% of available height) - Hidden in fullscreen */}
            {!isFullscreen && (
                <div className="flex-[15] flex flex-col gap-0 min-h-[140px] border border-white/10 rounded-xl bg-[#1A1A1A]/30 overflow-hidden pb-2">
                    <div className="flex-1 flex flex-col gap-2 min-h-0 pb-2 pt-2 px-4">
                        {/* Header with Controls */}
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">Reports Library</label>
                                <div className="flex gap-1 bg-[#1A1A1A] p-0.5 rounded-lg border border-white/10">
                                    <button
                                        onClick={() => setFilter('all')}
                                        className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${filter === 'all' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        All ({reports.length})
                                    </button>
                                    <button
                                        onClick={() => setFilter('ileapp')}
                                        className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${filter === 'ileapp' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        iLEAPP ({reports.filter(r => r.tool === 'ileapp').length})
                                    </button>
                                    <button
                                        onClick={() => setFilter('aleapp')}
                                        className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${filter === 'aleapp' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        aLEAPP ({reports.filter(r => r.tool === 'aleapp').length})
                                    </button>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <div className="relative w-64">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                                    <input
                                        type="text"
                                        placeholder="Search reports..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full bg-[#1A1A1A] border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-white/20"
                                    />
                                </div>
                                <select
                                    value={sort}
                                    onChange={(e) => setSort(e.target.value as 'newest' | 'oldest' | 'name')}
                                    className="bg-[#1A1A1A] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-white/20 appearance-none cursor-pointer text-center"
                                >
                                    <option value="newest">Newest First</option>
                                    <option value="oldest">Oldest First</option>
                                    <option value="name">Name (A-Z)</option>
                                </select>
                            </div>
                        </div>

                        {/* Horizontal Scrollable Report Cards */}
                        <div
                            ref={scrollContainerRef}
                            className={`report-cards-container flex-1 overflow-x-auto overflow-y-hidden min-h-0 [&::-webkit-scrollbar]:hidden ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                            onMouseDown={handleMouseDown}
                            onMouseLeave={handleMouseLeave}
                            onMouseUp={handleMouseUp}
                            onMouseMove={handleMouseMove}
                        >
                            {isLoading ? (
                                <LoadingPage />
                            ) : filteredReports.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-gray-500 text-sm">No reports found</div>
                            ) : (
                                <div className="flex gap-3 h-full items-center">
                                    {filteredReports.map((report) => (
                                        <div
                                            key={report.path}
                                            data-report-path={report.path}
                                            className={`report-card group flex-shrink-0 w-72 min-h-[60px] rounded-lg px-2.5 flex items-center gap-2 border transition-colors cursor-pointer ${selectedReport?.path === report.path ? 'bg-[#1A1A1A] border-white/40' : 'bg-[#1A1A1A] border-white/10 hover:border-white/20'
                                                }`}
                                            onClick={() => handleViewReport(report)}
                                        >
                                            {/* Icon - scales with container */}
                                            <div className="report-card-icon shrink-0 bg-[#1a1a1a] rounded flex items-center justify-center p-0.5">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={report.tool === 'ileapp' ? '/apple-logo.svg' : '/android-logo.svg'}
                                                    alt={report.tool}
                                                    className="max-h-full max-w-full object-contain"
                                                    style={{
                                                        filter: report.tool === 'ileapp'
                                                            ? 'brightness(0) invert(1)' // White for Apple
                                                            : 'brightness(0) saturate(100%) invert(80%) sepia(16%) saturate(1088%) hue-rotate(32deg) brightness(92%) contrast(87%)' // #a6c43b for Android
                                                    }}
                                                />
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0 flex flex-col justify-center py-1 overflow-hidden">
                                                <h3 className="text-white font-medium truncate text-xs w-full text-center">{report.name}</h3>
                                                <div className="flex items-center justify-center gap-1.5 text-[10px] text-gray-400 mt-0.5 whitespace-nowrap">
                                                    <span className="flex items-center gap-0.5 shrink-0">
                                                        <FileText size={9} className="shrink-0" />
                                                        <span>{new Date(report.created_at).toLocaleDateString()}</span>
                                                    </span>
                                                    <span className="shrink-0">•</span>
                                                    <span className="shrink-0">{report.size}</span>
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-0.5 shrink-0">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleOpenClick(report);
                                                    }}
                                                    title="Open in Finder"
                                                    className="h-6 w-6 shrink-0 hover:bg-white/20 text-white"
                                                >
                                                    <FolderOpen size={11} className="shrink-0" />
                                                </Button>

                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteClick(report);
                                                    }}
                                                    title="Delete Report"
                                                    className="h-6 w-6 shrink-0 hover:bg-red-900/30 text-white hover:text-red-400"
                                                >
                                                    <Trash2 size={11} className="shrink-0" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Custom Minimal Scrollbar - Moved Outside Red Container */}
                    {filteredReports.length > 0 && thumbWidth < 100 && (
                        <div
                            ref={scrollbarRef}
                            className="h-1 bg-white/5 rounded-full mx-4 relative cursor-pointer"
                            onMouseDown={(e) => {
                                // Click to scroll to position
                                if (!scrollContainerRef.current || !scrollbarRef.current) return;
                                const rect = scrollbarRef.current.getBoundingClientRect();
                                const clickX = e.clientX - rect.left;
                                const percentage = clickX / rect.width;
                                const maxScroll = scrollContainerRef.current.scrollWidth - scrollContainerRef.current.clientWidth;
                                scrollContainerRef.current.scrollLeft = percentage * maxScroll;
                            }}
                        >
                            {/* Scrollbar Thumb */}
                            <div
                                className={`absolute top-0 h-full bg-white/30 rounded-full transition-colors hover:bg-white/50 ${isScrollbarDragging ? 'bg-white/50' : ''}`}
                                style={{
                                    width: `${thumbWidth}%`,
                                    left: `${scrollProgress * (100 - thumbWidth)}%`,
                                    cursor: isScrollbarDragging ? 'grabbing' : 'grab',
                                }}
                                onMouseDown={(e) => {
                                    e.stopPropagation();
                                    handleScrollbarMouseDown(e);
                                }}
                            />
                        </div>
                    )}
                </div>
            )}

            <Dialog open={reportToDelete !== null} onOpenChange={(open) => !open && setReportToDelete(null)}>
                <DialogContent className="max-w-[340px] p-5 bg-[#1A1A1A] border-[#333333] rounded-xl shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-sm font-semibold text-white tracking-wide uppercase">Delete Report</DialogTitle>
                    </DialogHeader>
                    <div className="py-2">
                        <p className="text-[11px] text-gray-400 leading-relaxed">
                            Are you sure you want to delete <span className="text-white font-medium">{reportToDelete?.name}</span>? This action cannot be undone.
                        </p>
                    </div>
                    <DialogFooter className="mt-2 flex gap-2">
                        <Button
                            variant="secondary"
                            size="sm"
                            className="flex-1 h-8 text-[11px] bg-[#222] hover:bg-[#2a2a2a] text-gray-300 border border-white/5"
                            onClick={() => setReportToDelete(null)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            size="sm"
                            className="flex-1 h-8 text-[11px] bg-red-900/20 hover:bg-red-900/40 text-white border border-red-900/30"
                            onClick={executeDelete}
                        >
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={reportToOpen !== null} onOpenChange={(open) => !open && setReportToOpen(null)}>
                <DialogContent className="max-w-[340px] p-5 bg-[#1A1A1A] border-[#333333] rounded-xl shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-sm font-semibold text-white tracking-wide uppercase">Open Folder</DialogTitle>
                    </DialogHeader>
                    <div className="py-2">
                        <p className="text-[11px] text-gray-400 leading-relaxed">
                            Are you sure you want to open <span className="text-white font-medium">{reportToOpen?.name}</span> in Finder?
                        </p>
                    </div>
                    <DialogFooter className="mt-2 flex gap-2">
                        <Button
                            variant="secondary"
                            size="sm"
                            className="flex-1 h-8 text-[11px] bg-[#222] hover:bg-[#2a2a2a] text-gray-300 border border-white/5"
                            onClick={() => setReportToOpen(null)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="default"
                            size="sm"
                            className="flex-1 h-8 text-[11px] bg-white/10 hover:bg-white/20 text-white border border-white/10"
                            onClick={executeOpen}
                        >
                            Open
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={reportToDownload !== null} onOpenChange={(open) => !open && setReportToDownload(null)}>
                <DialogContent className="max-w-[340px] p-5 bg-[#1A1A1A] border-[#333333] rounded-xl shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-sm font-semibold text-white tracking-wide uppercase">Download Report</DialogTitle>
                    </DialogHeader>
                    <div className="py-2">
                        <p className="text-[11px] text-gray-400 leading-relaxed">
                            Are you sure you want to download <span className="text-white font-medium">{reportToDownload?.name}</span> as a ZIP archive?
                        </p>
                    </div>
                    <DialogFooter className="mt-2 flex gap-2">
                        <Button
                            variant="secondary"
                            size="sm"
                            className="flex-1 h-8 text-[11px] bg-[#222] hover:bg-[#2a2a2a] text-gray-300 border border-white/5"
                            onClick={() => setReportToDownload(null)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="default"
                            size="sm"
                            className="flex-1 h-8 text-[11px] bg-white/10 hover:bg-white/20 text-white border border-white/10"
                            onClick={executeDownload}
                        >
                            Download
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
