"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent } from "@/components/ui/Card"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { Database, HardDrive } from 'lucide-react'

interface StorageData {
    total: number
    free: number
    breakdown: {
        name: string
        value: number
        color: string
    }[]
}

interface StorageWidgetProps {
    className?: string
}

export default function StorageWidget({ className }: StorageWidgetProps) {
    const [data, setData] = useState<StorageData | null>(null)

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch('http://localhost:8000/api/system/storage')
                if (res.ok) {
                    const json = await res.json()
                    setData(json)
                }
            } catch (error) {
                console.error('Failed to fetch storage data:', error)
            }
        }

        fetchData()
    }, [])

    const formatBytes = (bytes: number) => {
        if (!Number.isFinite(bytes) || bytes < 0) return '0 B'
        if (bytes === 0) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
    }

    if (!data) return (
        <Card className={`bg-transparent border-none shadow-none flex flex-col overflow-hidden h-full ${className}`}>
            <CardContent className="flex-1 p-4 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            </CardContent>
        </Card>
    )

    const usedPercentage = ((data.total - data.free) / data.total) * 100

    // Filter breakdown to only show Backups and Reports
    const displayBreakdown = data.breakdown.filter(item =>
        item.name === 'Backups' || item.name === 'Reports'
    )

    // Calculate total size of displayed items (Backups + Reports)
    const totalDisplayed = displayBreakdown.reduce((acc, item) => acc + item.value, 0)

    return (
        <Card className={`bg-transparent border-none shadow-none flex flex-col overflow-hidden h-full ${className}`}>
            <CardContent className="flex-1 p-6 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-medium text-gray-200 flex items-center gap-2">
                        <Database size={18} className="text-purple-400" />
                        Storage
                    </h3>
                    <span className="text-sm text-gray-500 font-mono">
                        System {formatBytes(data.total - data.free)} / {formatBytes(data.total)}
                    </span>
                </div>

                <div className="flex-1 min-h-0 flex items-center justify-center gap-8">
                    <div className="h-full aspect-square relative max-h-[220px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={displayBreakdown}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={2}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {displayBreakdown.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '4px', fontSize: '14px' }}
                                    itemStyle={{ color: '#fff' }}
                                    formatter={(value: number) => formatBytes(value)}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="text-center">
                                <div className="text-xl font-bold text-white">{formatBytes(totalDisplayed)}</div>
                                <div className="text-xs text-gray-500">Used</div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3 min-w-[160px]">
                        {displayBreakdown.map((item) => (
                            <div key={item.name} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-3">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                                    <span className="text-gray-300">{item.name}</span>
                                </div>
                                <span className="text-gray-500 font-mono">{formatBytes(item.value)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
