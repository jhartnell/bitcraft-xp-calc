import React from 'react';

interface ProgressBarWithTicksProps {
  progressPercent: number;
  barColorClassName?: string;
  heightClassName?: string;
  showTickLabels?: boolean;
}

export const ProgressBarWithTicks: React.FC<ProgressBarWithTicksProps> = ({
  progressPercent,
  barColorClassName = 'bg-indigo-500',
  heightClassName = 'h-3',
  showTickLabels = true,
}) => {
  const clampedPercent = Math.max(0, Math.min(100, progressPercent));

  return (
    <div className="space-y-1">
      <div className={`relative w-full bg-surface rounded-full ${heightClassName} overflow-hidden border border-surface-border`}>
        <div
          className={`${barColorClassName} h-full rounded-full transition-all duration-500 shadow-sm`}
          style={{ width: `${clampedPercent}%` }}
        />
        {/* 25%, 50%, 75% Tick Dividers */}
        <div className="absolute inset-0 pointer-events-none flex justify-between">
          <div className="absolute left-[25%] top-0 bottom-0 w-[1.5px] bg-surface-border/90 shadow-[0_0_1px_rgba(255,255,255,0.4)]" />
          <div className="absolute left-[50%] top-0 bottom-0 w-[1.5px] bg-surface-border/90 shadow-[0_0_1px_rgba(255,255,255,0.4)]" />
          <div className="absolute left-[75%] top-0 bottom-0 w-[1.5px] bg-surface-border/90 shadow-[0_0_1px_rgba(255,255,255,0.4)]" />
        </div>
      </div>

      {showTickLabels && (
        <div className="flex justify-between text-[9px] text-gray-500 font-mono px-0.5 select-none">
          <span>0%</span>
          <span>25%</span>
          <span>50%</span>
          <span>75%</span>
          <span>100%</span>
        </div>
      )}
    </div>
  );
};
