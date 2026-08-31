import React, { useState, useEffect } from 'react';
import { PlayerDetails } from '../types/api';
import { SkillOverrideMap } from '../types/calculator';
import { SKILL_DEFINITIONS, getXpProgressForLevel, formatXp, calculateXpForLevel } from '../services/bitcraftData';
import { ShowPanelButton, HidePanelButton } from './PanelToggleButtons';
import { Edit2, RotateCcw, Check, X } from 'lucide-react';

interface SkillListProps {
  player: PlayerDetails;
  highlightSkillId?: number;
  isInitiallyCollapsed?: boolean;
  skillOverrides?: SkillOverrideMap;
  onSetSkillLevel?: (skillId: number, level: number) => void;
  onClearSkillOverride?: (skillId: number) => void;
}

export const SkillList: React.FC<SkillListProps> = ({
  player,
  highlightSkillId,
  isInitiallyCollapsed = false,
  skillOverrides = {},
  onSetSkillLevel,
  onClearSkillOverride,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(isInitiallyCollapsed);
  const [editingSkillId, setEditingSkillId] = useState<number | null>(null);
  const [editLevelInput, setEditLevelInput] = useState<string>('');

  useEffect(() => {
    setIsCollapsed(isInitiallyCollapsed);
  }, [isInitiallyCollapsed]);

  const experiences = player.experience || [];
  const expMap = new Map<number, number>();
  for (const exp of experiences) {
    expMap.set(exp.skill_id, exp.quantity);
  }

  // Sort skills: highlighted first, then by profession/adventure
  const skillList = Object.values(SKILL_DEFINITIONS).filter((s) => s.id !== 1);
  const activeSkill = highlightSkillId ? SKILL_DEFINITIONS[highlightSkillId] : null;
  const activeOverride = highlightSkillId ? skillOverrides[highlightSkillId] : null;
  const activeSkillExp = activeOverride?.xp ?? (activeOverride?.level ? calculateXpForLevel(activeOverride.level) : (highlightSkillId ? expMap.get(highlightSkillId) || 0 : 0));
  const activeSkillProg = getXpProgressForLevel(activeSkillExp);

  const startEditing = (skillId: number, currentLevel: number) => {
    setEditingSkillId(skillId);
    setEditLevelInput(String(currentLevel));
  };

  const handleSaveLevel = (skillId: number) => {
    const val = parseInt(editLevelInput, 10);
    if (!isNaN(val) && val >= 1 && val <= 110 && onSetSkillLevel) {
      onSetSkillLevel(skillId, val);
    }
    setEditingSkillId(null);
  };

  // Collapsed View
  if (isCollapsed) {
    return (
      <div className="bg-surface rounded-xl border border-surface-border p-3.5 shadow-md flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-surface-subtle border border-surface-border text-emerald-400">
            📊
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-gray-200">Character Skills:</span>
            {activeSkill ? (
              <span className="text-emerald-400 font-mono font-bold flex items-center gap-1.5">
                <span>{activeSkill.icon} {activeSkill.name} Level {activeSkillProg.level} ({formatXp(activeSkillExp)} XP)</span>
                {activeOverride && (
                  <span className="text-[10px] bg-amber-950/70 border border-amber-700/60 text-amber-300 px-1 py-0.2 rounded font-sans font-normal">
                    Custom Level
                  </span>
                )}
              </span>
            ) : (
              <span className="text-gray-400 font-mono">14 Profession Skills</span>
            )}
          </div>
        </div>

        <ShowPanelButton
          label="Show Skills Matrix"
          onClick={() => setIsCollapsed(false)}
        />
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-xl border border-surface-border p-5 shadow-xl space-y-3 animate-in fade-in duration-200">
      <div className="flex items-center justify-between border-b border-surface-border pb-3">
        <div>
          <h3 className="text-base font-bold text-gray-100 flex items-center gap-2">
            <span>📊 Character Skills Overview</span>
          </h3>
          <p className="text-xs text-gray-400">
            All professions & adventure skills for {player.username} • Click any skill level to customize
          </p>
        </div>

        <HidePanelButton
          title="Collapse Skills Overview"
          onClick={() => setIsCollapsed(true)}
        />
      </div>

      {(!player.experience || player.experience.length === 0) && (
        <div className="bg-amber-950/30 border border-amber-700/40 rounded-lg px-3 py-2 text-xs text-amber-300/90 flex items-center justify-between gap-2">
          <span>
            ℹ️ <strong>Notice:</strong> Server experience data for <strong>{player.username}</strong> was unpopulated by BitJita. Skills start at baseline Level 1 unless overridden.
          </span>
          <span className="text-[10px] text-amber-400/80 shrink-0 font-mono">
            Click any level to customize
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 pt-1">
        {skillList.map((skill) => {
          const override = skillOverrides[skill.id];
          const hasOverride = Boolean(override);
          const rawServerXp = expMap.get(skill.id) || 0;
          const currentXp = override?.xp ?? (override?.level ? calculateXpForLevel(override.level) : rawServerXp);
          const prog = getXpProgressForLevel(currentXp);
          const isHighlighted = highlightSkillId === skill.id;
          const isEditing = editingSkillId === skill.id;

          return (
            <div
              key={skill.id}
              className={`p-2.5 rounded-lg border text-xs transition-all relative group ${
                isHighlighted
                  ? 'bg-emerald-950/70 border-emerald-500/80 shadow-md shadow-emerald-900/30 ring-1 ring-emerald-500/50'
                  : 'bg-surface-subtle border-surface-border hover:border-surface-border/80'
              }`}
              title={`${skill.name} Lvl ${prog.level}: ${prog.xpInCurrentLevel.toLocaleString()} / ${prog.levelSpan.toLocaleString()} XP (${prog.xpNeededForNext.toLocaleString()} XP left to Lvl ${Math.min(120, prog.level + 1)})\nLifetime XP: ${currentXp.toLocaleString()}`}
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="font-semibold text-gray-200 truncate flex items-center gap-1">
                  <span>{skill.icon}</span>
                  <span className="truncate">{skill.name}</span>
                </span>
                
                {isEditing ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="1"
                      max="110"
                      value={editLevelInput}
                      onChange={(e) => setEditLevelInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveLevel(skill.id);
                        if (e.key === 'Escape') setEditingSkillId(null);
                      }}
                      className="w-12 px-1 py-0.5 rounded bg-surface border border-emerald-500 text-emerald-300 font-mono text-[11px] font-bold focus:outline-none"
                      autoFocus
                    />
                    <button
                      onClick={() => handleSaveLevel(skill.id)}
                      className="p-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white cursor-pointer"
                      title="Save Level"
                    >
                      <Check className="w-2.5 h-2.5" />
                    </button>
                    <button
                      onClick={() => setEditingSkillId(null)}
                      className="p-1 rounded bg-surface-border hover:bg-gray-600 text-gray-300 cursor-pointer"
                      title="Cancel"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => startEditing(skill.id, prog.level)}
                    className={`font-mono font-bold px-1.5 py-0.5 rounded flex items-center gap-1 cursor-pointer transition-colors ${
                      hasOverride
                        ? 'bg-amber-950/80 text-amber-300 border border-amber-700/60 hover:bg-amber-900/90'
                        : isHighlighted
                        ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700/60 hover:bg-emerald-800/80'
                        : 'bg-surface/80 text-gray-300 border border-surface-border hover:bg-surface-border text-[11px]'
                    }`}
                    title="Click to edit skill level"
                  >
                    <span>Lvl {prog.level}</span>
                    <Edit2 className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100" />
                  </button>
                )}
              </div>

              <div className="w-full bg-surface rounded-full h-1.5 overflow-hidden border border-surface-border my-1">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    hasOverride ? 'bg-amber-400' : isHighlighted ? 'bg-emerald-400' : 'bg-indigo-500'
                  }`}
                  style={{ width: `${Math.max(1, prog.progressPercent)}%` }}
                />
              </div>

              <div className="text-[10px] text-gray-400 font-mono flex items-center justify-between">
                <span>{prog.progressPercent.toFixed(0)}%</span>
                <div className="flex items-center gap-1">
                  <span>{formatXp(currentXp)} XP</span>
                  {hasOverride && onClearSkillOverride && (
                    <button
                      onClick={() => onClearSkillOverride(skill.id)}
                      className="text-gray-500 hover:text-rose-400 cursor-pointer transition-colors ml-0.5"
                      title="Reset to server data"
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

