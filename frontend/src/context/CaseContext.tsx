import React, { createContext, useContext, useState, useEffect } from 'react'
import { Case } from "@/components/cases/CaseFormDialog"

interface CaseContextType {
    selectedCaseId: string | null
    setSelectedCaseId: (id: string | null) => void
    cases: Case[]
    setCases: React.Dispatch<React.SetStateAction<Case[]>>
}

const CaseContext = createContext<CaseContextType | undefined>(undefined)

export function CaseProvider({ children }: { children: React.ReactNode }) {
    const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null)
    const [cases, setCases] = useState<Case[]>([])

    useEffect(() => {
        // Load from localStorage on mount
        const savedId = localStorage.getItem('selectedCaseId')
        if (savedId) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setSelectedCaseId(savedId)
        }
    }, [])

    useEffect(() => {
        // Save to localStorage on change
        if (selectedCaseId) {
            localStorage.setItem('selectedCaseId', selectedCaseId)
        } else {
            localStorage.removeItem('selectedCaseId')
        }
    }, [selectedCaseId])

    return (
        <CaseContext.Provider value={{ selectedCaseId, setSelectedCaseId, cases, setCases }}>
            {children}
        </CaseContext.Provider>
    )
}

export function useCase() {
    const context = useContext(CaseContext)
    if (context === undefined) {
        throw new Error('useCase must be used within a CaseProvider')
    }
    return context
}
