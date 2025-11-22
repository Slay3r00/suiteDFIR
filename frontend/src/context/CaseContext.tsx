"use client"

import React, { createContext, useContext, useState, useEffect } from 'react'

interface CaseContextType {
    selectedCaseId: string | null
    setSelectedCaseId: (id: string | null) => void
}

const CaseContext = createContext<CaseContextType | undefined>(undefined)

export function CaseProvider({ children }: { children: React.ReactNode }) {
    const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null)

    useEffect(() => {
        // Load from localStorage on mount
        const savedId = localStorage.getItem('selectedCaseId')
        if (savedId) {
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
        <CaseContext.Provider value={{ selectedCaseId, setSelectedCaseId }}>
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
