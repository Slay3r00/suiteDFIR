"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { cn } from "@/lib/utils"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from "@/components/ui/Dialog"

// --- Types ---
export type CaseStatus = 'Active' | 'Closed' | 'Archived'
export type CasePriority = 'High' | 'Medium' | 'Low'

export interface Case {
    id: number
    case_number: string
    name: string
    business_name: string
    investigator_name: string
    client_name: string
    client_location: string
    client_contact: string
    description: string
    status: CaseStatus
    priority: CasePriority
    created_at: string
}

interface CaseFormDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    caseData?: Case | null
    onSuccess: (savedCase: Case) => void
}

const Label = ({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
    <label className={cn("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", className)} {...props} />
)

export function CaseFormDialog({ open, onOpenChange, caseData, onSuccess }: CaseFormDialogProps) {
    const [formData, setFormData] = useState<Partial<Case>>({})

    useEffect(() => {
        if (open) {
            if (caseData) {
                setFormData({ ...caseData })
            } else {
                setFormData({
                    status: 'Active',
                    priority: 'Medium',
                    case_number: `2024-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}` // Auto-gen for now
                })
            }
        }
    }, [open, caseData])

    const handleSave = async () => {
        try {
            if (caseData) {
                // Update
                const res = await fetch(`http://localhost:8000/api/cases/${caseData.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                })
                if (res.ok) {
                    const updatedCase = await res.json()
                    onSuccess(updatedCase)
                    onOpenChange(false)
                }
            } else {
                // Create
                const res = await fetch('http://localhost:8000/api/cases', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                })
                if (res.ok) {
                    const newCase = await res.json()
                    onSuccess(newCase)
                    onOpenChange(false)
                }
            }
        } catch (error) {
            console.error('Failed to save case:', error)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-[#1A1A1A] border-[#333333] text-white max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{caseData ? 'Edit Case' : 'Create New Case'}</DialogTitle>
                    <DialogDescription className="text-gray-400">
                        {caseData ? 'Update case details below.' : 'Enter the details for the new investigation.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-4 py-4">
                    {/* Case Name */}
                    <div className="col-span-2 space-y-2">
                        <Label htmlFor="name" className="text-gray-400 text-xs uppercase">Case Name</Label>
                        <Input
                            id="name"
                            value={formData.name || ''}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            className="bg-[#111111] border-[#333333]"
                        />
                    </div>

                    {/* Business Name */}
                    <div className="space-y-2">
                        <Label htmlFor="business" className="text-gray-400 text-xs uppercase">Business Name</Label>
                        <Input
                            id="business"
                            value={formData.business_name || ''}
                            onChange={e => setFormData({ ...formData, business_name: e.target.value })}
                            className="bg-[#111111] border-[#333333]"
                        />
                    </div>

                    {/* Investigator */}
                    <div className="space-y-2">
                        <Label htmlFor="investigator" className="text-gray-400 text-xs uppercase">Investigator</Label>
                        <Input
                            id="investigator"
                            value={formData.investigator_name || ''}
                            onChange={e => setFormData({ ...formData, investigator_name: e.target.value })}
                            className="bg-[#111111] border-[#333333]"
                        />
                    </div>

                    {/* Client Name */}
                    <div className="space-y-2">
                        <Label htmlFor="client" className="text-gray-400 text-xs uppercase">Client Name</Label>
                        <Input
                            id="client"
                            value={formData.client_name || ''}
                            onChange={e => setFormData({ ...formData, client_name: e.target.value })}
                            className="bg-[#111111] border-[#333333]"
                        />
                    </div>

                    {/* Client Contact */}
                    <div className="space-y-2">
                        <Label htmlFor="contact" className="text-gray-400 text-xs uppercase">Client Contact</Label>
                        <Input
                            id="contact"
                            value={formData.client_contact || ''}
                            onChange={e => setFormData({ ...formData, client_contact: e.target.value })}
                            className="bg-[#111111] border-[#333333]"
                        />
                    </div>

                    {/* Client Location */}
                    <div className="col-span-2 space-y-2">
                        <Label htmlFor="location" className="text-gray-400 text-xs uppercase">Client Location</Label>
                        <Input
                            id="location"
                            value={formData.client_location || ''}
                            onChange={e => setFormData({ ...formData, client_location: e.target.value })}
                            className="bg-[#111111] border-[#333333]"
                        />
                    </div>

                    {/* Status */}
                    <div className="space-y-2">
                        <Label htmlFor="status" className="text-gray-400 text-xs uppercase">Status</Label>
                        <select
                            id="status"
                            className="w-full h-10 bg-[#111111] border border-[#333333] rounded-md px-3 text-sm text-white outline-none focus:border-gray-500"
                            value={formData.status || 'Active'}
                            onChange={e => setFormData({ ...formData, status: e.target.value as CaseStatus })}
                        >
                            <option value="Active">Active</option>
                            <option value="Closed">Closed</option>
                            <option value="Archived">Archived</option>
                        </select>
                    </div>

                    {/* Priority */}
                    <div className="space-y-2">
                        <Label htmlFor="priority" className="text-gray-400 text-xs uppercase">Priority</Label>
                        <select
                            id="priority"
                            className="w-full h-10 bg-[#111111] border border-[#333333] rounded-md px-3 text-sm text-white outline-none focus:border-gray-500"
                            value={formData.priority || 'Medium'}
                            onChange={e => setFormData({ ...formData, priority: e.target.value as CasePriority })}
                        >
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                            <option value="Low">Low</option>
                        </select>
                    </div>

                    {/* Description */}
                    <div className="col-span-2 space-y-2">
                        <Label htmlFor="description" className="text-gray-400 text-xs uppercase">Description</Label>
                        <textarea
                            id="description"
                            className="w-full min-h-[100px] bg-[#111111] border border-[#333333] rounded-md p-3 text-sm text-white outline-none focus:border-gray-500 resize-none"
                            value={formData.description || ''}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="border-[#333333] text-gray-400 hover:text-white hover:bg-[#333333]">
                        Cancel
                    </Button>
                    <Button onClick={handleSave} className="bg-white text-black hover:bg-gray-200">
                        {caseData ? 'Save Changes' : 'Create Case'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
