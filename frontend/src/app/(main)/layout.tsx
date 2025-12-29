"use client";

import { useEffect, useState } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

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
        <SidebarProvider defaultOpen={defaultOpen} className="h-screen overflow-hidden">
            <AppSidebar />
            <main className="flex-1 overflow-hidden">
                {children}
            </main>
        </SidebarProvider>
    );
}
