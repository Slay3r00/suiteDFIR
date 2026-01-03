"use client";

import { useEffect, useState } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ReportsProvider } from "@/context/ReportsContext";
import { DashboardProvider } from "@/context/DashboardContext";
import { SpatialProvider } from "@/context/SpatialContext";

export default function MainLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const [defaultOpen, setDefaultOpen] = useState(true);

    useEffect(() => {
        // Read sidebar state from localStorage instead of cookies
        const storedState = localStorage.getItem("sidebar_state");
        if (storedState !== null) {
            setDefaultOpen(storedState === "true"); // eslint-disable-line react-hooks/set-state-in-effect
        }
    }, []);

    return (
        <ReportsProvider>
            <DashboardProvider>
                <SpatialProvider>
                    <SidebarProvider defaultOpen={defaultOpen} className="h-full overflow-hidden">
                        <AppSidebar />
                        <SidebarInset className="bg-[#151515] flex flex-col overflow-hidden">
                            {children}
                        </SidebarInset>
                    </SidebarProvider>
                </SpatialProvider>
            </DashboardProvider>
        </ReportsProvider>
    );
}
