"use client";

import { useState, useEffect, useCallback } from "react";
import { getToolsStatus, installTool, uninstallTool, ToolsStatusResponse } from "@/lib/api/tools";


type Tab = "general" | "tools";

interface InstallProgress {
    tool: string;
    progress: number;
    message: string;
}

export default function PreferencesPage() {
    const [activeTab, setActiveTab] = useState<Tab>("general");
    const [toolsStatus, setToolsStatus] = useState<ToolsStatusResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [installProgress, setInstallProgress] = useState<InstallProgress | null>(null);


    const fetchToolsStatus = useCallback(async () => {
        try {
            const status = await getToolsStatus();
            setToolsStatus(status);
        } catch (error) {
            console.error("Failed to fetch tools status:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchToolsStatus();
    }, [fetchToolsStatus]);

    const handleInstall = async (toolName: string) => {
        setInstallProgress({ tool: toolName, progress: 0, message: "Starting..." });

        const result = await installTool(toolName, (progress, message) => {
            setInstallProgress({ tool: toolName, progress, message });
        });

        if (result.success) {
            await fetchToolsStatus();
        } else {
            console.error("Install failed:", result.error);
        }

        setInstallProgress(null);
    };

    const handleUninstall = async (toolName: string) => {
        if (!confirm(`Are you sure you want to uninstall ${toolName}?`)) {
            return;
        }

        const result = await uninstallTool(toolName);

        if (result.success) {
            await fetchToolsStatus();
        } else {
            console.error("Uninstall failed:", result.error);
        }
    };

    const renderToolItem = (toolKey: 'ileapp' | 'aleapp') => {
        if (!toolsStatus) return null;

        const tool = toolsStatus[toolKey];
        const isInstalling = installProgress?.tool === toolKey;

        return (
            <div className="flex items-center justify-between py-4 border-b border-white/5 last:border-0 group">
                <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{tool.name}</span>
                    </div>
                    <p className="text-xs text-white/50">{tool.description}</p>
                </div>

                <div className="flex items-center gap-3">
                    {isInstalling ? (
                        <div className="flex flex-col items-end gap-1 min-w-[140px]">
                            <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-white/80 transition-all duration-300"
                                    style={{ width: `${Math.max(0, installProgress.progress)}%` }}
                                />
                            </div>
                            <span className="text-[10px] text-white/50 uppercase tracking-wider font-medium">{installProgress.message}</span>
                        </div>
                    ) : tool.installed ? (
                        <div className="flex items-center gap-4">
                            <span className="text-xs text-white font-medium tracking-wide">Installed</span>
                            <button
                                className="h-8 w-8 flex items-center justify-center text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-all duration-200"
                                title="Uninstall"
                                onClick={() => handleUninstall(toolKey)}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M3 6h18"></path>
                                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                                </svg>
                            </button>
                        </div>
                    ) : (
                        <button
                            className="h-8 px-6 text-xs font-medium bg-white text-black hover:bg-white/90 rounded-md transition-all duration-200"
                            onClick={() => handleInstall(toolKey)}
                        >
                            Download
                        </button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="h-full w-full bg-[#151515] text-white py-[3vh] px-[9vh] overflow-y-auto">
            <div className="space-y-6">
                {/* Tabs */}
                <div className="flex space-x-6 border-b border-white/5 pb-1">
                    <button
                        onClick={() => setActiveTab("general")}
                        className={`
                            pb-2 text-sm font-medium transition-all duration-200 border-b-2
                            ${activeTab === "general"
                                ? "border-white text-white"
                                : "border-transparent text-muted-foreground hover:text-white"}
                        `}
                    >
                        General
                    </button>
                    <button
                        onClick={() => setActiveTab("tools")}
                        className={`
                            pb-2 text-sm font-medium transition-all duration-200 border-b-2
                            ${activeTab === "tools"
                                ? "border-white text-white"
                                : "border-transparent text-muted-foreground hover:text-white"}
                        `}
                    >
                        Forensic Tools
                    </button>
                </div>

                {/* Content */}
                <div className="pt-2">
                    {activeTab === "general" && (
                        <div className="text-muted-foreground text-sm py-4">
                            No general settings available.
                        </div>
                    )}

                    {activeTab === "tools" && (
                        <div className="space-y-4">

                            {loading ? (
                                <div className="text-sm text-[#888] py-4">Loading...</div>
                            ) : toolsStatus ? (
                                <div className="space-y-0">
                                    {renderToolItem('ileapp')}
                                    {renderToolItem('aleapp')}
                                </div>
                            ) : (
                                <div className="text-sm text-[#888] py-4">
                                    Failed to load tools status
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
