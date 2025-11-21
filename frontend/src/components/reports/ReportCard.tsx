import { FileText, FolderOpen, Download, Trash2, HardDrive } from 'lucide-react';
import { Button } from '../ui';

interface Report {
    name: string;
    path: string;
    tool: 'ileapp' | 'aleapp';
    created_at: string;
    size: string;
    artifact_count: number;
}

interface ReportCardProps {
    report: Report;
    isSelected?: boolean;
    onView: (report: Report) => void;
    onOpen: (path: string) => void;
    onDownload: (path: string) => void;
    onDelete: (path: string) => void;
}

export default function ReportCard({ report, isSelected, onView, onOpen, onDownload, onDelete }: ReportCardProps) {
    const isIleapp = report.tool === 'ileapp';
    const logoSrc = isIleapp ? '/apple-logo.svg' : '/android-logo.svg';

    return (
        <div
            className={`bg-[#1A1A1A] border rounded-lg p-3 flex items-center gap-3 hover:border-white/20 transition-colors group cursor-pointer ${isSelected ? 'border-white/30' : 'border-white/10'
                }`}
            onClick={() => onView(report)}
        >
            {/* Icon/Logo */}
            <div className="h-12 w-12 flex-shrink-0 bg-white rounded-md flex items-center justify-center p-2">
                <img src={logoSrc} alt={report.tool} className="max-h-full max-w-full" />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <h3 className="text-white font-medium truncate text-sm">{report.name}</h3>
                <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                    <span className="flex items-center gap-1">
                        <FileText size={12} />
                        {new Date(report.created_at).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1">
                        <HardDrive size={12} />
                        {report.size}
                    </span>
                    <span className="px-1.5 py-0.5 bg-white/5 rounded text-[10px] border border-white/5">
                        {report.artifact_count} files
                    </span>
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onOpen(report.path)}
                    title="Open in Finder"
                    className="hover:bg-white/10 text-gray-400 hover:text-white"
                >
                    <FolderOpen size={18} />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDownload(report.path)}
                    title="Download ZIP"
                    className="hover:bg-white/10 text-gray-400 hover:text-white"
                >
                    <Download size={18} />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(report.path)}
                    title="Delete Report"
                    className="hover:bg-red-900/20 text-gray-400 hover:text-red-400"
                >
                    <Trash2 size={18} />
                </Button>
            </div>
        </div>
    );
}
