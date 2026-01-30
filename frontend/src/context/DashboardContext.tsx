
import React, { createContext, useContext, useState, useEffect } from 'react'

interface DashboardContextType {
    activeTab: 'tasks' | 'notes';
    taskInput: string;
    taskDescription: string;
    taskPriority: 'Low' | 'Medium' | 'High';
    noteInput: string;
    noteDescription: string;

    setActiveTab: (tab: 'tasks' | 'notes') => void;
    setTaskInput: (val: string) => void;
    setTaskDescription: (val: string) => void;
    setTaskPriority: (val: 'Low' | 'Medium' | 'High') => void;
    setNoteInput: (val: string) => void;
    setNoteDescription: (val: string) => void;

    isStateLoaded: boolean;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined)

import { useCase } from './CaseContext';

const STORAGE_KEY_PREFIX = 'vdf_dashboard_state_';

interface StoredState {
    activeTab: 'tasks' | 'notes';
    taskInput: string;
    taskDescription: string;
    taskPriority: 'Low' | 'Medium' | 'High';
    noteInput: string;
    noteDescription: string;
}

export function DashboardProvider({ children }: { children: React.ReactNode }) {
    const { selectedCaseId } = useCase();
    const [activeTab, setActiveTab] = useState<'tasks' | 'notes'>('tasks');
    const [taskInput, setTaskInput] = useState('');
    const [taskDescription, setTaskDescription] = useState('');
    const [taskPriority, setTaskPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
    const [noteInput, setNoteInput] = useState('');
    const [noteDescription, setNoteDescription] = useState('');
    const [isStateLoaded, setIsStateLoaded] = useState(false);

    // Load state from sessionStorage when selectedCaseId changes
    useEffect(() => {
        if (!selectedCaseId) {
            setIsStateLoaded(true);
            return;
        }

        setIsStateLoaded(false);

        try {
            const stored = sessionStorage.getItem(`${STORAGE_KEY_PREFIX}${selectedCaseId}`);
            if (stored) {
                const parsed: StoredState = JSON.parse(stored);
                if (parsed.activeTab) setActiveTab(parsed.activeTab);
                if (parsed.taskInput !== undefined) setTaskInput(parsed.taskInput);
                else setTaskInput('');
                if (parsed.taskDescription !== undefined) setTaskDescription(parsed.taskDescription);
                else setTaskDescription('');
                if (parsed.taskPriority) setTaskPriority(parsed.taskPriority);
                else setTaskPriority('Medium');
                if (parsed.noteInput !== undefined) setNoteInput(parsed.noteInput);
                else setNoteInput('');
                if (parsed.noteDescription !== undefined) setNoteDescription(parsed.noteDescription);
                else setNoteDescription('');
            } else {
                // Reset to defaults
                setActiveTab('tasks');
                setTaskInput('');
                setTaskDescription('');
                setTaskPriority('Medium');
                setNoteInput('');
                setNoteDescription('');
            }
        } catch (error) {
            console.error('Failed to load dashboard state:', error);
            // Reset to defaults on error
            setActiveTab('tasks');
            setTaskInput('');
            setTaskDescription('');
            setTaskPriority('Medium');
            setNoteInput('');
            setNoteDescription('');
        }
        setIsStateLoaded(true);
    }, [selectedCaseId]);

    // Save state to sessionStorage on change
    useEffect(() => {
        if (!isStateLoaded || !selectedCaseId) return;

        try {
            const state: StoredState = {
                activeTab,
                taskInput,
                taskDescription,
                taskPriority,
                noteInput,
                noteDescription
            };
            sessionStorage.setItem(`${STORAGE_KEY_PREFIX}${selectedCaseId}`, JSON.stringify(state));
        } catch (error) {
            console.error('Failed to save dashboard state:', error);
        }
    }, [activeTab, taskInput, taskDescription, taskPriority, noteInput, noteDescription, isStateLoaded, selectedCaseId]);

    return (
        <DashboardContext.Provider value={{
            activeTab,
            taskInput,
            taskDescription,
            taskPriority,
            noteInput,
            noteDescription,
            setActiveTab,
            setTaskInput,
            setTaskDescription,
            setTaskPriority,
            setNoteInput,
            setNoteDescription,
            isStateLoaded
        }}>
            {children}
        </DashboardContext.Provider>
    )
}

export function useDashboard() {
    const context = useContext(DashboardContext)
    if (context === undefined) {
        throw new Error('useDashboard must be used within a DashboardProvider')
    }
    return context
}
