"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/Card"
import { cn } from "@/lib/utils"
import { useCase } from "@/context/CaseContext"
import { User, MapPin, Phone, Building, FileText, Info } from 'lucide-react'

import { Edit2 } from 'lucide-react'
import { CaseFormDialog, Case } from "@/components/cases/CaseFormDialog"

export default function CaseDetailsWidget({ className }: { className?: string }) {
    const { selectedCaseId } = useCase()
    const [caseData, setCaseData] = useState<Case | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)

    const fetchCaseDetails = useCallback(async () => {
        setIsLoading(true)
        try {
            const res = await fetch(`http://localhost:8000/api/cases/${selectedCaseId}`)
            if (res.ok) {
                const data = await res.json()
                setCaseData(data)
            }
        } catch (error) {
            console.error('Failed to fetch case details:', error)
        } finally {
            setIsLoading(false)
        }
    }, [selectedCaseId])

    useEffect(() => {
        if (selectedCaseId) {
            fetchCaseDetails()
        } else {
            setCaseData(null)
        }
    }, [selectedCaseId, fetchCaseDetails])

    const handleCaseSaved = (savedCase: Case) => {
        setCaseData(savedCase)
    }

    if (!selectedCaseId) {
        return (
            <Card className={cn("bg-[#171717] border-[#333333] flex flex-col overflow-hidden h-full", className)}>
                <CardContent className="flex items-center justify-center h-full text-gray-500">
                    <p className="text-sm">No case selected</p>
                </CardContent>
            </Card>
        )
    }

    if (isLoading) {
        return (
            <Card className={cn("bg-[#171717] border-[#333333] flex flex-col overflow-hidden h-full", className)}>
                <CardContent className="flex items-center justify-center h-full text-gray-500">
                    <p className="text-sm">Loading case details...</p>
                </CardContent>
            </Card>
        )
    }

    if (!caseData) {
        return (
            <Card className={cn("bg-[#171717] border-[#333333] flex flex-col overflow-hidden h-full", className)}>
                <CardContent className="flex items-center justify-center h-full text-gray-500">
                    <p className="text-sm">Case not found</p>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className={cn("bg-[#171717] border-[#333333] flex flex-col overflow-hidden h-full", className)}>
            <div className="px-4 py-2 border-b border-[#333333] bg-[#1A1A1A] flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Case Overview</h3>
                    <button
                        onClick={() => setIsEditModalOpen(true)}
                        className="p-1 hover:bg-[#333333] rounded text-gray-500 hover:text-white transition-colors"
                        title="Edit Case"
                    >
                        <Edit2 size={12} />
                    </button>
                </div>
                <span className="text-[10px] font-mono text-gray-500">{caseData.case_number}</span>
            </div>
            <CardContent className="flex-1 p-6 flex flex-col min-h-0">
                <div className="grid grid-cols-2 gap-x-12 gap-y-8 mb-8 shrink-0">
                    {/* Case Name */}
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-gray-500 mb-1">
                            <FileText size={14} />
                            <span className="text-[10px] font-medium uppercase tracking-wider">Case Name</span>
                        </div>
                        <p className="text-sm text-gray-200 font-medium">{caseData.name}</p>
                    </div>

                    {/* Business Name */}
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-gray-500 mb-1">
                            <Building size={14} />
                            <span className="text-[10px] font-medium uppercase tracking-wider">Business Name</span>
                        </div>
                        <p className="text-sm text-gray-200 font-medium">{caseData.business_name || 'N/A'}</p>
                    </div>

                    {/* Investigator */}
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-gray-500 mb-1">
                            <User size={14} />
                            <span className="text-[10px] font-medium uppercase tracking-wider">Investigator</span>
                        </div>
                        <p className="text-sm text-gray-200 font-medium">{caseData.investigator_name || 'N/A'}</p>
                    </div>

                    {/* Client Name */}
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-gray-500 mb-1">
                            <User size={14} />
                            <span className="text-[10px] font-medium uppercase tracking-wider">Client Name</span>
                        </div>
                        <p className="text-sm text-gray-200 font-medium">{caseData.client_name || 'N/A'}</p>
                    </div>

                    {/* Client Location */}
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-gray-500 mb-1">
                            <MapPin size={14} />
                            <span className="text-[10px] font-medium uppercase tracking-wider">Client Location</span>
                        </div>
                        <p className="text-sm text-gray-200 font-medium">{caseData.client_location || 'N/A'}</p>
                    </div>

                    {/* Client Contact */}
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-gray-500 mb-1">
                            <Phone size={14} />
                            <span className="text-[10px] font-medium uppercase tracking-wider">Client Contact</span>
                        </div>
                        <p className="text-sm text-gray-200 font-medium">{caseData.client_contact || 'N/A'}</p>
                    </div>
                </div>

                {/* Case Description - Full Width & Fill Height */}
                <div className="flex-1 flex flex-col min-h-0 space-y-2">
                    <div className="flex items-center gap-2 text-gray-500 shrink-0">
                        <Info size={14} />
                        <span className="text-[10px] font-medium uppercase tracking-wider">Case Description</span>
                    </div>
                    <div className="flex-1 bg-[#111111] border border-[#333333] rounded-md p-3 overflow-y-auto text-sm text-gray-300 leading-relaxed">
                        <p>{caseData.description || 'No description provided.'}</p>
                    </div>
                </div>
            </CardContent>

            <CaseFormDialog
                open={isEditModalOpen}
                onOpenChange={setIsEditModalOpen}
                caseData={caseData}
                onSuccess={handleCaseSaved}
            />
        </Card>
    )
}
