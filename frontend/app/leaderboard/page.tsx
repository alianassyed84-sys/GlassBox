"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Trophy, Flame, Sparkles, ArrowRight, Target, HelpCircle } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

interface Challenge {
  id: number;
  run_id: number;
  flawed_node_id: number;
  creator_name: string;
  created_at: string;
  attempt_count: number;
  correct_guess_count: number;
  goal?: string | null;
  run_name?: string | null;
}

import { getApiBase } from "@/lib/api";

const API_BASE = getApiBase();

function getDifficulty(attemptCount: number, correctCount: number): { label: string; color: string; bg: string } {
  if (attemptCount === 0) return { label: "Unchallenged", color: "text-neutral-600 dark:text-neutral-400", bg: "bg-neutral-100 dark:bg-neutral-800" };
  const rate = (correctCount / attemptCount) * 100;
  if (rate <= 20) return { label: "🔥 Brutal (<20%)", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" };
  if (rate <= 50) return { label: "⚡ Hard (20-50%)", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" };
  if (rate <= 75) return { label: "🎯 Medium (50-75%)", color: "text-indigo-400", bg: "bg-indigo-500/10 border-indigo-500/20" };
  return { label: "✅ Easy (>75%)", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" };
}

export default function LeaderboardPage() {
  const router = useRouter();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"toughest" | "popular" | "newest">("toughest");

  useEffect(() => {
    fetchChallenges();
  }, []);

  async function fetchChallenges() {
    try {
      const res = await fetch(`${API_BASE}/challenges`);
      if (res.ok) {
        const data = await res.json();
        setChallenges(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  const sortedChallenges = [...challenges].sort((a, b) => {
    if (filter === "toughest") {
      const rateA = a.attempt_count > 0 ? a.correct_guess_count / a.attempt_count : 1;
      const rateB = b.attempt_count > 0 ? b.correct_guess_count / b.attempt_count : 1;
      return rateA - rateB; // lowest accuracy first
    }
    if (filter === "popular") {
      return b.attempt_count - a.attempt_count;
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0a0a0a] text-neutral-900 dark:text-neutral-100 flex flex-col transition-colors">
      {/* Top Navbar */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-neutral-200 dark:border-neutral-800 bg-white/90 dark:bg-[#0a0a0a]/90 backdrop-blur-md shrink-0 transition-colors">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={() => router.push("/")}
            className="text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300 text-xs sm:text-sm flex items-center gap-1.5 transition-colors font-medium shrink-0"
          >
            <img src="/logo-icon.png" alt="GlassBox Logo" className="w-5 h-5 rounded object-contain" />
            <span className="hidden xs:inline">← GlassBox</span>
            <span className="xs:hidden">←</span>
          </button>
          <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-800 shrink-0" />
          <span className="font-semibold text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 text-neutral-900 dark:text-white truncate">
            <Trophy size={16} className="text-amber-500 dark:text-amber-400 shrink-0" />
            <span className="truncate">Leaderboard</span>
          </span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-2">
          <ThemeToggle />
          <UserButton />
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6 sm:space-y-8">
        {/* Header Hero */}
        <div className="bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-teal-500/10 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-8 text-center relative overflow-hidden">
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-4 py-1.5 mb-4">
            <Sparkles size={14} className="text-amber-400" />
            <span className="text-amber-300 text-xs font-semibold uppercase tracking-wider">
              Challenge Mode
            </span>
          </div>
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-white mb-3 tracking-tight">
            Can You Spot the Flawed Agent Node?
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 text-sm max-w-xl mx-auto leading-relaxed">
            Engineers turn their multi-agent replays into community challenges.
            Test your prompt engineering intuition by finding which agent failed!
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center justify-between">
          <div className="flex items-center bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-1 rounded-xl">
            <button
              onClick={() => setFilter("toughest")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === "toughest" ? "bg-indigo-600 text-white shadow-sm" : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
              }`}
            >
              <Flame size={13} className="text-amber-400" />
              Toughest
            </button>
            <button
              onClick={() => setFilter("popular")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === "popular" ? "bg-indigo-600 text-white shadow-sm" : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
              }`}
            >
              <Target size={13} className="text-teal-400" />
              Most Attempted
            </button>
            <button
              onClick={() => setFilter("newest")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === "newest" ? "bg-indigo-600 text-white shadow-sm" : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
              }`}
            >
              <Sparkles size={13} className="text-indigo-400" />
              Newest
            </button>
          </div>

          <span className="text-neutral-500 text-xs font-mono">
            {challenges.length} active challenge{challenges.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Challenge Cards List */}
        {loading ? (
          <div className="space-y-4 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-white dark:bg-[#111111] border border-neutral-200 dark:border-neutral-800 rounded-2xl" />
            ))}
          </div>
        ) : sortedChallenges.length === 0 ? (
          <div className="bg-white dark:bg-[#111111] border border-neutral-200 dark:border-neutral-800 rounded-2xl p-12 text-center space-y-3">
            <HelpCircle size={32} className="text-neutral-400 dark:text-neutral-600 mx-auto" />
            <h3 className="text-neutral-900 dark:text-neutral-300 font-semibold text-sm">No Challenges Posted Yet</h3>
            <p className="text-neutral-500 text-xs max-w-sm mx-auto">
              Run a pipeline on the homepage, edit a node, and click &quot;Submit as Challenge&quot; to create the first community puzzle!
            </p>
            <button
              onClick={() => router.push("/")}
              className="mt-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-5 py-2.5 rounded-xl transition-colors inline-flex items-center gap-1.5"
            >
              Run Pipeline Now →
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedChallenges.map((c, rank) => {
              const diff = getDifficulty(c.attempt_count, c.correct_guess_count);
              const accuracy = c.attempt_count > 0 ? Math.round((c.correct_guess_count / c.attempt_count) * 100) : null;

              return (
                <div
                  key={c.id}
                  onClick={() => router.push(`/challenges/${c.id}`)}
                  className="bg-white hover:bg-neutral-50 dark:bg-[#111111] dark:hover:bg-[#161616] border border-neutral-200 dark:border-neutral-800 hover:border-indigo-500/40 rounded-2xl p-5 flex items-center justify-between cursor-pointer transition-all group shadow-md"
                >
                  <div className="flex items-center gap-4 min-w-0 pr-4">
                    {/* Rank Badge */}
                    <div className="w-9 h-9 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex items-center justify-center text-xs font-mono font-bold text-neutral-500 dark:text-neutral-400 shrink-0">
                      #{rank + 1}
                    </div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-neutral-600 dark:text-neutral-400 font-medium">Created by {c.creator_name}</span>
                        <span className="text-[10px] text-neutral-400 dark:text-neutral-600">•</span>
                        <span className={`text-[10px] border px-2 py-0.5 rounded-full font-medium ${diff.bg} ${diff.color}`}>
                          {diff.label}
                        </span>
                      </div>

                      <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 truncate transition-colors">
                        {c.goal || c.run_name || `Challenge #${c.id}`}
                      </h3>

                      <div className="flex items-center gap-4 text-[11px] text-neutral-500 pt-0.5">
                        <span>{c.attempt_count} attempt{c.attempt_count !== 1 ? "s" : ""}</span>
                        <span>•</span>
                        <span>
                          {accuracy !== null ? `${accuracy}% solve rate` : "No solves yet"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button className="bg-neutral-50 dark:bg-neutral-900 group-hover:bg-indigo-600 text-neutral-700 dark:text-neutral-300 group-hover:text-white border border-neutral-200 dark:border-neutral-800 group-hover:border-indigo-500 text-xs font-medium px-4 py-2.5 rounded-xl flex items-center gap-1.5 shrink-0 transition-all">
                    <span>Try Challenge</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}