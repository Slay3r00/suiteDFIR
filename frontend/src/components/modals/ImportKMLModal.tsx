
import React, { useState, useRef } from "react"
import { Upload, X, FileText, Loader2, Save, Eye } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/Dialog"
import { Button } from "@/components/ui/Button"
import { cn } from "@/lib/utils"
import { API } from "@/lib/api"
import { parseKmlText } from "@/lib/kmlUtils"
import JSZip from "jszip"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import type { GeoJsonObject } from "geojson"

interface ImportKMLModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onImportTemporary: (data: GeoJsonObject, fileName?: string) => void
    onImportPersistent: () => void
}

export function ImportKMLModal({ open, onOpenChange, onImportTemporary, onImportPersistent }: ImportKMLModalProps) {
    const [files, setFiles] = useState<File[]>([])
    const [isDragging, setIsDragging] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }

    const handleDragLeave = () => {
        setIsDragging(false)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            validateAndSetFiles(Array.from(e.dataTransfer.files))
        }
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            validateAndSetFiles(Array.from(e.target.files))
        }
    }

    const validateAndSetFiles = (selectedFiles: File[]) => {
        const validExtensions = ['.kml', '.kmz']
        const validFiles = selectedFiles.filter(file => {
            const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
            return validExtensions.includes(ext)
        })

        if (validFiles.length > 0) {
            setFiles(prev => [...prev, ...validFiles])
        }
        if (validFiles.length !== selectedFiles.length) {
            console.warn(`${selectedFiles.length - validFiles.length} file(s) skipped due to invalid type`)
        }
    }

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index))
    }

    const handleViewTemporarily = async () => {
        if (files.length === 0) return
        setIsProcessing(true)

        try {
            for (const file of files) {
                let kmlText = ""

                if (file.name.endsWith('.kml')) {
                    kmlText = await file.text()
                } else if (file.name.endsWith('.kmz')) {
                    const zip = await JSZip.loadAsync(file)
                    const kmlFile = Object.values(zip.files).find(f => f.name.endsWith('.kml'))
                    if (kmlFile) {
                        kmlText = await kmlFile.async('string')
                    } else {
                        throw new Error("No KML file found in KMZ archive")
                    }
                }

                const geojson = parseKmlText(kmlText)
                onImportTemporary(geojson, file.name)
            }
            resetAndClose()
        } catch (error) {
            console.error("Failed to parse file:", error)
        } finally {
            setIsProcessing(false)
        }
    }

    const handleSaveAndView = async () => {
        if (files.length === 0) return
        setIsProcessing(true)

        try {
            // Upload all files
            for (const file of files) {
                const formData = new FormData()
                formData.append("file", file)

                const res = await fetch(API.path("/spatial/import"), {
                    method: "POST",
                    body: formData
                })

                if (!res.ok) {
                    console.error(`Upload failed for ${file.name}`)
                }
            }

            onImportPersistent() // Trigger re-fetch list
            resetAndClose()
        } catch (error) {
            console.error("Failed to save files:", error)
        } finally {
            setIsProcessing(false)
        }
    }

    const resetAndClose = () => {
        setFiles([])
        setIsProcessing(false)
        onOpenChange(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    const totalSize = files.reduce((sum, f) => sum + f.size, 0)

    return (
        <Dialog open={open} onOpenChange={(val) => {
            if (!val) resetAndClose()
            else onOpenChange(val)
        }}>
            <DialogContent className="max-w-[440px] p-0 bg-[#1A1A1A] border-[#333333] rounded-xl shadow-2xl overflow-hidden text-gray-100">
                <DialogHeader className="p-5 pb-2">
                    <DialogTitle className="text-sm font-semibold tracking-wide uppercase flex items-center gap-2 text-gray-300">
                        <Upload className="w-4 h-4 text-gray-400" />
                        Import Spatial Data
                    </DialogTitle>
                </DialogHeader>

                <div className="p-5 pt-2">
                    {files.length === 0 ? (
                        <div
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={cn(
                                "border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 group",
                                isDragging
                                    ? "border-gray-500 bg-[#262626]"
                                    : "border-[#333] hover:border-[#444] hover:bg-[#1f1f1f]"
                            )}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".kml,.kmz"
                                multiple
                                className="hidden"
                                onChange={handleFileSelect}
                            />
                            <div className="w-12 h-12 rounded-full bg-[#262626] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                <Upload className="w-5 h-5 text-gray-500 group-hover:text-gray-300" />
                            </div>
                            <p className="text-sm font-medium text-gray-400">Click to upload or drag & drop</p>
                            <p className="text-xs text-gray-600 mt-1">Supports .kml and .kmz (multiple files)</p>
                        </div>
                    ) : (
                        <div className="space-y-2 animate-in fade-in zoom-in-95 duration-200">
                            {/* File count summary */}
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs text-gray-500">
                                    {files.length} file{files.length !== 1 ? 's' : ''} selected ({(totalSize / 1024).toFixed(1)} KB total)
                                </span>
                                <button
                                    onClick={() => setFiles([])}
                                    className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                                >
                                    Clear all
                                </button>
                            </div>

                            {/* File list */}
                            <div className="max-h-[180px] overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                                {files.map((file, index) => (
                                    <div
                                        key={`${file.name}-${index}`}
                                        className="bg-[#212121] rounded-lg p-3 border border-[#333] flex items-center justify-between"
                                    >
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="w-8 h-8 rounded bg-[#262626] flex items-center justify-center flex-shrink-0">
                                                <FileText className="w-4 h-4 text-gray-400" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-medium text-gray-300 truncate">{file.name}</p>
                                                <p className="text-[10px] text-gray-600">{(file.size / 1024).toFixed(1)} KB</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => removeFile(index)}
                                            className="p-1 hover:bg-[#333] rounded-full transition-colors"
                                        >
                                            <X className="w-3.5 h-3.5 text-gray-500 hover:text-gray-300" />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {/* Add more files button */}
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full py-2 text-xs text-gray-500 hover:text-gray-300 border border-dashed border-[#333] hover:border-[#444] rounded-lg transition-colors"
                            >
                                + Add more files
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".kml,.kmz"
                                multiple
                                className="hidden"
                                onChange={handleFileSelect}
                            />
                        </div>
                    )}

                    <div className="mt-5 flex flex-col gap-2.5">
                        <Button
                            onClick={handleViewTemporarily}
                            disabled={files.length === 0 || isProcessing}
                            variant="secondary"
                            className="w-full justify-between bg-[#212121] hover:bg-[#2a2a2a] text-gray-300 border border-[#333] h-11"
                        >
                            <span className="flex items-center gap-2">
                                <Eye className="w-4 h-4" />
                                View Temporarily
                            </span>
                            <span className="text-[9px] bg-[#1a1a1a] px-2 py-0.5 rounded text-gray-500 uppercase tracking-wider font-medium">Session Only</span>
                        </Button>

                        <Button
                            onClick={handleSaveAndView}
                            disabled={files.length === 0 || isProcessing}
                            className="w-full justify-between bg-[#333333] hover:bg-[#404040] text-gray-200 h-11 border border-[#444]"
                        >
                            <span className="flex items-center gap-2">
                                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Save & View
                            </span>
                            <span className="text-[9px] bg-[#262626] px-2 py-0.5 rounded text-gray-400 uppercase tracking-wider font-medium">Persists</span>
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
