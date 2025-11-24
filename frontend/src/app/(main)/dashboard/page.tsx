"use client"

import { Card, CardContent } from "@/components/ui/Card"
import TasksNotesWidget from "@/components/dashboard/TasksNotesWidget"
import StorageWidget from "@/components/dashboard/StorageWidget"
import ActiveDevicesWidget from "@/components/dashboard/ActiveDevicesWidget"
import RecentActivityWidget from "@/components/dashboard/RecentActivityWidget"
import CaseDetailsWidget from "@/components/dashboard/CaseDetailsWidget"

export default function DashboardPage() {
    return (
        <div className="h-full w-full grid grid-cols-2 gap-[9vh] bg-[#151515] text-white py-[3vh] px-[9vh]">
            {/* Left Column */}
            <div className="flex flex-col gap-4 h-full min-h-0">
                {/* Case Details - Tall (Flex-1) */}
                <div className="flex-1 min-h-0">
                    <CaseDetailsWidget />
                </div>
                {/* Active Devices & Activity - Short (43%) */}
                <div className="h-[43%] min-h-0 grid grid-cols-2 gap-4">
                    <RecentActivityWidget />
                    <ActiveDevicesWidget />
                </div>
            </div>

            {/* Right Column */}
            <div className="flex flex-col gap-4 h-full min-h-0">
                {/* Top Right - Storage (Short 43%) */}
                <div className="h-[43%] min-h-0">
                    <StorageWidget />
                </div>
                {/* Tasks & Notes - Tall (Flex-1) */}
                <div className="flex-1 min-h-0">
                    <TasksNotesWidget />
                </div>
            </div>
        </div>
    )
}
