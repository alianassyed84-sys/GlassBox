"use client";

import { Flame } from "lucide-react";

interface StreakBadgeProps {
  streakDays: number;
  onClick?: () => void;
}

export default function StreakBadge({ streakDays, onClick }: StreakBadgeProps) {
  if (streakDays <= 0) return null;

  return (
    <button
      onClick={onClick}
      title={`${streakDays} day debug streak! Click to view milestone.`}
      className="flex items-center gap-1 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 hover:border-amber-500/60 px-2.5 py-1 rounded-full text-xs font-extrabold text-amber-500 transition-all shadow-xs shrink-0"
    >
      <Flame size={14} className="text-amber-500 animate-pulse" />
      <span>{streakDays}d streak</span>
    </button>
  );
}
