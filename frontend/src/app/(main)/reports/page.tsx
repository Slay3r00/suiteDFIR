'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, FileText, FolderOpen, Download, Trash2, X, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { useCase } from "@/context/CaseContext";

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
    const [reports, setReports] = useState<Report[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'ileapp' | 'aleapp'>('all');
    const [sort, setSort] = useState<'newest' | 'oldest' | 'name'>('newest');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedReport, setSelectedReport] = useState<Report | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const { selectedCaseId } = useCase();

    // Drag-to-scroll state
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const scrollbarRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);
    const [scrollProgress, setScrollProgress] = useState(0);
    const [thumbWidth, setThumbWidth] = useState(20);
    const [isScrollbarDragging, setIsScrollbarDragging] = useState(false);

    const fetchReports = useCallback(async () => {
        try {
            const url = selectedCaseId
                ? `http://localhost:8000/api/reports?case_id=${selectedCaseId}`
                : 'http://localhost:8000/api/reports';
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                setReports(data);

                // Smart selection logic
                setSelectedReport(prev => {
                    // If no reports, clear selection
                    if (data.length === 0) return null;

                    // If we have a previous selection, check if it still exists in the new list
                    if (prev) {
                        const stillExists = data.find((r: Report) => r.path === prev.path);
                        if (stillExists) return prev;
                    }

                    // Otherwise (new case or previous selection gone), select the first one
                    return data[0];
                });
            }
        } catch (error) {
            console.error('Failed to fetch reports:', error);
        } finally {
            setIsLoading(false);
        }
    }, [selectedCaseId]);

    useEffect(() => {
        // Clear selection when switching cases to prevent showing old case's report
        setSelectedReport(null);
        fetchReports();
    }, [selectedCaseId, fetchReports]);

    // Track scroll position for custom scrollbar
    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const updateScrollProgress = () => {
            const maxScroll = container.scrollWidth - container.clientWidth;
            if (maxScroll > 0) {
                setScrollProgress(container.scrollLeft / maxScroll);
                setThumbWidth(Math.max(20, (container.clientWidth / container.scrollWidth) * 100));
            }
        };

        container.addEventListener('scroll', updateScrollProgress);
        // Initial calculation
        updateScrollProgress();

        return () => container.removeEventListener('scroll', updateScrollProgress);
    }, [reports]);

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

    const handleOpen = async (path: string) => {
        try {
            await fetch(`http://localhost:8000/api/reports/open?path=${encodeURIComponent(path)}`, {
                method: 'POST'
            });
        } catch (error) {
            console.error('Failed to open report:', error);
        }
    };

    const handleDownload = async (path: string) => {
        window.location.href = `http://localhost:8000/api/reports/download?path=${encodeURIComponent(path)}`;
    };

    const handleDelete = async (path: string) => {
        if (!confirm('Are you sure you want to delete this report? This action cannot be undone.')) return;

        try {
            const response = await fetch(`http://localhost:8000/api/reports?path=${encodeURIComponent(path)}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                // If deleted report was selected, clear selection
                if (selectedReport?.path === path) {
                    setSelectedReport(null);
                }
                fetchReports(); // Refresh list
            }
        } catch (error) {
            console.error('Failed to delete report:', error);
        }
    };

    const handleViewReport = (report: Report) => {
        setSelectedReport(report);
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
                        className="absolute top-14 right-2 z-10 h-10 w-10 bg-[#212121] hover:bg-[#2a2a2a] border border-white/20 rounded-lg flex items-center justify-center transition-all hover:scale-105"
                        title={isFullscreen ? 'Exit fullscreen' : 'Expand fullscreen'}
                    >
                        {isFullscreen ? (
                            <X size={20} className="text-white" />
                        ) : (
                            <Maximize2 size={20} className="text-white" />
                        )}
                    </button>
                )}

                {selectedReport ? (
                    <div className={`flex-1 bg-[#1A1A1A] border border-white/10 overflow-hidden shadow-xl ${isFullscreen ? 'rounded-none' : 'rounded-lg'}`}>
                        <iframe
                            src={`http://localhost:8000${selectedReport.url}`}
                            className="w-full h-full"
                            title={selectedReport.name}
                        />
                    </div>
                ) : (
                    <div className="flex-1 bg-[#1A1A1A] border border-white/10 rounded-lg flex items-center justify-center text-gray-500">
                        <div className="text-center">
                            <FileText size={48} className="mx-auto mb-3 opacity-30" />
                            <p className="text-lg">Select a report to view</p>
                            <p className="text-sm mt-1">Choose from the reports below</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Section - Report List (15% of available height) - Hidden in fullscreen */}
            {!isFullscreen && (
                <div className="flex-[15] flex flex-col gap-3 min-h-0">
                    {/* Header with Controls */}
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">Reports Library</label>
                            <div className="flex gap-1 bg-[#1A1A1A] p-1 rounded-lg border border-white/10">
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
                        className={`flex-1 overflow-x-auto overflow-y-hidden min-h-0 [&::-webkit-scrollbar]:hidden ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                        onMouseDown={handleMouseDown}
                        onMouseLeave={handleMouseLeave}
                        onMouseUp={handleMouseUp}
                        onMouseMove={handleMouseMove}
                    >
                        {isLoading ? (
                            <div className="h-full flex items-center justify-center text-gray-500 text-sm">Loading reports...</div>
                        ) : filteredReports.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-gray-500 text-sm">No reports found</div>
                        ) : (
                            <div className="flex gap-3 h-full pb-2">
                                {filteredReports.map((report) => (
                                    <div
                                        key={report.path}
                                        className={`group flex-shrink-0 w-80 rounded-lg p-2 flex items-center gap-2 border transition-colors cursor-pointer ${selectedReport?.path === report.path ? 'bg-[#1A1A1A] border-white/40' : 'bg-[#1A1A1A] border-white/10 hover:border-white/20'
                                            }`}
                                        onClick={() => handleViewReport(report)}
                                    >
                                        {/* Icon */}
                                        <div className="h-10 w-10 flex-shrink-0 bg-[#1a1a1a] rounded flex items-center justify-center p-0.5">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={report.tool === 'ileapp' ? '/apple-logo.svg' : '/android-logo.svg'}
                                                alt={report.tool}
                                                className="max-h-full max-w-full"
                                                style={{
                                                    filter: report.tool === 'ileapp'
                                                        ? 'brightness(0) invert(1)' // White for Apple
                                                        : 'brightness(0) saturate(100%) invert(80%) sepia(16%) saturate(1088%) hue-rotate(32deg) brightness(92%) contrast(87%)' // #a6c43b for Android
                                                }}
                                            />
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0 flex flex-col justify-center items-center">
                                            <h3 className="text-white font-medium truncate text-xs w-full text-center">{report.name}</h3>
                                            <div className="flex items-center justify-center gap-2 text-[10px] text-gray-400 mt-0.5">
                                                <span className="flex items-center gap-0.5">
                                                    <FileText size={9} />
                                                    {new Date(report.created_at).toLocaleDateString()}
                                                </span>
                                                <span>•</span>
                                                <span>{report.size}</span>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-0.5 transition-opacity">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleOpen(report.path);
                                                }}
                                                title="Open in Finder"
                                                className="h-7 w-7 hover:bg-white/20 text-white"
                                            >
                                                <FolderOpen size={12} />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDownload(report.path);
                                                }}
                                                title="Download ZIP"
                                                className="h-7 w-7 hover:bg-white/20 text-white"
                                            >
                                                <Download size={12} />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDelete(report.path);
                                                }}
                                                title="Delete Report"
                                                className="h-7 w-7 hover:bg-red-900/30 text-white hover:text-red-400"
                                            >
                                                <Trash2 size={12} />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Custom Minimal Scrollbar */}
                    {filteredReports.length > 0 && (
                        <div
                            ref={scrollbarRef}
                            className="h-1.5 bg-white/5 rounded-full mx-4 mb-1 relative cursor-pointer"
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
        </div>
    );
}
