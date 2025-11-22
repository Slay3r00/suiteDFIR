"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Plus, Trash2, CheckSquare, FileText, Check } from 'lucide-react'
import { useToast } from "@/hooks/use-toast"
import { useCase } from "@/context/CaseContext"

interface Task {
    id: number
    content: string
    description?: string
    priority: 'low' | 'medium' | 'high'
    completed: boolean
    created_at: string
    case_id?: number
}

interface Note {
    id: number
    content: string
    description?: string
    created_at: string
    case_id?: number
}

export default function TasksNotesWidget() {
    const { selectedCaseId } = useCase()
    const [activeTab, setActiveTab] = useState<'tasks' | 'notes'>('tasks')
    const [tasks, setTasks] = useState<Task[]>([])
    const [notes, setNotes] = useState<Note[]>([])
    const [inputValue, setInputValue] = useState('')
    const [descriptionValue, setDescriptionValue] = useState('')
    const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')
    const [isLoading, setIsLoading] = useState(false)
    const { toast } = useToast()

    useEffect(() => {
        if (selectedCaseId) {
            fetchData()
        } else {
            setTasks([])
            setNotes([])
        }
    }, [selectedCaseId])

    const fetchData = async () => {
        if (!selectedCaseId) return

        try {
            const [tasksRes, notesRes] = await Promise.all([
                fetch(`http://localhost:8000/api/dashboard/tasks?case_id=${selectedCaseId}`),
                fetch(`http://localhost:8000/api/dashboard/notes?case_id=${selectedCaseId}`)
            ])

            if (tasksRes.ok) setTasks(await tasksRes.json())
            if (notesRes.ok) setNotes(await notesRes.json())
        } catch (error) {
            console.error('Failed to fetch data:', error)
        }
    }

    const handleAdd = async () => {
        if (!inputValue.trim() || !selectedCaseId) return

        setIsLoading(true)
        try {
            const endpoint = activeTab === 'tasks' ? 'tasks' : 'notes'
            const body = activeTab === 'tasks'
                ? { content: inputValue, description: descriptionValue, priority, case_id: parseInt(selectedCaseId) }
                : { content: inputValue, description: descriptionValue, case_id: parseInt(selectedCaseId) }

            const res = await fetch(`http://localhost:8000/api/dashboard/${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })

            if (!res.ok) throw new Error('Failed to create item')

            const newItem = await res.json()

            if (activeTab === 'tasks') {
                setTasks([newItem, ...tasks])
            } else {
                setNotes([newItem, ...notes])
            }
            setInputValue('')
            setDescriptionValue('')
            setPriority('medium') // Reset priority
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to create item",
                variant: "destructive"
            })
        } finally {
            setIsLoading(false)
        }
    }

    const handleToggleTask = async (id: number) => {
        try {
            // Optimistic update
            setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t))

            const res = await fetch(`http://localhost:8000/api/dashboard/tasks/${id}`, {
                method: 'PUT'
            })

            if (!res.ok) throw new Error('Failed to update task')

            // Update with server response to be sure
            const updatedTask = await res.json()
            setTasks(prev => prev.map(t => t.id === id ? updatedTask : t))
        } catch (error) {
            // Revert on error
            fetchData()
            toast({
                title: "Error",
                description: "Failed to update task",
                variant: "destructive"
            })
        }
    }

    const handleDelete = async (id: number, type: 'tasks' | 'notes') => {
        try {
            // Optimistic update
            if (type === 'tasks') {
                setTasks(tasks.filter(t => t.id !== id))
            } else {
                setNotes(notes.filter(n => n.id !== id))
            }

            const res = await fetch(`http://localhost:8000/api/dashboard/${type}/${id}`, {
                method: 'DELETE'
            })

            if (!res.ok) throw new Error('Failed to delete item')
        } catch (error) {
            // Revert on error
            fetchData()
            toast({
                title: "Error",
                description: "Failed to delete item",
                variant: "destructive"
            })
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleAdd()
        }
    }

    const getPriorityColor = (p: string) => {
        switch (p) {
            case 'high': return 'text-red-400 border-red-400/30 bg-red-400/10'
            case 'medium': return 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10'
            case 'low': return 'text-blue-400 border-blue-400/30 bg-blue-400/10'
            default: return 'text-gray-400 border-gray-400/30 bg-gray-400/10'
        }
    }

    if (!selectedCaseId) {
        return (
            <Card className="bg-[#171717] border-[#333333] flex flex-col overflow-hidden h-full">
                <CardContent className="flex items-center justify-center h-full text-gray-500">
                    <p className="text-sm">Select a case to view tasks and notes</p>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="bg-[#171717] border-[#333333] flex flex-col overflow-hidden h-full">
            <CardContent className="flex-1 flex flex-col p-0 min-h-0">
                {/* Header Section */}
                <div className="p-4 border-b border-[#333333] space-y-3 bg-[#1A1A1A]">
                    {/* Custom Tabs */}
                    <div className="flex p-1 bg-[#212121] rounded-lg w-full">
                        <button
                            onClick={() => setActiveTab('tasks')}
                            className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'tasks'
                                ? 'bg-[#333333] text-white shadow-sm'
                                : 'text-gray-400 hover:text-gray-200'
                                }`}
                        >
                            <CheckSquare size={14} />
                            Tasks
                        </button>
                        <button
                            onClick={() => setActiveTab('notes')}
                            className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'notes'
                                ? 'bg-[#333333] text-white shadow-sm'
                                : 'text-gray-400 hover:text-gray-200'
                                }`}
                        >
                            <FileText size={14} />
                            Notes
                        </button>
                    </div>

                    {/* Input Area */}
                    {/* Input Area Container */}
                    <div className="bg-[#212121] p-3 rounded-lg space-y-2.5">
                        <div className="flex gap-2">
                            <Input
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={activeTab === 'tasks' ? "Add a new task..." : "Add a new note..."}
                                className="bg-[#171717] border-[#333333] text-white placeholder:text-gray-500 h-9 text-sm focus-visible:ring-1 focus-visible:ring-gray-500"
                            />
                            {activeTab === 'tasks' && (
                                <select
                                    value={priority}
                                    onChange={(e) => setPriority(e.target.value as any)}
                                    className="h-9 bg-[#171717] border border-[#333333] text-white text-xs rounded-md px-2 outline-none focus:ring-1 focus:ring-gray-500 w-24"
                                >
                                    <option value="low">Low</option>
                                    <option value="medium">Medium</option>
                                    <option value="high">High</option>
                                </select>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Input
                                value={descriptionValue}
                                onChange={(e) => setDescriptionValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Add a description (optional)..."
                                className="bg-[#171717] border-[#333333] text-gray-300 placeholder:text-gray-500 h-9 text-xs focus-visible:ring-1 focus-visible:ring-gray-500 flex-1"
                            />
                            <Button
                                onClick={handleAdd}
                                disabled={isLoading || !inputValue.trim()}
                                size="icon"
                                className="h-9 w-9 bg-white text-black hover:bg-gray-200 shrink-0"
                            >
                                <Plus size={16} />
                            </Button>
                        </div>
                    </div>
                </div>

                {/* List Section */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {activeTab === 'tasks' ? (
                        tasks.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-500">
                                <p className="text-xs">No tasks yet</p>
                            </div>
                        ) : (
                            tasks.map((task) => (
                                <div
                                    key={task.id}
                                    className="group flex items-start gap-3 p-2.5 rounded-lg hover:bg-[#212121] transition-colors"
                                >
                                    <button
                                        onClick={() => handleToggleTask(task.id)}
                                        className={`mt-0.5 h-4 w-4 rounded border flex items-center justify-center transition-colors shrink-0 ${task.completed
                                            ? 'bg-green-500 border-green-500 text-black'
                                            : 'border-gray-500 hover:border-gray-300'
                                            }`}
                                    >
                                        {task.completed && <Check size={10} strokeWidth={4} />}
                                    </button>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className={`truncate text-sm font-medium ${task.completed ? 'text-gray-500 line-through' : 'text-gray-200'}`}>
                                                {task.content}
                                            </span>
                                            {task.priority && (
                                                <span className={`text-[9px] px-1.5 py-px rounded border ${getPriorityColor(task.priority)} uppercase font-bold tracking-wider`}>
                                                    {task.priority}
                                                </span>
                                            )}
                                        </div>
                                        {task.description && (
                                            <p className={`text-xs ${task.completed ? 'text-gray-600' : 'text-gray-400'} break-words leading-relaxed`}>
                                                {task.description}
                                            </p>
                                        )}
                                    </div>

                                    <button
                                        onClick={() => handleDelete(task.id, 'tasks')}
                                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-red-400 transition-all"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))
                        )
                    ) : (
                        notes.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-500">
                                <p className="text-xs">No notes yet</p>
                            </div>
                        ) : (
                            notes.map((note) => (
                                <div
                                    key={note.id}
                                    className="group flex items-start gap-3 p-3 rounded-lg hover:bg-[#212121] transition-colors border border-transparent hover:border-[#333333]"
                                >
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-200 whitespace-pre-wrap break-words leading-relaxed">
                                            {note.content}
                                        </p>
                                        {note.description && (
                                            <p className="text-xs text-gray-400 mt-1 whitespace-pre-wrap break-words leading-relaxed">
                                                {note.description}
                                            </p>
                                        )}
                                        <p className="text-[10px] text-gray-600 mt-2">
                                            {new Date(note.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => handleDelete(note.id, 'notes')}
                                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-red-400 transition-all shrink-0"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))
                        )
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
