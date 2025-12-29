"use client";

import { useState } from "react";
// import { Button } from "@/components/ui/Button";


type Tab = "general";

export default function PreferencesPage() {
    const [activeTab, setActiveTab] = useState<Tab>("general");
    // const [isSaving, setIsSaving] = useState(false);

    // useEffect(() => {
    //     // Placeholder for restoring general preferences if needed
    // }, []);

    // const handleSave = () => {
    //     setIsSaving(true);
    //     // Placeholder for saving general preferences
    //
    //     setTimeout(() => {
    //         setIsSaving(false);
    //     }, 600);
    // };

    return (
        <div className="h-full w-full bg-[#151515] text-white py-[3vh] px-[9vh] overflow-y-auto">
            <div className="space-y-6"> {/* Removed max-w-4xl mx-auto */}

                {/* Tabs - Minimal Text Only */}
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

                </div>

                {/* Content */}
                <div className="pt-2">
                    {activeTab === "general" && (
                        <div className="text-muted-foreground text-sm py-4">
                            No general settings available.
                        </div>
                    )}


                </div>
            </div>
        </div>
    );
}
