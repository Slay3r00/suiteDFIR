import { Suspense, lazy, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { LoadingPage } from '@/components/ui/LoadingPage'
import { Button } from '@/components/ui/Button'
import { Settings } from 'lucide-react'
import { API } from '@/lib/api'

const SpatialMap = lazy(() => import('@/components/spatial/SpatialMap'))

export default function SpatialPage() {
    const [hasApiKey, setHasApiKey] = useState<boolean | null>(null)
    const navigate = useNavigate()

    useEffect(() => {
        checkApiKey()
    }, [])

    const checkApiKey = async () => {
        try {
            const res = await fetch(API.path("/settings/google_maps_api_key"))
            setHasApiKey(res.ok)
        } catch {
            setHasApiKey(false)
        }
    }

    // Loading state
    if (hasApiKey === null) {
        return <LoadingPage />
    }

    // Gate: no API key configured
    if (!hasApiKey) {
        return (
            <div className="h-full w-full flex flex-col items-center justify-center bg-[#151515] text-white">
                <div className="text-center space-y-4 max-w-sm">
                    <p className="text-lg font-medium text-gray-300">
                        Google Maps API Key Required
                    </p>
                    <p className="text-sm text-gray-500 leading-relaxed">
                        Configure your API key in Settings to use the geospatial viewer
                    </p>
                    <Button
                        size="sm"
                        onClick={() => navigate('/settings')}
                        className="bg-white text-black hover:bg-gray-200 gap-1.5 text-[11px] font-bold uppercase tracking-wider h-8 px-4 mt-2"
                    >
                        <Settings size={14} />
                        Go to Settings
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full w-full relative overflow-hidden">
            <Suspense fallback={<LoadingPage />}>
                <SpatialMap />
            </Suspense>
        </div>
    );
}
