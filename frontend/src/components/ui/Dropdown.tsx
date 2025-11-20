import { useRef, useEffect } from 'react';

interface DropdownProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  align?: 'left' | 'right';
  buttonRef?: React.RefObject<HTMLButtonElement>;
}

export default function Dropdown({ isOpen, onClose, children, align = 'right', buttonRef }: DropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // Don't close if clicking inside dropdown
      if (dropdownRef.current && dropdownRef.current.contains(target)) {
        return;
      }

      // Don't close if clicking on the button that opened this dropdown
      if (buttonRef?.current && buttonRef.current.contains(target)) {
        return;
      }

      // Close if clicking anywhere else
      if (isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, buttonRef]);

  if (!isOpen) return null;

  return (
    <div
      ref={dropdownRef}
      className={`absolute top-full mt-2 z-50 w-fit ${
        align === 'left' ? 'left-0' : 'right-0'
      }`}
    >
      <div className="bg-[#30444f] rounded-lg shadow-xl overflow-hidden">
        {children}
      </div>
    </div>
  );
}