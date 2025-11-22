import { cookies } from "next/headers";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

export default async function MainLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const cookieStore = await cookies();
    const defaultOpen = cookieStore.get("sidebar_state")?.value === "true";

    return (
        <SidebarProvider defaultOpen={defaultOpen} className="h-screen overflow-hidden">
            <AppSidebar />
            <main className="flex-1 overflow-hidden">
                {children}
            </main>
        </SidebarProvider>
    );
}
