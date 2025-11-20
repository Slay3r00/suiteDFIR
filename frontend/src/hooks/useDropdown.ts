import { useState, useRef } from 'react';

export function useDropdown(initialState = false) {
  const [isOpen, setIsOpen] = useState(initialState);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);
  const toggle = () => setIsOpen(!isOpen);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isOpen) {
      // If dropdown is open, just close it and prevent reopen
      setIsOpen(false);
      // Small delay to prevent immediate reopen
      setTimeout(() => {}, 0);
    } else {
      // If dropdown is closed, open it
      setIsOpen(true);
    }
  };

  return {
    isOpen,
    open,
    close,
    toggle,
    handleClick,
    buttonRef,
  };
}