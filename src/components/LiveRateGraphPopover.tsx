import React, { useState, useRef, useEffect } from 'react';
import { Zap, Trophy, Clock, Sparkles, RotateCcw, Activity, TrendingUp } from 'lucide-react';
import { SessionRateStats, SessionRatePoint } from '../types/calculator';
import { formatTimeSeconds, formatXp } from '../services/bitcraftData';

interface LiveRateGraphPopoverProps {
  sessionStats?: SessionRateStats | null;
  theoreticalXpPerHour: number;
  onResetSession?: () => void;
  children: React.ReactNode;
}

export const LiveRateGraphPopover: React.FC<LiveRateGraphPopoverProps> = ({
  sessionStats,
  theoreticalXpPerHour,
  onResetSession,
  children,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<SessionRatePoint | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
      setHoveredPoint(null);
    }, 250);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const history = sessionStats?.history || [];

  // Determine clean dynamic scale with baseline at 0 for visual proportion
  const allRates = [
    theoreticalXpPerHour,
    ...(history.map((h) => h.xpPerHour) || []),
    ...(history.map((h) => h.theoreticalXpPerHour || theoreticalXpPerHour) || []),
  ];
  const rawMax = Math.max(...allRates, 1000);
  // Round maxRate up to nearest clean step (e.g. 200k, 250k) with top headroom
  const step = rawMax > 100000 ? 50000 : rawMax > 20000 ? 10000 : 5000;
  const maxRate = Math.max(step * 2, Math.ceil((rawMax * 1.2) / step) * step);
  const minRate = 0;

  // SVG dimensions
  const svgWidth = 460;
  const svgHeight = 165;
  const paddingLeft = 56; // Left margin for Y-axis scale numbers
  const paddingRight = 16;
  const paddingTop = 16;
  const paddingBottom = 22;
  const graphWidth = svgWidth - paddingLeft - paddingRight;
  const graphHeight = svgHeight - paddingTop - paddingBottom;

  // Build Live Rate points
  const livePoints = history.map((pt, idx) => {
    const x = paddingLeft + (idx / Math.max(1, history.length - 1)) * graphWidth;
    const normalizedY = (pt.xpPerHour - minRate) / Math.max(1, maxRate - minRate);
    const y = paddingTop + (1 - Math.max(0, Math.min(1, normalizedY))) * graphHeight;
    return { x, y, pt };
  });

  // Build Theoretical Rate points (to reflect mid-flight food buff or tool changes!)
  const theoPoints = history.map((pt, idx) => {
    const x = paddingLeft + (idx / Math.max(1, history.length - 1)) * graphWidth;
    const theoVal = pt.theoreticalXpPerHour || theoreticalXpPerHour;
    const normalizedY = (theoVal - minRate) / Math.max(1, maxRate - minRate);
    const y = paddingTop + (1 - Math.max(0, Math.min(1, normalizedY))) * graphHeight;
    return { x, y, val: theoVal };
  });

  const livePathD =
    livePoints.length > 1
      ? livePoints.reduce(
          (acc, p, idx) => `${acc} ${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)},${p.y.toFixed(1)}`,
          ''
        )
      : '';

  const liveAreaD =
    livePoints.length > 1
      ? `${livePathD} L ${livePoints[livePoints.length - 1].x.toFixed(1)},${(paddingTop + graphHeight).toFixed(1)} L ${livePoints[0].x.toFixed(1)},${(paddingTop + graphHeight).toFixed(1)} Z`
      : '';

  const theoPathD =
    theoPoints.length > 1
      ? theoPoints.reduce(
          (acc, p, idx) => `${acc} ${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)},${p.y.toFixed(1)}`,
          ''
        )
      : '';

  // Static fallback horizontal Y for theoretical ceiling when 0 or 1 point
  const fallbackTheoNormY = (theoreticalXpPerHour - minRate) / Math.max(1, maxRate - minRate);
  const fallbackTheoY = Math.max(
    paddingTop,
    Math.min(paddingTop + graphHeight, paddingTop + (1 - fallbackTheoNormY) * graphHeight)
  );

  // Y-axis tick intervals with clean labels
  const yTicks = [
    { val: maxRate, y: paddingTop },
    { val: Math.round(maxRate * 0.75), y: paddingTop + graphHeight * 0.25 },
    { val: Math.round(maxRate * 0.5), y: paddingTop + graphHeight * 0.5 },
    { val: Math.round(maxRate * 0.25), y: paddingTop + graphHeight * 0.75 },
    { val: 0, y: paddingTop + graphHeight },
  ];

  return (
    <div
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      ref={popoverRef}
    >
      {/* Trigger children badge */}
      <div className="cursor-pointer select-none">
        {children}
      </div>

      {/* Enlarged Popover Window */}
      {isOpen && (
        <div
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-3 w-[450px] sm:w-[500px] max-w-[94vw] bg-surface/95 backdrop-blur-md border border-surface-border rounded-xl shadow-2xl p-4 text-xs font-sans animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-surface-border/60">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-950/80 border border-indigo-700/60 text-indigo-400">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-gray-100 text-sm">Combined Live & Theoretical Rate Graph</h3>
                <p className="text-[10px] text-gray-400">Real-time throughput plotted with theoretical ceiling</p>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onResetSession) {
                  onResetSession();
                }
              }}
              className="flex items-center gap-1.5 text-[11px] font-medium text-gray-300 hover:text-white bg-surface-subtle hover:bg-surface border border-surface-border hover:border-indigo-500/60 px-2.5 py-1 rounded-lg transition-colors cursor-pointer shadow-sm"
              title="Reset session timer and trend history"
            >
              <RotateCcw className="w-3.5 h-3.5 text-indigo-400" />
              <span>Reset</span>
            </button>
          </div>

          {/* Session Stats Matrix */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3.5 font-mono text-[11px]">
            <div className="bg-surface-subtle/80 p-2 rounded-lg border border-surface-border/50">
              <div className="text-[10px] text-gray-400 flex items-center gap-1 font-sans">
                <TrendingUp className="w-3 h-3 text-indigo-400" />
                <span>Current Live</span>
              </div>
              <div className="text-indigo-300 font-bold text-xs mt-0.5">
                {sessionStats?.measuredXpPerHour
                  ? `${sessionStats.measuredXpPerHour.toLocaleString()} XP/h`
                  : 'Calibrating...'}
              </div>
            </div>

            <div className="bg-surface-subtle/80 p-2 rounded-lg border border-surface-border/50">
              <div className="text-[10px] text-gray-400 flex items-center gap-1 font-sans">
                <Zap className="w-3 h-3 text-emerald-400" />
                <span>Theoretical</span>
              </div>
              <div className="text-emerald-400 font-bold text-xs mt-0.5">
                {theoreticalXpPerHour.toLocaleString()} XP/h
              </div>
            </div>

            <div className="bg-surface-subtle/80 p-2 rounded-lg border border-surface-border/50">
              <div className="text-[10px] text-gray-400 flex items-center gap-1 font-sans">
                <Trophy className="w-3 h-3 text-amber-400" />
                <span>Session Peak</span>
              </div>
              <div className="text-amber-300 font-bold text-xs mt-0.5">
                {sessionStats?.peakXpPerHour
                  ? `${sessionStats.peakXpPerHour.toLocaleString()} XP/h`
                  : '—'}
              </div>
            </div>

            <div className="bg-surface-subtle/80 p-2 rounded-lg border border-surface-border/50">
              <div className="text-[10px] text-gray-400 flex items-center gap-1 font-sans">
                <Sparkles className="w-3 h-3 text-indigo-400" />
                <span>Session Total</span>
              </div>
              <div className="text-gray-100 font-bold text-xs mt-0.5">
                +{sessionStats?.sessionXpGained.toLocaleString() || 0} XP
              </div>
            </div>
          </div>

          {/* SVG Trend Chart Area */}
          <div className="bg-surface-subtle/70 rounded-xl p-3 border border-surface-border/60 relative">
            {/* Chart Legend & Scrubber Readout */}
            <div className="flex items-center justify-between text-[11px] mb-2 pb-1.5 border-b border-surface-border/40 font-mono">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-indigo-300 font-medium">
                  <span className="w-3 h-1 bg-indigo-400 rounded-full inline-block" />
                  Live Measured
                </span>
                <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                  <span className="w-3 h-1 border-b-2 border-dashed border-emerald-400 inline-block" />
                  Theoretical Target
                </span>
              </div>

              {hoveredPoint ? (
                <div className="flex items-center gap-1.5 sm:gap-2 text-gray-200 text-[11px]">
                  <span className="text-gray-400">{hoveredPoint.timeLabel}:</span>
                  <strong className="text-indigo-300 font-bold">
                    {hoveredPoint.xpPerHour.toLocaleString()} XP/h
                  </strong>
                  <span className="text-emerald-400 font-mono text-[10px]">
                    (Theo: {(hoveredPoint.theoreticalXpPerHour || theoreticalXpPerHour).toLocaleString()})
                  </span>
                  <span className="text-indigo-200 font-mono text-[10px] bg-indigo-950/80 px-1.5 py-0.2 rounded border border-indigo-700/60 font-semibold">
                    {Math.round((hoveredPoint.xpPerHour / (hoveredPoint.theoreticalXpPerHour || theoreticalXpPerHour || 1)) * 100)}% Eff
                  </span>
                </div>
              ) : (
                <span className="text-gray-400 text-[10px] flex items-center gap-1">
                  <Clock className="w-3 h-3 text-teal-400" />
                  Active: {sessionStats ? formatTimeSeconds(sessionStats.sessionDurationSeconds) : '0s'}
                </span>
              )}
            </div>

            {/* Combined Interactive SVG Graph with Left Y-Axis Scale */}
            <div className="relative">
              <svg
                width={svgWidth}
                height={svgHeight}
                className="w-full h-auto overflow-visible cursor-crosshair"
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              >
                <defs>
                  <linearGradient id="liveRateGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#818cf8" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#818cf8" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Y-Axis Guidelines & Left Column Scale Labels */}
                {yTicks.map((tick, idx) => (
                  <g key={`ytick-${idx}`}>
                    <line
                      x1={paddingLeft}
                      y1={tick.y}
                      x2={svgWidth - paddingRight}
                      y2={tick.y}
                      stroke="#374151"
                      strokeWidth={idx === yTicks.length - 1 ? '1' : '0.5'}
                      strokeDasharray={idx < yTicks.length - 1 ? '2 2' : undefined}
                      opacity="0.6"
                    />
                    <text
                      x={paddingLeft - 8}
                      y={tick.y + 3.5}
                      textAnchor="end"
                      fontSize="9.5"
                      fill="#9ca3af"
                      fontFamily="monospace"
                      fontWeight="500"
                    >
                      {formatXp(tick.val)}
                    </text>
                  </g>
                ))}

                {/* Theoretical Target Path (Dashed Emerald Line) */}
                {theoPoints.length > 1 ? (
                  <path
                    d={theoPathD}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="2.5"
                    strokeDasharray="6 4"
                    opacity="0.9"
                  />
                ) : (
                  <line
                    x1={paddingLeft}
                    y1={fallbackTheoY}
                    x2={svgWidth - paddingRight}
                    y2={fallbackTheoY}
                    stroke="#10b981"
                    strokeWidth="2.5"
                    strokeDasharray="6 4"
                    opacity="0.9"
                  />
                )}

                {/* Live Rate Area Gradient Fill */}
                {liveAreaD && <path d={liveAreaD} fill="url(#liveRateGradient)" />}

                {/* Live Rate Smooth Spline Line (Solid Indigo) */}
                {livePathD && (
                  <path
                    d={livePathD}
                    fill="none"
                    stroke="#818cf8"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Theoretical Data Points (Emerald Rectangles) */}
                {theoPoints.map((tp, idx) => (
                  <rect
                    key={`theo-pt-${idx}`}
                    x={tp.x - 2.5}
                    y={tp.y - 2.5}
                    width={5}
                    height={5}
                    className="fill-emerald-400 stroke-surface stroke-1 opacity-90"
                  />
                ))}

                {/* Live Rate Interactive Data Points & Hover Scrubber */}
                {livePoints.map((p, i) => {
                  const isHovered = hoveredPoint?.timestamp === p.pt.timestamp;

                  return (
                    <g key={`live-pt-${i}`}>
                      {/* Vertical Crosshair Line when hovered */}
                      {isHovered && (
                        <line
                          x1={p.x}
                          y1={paddingTop}
                          x2={p.x}
                          y2={paddingTop + graphHeight}
                          stroke="#e0e7ff"
                          strokeWidth="1"
                          strokeDasharray="2 2"
                        />
                      )}

                      {/* Live Data Circle */}
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={isHovered ? 5 : 3}
                        className={
                          isHovered
                            ? 'fill-amber-400 stroke-surface stroke-2'
                            : 'fill-indigo-300 hover:fill-indigo-200'
                        }
                        onMouseEnter={() => setHoveredPoint(p.pt)}
                      />
                    </g>
                  );
                })}
              </svg>

              {/* Bottom Time Axis Labels */}
              <div className="flex justify-between text-[10px] text-gray-500 font-mono mt-1.5 pl-14 pr-4">
                <span>{history[0]?.timeLabel || 'Start of Session'}</span>
                <span className="text-gray-400">
                  Theoretical: {formatXp(theoreticalXpPerHour)} XP/h
                </span>
                <span>{history[history.length - 1]?.timeLabel || 'Latest Poll'}</span>
              </div>
            </div>
          </div>

          {/* Footer Arrow Pointer */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-surface-border" />
        </div>
      )}
    </div>
  );
};
