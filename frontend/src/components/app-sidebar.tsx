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
    ios: [
        {
            title: "Analysis (iLEAPP)",
            url: "/ileapp",
            icon: Smartphone,
        },
        {
            title: "Backup (libimobile)",
            url: "/backup",
            icon: Archive,
        },
    ],
    android: [
        {
            title: "Analysis (aLEAPP)",
            url: "/aleapp",
            icon: Smartphone,
        },
    ],

    data_analysis: [
        {
            title: "Timeline",
            url: "/timeline",
            icon: Clock,
        },
        {
            title: "GeoSpatial",
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
                    <SidebarGroupContent className="space-y-4">
                        <div className="flex flex-col group-data-[state=expanded]:pl-4">
                            <div className="px-2 py-1.5 text-[10px] font-medium text-sidebar-foreground/70 uppercase group-data-[state=collapsed]:hidden">
                                iOS
                            </div>
                            <SidebarMenu>
                                {data.ios.map((item) => (
                                    <SidebarMenuItem key={item.title}>
                                        <SidebarMenuButton asChild tooltip={item.title} isActive={pathname === item.url}>
                                            <a href={item.url}>
                                                <item.icon />
                                                <span>
                                                    {item.title.split(" (")[0]}
                                                    {item.title.includes(" (") && (
                                                        <span className="text-[10px] text-muted-foreground/80 ml-1">
                                                            ({item.title.split(" (")[1]}
                                                        </span>
                                                    )}
                                                </span>
                                            </a>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        </div>

                        <div className="flex flex-col group-data-[state=expanded]:pl-4">
                            <div className="px-2 py-1.5 text-[10px] font-medium text-sidebar-foreground/70 uppercase group-data-[state=collapsed]:hidden">
                                Android
                            </div>
                            <SidebarMenu>
                                {data.android.map((item) => (
                                    <SidebarMenuItem key={item.title}>
                                        <SidebarMenuButton asChild tooltip={item.title} isActive={pathname === item.url}>
                                            <a href={item.url}>
                                                <item.icon />
                                                <span>
                                                    {item.title.split(" (")[0]}
                                                    {item.title.includes(" (") && (
                                                        <span className="text-[10px] text-muted-foreground/80 ml-1">
                                                            ({item.title.split(" (")[1]}
                                                        </span>
                                                    )}
                                                </span>
                                            </a>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        </div>
                    </SidebarGroupContent>
                </SidebarGroup>

                <SidebarGroup>
                    <SidebarGroupLabel>Data Analysis</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {data.data_analysis.map((item) => (
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
                <SidebarMenu className="flex-row gap-1 group-data-[state=collapsed]:flex-col">
                    <SidebarMenuItem className="flex-[2]">
                        <SidebarMenuButton
                            tooltip="Back to Cases"
                            onClick={() => router.push('/cases')}
                            className="h-10 hover:bg-sidebar-accent px-3 gap-2 group-data-[state=collapsed]:justify-center"
                        >
                            <ChevronLeft className="h-4 w-4 shrink-0" />
                            <span className="text-xs font-medium truncate group-data-[state=collapsed]:hidden">Back to Cases</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem className="flex-1">
                        <SidebarMenuButton
                            asChild
                            tooltip="Settings"
                            isActive={pathname === "/preferences"}
                            className="justify-center h-10 hover:bg-sidebar-accent"
                        >
                            <a href="/preferences">
                                <Settings className="h-5 w-5" />
                            </a>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </Sidebar>
    )
}
