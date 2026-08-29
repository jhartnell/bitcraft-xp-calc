import React from 'react';
import { Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react';

interface ShowPanelButtonProps {
  label: string;
  onClick: () => void;
  className?: string;
}

export const ShowPanelButton: React.FC<ShowPanelButtonProps> = ({
  label,
  onClick,
  className = '',
}) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-1.5 bg-surface-subtle hover:bg-surface-border border border-surface-border text-gray-300 hover:text-white px-3 py-1 rounded-lg transition-colors font-medium cursor-pointer ${className}`}
  >
    <Eye className="w-3.5 h-3.5 text-emerald-400" />
    <span>{label}</span>
    <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
  </button>
);

interface HidePanelButtonProps {
  onClick: () => void;
  title?: string;
  className?: string;
}

export const HidePanelButton: React.FC<HidePanelButtonProps> = ({
  onClick,
  title = 'Collapse section',
  className = '',
}) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-1 text-gray-400 hover:text-gray-200 bg-surface-subtle border border-surface-border px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer text-xs ${className}`}
    title={title}
  >
    <EyeOff className="w-3.5 h-3.5" />
    <span className="hidden sm:inline">Hide</span>
    <ChevronUp className="w-3.5 h-3.5" />
  </button>
);
