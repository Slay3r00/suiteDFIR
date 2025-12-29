"use client"

import {
    LayoutDashboard,
    FileText,
    Smartphone,
    Box,
    Clock,
    Settings,
    PanelLeft,
    Archive,
    ChevronLeft
} from "lucide-react"

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from "@/components/ui/sidebar"

import { usePathname, useRouter } from "next/navigation"

// Menu items.
const data = {
    case: [
        {
            title: "Dashboard",
            url: "/dashboard",
            icon: LayoutDashboard,
        },
        {
            title: "Reports",
            url: "/reports",
            icon: FileText,
        },
    ],
    mobile: [
        {
            title: "IOS",
            url: "/ileapp",
            icon: Smartphone,
        },
        {
            title: "Android",
            url: "/android",
            icon: Smartphone,
        },
        {
            title: "Backup",
            url: "/backup",
            icon: Archive,
        },
    ],

    visualization: [
        {
            title: "Timeline",
            url: "/timeline",
            icon: Clock,
        },
        {
            title: "Spatial",
            url: "/spatial",
            icon: Box,
        },
    ],
}


export function AppSidebar() {
    const { toggleSidebar } = useSidebar()
    const pathname = usePathname()
    const router = useRouter()

    return (
        <Sidebar collapsible="icon">
            <SidebarHeader>
                <div className="flex items-center justify-between p-2 group-data-[collapsible=icon]:justify-center">
                    <div className="flex items-center gap-2 overflow-hidden group-data-[state=expanded]:w-full">
                        <ChevronLeft
                            className="h-4 w-4 text-white opacity-70 flex-shrink-0 group-data-[state=collapsed]:hidden cursor-pointer hover:opacity-100 transition-opacity"
                            onClick={() => router.push('/cases')}
                        />
                        <div className="flex flex-col overflow-hidden whitespace-nowrap opacity-0 max-w-0 group-data-[state=expanded]:opacity-100 group-data-[state=expanded]:max-w-[200px] group-data-[state=expanded]:transition-[opacity,max-width] group-data-[state=expanded]:duration-300 group-data-[state=expanded]:ease-in-out group-data-[state=expanded]:delay-200">
                            <span className="text-lg font-bold text-white">VDF Tools</span>
                            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">Forensic Toolkit</span>
                        </div>
                    </div>
                    <button onClick={toggleSidebar} className="p-1 hover:bg-sidebar-accent rounded-md text-sidebar-foreground flex-shrink-0">
                        <PanelLeft className="h-5 w-5" />
                    </button>
                </div>
            </SidebarHeader>
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Case</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {data.case.map((item) => (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton asChild tooltip={item.title} isActive={pathname === item.url}>
                                        <a href={item.url}>
                                            <item.icon />
                                            <span>{item.title}</span>
                                        </a>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
                <SidebarGroup>
                    <SidebarGroupLabel>Mobile Tools</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {data.mobile.map((item) => (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton asChild tooltip={item.title} isActive={pathname === item.url}>
                                        <a href={item.url}>
                                            <item.icon />
                                            <span>{item.title}</span>
                                        </a>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                <SidebarGroup>
                    <SidebarGroupLabel>Visualization</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {data.visualization.map((item) => (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton asChild tooltip={item.title} isActive={pathname === item.url}>
                                        <a href={item.url}>
                                            <item.icon />
                                            <span>{item.title}</span>
                                        </a>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
            <SidebarFooter>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild tooltip="Preferences" isActive={pathname === "/preferences"}>
                            <a href="/preferences">
                                <Settings className="h-5 w-5" />
                                <span>Preferences</span>
                            </a>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </Sidebar>
    )
}
