"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { UserButton } from "@clerk/nextjs";
import { Trophy, Target, CheckCircle2, XCircle, ArrowLeft } from "lucide-react";
import { api, Node, Run } from "@/lib/api";
import ThemeToggle from "@/components/ThemeToggle";

const RunGraph = dynamic(() => import("@/components/RunGraph"), { ssr: false });

interface ChallengeDetail {
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

interface GuessResult {
  correct: boolean;
  flawed_node_id: number;
  attempt_count: number;
  correct_guess_count: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function ChallengeVisitorPage() {
  const params = useParams();
  const router = useRouter();
  const challengeId = Number(params.id);

  const [challenge, setChallenge] = useState<ChallengeDetail | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [submittingGuess, setSubmittingGuess] = useState(false);
  const [guessResult, setGuessResult] = useState<GuessResult | null>(null);

  useEffect(() => {
    fetchChallengeAndRun();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challengeId]);

  async function fetchChallengeAndRun() {
    try {
      const res = await fetch(`${API_BASE}/challenges`);
      if (res.ok) {
        const list: ChallengeDetail[] = await res.json();
        const found = list.find((c) => c.id === challengeId);
        if (found) {
          setChallenge(found);
          const [runData, nodesData] = await Promise.all([
            api.getRun(found.run_id),
            api.getRunNodes(found.run_id),
          ]);
          setRun(runData);
          setNodes(nodesData);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleGuess() {
    if (!selectedNodeId || !challenge) return;
    setSubmittingGuess(true);
    try {
      const res = await fetch(`${API_BASE}/challenges/${challengeId}/guess`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ node_id: selectedNodeId }),
      });
      if (res.ok) {
        const result: GuessResult = await res.json();
        setGuessResult(result);
        setChallenge((prev) =>
          prev
            ? {
                ...prev,
                attempt_count: result.attempt_count,
                correct_guess_count: result.correct_guess_count,
              }
            : null
        );
      }
    } catch {
      // ignore
    } finally {
      setSubmittingGuess(false);
    }
  }

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-[#0a0a0a] text-neutral-900 dark:text-neutral-100 transition-colors">
      {/* Topbar */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-white/90 dark:bg-[#0a0a0a]/90 backdrop-blur-md shrink-0 z-10 transition-colors">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/leaderboard")}
            className="text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300 text-sm flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft size={14} />
            Leaderboard
          </button>
          <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-800" />
          <div className="flex items-center gap-2">
            <Trophy size={15} className="text-amber-500 dark:text-amber-400" />
            <span className="text-sm font-semibold text-neutral-900 dark:text-white">Challenge #{challengeId}</span>
            <span className="text-xs text-neutral-500">by {challenge?.creator_name}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <ThemeToggle />
          {challenge && (
            <div className="flex items-center gap-3 text-xs font-mono bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 px-3 py-1 rounded-lg">
              <span className="text-neutral-600 dark:text-neutral-400">Attempts: <strong className="text-neutral-800 dark:text-neutral-200">{challenge.attempt_count}</strong></span>
              <span className="text-neutral-400 dark:text-neutral-600">•</span>
              <span className="text-emerald-600 dark:text-emerald-400">Solves: <strong>{challenge.correct_guess_count}</strong></span>
            </div>
          )}
          <UserButton />
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Graph Area */}
        <div className="flex-1 relative overflow-hidden">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-neutral-600 text-sm animate-pulse">Loading challenge graph…</p>
            </div>
          ) : (
            <RunGraph apiNodes={nodes} runId={challenge?.run_id ?? 0} />
          )}
        </div>

        {/* Visitor Inspection Panel */}
        <div className="w-[380px] bg-white dark:bg-[#0f0f0f] border-l border-neutral-200 dark:border-neutral-800/80 flex flex-col shrink-0 shadow-xl transition-colors">
          {/* Goal Banner */}
          <div className="p-4 border-b border-neutral-200 dark:border-neutral-800/80 bg-neutral-50 dark:bg-[#141414] space-y-2">
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
              <Target size={12} />
              Challenge Goal
            </span>
            <p className="text-xs text-neutral-800 dark:text-neutral-200 leading-relaxed font-medium">
              {run?.goal || challenge?.goal || "Loading..."}
            </p>
          </div>

          {/* Feedback Banner after Guess */}
          <AnimatePresence>
            {guessResult && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className={`p-4 border-b ${
                  guessResult.correct
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                    : "bg-red-500/10 border-red-500/30 text-red-300"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {guessResult.correct ? (
                    <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold">
                      {guessResult.correct ? "Spot on! Correct Guess!" : "Incorrect Guess!"}
                    </h4>
                    <p className="text-[11px] leading-relaxed opacity-90">
                      {guessResult.correct
                        ? `You correctly identified Node #${guessResult.flawed_node_id} as the flawed step.`
                        : `The actual flawed node was Node #${guessResult.flawed_node_id}.`}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Selected Node Inspection */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {selectedNode ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-2.5 rounded-xl">
                  <div>
                    <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 capitalize">{selectedNode.agent_name}</span>
                    <span className="text-[10px] text-neutral-500 ml-2 font-mono">#{selectedNode.id}</span>
                  </div>
                  <span className="text-[10px] bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 px-2 py-0.5 rounded font-mono">
                    {selectedNode.node_type}
                  </span>
                </div>

                <div>
                  <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-semibold mb-1">Node Output</p>
                  <pre className="bg-neutral-50 dark:bg-[#0a0a0a] border border-neutral-200 dark:border-neutral-800 rounded-xl p-3 text-[11px] font-mono text-neutral-800 dark:text-neutral-300 leading-relaxed overflow-auto max-h-60 scrollbar-thin">
                    {JSON.stringify(selectedNode.output_json ?? {}, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center py-12 text-neutral-600 space-y-2">
                <Target size={24} className="text-neutral-700" />
                <p className="text-xs">Click any node in the graph to inspect it.</p>
              </div>
            )}
          </div>

          {/* Guess Submission Footer */}
          <div className="p-4 border-t border-neutral-200 dark:border-neutral-800/80 bg-white dark:bg-[#111111] shrink-0">
            <button
              id="submit-guess-btn"
              onClick={handleGuess}
              disabled={!selectedNodeId || submittingGuess || guessResult !== null}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-neutral-950 font-bold text-xs py-3 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
            >
              {submittingGuess ? (
                "Verifying Guess…"
              ) : guessResult ? (
                "Guess Submitted!"
              ) : selectedNodeId ? (
                `Submit Node #${selectedNodeId} as Flawed`
              ) : (
                "Select a Node First"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}