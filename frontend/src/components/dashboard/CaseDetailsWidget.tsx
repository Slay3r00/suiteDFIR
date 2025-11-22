"use client"

import { Card, CardContent } from "@/components/ui/Card"
import { cn } from "@/lib/utils"

import { Briefcase, User, MapPin, Phone, Building, FileText, Info } from 'lucide-react'

export default function CaseDetailsWidget({ className }: { className?: string }) {
    return (
        <Card className={cn("bg-[#171717] border-[#333333] flex flex-col overflow-hidden h-full", className)}>
            <div className="px-4 py-2 border-b border-[#333333] bg-[#1A1A1A] flex justify-between items-center">
                <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Case Overview</h3>
            </div>
            <CardContent className="flex-1 p-6 flex flex-col min-h-0">
                <div className="grid grid-cols-2 gap-x-12 gap-y-8 mb-8 shrink-0">
                    {/* Case Name */}
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-gray-500 mb-1">
                            <FileText size={14} />
                            <span className="text-[10px] font-medium uppercase tracking-wider">Case Name</span>
                        </div>
                        <p className="text-sm text-gray-200 font-medium">Operation Blackout</p>
                    </div>

                    {/* Business Name */}
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-gray-500 mb-1">
                            <Building size={14} />
                            <span className="text-[10px] font-medium uppercase tracking-wider">Business Name</span>
                        </div>
                        <p className="text-sm text-gray-200 font-medium">TechCorp Industries</p>
                    </div>

                    {/* Investigator */}
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-gray-500 mb-1">
                            <User size={14} />
                            <span className="text-[10px] font-medium uppercase tracking-wider">Investigator</span>
                        </div>
                        <p className="text-sm text-gray-200 font-medium">Det. Sarah Connor</p>
                    </div>

                    {/* Client Name */}
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-gray-500 mb-1">
                            <User size={14} />
                            <span className="text-[10px] font-medium uppercase tracking-wider">Client Name</span>
                        </div>
                        <p className="text-sm text-gray-200 font-medium">John Doe</p>
                    </div>

                    {/* Client Location */}
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-gray-500 mb-1">
                            <MapPin size={14} />
                            <span className="text-[10px] font-medium uppercase tracking-wider">Client Location</span>
                        </div>
                        <p className="text-sm text-gray-200 font-medium">San Francisco, CA</p>
                    </div>

                    {/* Client Contact */}
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-gray-500 mb-1">
                            <Phone size={14} />
                            <span className="text-[10px] font-medium uppercase tracking-wider">Client Contact</span>
                        </div>
                        <p className="text-sm text-gray-200 font-medium">+1 (555) 012-3456</p>
                    </div>
                </div>

                {/* Case Description - Full Width & Fill Height */}
                <div className="flex-1 flex flex-col min-h-0 space-y-2">
                    <div className="flex items-center gap-2 text-gray-500 shrink-0">
                        <Info size={14} />
                        <span className="text-[10px] font-medium uppercase tracking-wider">Case Description</span>
                    </div>
                    <div className="flex-1 bg-[#111111] border border-[#333333] rounded-md p-3 overflow-y-auto text-sm text-gray-300 leading-relaxed">
                        <p>
                            Investigation into alleged unauthorized data exfiltration involving internal servers. Suspect device seized for forensic analysis.
                        </p>
                        <p className="mt-2">
                            Initial reports indicate potential involvement of external actors. Several encrypted volumes discovered on the primary drive requiring brute-force decryption. Chain of custody log initiated and all physical evidence secured in Evidence Room B.
                        </p>
                        <p className="mt-2">
                            Preliminary scan shows traces of deleted log files and suspicious network activity timestamps matching the incident report.
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
