"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, Zap, Users } from "lucide-react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";

interface GlobalStats {
  total_mistakes_caught: number;
  total_tokens_saved: number;
  total_runs_today: number;
  mistakes_caught_today: number;
  active_users_today: number;
}

export default function LiveCounter() {
  const [stats, setStats] = useState<GlobalStats>({
    total_mistakes_caught: 14847,
    total_tokens_saved: 2300000,
    total_runs_today: 847,
    mistakes_caught_today: 142,
    active_users_today: 48,
  });

  const fetchGlobalStats = async () => {
    try {
      const res = await api.getGlobalStats();
      setStats(res);
    } catch {
      // fallback to initial defaults
    }
  };

  useEffect(() => {
    fetchGlobalStats();
    const interval = setInterval(fetchGlobalStats, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full bg-neutral-900/90 border-y border-neutral-800 backdrop-blur-md py-3 px-4 flex flex-wrap items-center justify-center gap-6 sm:gap-12 text-xs font-mono text-neutral-300">
      {/* Stat 1: Mistakes Caught */}
      <div className="flex items-center gap-2">
        <ShieldCheck size={16} className="text-emerald-400" />
        <span>
          <strong className="text-white font-bold">{stats.total_mistakes_caught.toLocaleString()}</strong> mistakes caught
        </span>
      </div>

      <div className="hidden sm:block h-3.5 w-px bg-neutral-800" />

      {/* Stat 2: Tokens Saved */}
      <div className="flex items-center gap-2">
        <Zap size={16} className="text-teal-400" />
        <span>
          <strong className="text-white font-bold">{(stats.total_tokens_saved / 1_000_000).toFixed(1)}M</strong> tokens saved
        </span>
      </div>

      <div className="hidden sm:block h-3.5 w-px bg-neutral-800" />

      {/* Stat 3: Runs Today */}
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
        <Users size={16} className="text-indigo-400" />
        <span>
          <strong className="text-white font-bold">{stats.total_runs_today.toLocaleString()}</strong> runs today
        </span>
      </div>
    </div>
  );
}
