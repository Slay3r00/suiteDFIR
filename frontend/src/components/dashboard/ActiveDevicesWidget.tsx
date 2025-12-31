"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent } from "@/components/ui/Card"
import { Smartphone, Wifi, Battery, Usb } from 'lucide-react'
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
} from "@/components/ui/carousel"
import Iphone15Pro from "@/components/ui/shadcn-io/iphone-15-pro"

interface Device {
    id: string
    name: string
    type: 'ios' | 'android'
    status: 'online' | 'offline'
    battery?: number
    connection: 'usb' | 'wifi'
}

export default function ActiveDevicesWidget() {
    const [devices, setDevices] = useState<Device[]>([])

    useEffect(() => {
        let isMounted = true;

        // Initial fetch
        const fetchDevices = async () => {
            try {
                const res = await fetch('http://localhost:8000/api/dashboard/devices');
                if (res.ok && isMounted) {
                    const data = await res.json();
                    setDevices(data);
                }
            } catch (error) {
                console.error('Failed to fetch initial devices:', error);
            }
        };
        fetchDevices();

        // Connect to unified SSE stream
        const eventSource = new EventSource('http://localhost:8000/api/stream');

        eventSource.onmessage = (event) => {
            if (!isMounted) return;
            try {
                const message = JSON.parse(event.data);
                if (message.type === 'device_update') {
                    setDevices(message.data);
                }
            } catch (error) {
                console.error('Failed to parse device update:', error);
            }
        };

        eventSource.onerror = (error) => {
            if (!isMounted) return;
            // Only log if it's not a clean close
            if (eventSource.readyState !== EventSource.CLOSED) {
                console.error('SSE connection error:', error);
            }
            eventSource.close();
        };

        return () => {
            isMounted = false;
            eventSource.close();
        };
    }, [])

    return (
        <Card className="bg-transparent border-none shadow-none flex flex-col overflow-hidden h-full">
            <div className="px-0 h-10 bg-transparent flex justify-between items-center">
                <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <Smartphone size={14} className="text-green-400/70" />
                    Active Devices
                </h3>
                <span className="text-[10px] font-mono text-gray-500 bg-[#212121] px-2 py-0.5 rounded-full uppercase tracking-wider">
                    {devices.filter(d => d.status === 'online').length} Online
                </span>
            </div>
            <CardContent className="flex-1 p-0 pt-6 flex flex-col min-h-0 relative">

                <div className="flex-1 flex items-center justify-center min-h-0 relative">
                    {devices.length === 0 ? (
                        <div className="text-center text-gray-500">
                            <Smartphone size={32} className="mx-auto mb-2 opacity-20" />
                            <p className="text-xs">No devices connected</p>
                        </div>
                    ) : (
                        <Carousel className="w-full max-w-[200px]">
                            <CarouselContent>
                                {devices.map((device) => (
                                    <CarouselItem key={device.id} className="h-full flex flex-col justify-center">
                                        <div className="flex flex-col items-center h-full justify-center py-2">
                                            <div className="relative flex-1 flex items-center justify-center w-full min-h-0">
                                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl opacity-50" />
                                                <Iphone15Pro
                                                    className="h-full max-h-[160px] w-auto drop-shadow-2xl object-contain"
                                                    src="/ios-wallpaper.jpg"
                                                />
                                            </div>

                                            <div className="mt-3 text-center space-y-1.5 shrink-0">
                                                <h4 className="text-sm font-medium text-white tracking-tight">{device.name}</h4>
                                                <div className="flex items-center justify-center gap-3 text-[10px] text-gray-400 font-medium">
                                                    {device.status === 'online' ? (
                                                        <>
                                                            <span className="flex items-center gap-1.5 bg-[#262626] px-2 py-0.5 rounded-full border border-[#333]">
                                                                <Battery size={10} className={device.battery && device.battery < 20 ? "text-red-400" : "text-green-400"} />
                                                                {device.battery}%
                                                            </span>
                                                            <span className="flex items-center gap-1.5 bg-[#262626] px-2 py-0.5 rounded-full border border-[#333]">
                                                                {device.connection === 'usb' ? <Usb size={10} className="text-blue-400" /> : <Wifi size={10} className="text-blue-400" />}
                                                                {device.connection.toUpperCase()}
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <span className="bg-[#262626] px-2 py-0.5 rounded-full border border-[#333]">Offline</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </CarouselItem>
                                ))}
                            </CarouselContent>
                            {devices.length > 1 && (
                                <>
                                    <CarouselPrevious className="left-0 bg-[#262626] border-[#333] text-white hover:bg-[#333] hover:text-white" />
                                    <CarouselNext className="right-0 bg-[#262626] border-[#333] text-white hover:bg-[#333] hover:text-white" />
                                </>
                            )}
                        </Carousel>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
