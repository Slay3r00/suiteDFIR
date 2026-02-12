import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Eye, EyeOff, Loader2, Check } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { API } from "@/lib/api"

export default function SettingsPage() {
    const navigate = useNavigate()
    const [apiKey, setApiKey] = useState("")
    const [showKey, setShowKey] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [saved, setSaved] = useState(false)
    const [hasExistingKey, setHasExistingKey] = useState(false)

    useEffect(() => {
        loadApiKey()
    }, [])

    const loadApiKey = async () => {
        try {
            const res = await fetch(API.path("/settings/google_maps_api_key"))
            if (res.ok) {
                const data = await res.json()
                setApiKey(data.value)
                setHasExistingKey(true)
            }
        } catch {
            // Key not set yet
        } finally {
            setIsLoading(false)
        }
    }

    const handleSave = async () => {
        if (!apiKey.trim()) return
        setIsSaving(true)
        setSaved(false)
        try {
            const res = await fetch(API.path("/settings/google_maps_api_key"), {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ value: apiKey.trim() }),
            })
            if (res.ok) {
                setSaved(true)
                setHasExistingKey(true)
                setTimeout(() => setSaved(false), 3000)
            }
        } catch (error) {
            console.error("Failed to save API key:", error)
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="h-full flex flex-col bg-[#151515] text-white overflow-hidden">
            {/* Back button */}
            <div className="px-8 py-6 shrink-0">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(-1)}
                    className="text-gray-400 hover:text-white gap-1.5 text-[11px] font-medium uppercase tracking-wider h-8 px-2"
                >
                    <ArrowLeft size={14} />
                    Back
                </Button>
            </div>

            {/* Content */}
            <div className="flex-1 flex items-start px-8 overflow-y-auto">
                <div className="w-full max-w-lg pb-12">

                    {/* API Key Section - Clean, no container card */}
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <h2 className="text-sm font-medium text-white">Google Maps API Key</h2>
                            <p className="text-[13px] text-gray-500">
                                Required for geospatial mapping and location search
                            </p>
                        </div>

                        {isLoading ? (
                            <div className="py-2">
                                <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                            </div>
                        ) : (
                            <div className="space-y-3 pt-1">
                                <div className="flex items-center gap-3">
                                    <div className="relative flex-1">
                                        <Input
                                            type={showKey ? "text" : "password"}
                                            value={apiKey}
                                            onChange={(e) => { setApiKey(e.target.value); setSaved(false) }}
                                            placeholder="Enter your Google Maps API key..."
                                            className="w-full pr-10 h-10 text-[13px] bg-[#1A1A1A] border border-[#333333] text-white placeholder:text-gray-600 focus-visible:ring-1 focus-visible:ring-gray-500 rounded-md"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowKey(!showKey)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                                        >
                                            {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>

                                    <Button
                                        size="sm"
                                        onClick={handleSave}
                                        disabled={!apiKey.trim() || isSaving}
                                        className="bg-white text-black hover:bg-gray-200 text-[11px] font-bold uppercase tracking-wider h-10 px-6 shrink-0"
                                    >
                                        {isSaving ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : saved ? (
                                            <><Check size={12} className="mr-1" /> Saved</>
                                        ) : (
                                            "Update"
                                        )}
                                    </Button>

                                    {hasExistingKey && !saved && (
                                        <div className="shrink-0 text-gray-500">
                                            <p className="text-[11px] font-medium">Key configured</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    )
}
