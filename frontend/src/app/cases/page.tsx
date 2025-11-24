"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useCase } from "@/context/CaseContext"
import {
    Search,
    LayoutGrid,
    List as ListIcon,
    Plus,
    Filter,
    MoreVertical,
    Briefcase,
    MapPin,
    User,
    Phone,
    Calendar,
    Shield,
    Trash2,
    Edit2,
    Building,
    ArrowRight
} from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Card, CardContent } from "@/components/ui/Card"
import { cn } from "@/lib/utils"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from "@/components/ui/Dialog"

import { CaseFormDialog, Case, CaseStatus, CasePriority } from "@/components/cases/CaseFormDialog"

export default function CaseManagementPage() {
    const router = useRouter()
    const { setSelectedCaseId } = useCase()
    const [cases, setCases] = useState<Case[]>([])
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState<CaseStatus | 'All'>('All')
    const [isLoading, setIsLoading] = useState(true)

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingCase, setEditingCase] = useState<Case | null>(null)

    // --- Fetch Data ---
    useEffect(() => {
        fetchCases()
    }, [])

    const fetchCases = async () => {
        try {
            const res = await fetch('http://localhost:8000/api/cases')
            if (res.ok) {
                const data = await res.json()
                setCases(data)
            }
        } catch (error) {
            console.error('Failed to fetch cases:', error)
        } finally {
            setIsLoading(false)
        }
    }

    // --- Derived State ---
    const filteredCases = cases.filter(c => {
        const matchesSearch =
            (c.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
            (c.case_number?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
            (c.client_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
            (c.business_name?.toLowerCase() || '').includes(searchQuery.toLowerCase())

        const matchesStatus = statusFilter === 'All' || c.status === statusFilter

        return matchesSearch && matchesStatus
    })

    // --- Handlers ---
    const handleSelectCase = (caseId: number) => {
        setSelectedCaseId(caseId.toString())
        router.push('/dashboard')
    }

    const handleOpenCreate = () => {
        setEditingCase(null)
        setIsModalOpen(true)
    }

    const handleOpenEdit = (e: React.MouseEvent, caseItem: Case) => {
        e.stopPropagation() // Prevent case selection
        setEditingCase(caseItem)
        setIsModalOpen(true)
    }

    const handleDelete = async (e: React.MouseEvent, id: number) => {
        e.stopPropagation() // Prevent case selection
        if (confirm('Are you sure you want to delete this case?')) {
            try {
                const res = await fetch(`http://localhost:8000/api/cases/${id}`, {
                    method: 'DELETE'
                })
                if (res.ok) {
                    setCases(prev => prev.filter(c => c.id !== id))
                }
            } catch (error) {
                console.error('Failed to delete case:', error)
            }
        }
    }

    const handleCaseSaved = (savedCase: Case) => {
        setCases(prev => {
            const exists = prev.find(c => c.id === savedCase.id)
            if (exists) {
                return prev.map(c => c.id === savedCase.id ? savedCase : c)
            } else {
                return [savedCase, ...prev]
            }
        })
    }

    // --- Helpers ---
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Active': return 'bg-green-500/10 text-green-500 border-green-500/20'
            case 'Closed': return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
            case 'Archived': return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
            default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
        }
    }

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'High': return 'text-red-400'
            case 'Medium': return 'text-yellow-400'
            case 'Low': return 'text-blue-400'
            default: return 'text-gray-400'
        }
    }

    return (
        <div className="h-full w-full bg-[#0A0A0A] text-white flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-8 py-6 border-b border-[#222222] bg-[#0F0F0F] flex justify-between items-center shrink-0">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Case Management</h1>
                    <p className="text-gray-400 text-sm mt-1">Manage and track all active investigations</p>
                </div>
                <Button onClick={handleOpenCreate} className="bg-white text-black hover:bg-gray-200 gap-2">
                    <Plus size={16} />
                    New Case
                </Button>
            </div>

            {/* Toolbar */}
            <div className="px-8 py-4 border-b border-[#222222] bg-[#111111] flex gap-4 items-center shrink-0">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                    <Input
                        placeholder="Search cases..."
                        className="pl-9 bg-[#1A1A1A] border-[#333333] text-white placeholder:text-gray-500 focus-visible:ring-1 focus-visible:ring-gray-500"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-2 ml-auto">
                    <select
                        className="h-9 bg-[#1A1A1A] border border-[#333333] text-sm rounded-md px-3 outline-none focus:border-gray-500 transition-colors text-gray-300"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                    >
                        <option value="All">All Status</option>
                        <option value="Active">Active</option>
                        <option value="Closed">Closed</option>
                        <option value="Archived">Archived</option>
                    </select>

                    <div className="h-9 w-[1px] bg-[#333333] mx-2" />

                    <div className="flex bg-[#1A1A1A] rounded-md border border-[#333333] p-1">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={cn(
                                "p-1.5 rounded transition-colors",
                                viewMode === 'grid' ? "bg-[#333333] text-white" : "text-gray-500 hover:text-gray-300"
                            )}
                        >
                            <LayoutGrid size={16} />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={cn(
                                "p-1.5 rounded transition-colors",
                                viewMode === 'list' ? "bg-[#333333] text-white" : "text-gray-500 hover:text-gray-300"
                            )}
                        >
                            <ListIcon size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-8">
                {isLoading ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500">
                        <p>Loading cases...</p>
                    </div>
                ) : filteredCases.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500">
                        <Briefcase size={48} className="mb-4 opacity-20" />
                        <p className="text-lg font-medium">No cases found</p>
                        <p className="text-sm">Try adjusting your search or filters</p>
                    </div>
                ) : viewMode === 'grid' ? (
                    // Grid View
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredCases.map(caseItem => (
                            <Card
                                key={caseItem.id}
                                onClick={() => handleSelectCase(caseItem.id)}
                                className="bg-[#151515] border-[#333333] hover:border-[#555555] transition-all cursor-pointer group flex flex-col hover:shadow-lg hover:bg-[#1A1A1A]"
                            >
                                <CardContent className="p-5 flex-1 flex flex-col">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">
                                                {caseItem.case_number}
                                            </span>
                                            <h3 className="font-semibold text-gray-200 group-hover:text-white transition-colors line-clamp-1" title={caseItem.name}>
                                                {caseItem.name}
                                            </h3>
                                        </div>
                                        <div className={cn("px-2 py-0.5 rounded text-[10px] font-medium border uppercase tracking-wider", getStatusColor(caseItem.status))}>
                                            {caseItem.status}
                                        </div>
                                    </div>

                                    <div className="space-y-3 flex-1">
                                        <div className="flex items-center gap-2 text-sm text-gray-400">
                                            <Building size={14} className="shrink-0" />
                                            <span className="truncate">{caseItem.business_name || 'N/A'}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-gray-400">
                                            <User size={14} className="shrink-0" />
                                            <span className="truncate">{caseItem.investigator_name || 'N/A'}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-gray-400">
                                            <MapPin size={14} className="shrink-0" />
                                            <span className="truncate">{caseItem.client_location || 'N/A'}</span>
                                        </div>
                                    </div>

                                    <div className="mt-5 pt-4 border-t border-[#222222] flex justify-between items-center">
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                            <Calendar size={12} />
                                            <span>{new Date(caseItem.created_at).toLocaleDateString()}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={cn("text-[10px] font-bold uppercase tracking-wider mr-2", getPriorityColor(caseItem.priority))}>
                                                {caseItem.priority}
                                            </span>
                                            <button
                                                onClick={(e) => handleOpenEdit(e, caseItem)}
                                                className="p-1 hover:bg-[#333333] rounded text-gray-500 hover:text-white transition-colors"
                                                title="Edit Case"
                                            >
                                                <Edit2 size={14} />
                                            </button>
                                            <button
                                                onClick={(e) => handleDelete(e, caseItem.id)}
                                                className="p-1 hover:bg-[#333333] rounded text-gray-500 hover:text-red-400 transition-colors"
                                                title="Delete Case"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : (
                    // List View
                    <div className="border border-[#333333] rounded-lg overflow-hidden bg-[#151515]">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-[#1A1A1A] text-gray-400 font-medium border-b border-[#333333]">
                                <tr>
                                    <th className="px-6 py-3 w-[120px]">Case ID</th>
                                    <th className="px-6 py-3">Case Name</th>
                                    <th className="px-6 py-3">Client / Business</th>
                                    <th className="px-6 py-3">Investigator</th>
                                    <th className="px-6 py-3 w-[100px]">Status</th>
                                    <th className="px-6 py-3 w-[100px]">Priority</th>
                                    <th className="px-6 py-3 w-[120px]">Date</th>
                                    <th className="px-6 py-3 w-[50px]"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#222222]">
                                {filteredCases.map(caseItem => (
                                    <tr
                                        key={caseItem.id}
                                        onClick={() => handleSelectCase(caseItem.id)}
                                        className="hover:bg-[#1F1F1F] transition-colors group cursor-pointer"
                                    >
                                        <td className="px-6 py-4 font-mono text-gray-500 text-xs">{caseItem.case_number}</td>
                                        <td className="px-6 py-4 font-medium text-gray-200">{caseItem.name}</td>
                                        <td className="px-6 py-4 text-gray-400">
                                            <div className="flex flex-col">
                                                <span className="text-gray-300">{caseItem.client_name}</span>
                                                <span className="text-xs text-gray-500">{caseItem.business_name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-400">{caseItem.investigator_name}</td>
                                        <td className="px-6 py-4">
                                            <span className={cn("px-2 py-0.5 rounded text-[10px] font-medium border uppercase tracking-wider inline-block", getStatusColor(caseItem.status))}>
                                                {caseItem.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={cn("text-[10px] font-bold uppercase tracking-wider", getPriorityColor(caseItem.priority))}>
                                                {caseItem.priority}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 text-xs">{new Date(caseItem.created_at).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={(e) => handleOpenEdit(e, caseItem)}
                                                    className="p-1.5 hover:bg-[#333333] rounded text-gray-500 hover:text-white transition-colors"
                                                    title="Edit Case"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={(e) => handleDelete(e, caseItem.id)}
                                                    className="p-1.5 hover:bg-[#333333] rounded text-gray-500 hover:text-red-400 transition-colors"
                                                    title="Delete Case"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create/Edit Modal */}
            <CaseFormDialog
                open={isModalOpen}
                onOpenChange={setIsModalOpen}
                caseData={editingCase}
                onSuccess={handleCaseSaved}
            />
        </div>
    )
}
