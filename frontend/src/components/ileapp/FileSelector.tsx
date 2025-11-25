import { useState, useRef, useEffect } from 'react';
import Dropdown from '../ui/Dropdown';
import { Input, Button } from '../ui';
import { useDropdown } from '../../hooks/useDropdown';
import { createLeappApi } from '../../services/leappApi';
import { Smartphone, HardDrive, Folder } from 'lucide-react';

// Browser endpoints are tool-agnostic, so we can use any tool
const api = createLeappApi('ileapp');

interface FileSelectorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  showFolderOption?: boolean;
  tool?: string;
  caseId?: number;
}

interface Backup {
  id: number;
  name: string;
  path: string;
  tool: string;
  device_name: string;
  device_udid: string;
  created_at: string;
  type: string;
}

export default function FileSelector({
  value,
  onChange,
  disabled = false,
  placeholder = 'Select input file...',
  showFolderOption = true,
  tool,
  caseId
}: FileSelectorProps) {
  const fileDropdown = useDropdown();
  const [backups, setBackups] = useState<Backup[]>([]);

  useEffect(() => {
    if (fileDropdown.isOpen && tool) {
      fetchBackups();
    }
  }, [fileDropdown.isOpen, tool, caseId]);

  const fetchBackups = async () => {
    try {
      console.log('Fetching backups for tool:', tool);
      const url = caseId
        ? `http://localhost:8000/api/backups?case_id=${caseId}`
        : 'http://localhost:8000/api/backups';
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        console.log('Fetched backups:', json);
        // Filter backups based on tool
        // ileapp -> ios, aleapp -> android
        const targetType = tool === 'ileapp' ? 'ios' : 'android';
        console.log('Target type:', targetType);
        const filtered = json.filter((b: any) => b.type === targetType && b.status === 'completed');
        console.log('Filtered backups:', filtered);
        setBackups(filtered);
      }
    } catch (error) {
      console.error('Failed to fetch backups:', error);
    }
  };

  const handleBrowseFiles = async () => {
    try {
      const data = await api.browser.browseFiles();
      if (data.success && data.file_path) {
        onChange(data.file_path);
        fileDropdown.close();
      }
    } catch (error) {
      console.error('File selection failed:', error);
    }
  };

  const handleBrowseFolders = async () => {
    try {
      const data = await api.browser.browseFolders();
      if (data.success && data.file_path) {
        onChange(data.file_path);
        fileDropdown.close();
      }
    } catch (error) {
      console.error('Folder selection failed:', error);
    }
  };

  return (
    <div className="flex gap-3">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="flex-1"
      />
      <div className="relative">
        <Button
          ref={fileDropdown.buttonRef as React.RefObject<HTMLButtonElement>}
          onClick={fileDropdown.handleClick}
          disabled={disabled}
          variant="secondary"
        >
          Browse
        </Button>

        <Dropdown
          isOpen={fileDropdown.isOpen}
          onClose={fileDropdown.close}
          buttonRef={fileDropdown.buttonRef as React.RefObject<HTMLButtonElement>}
          className="w-80 bg-[#1A1A1A] border border-[#333] rounded-lg shadow-xl overflow-hidden"
        >
          {/* Existing Backups Section */}
          {backups.length > 0 && (
            <div className="border-b border-[#333]">
              <div className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider bg-[#212121]">
                Existing Backups
              </div>
              <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
                {backups.map((backup) => (
                  <div
                    key={backup.id}
                    onClick={() => {
                      // For iOS backups created by idevicebackup2, the actual data is in a subdirectory named with the UDID
                      // The path stored in DB is the parent folder
                      let finalPath = backup.path;
                      if (backup.type === 'ios' && backup.device_udid) {
                        // Check if path already ends with UDID (just in case)
                        if (!finalPath.endsWith(backup.device_udid)) {
                          finalPath = `${finalPath}/${backup.device_udid}`;
                        }
                      }
                      onChange(finalPath);
                      fileDropdown.close();
                    }}
                    className="px-3 py-2 hover:bg-[#2a2a2a] cursor-pointer transition-colors flex items-center gap-3 border-b border-[#262626] last:border-b-0"
                  >
                    <div className="h-8 w-8 rounded bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                      <Smartphone size={14} className="text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-200 font-medium truncate">{backup.name}</div>
                      <div className="text-[10px] text-gray-500 flex items-center gap-1">
                        <span>{backup.device_name}</span>
                        <span>•</span>
                        <span>{new Date(backup.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Browse Options */}
          <div className="bg-[#1A1A1A]">
            <div className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider bg-[#212121] border-b border-[#333]">
              Browse System
            </div>
            {showFolderOption && (
              <div
                onClick={handleBrowseFiles}
                className="px-4 py-3 text-sm font-medium text-gray-300 hover:text-white hover:bg-[#2a2a2a] transition-colors cursor-pointer flex items-center gap-3"
              >
                <HardDrive size={16} />
                Choose File
              </div>
            )}
            <div
              onClick={handleBrowseFolders}
              className="px-4 py-3 text-sm font-medium text-gray-300 hover:text-white hover:bg-[#2a2a2a] transition-colors cursor-pointer flex items-center gap-3"
            >
              <Folder size={16} />
              Choose Folder
            </div>
          </div>
        </Dropdown>
      </div>
    </div>
  );
}