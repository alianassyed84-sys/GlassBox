"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { UserButton, useAuth, useUser } from "@clerk/nextjs";
import { Trophy, Key, Sparkles, ArrowRight, Volume2, VolumeX, Download } from "lucide-react";
import { api, Run, setAuthTokenGetter } from "@/lib/api";
import { useGlassboxStore } from "@/lib/store";
import CommandPalette from "@/components/CommandPalette";
import MagneticButton from "@/components/MagneticButton";
import ThemeToggle from "@/components/ThemeToggle";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import NetworkStatusIndicator from "@/components/NetworkStatusIndicator";

export default function DashboardApp() {
  const router = useRouter();
  const { getToken } = useAuth();
  const { user } = useUser();
  const [goal, setGoal] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const { isOnline } = useNetworkStatus();
  const { isInstallable, installApp } = usePWAInstall();
  const { setPaletteOpen, soundEnabled, toggleSound, reset, addToast } = useGlassboxStore();

  useEffect(() => {
    setAuthTokenGetter(() => getToken());
    reset(); // Clear previous session state on user load/switch
    if (user) {
      api.listRuns().then(setRuns).catch(() => setRuns([]));
    } else {
      setRuns([]);
    }
  }, [getToken, user, reset, isOnline]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!goal.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const { run_id } = await api.createRun(goal.trim());
      router.push(`/runs/${run_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create run");
      setLoading(false);
    }
  }

  return (
    <>
      <CommandPalette runs={runs} />
      <div className="min-h-screen bg-slate-50 dark:bg-[#0a0a0a] text-neutral-900 dark:text-neutral-100 flex flex-col font-sans transition-colors">
        {/* Top Navbar */}
        <header className="w-full flex items-center justify-between px-6 py-4 border-b border-neutral-200/80 dark:border-neutral-800/80 bg-white/90 dark:bg-[#0d0d0d]/90 backdrop-blur-md transition-colors">
          <div className="flex items-center gap-2.5">
            <img src="/logo-icon.png" alt="GlassBox Logo" className="w-7 h-7 rounded-lg object-contain shadow-xs" />
            <span className="font-bold tracking-tight text-xl bg-gradient-to-r from-neutral-900 via-indigo-900 to-indigo-600 dark:from-white dark:via-neutral-200 dark:to-indigo-300 bg-clip-text text-transparent">
              GlassBox
            </span>
            <span className="text-xs text-neutral-500 border border-neutral-200 dark:border-neutral-800 px-2 py-0.5 rounded-full font-mono">
              v1.0
            </span>
            <NetworkStatusIndicator />
          </div>

          <div className="flex items-center gap-2.5">
            {isInstallable && (
              <button
                id="install-pwa-btn"
                onClick={async () => {
                  const success = await installApp();
                  if (success) {
                    addToast("Installed! 🎉", "success");
                  }
                }}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-200 border border-indigo-200 dark:border-indigo-800 hover:border-indigo-300 dark:hover:border-indigo-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors bg-indigo-50/50 dark:bg-indigo-950/20 font-semibold"
              >
                <Download size={13} />
                Install Glassbox
              </button>
            )}

            <ThemeToggle />
            <button
              id="sound-toggle-btn"
              onClick={toggleSound}
              title={soundEnabled ? "Sound effects enabled (click to mute)" : "Sound effects muted (click to enable)"}
              className={`p-1.5 rounded-lg border text-xs flex items-center justify-center transition-colors ${
                soundEnabled
                  ? "bg-indigo-600/20 text-indigo-300 border-indigo-500/30"
                  : "bg-neutral-100 dark:bg-neutral-900 text-neutral-500 border-neutral-200 dark:border-neutral-800 hover:text-neutral-700 dark:hover:text-neutral-300"
              }`}
            >
              {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
            </button>

            <button
              onClick={() => router.push("/leaderboard")}
              className="text-xs text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors bg-white/50 dark:bg-neutral-900/50"
            >
              <Trophy size={13} className="text-amber-500 dark:text-amber-400" />
              Leaderboard
            </button>

            <button
              onClick={() => router.push("/settings")}
              className="text-xs text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors bg-white/50 dark:bg-neutral-900/50"
            >
              <Key size={13} className="text-indigo-600 dark:text-indigo-400" />
              API Keys
            </button>

            <kbd
              onClick={() => setPaletteOpen(true)}
              className="cursor-pointer text-xs text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 px-2.5 py-1 rounded-md hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors hidden sm:block font-mono"
            >
              ⌘K
            </kbd>
            <UserButton />
          </div>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center px-4 -mt-8 py-12">
          {runs.length === 0 && !isOnline ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="max-w-md w-full text-center flex flex-col items-center p-8 bg-white dark:bg-[#111111] border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-xl"
            >
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 text-3xl mb-6 shadow-inner animate-pulse">
                📡
              </div>
              <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-3">
                You're offline
              </h2>
              <p className="text-neutral-600 dark:text-neutral-400 text-xs sm:text-sm leading-relaxed">
                Connect to the internet to start debugging AI agents. Once you've completed some runs, they'll be available here even without a connection.
              </p>
            </motion.div>
          ) : (
            <>
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-center mb-10 max-w-xl"
              >
                <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-4 py-1.5 mb-5 shadow-inner shadow-indigo-500/10">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 dark:bg-indigo-400 animate-pulse" />
                  <span className="text-indigo-700 dark:text-indigo-300 text-xs font-semibold tracking-wider uppercase">
                    Multi-Agent Debugger &amp; Pipeline Runner
                  </span>
                </div>
                <h1 className="text-4xl sm:text-5xl font-extrabold text-neutral-900 dark:text-white mb-4 tracking-tight">
                  What should your agents build?
                </h1>
                <p className="text-neutral-600 dark:text-neutral-400 text-sm sm:text-base leading-relaxed">
                  Enter any prompt below. GlassBox plans, clarifies, executes multi-agent subtasks, and lets you inspect and replay every step.
                </p>
              </motion.div>

              <motion.form
                onSubmit={handleSubmit}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="w-full max-w-2xl"
              >
                <div className="relative group">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500/30 via-teal-500/20 to-purple-500/30 rounded-2xl blur-md opacity-40 group-hover:opacity-75 transition duration-500" />
                  <div className="relative bg-white dark:bg-[#111111] border border-neutral-200 dark:border-neutral-800 focus-within:border-indigo-500/60 rounded-2xl p-5 shadow-xl dark:shadow-2xl transition-colors">
                    <textarea
                      id="goal-input-textarea"
                      rows={3}
                      value={goal}
                      onChange={(e) => setGoal(e.target.value)}
                      placeholder={isOnline ? "e.g. Detect traffic anomaly on /api/checkout & auto-deploy edge rate limiters..." : "Connect to internet to run new agents"}
                      disabled={loading || !isOnline}
                      className="w-full bg-transparent text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-600 text-base resize-none focus:outline-none transition-all font-sans disabled:opacity-50"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                          handleSubmit(e);
                        }
                      }}
                    />

                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800/80">
                      <span className="text-neutral-500 text-xs flex items-center gap-1">
                        {isOnline ? (
                          <>
                            Press <kbd className="text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 px-1.5 py-0.5 rounded font-mono text-[10px]">⌘ Enter</kbd> to run
                          </>
                        ) : (
                          <span className="text-amber-500/80 font-medium font-sans">Offline mode active</span>
                        )}
                      </span>

                      <MagneticButton
                        id="submit-goal-btn"
                        type="submit"
                        disabled={loading || !goal.trim() || !isOnline}
                        className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white font-medium text-sm px-6 py-2.5 rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/25"
                      >
                        {loading ? (
                          <>
                            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                            </svg>
                            Initializing Pipeline…
                          </>
                        ) : (
                          <>
                            Run Pipeline
                            <ArrowRight size={15} className="text-indigo-200" />
                          </>
                        )}
                      </MagneticButton>
                    </div>
                  </div>
                </div>

                {error && (
                  <p className="mt-4 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
                    {error}
                  </p>
                )}
              </motion.form>

              {runs.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="mt-12 w-full max-w-2xl"
                >
                  <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3 px-1 flex items-center gap-2">
                    <Sparkles size={12} className="text-indigo-400" />
                    Recent Pipeline Traces
                  </h2>
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {runs.slice(0, 6).map((r) => (
                      <div
                        key={r.id}
                        onClick={() => router.push(`/runs/${r.id}`)}
                        className="flex items-center justify-between p-3.5 bg-white dark:bg-[#111111] hover:bg-neutral-50 dark:hover:bg-neutral-900 border border-neutral-200 dark:border-neutral-800/80 hover:border-neutral-300 dark:hover:border-neutral-700 rounded-xl cursor-pointer transition-all group shadow-sm dark:shadow-none"
                      >
                        <span className="text-sm text-neutral-700 dark:text-neutral-300 group-hover:text-neutral-900 dark:group-hover:text-white truncate max-w-md font-medium">
                          {r.name || r.goal}
                        </span>
                        <div className="flex items-center gap-3">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-mono uppercase ${
                              r.status === "completed"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : r.status === "awaiting_input"
                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                : r.status === "error"
                                ? "bg-red-500/10 text-red-400 border border-red-500/20"
                                : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                            }`}
                          >
                            {r.status}
                          </span>
                          <span className="text-xs text-neutral-500 font-mono">#{r.id}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </>
          )}
        </main>
      </div>
    </>
  );
}
