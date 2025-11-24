"use client"

import dynamic from 'next/dynamic'

const SpatialMap = dynamic(() => import('@/components/spatial/SpatialMap'), {
    ssr: false,
    loading: () => (
        <div className="h-full w-full flex items-center justify-center bg-black text-muted-foreground">
            <div className="flex flex-col items-center gap-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                <p>Loading Map...</p>
            </div>
        </div>
    )
})

export default function Spatial() {
    return (
        <div className="h-full w-full relative overflow-hidden">
            <SpatialMap />
        </div>
    );
}
