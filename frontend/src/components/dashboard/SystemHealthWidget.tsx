"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent } from "@/components/ui/Card"
import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from 'recharts'
import { Activity, Cpu, HardDrive, Zap } from 'lucide-react'

export default function SystemHealthWidget() {
    const [data, setData] = useState({ cpu: 0, ram: 0, disk: 0 })

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch('http://localhost:8000/api/system/health')
                if (res.ok) {
                    const json = await res.json()
                    setData(json)
                }
            } catch (error) {
                console.error('Failed to fetch system health:', error)
            }
        }

        fetchData()
        const interval = setInterval(fetchData, 2000)
        return () => clearInterval(interval)
    }, [])

    const chartData = [
        { name: 'CPU', value: data.cpu, fill: '#ef4444' },
        { name: 'RAM', value: data.ram, fill: '#3b82f6' },
        { name: 'Disk', value: data.disk, fill: '#10b981' }
    ]

    return (
        <Card className="bg-[#171717] border-[#333333] flex flex-col overflow-hidden h-full">
            <CardContent className="flex-1 p-4 flex flex-col relative">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-200 flex items-center gap-2">
                        <Activity size={16} className="text-blue-400" />
                        System Health
                    </h3>
                    <div className="flex gap-2 text-[10px] text-gray-500">
                        <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-red-500" />CPU</span>
                        <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-blue-500" />RAM</span>
                        <span className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-green-500" />Disk</span>
                    </div>
                </div>

                <div className="flex-1 min-h-0 relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <RadialBarChart
                            innerRadius="30%"
                            outerRadius="100%"
                            barSize={10}
                            data={chartData}
                            startAngle={90}
                            endAngle={-270}
                        >
                            <RadialBar
                                background
                                dataKey="value"
                                cornerRadius={30 / 2}
                            />
                        </RadialBarChart>
                    </ResponsiveContainer>

                    {/* Centered Stats */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="text-center">
                            <div className="text-2xl font-bold text-white">{Math.round(data.cpu)}%</div>
                            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Load</div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-2">
                    <div className="bg-[#212121] rounded p-2 flex flex-col items-center">
                        <Cpu size={14} className="text-red-400 mb-1" />
                        <span className="text-xs font-bold text-white">{data.cpu.toFixed(1)}%</span>
                    </div>
                    <div className="bg-[#212121] rounded p-2 flex flex-col items-center">
                        <Zap size={14} className="text-blue-400 mb-1" />
                        <span className="text-xs font-bold text-white">{data.ram.toFixed(1)}%</span>
                    </div>
                    <div className="bg-[#212121] rounded p-2 flex flex-col items-center">
                        <HardDrive size={14} className="text-green-400 mb-1" />
                        <span className="text-xs font-bold text-white">{data.disk.toFixed(1)}%</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
