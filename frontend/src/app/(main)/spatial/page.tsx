"use client"

import dynamic from 'next/dynamic'
import { LoadingPage } from '@/components/ui/LoadingPage'

const SpatialMap = dynamic(() => import('@/components/spatial/SpatialMap'), {
    ssr: false,
    loading: () => <LoadingPage />
})

export default function Spatial() {
    return (
        <div className="h-full w-full relative overflow-hidden">
            <SpatialMap />
        </div>
    );
}
