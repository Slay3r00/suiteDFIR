
export function LoadingPage() {
    return (
        <div className="flex-1 w-full flex items-center justify-center bg-[#151515] text-white min-h-[50vh]">
            <div className="flex flex-col items-center gap-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                <div className="text-sm text-gray-500">Loading...</div>
            </div>
        </div>
    );
}
