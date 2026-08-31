import React from 'react';
import { ExternalLink } from 'lucide-react';

export const Footer: React.FC = () => {
  const version = import.meta.env.VITE_APP_VERSION || '1.8.3';

  return (
    <footer className="w-full border-t border-surface-border py-4 px-4 mt-auto text-xs text-gray-500 font-mono">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
        <div className="flex items-center gap-2">
          <span className="text-gray-400 font-sans font-medium">BitCraft Online XP Calculator</span>
          <span className="px-1.5 py-0.5 rounded bg-surface-subtle border border-surface-border text-emerald-400 font-bold text-[10px]">
            v{version}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] text-gray-400">
          <span>
            Powered by{' '}
            <a
              href="https://bitjita.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 hover:text-indigo-300 underline"
            >
              BitJita API
            </a>
          </span>
          <span>•</span>
          <a
            href="https://github.com/jhartnell/bitcraft-xp-calc"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-200 transition-colors flex items-center gap-1"
          >
            <span>GitHub</span>
            <ExternalLink className="w-3 h-3 text-gray-500" />
          </a>
          <span>•</span>
          <span>MIT License</span>
        </div>
      </div>
    </footer>
  );
};
