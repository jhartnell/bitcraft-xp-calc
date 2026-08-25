import React from 'react';
import { PlayerDetails } from '../types/api';
import { SKILL_DEFINITIONS, getXpProgressForLevel, formatXp } from '../services/bitcraftData';

interface SkillListProps {
  player: PlayerDetails;
  highlightSkillId?: number;
}

export const SkillList: React.FC<SkillListProps> = ({ player, highlightSkillId }) => {
  const experiences = player.experience || [];
  const expMap = new Map<number, number>();
  for (const exp of experiences) {
    expMap.set(exp.skill_id, exp.quantity);
  }

  // Sort skills: highlighted first, then by profession/adventure
  const skillList = Object.values(SKILL_DEFINITIONS).filter((s) => s.id !== 1);

  return (
    <div className="bg-surface rounded-xl border border-surface-border p-5 shadow-xl space-y-3">
      <div className="flex items-center justify-between border-b border-surface-border pb-3">
        <div>
          <h3 className="text-base font-bold text-gray-100 flex items-center gap-2">
            <span>📊 Character Skills Overview</span>
          </h3>
          <p className="text-xs text-gray-400">
            All professions & adventure skills for {player.username}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 pt-1">
        {skillList.map((skill) => {
          const currentXp = expMap.get(skill.id) || 0;
          const prog = getXpProgressForLevel(currentXp);
          const isHighlighted = highlightSkillId === skill.id;

          return (
            <div
              key={skill.id}
              className={`p-2.5 rounded-lg border text-xs transition-all ${
                isHighlighted
                  ? 'bg-emerald-950/70 border-emerald-500/80 shadow-md shadow-emerald-900/30 ring-1 ring-emerald-500/50'
                  : 'bg-surface-subtle border-surface-border hover:border-surface-border/80'
              }`}
            >
              <div className="flex items-center justify-between gap-1 mb-1">
                <span className="font-semibold text-gray-200 truncate flex items-center gap-1">
                  <span>{skill.icon}</span>
                  <span>{skill.name}</span>
                </span>
                <span className={`font-mono font-bold ${isHighlighted ? 'text-emerald-400' : 'text-gray-300'}`}>
                  Lvl {prog.level}
                </span>
              </div>

              <div className="w-full bg-surface rounded-full h-1.5 overflow-hidden border border-surface-border my-1">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isHighlighted ? 'bg-emerald-400' : 'bg-indigo-400'
                  }`}
                  style={{ width: `${Math.max(1, prog.progressPercent)}%` }}
                />
              </div>

              <div className="text-[10px] text-gray-400 font-mono text-right">
                {formatXp(currentXp)} XP
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
