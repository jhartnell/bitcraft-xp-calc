import { useState, useRef, useCallback } from 'react';

export function useHoverPopoverState(delayMs = 150) {
  const [isOpen, setIsOpen] = useState(false);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    setIsOpen(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    hideTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, delayMs);
  }, [delayMs]);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  return {
    isOpen,
    setIsOpen,
    handleMouseEnter,
    handleMouseLeave,
    toggle,
  };
}
