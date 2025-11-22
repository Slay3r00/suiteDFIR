"use client"

import { Card, CardContent } from "@/components/ui/Card"
import TasksNotesWidget from "@/components/dashboard/TasksNotesWidget"
import StorageWidget from "@/components/dashboard/StorageWidget"
import ActiveDevicesWidget from "@/components/dashboard/ActiveDevicesWidget"
import RecentActivityWidget from "@/components/dashboard/RecentActivityWidget"
import CaseDetailsWidget from "@/components/dashboard/CaseDetailsWidget"

export default function DashboardPage() {
    return (
        <div className="h-full w-full grid grid-cols-2 gap-4 bg-[#151515] text-white py-[3vh] px-[9vh]">
            {/* Left Column */}
            <div className="flex flex-col gap-4 h-full min-h-0">
                {/* Case Details - Tall (Flex-1) */}
                <div className="flex-1 min-h-0">
                    <CaseDetailsWidget />
                </div>
                {/* Storage - Short (1/3) */}
                <div className="h-1/3 min-h-0">
                    <StorageWidget />
                </div>
            </div>

            {/* Right Column */}
            <div className="flex flex-col gap-4 h-full min-h-0">
                {/* Top Right - Devices & Activity (Short 1/3) */}
                <div className="h-1/3 min-h-0 grid grid-cols-2 gap-4">
                    <ActiveDevicesWidget />
                    <RecentActivityWidget />
                </div>
                {/* Tasks & Notes - Tall (Flex-1) */}
                <div className="flex-1 min-h-0">
                    <TasksNotesWidget />
                </div>
            </div>
        </div>
    )
}
