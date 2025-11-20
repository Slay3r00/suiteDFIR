import { useState } from 'react';
import { Button, Input, Dropdown } from '../ui';
import { useDropdown } from '../../hooks/useDropdown';
import { ileappApi } from '../../services/ileappApi';

interface FileSelectorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  showFolderOption?: boolean;
}

export default function FileSelector({
  value,
  onChange,
  disabled = false,
  placeholder = 'Select input file...',
  showFolderOption = true
}: FileSelectorProps) {
  const fileDropdown = useDropdown();

  const handleBrowseFiles = async () => {
    try {
      const data = await ileappApi.browser.browseFiles();
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
      const data = await ileappApi.browser.browseFolders();
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
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        className="flex-1"
      />
      <div className="relative">
        <Button
          ref={fileDropdown.buttonRef}
          onClick={fileDropdown.handleClick}
          disabled={disabled}
          variant="secondary"
        >
          Browse
        </Button>

        <Dropdown isOpen={fileDropdown.isOpen} onClose={fileDropdown.close} buttonRef={fileDropdown.buttonRef}>
          {showFolderOption && (
            <div
              onClick={handleBrowseFiles}
              className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-white hover:bg-[#3a5464] transition-colors cursor-pointer border-b border-gray-700 last:border-b-0"
            >
              Choose File
            </div>
          )}
          <div
            onClick={handleBrowseFolders}
            className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-white hover:bg-[#3a5464] transition-colors cursor-pointer last:border-b-0"
          >
            Choose Folder
          </div>
        </Dropdown>
      </div>
    </div>
  );
}