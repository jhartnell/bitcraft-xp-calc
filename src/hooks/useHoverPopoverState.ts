import { useState, useRef, useCallback, useEffect } from 'react';

export function useHoverPopoverState(delayMs = 150) {
  const [isOpen, setIsOpen] = useState(false);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimeoutRef.current !== null) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  const handleMouseEnter = useCallback(() => {
    clearHideTimer();
    setIsOpen(true);
  }, [clearHideTimer]);

  const handleMouseLeave = useCallback(() => {
    clearHideTimer();
    hideTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
      hideTimeoutRef.current = null;
    }, delayMs);
  }, [clearHideTimer, delayMs]);

  const toggle = useCallback(() => {
    clearHideTimer();
    setIsOpen((prev) => !prev);
  }, [clearHideTimer]);

  const close = useCallback(() => {
    clearHideTimer();
    setIsOpen(false);
  }, [clearHideTimer]);

  // Clear pending timeout on unmount
  useEffect(() => {
    return () => {
      clearHideTimer();
    };
  }, [clearHideTimer]);

  // Close open popover when pressing Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, close]);

  return {
    isOpen,
    setIsOpen,
    handleMouseEnter,
    handleMouseLeave,
    toggle,
    close,
  };
}
