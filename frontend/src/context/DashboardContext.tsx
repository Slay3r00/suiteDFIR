"use client"

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

const STORAGE_KEY = 'vdf_dashboard_state';

interface StoredState {
    activeTab: 'tasks' | 'notes';
    taskInput: string;
    taskDescription: string;
    taskPriority: 'Low' | 'Medium' | 'High';
    noteInput: string;
    noteDescription: string;
}

export function DashboardProvider({ children }: { children: React.ReactNode }) {
    const [activeTab, setActiveTab] = useState<'tasks' | 'notes'>('tasks');
    const [taskInput, setTaskInput] = useState('');
    const [taskDescription, setTaskDescription] = useState('');
    const [taskPriority, setTaskPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
    const [noteInput, setNoteInput] = useState('');
    const [noteDescription, setNoteDescription] = useState('');
    const [isStateLoaded, setIsStateLoaded] = useState(false);

    // Load state from sessionStorage on mount
    useEffect(() => {
        try {
            const stored = sessionStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed: StoredState = JSON.parse(stored);
                if (parsed.activeTab) setActiveTab(parsed.activeTab);
                if (parsed.taskInput !== undefined) setTaskInput(parsed.taskInput);
                if (parsed.taskDescription !== undefined) setTaskDescription(parsed.taskDescription);
                if (parsed.taskPriority) setTaskPriority(parsed.taskPriority);
                if (parsed.noteInput !== undefined) setNoteInput(parsed.noteInput);
                if (parsed.noteDescription !== undefined) setNoteDescription(parsed.noteDescription);
            }
        } catch (error) {
            console.error('Failed to load dashboard state:', error);
        }
        setIsStateLoaded(true);
    }, []);

    // Save state to sessionStorage on change
    useEffect(() => {
        if (!isStateLoaded) return;

        try {
            const state: StoredState = {
                activeTab,
                taskInput,
                taskDescription,
                taskPriority,
                noteInput,
                noteDescription
            };
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (error) {
            console.error('Failed to save dashboard state:', error);
        }
    }, [activeTab, taskInput, taskDescription, taskPriority, noteInput, noteDescription, isStateLoaded]);

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
