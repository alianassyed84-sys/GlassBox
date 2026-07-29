"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { UserButton, useAuth } from "@clerk/nextjs";
import { Monitor, Eye, Download, Trophy, Check, X, Volume2, VolumeX, Search, Share2 } from "lucide-react";
import { api, Node, Run, setAuthTokenGetter } from "@/lib/api";
import { useGlassboxStore } from "@/lib/store";
import { playNodeCompleteSound } from "@/lib/sound";
import MagneticButton from "@/components/MagneticButton";
import NodeSidebar from "@/components/NodeSidebar";
import CommandPalette from "@/components/CommandPalette";
import AggregatorResult, { isValidAggregatorOutput } from "@/components/AggregatorResult";
import ClarificationPrompt from "@/components/ClarificationPrompt";
import RunStatsBar from "@/components/RunStatsBar";
import ThemeToggle from "@/components/ThemeToggle";
import RoastCard from "@/components/RoastCard";
import ReportCard, { ReportCardData } from "@/components/ReportCard";
import LinkedInPostModal from "@/components/LinkedInPostModal";
import ReelGenerator from "@/components/ReelGenerator";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import NetworkStatusIndicator from "@/components/NetworkStatusIndicator";
import { addPendingAction } from "@/lib/localdb";

const RunGraph = dynamic(() => import("@/components/RunGraph"), { ssr: false });
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function RunPage() {
  const params = useParams();
  const router = useRouter();
  const { getToken } = useAuth();
  const runId = Number(params.id);

  const [run, setRun] = useState<Run | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [runs, setRuns] = useState<Run[]>([]);
  const [copiedToast, setCopiedToast] = useState(false);
  const { isOnline } = useNetworkStatus();
  const { selectedNodeId, setSelectedNodeId, viewMode, setViewMode, soundEnabled, toggleSound, addToast } = useGlassboxStore();

  // Viral feature states
  const [showRoastModal, setShowRoastModal] = useState(false);
  const [roastData, setRoastData] = useState<{ roast_text: string; roast_grade: string } | null>(null);
  const [showReportCard, setShowReportCard] = useState(false);
  const [reportCardData, setReportCardData] = useState<ReportCardData | null>(null);
  const [showLinkedInModal, setShowLinkedInModal] = useState(false);
  const [linkedInPostData, setLinkedInPostData] = useState<{ post_text: string; hashtags: string[] } | null>(null);
  const [showReelModal, setShowReelModal] = useState(false);

  const handleFetchRoast = async () => {
    try {
      const data = await api.roastRun(runId);
      setRoastData(data);
      setShowRoastModal(true);
    } catch {
      alert("Failed to generate roast.");
    }
  };

  const handleFetchReportCard = async () => {
    try {
      const data = await api.gradeRun(runId);
      setReportCardData(data);
      setShowReportCard(true);
    } catch {
      alert("Failed to generate report card.");
    }
  };

  async function handleShareRun() {
    if (!isOnline) {
      await addPendingAction({
        type: "share-run",
        runId,
        content: `Run #${runId}`,
        createdAt: new Date().toISOString(),
      });
      addToast("Offline — share action queued for sync!", "info");
      return;
    }
    try {
      await api.createShareLink(runId);
      const shareUrl = `${window.location.origin}/share/${runId}`;
      await navigator.clipboard.writeText(shareUrl);
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 3000);
    } catch (err) {
      alert("Failed to generate share link: " + (err instanceof Error ? err.message : String(err)));
    }
  }

  // Challenge modal state
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [challengeNodeId, setChallengeNodeId] = useState<number | null>(null);
  const [creatorName, setCreatorName] = useState("");
  const [submittingChallenge, setSubmittingChallenge] = useState(false);
  const [challengeSuccess, setChallengeSuccess] = useState<number | null>(null);

  // Semantic search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Node[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const results = await api.searchNodes(runId, searchQuery);
      setSearchResults(results);
    } catch (err) {
      console.error("Search failed", err);
    } finally {
      setIsSearching(false);
    }
  };

  const aggregatorNode = nodes.find((n) => n.agent_name === "aggregator" && n.status === "success");
  const clarificationNode = nodes.find((n) => n.node_type === "clarification_request" && n.status === "awaiting_answer");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("glassbox_view_mode");
      if (saved === "simple" || saved === "developer") setViewMode(saved);
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setSelectedNodeId(null);
  }, [runId, setSelectedNodeId]);

  useEffect(() => {
    if (viewMode === "developer" && run?.status === "completed" && aggregatorNode && !selectedNodeId) {
      setSelectedNodeId(aggregatorNode.id);
    }
  }, [run?.status, aggregatorNode, selectedNodeId, setSelectedNodeId, viewMode]);

  useEffect(() => { setAuthTokenGetter(() => getToken()); }, [getToken]);
  useEffect(() => { api.listRuns().then(setRuns).catch(() => {}); }, []);

  const fetchRunState = async () => {
    try {
      const [runData, nodesData] = await Promise.all([api.getRun(runId), api.getRunNodes(runId)]);
      setRun(runData);
      setNodes(nodesData);
      setLoadingInitial(false);
      return runData;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes("403") || errMsg.includes("Access denied")) {
        alert("Access Denied: You do not have permission to view this run.");
        router.push("/dashboard");
      }
      setLoadingInitial(false);
      return null;
    }
  };

  useEffect(() => {
    let active = true;
    let ws: WebSocket | null = null;
    let reconnectAttempts = 0;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let pollingInterval: NodeJS.Timeout | null = null;
    let safetyTimer: NodeJS.Timeout | null = null;

    fetchRunState();

    if (!isOnline) {
      // Offline: do not connect ws or start pollers
      return () => {
        active = false;
      };
    }

    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const wsUrl = apiBase.replace(/^http/, "ws") + `/ws/runs/${runId}`;

    const startPolling = () => {
      if (pollingInterval) return;
      console.log("WebSocket failed. Falling back to HTTP polling.");
      pollingInterval = setInterval(() => {
        if (active) fetchRunState();
      }, 2000);
    };

    const stopPolling = () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
      }
    };

    const connectWs = () => {
      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          if (!active) return;
          console.log("WebSocket connected.");
          reconnectAttempts = 0;
          stopPolling();
          fetchRunState(); // Catch up on anything missed
        };

        ws.onmessage = (event) => {
          if (!active) return;
          try {
            const data = JSON.parse(event.data);
            if (data.type === "node_event" && data.node) {
              const updatedNode: Node = data.node;
              setNodes((prevNodes) => {
                const idx = prevNodes.findIndex((n) => n.id === updatedNode.id);
                if (idx >= 0) {
                  const next = [...prevNodes];
                  next[idx] = updatedNode;
                  return next;
                }
                return [...prevNodes, updatedNode];
              });
              if (updatedNode.status === "success" || updatedNode.status === "answered") {
                playNodeCompleteSound();
              }
              if (data.run_status) {
                setRun((prev) => prev ? { ...prev, status: data.run_status } : prev);
              }
            } else if (data.type === "run_updated" && data.status) {
              setRun((prev) => prev ? { ...prev, status: data.status } : prev);
            }
          } catch {
            // ignore
          }
        };

        ws.onerror = () => {
          // Handled in onclose
        };

        ws.onclose = () => {
          if (!active) return;
          if (reconnectAttempts < 5) {
            const backoffMs = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);
            console.log(`WebSocket closed. Reconnecting in ${backoffMs}ms...`);
            reconnectAttempts++;
            reconnectTimeout = setTimeout(connectWs, backoffMs);
          } else {
            startPolling();
          }
        };
      } catch {
        startPolling();
      }
    };

    connectWs();

    safetyTimer = setInterval(() => {
      if (active && (run?.status === "running" || !run)) {
        fetchRunState();
      }
    }, 10000);

    return () => {
      active = false;
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (pollingInterval) clearInterval(pollingInterval);
      if (safetyTimer) clearInterval(safetyTimer);
    };
  }, [runId, isOnline]);

  const handleAnswerSubmitted = () => {
    fetchRunState();
  };

  const statusColor: Record<string, string> = {
    running: "text-amber-400",
    awaiting_input: "text-blue-400",
    completed: "text-emerald-400",
    error: "text-red-400",
  };

  function handleDownloadTrace() {
    const trace = {
      run: { id: run?.id, goal: run?.goal, name: run?.name, status: run?.status, created_at: run?.created_at },
      nodes: nodes.map((n) => ({
        id: n.id, run_id: n.run_id, parent_id: n.parent_id, agent_name: n.agent_name,
        node_type: n.node_type, status: n.status, model_name: n.model_name,
        latency_ms: n.latency_ms,
        token_count_input: n.token_count_input ?? null,
        token_count_output: n.token_count_output ?? null,
        status_message: n.status_message, prompt_text: n.prompt_text,
        input_json: n.input_json, output_json: n.output_json,
        is_replay: n.is_replay, replayed_from_id: n.replayed_from_id,
        created_at: n.created_at, completed_at: n.completed_at,
      })),
      exported_at: new Date().toISOString(), glassbox_version: "1.0.0",
    };
    const blob = new Blob([JSON.stringify(trace, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `glassbox_run_${runId}_trace.json`; a.click(); URL.revokeObjectURL(url);
  }

  async function handleCreateChallenge(e: React.FormEvent) {
    e.preventDefault();
    if (!challengeNodeId) return;
    setSubmittingChallenge(true);
    try {
      const res = await fetch(`${API_BASE}/challenges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          run_id: runId,
          flawed_node_id: challengeNodeId,
          creator_name: creatorName.trim() || "Anonymous",
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setChallengeSuccess(created.id);
        setTimeout(() => {
          setShowChallengeModal(false);
          router.push("/leaderboard");
        }, 1500);
      }
    } catch {
      // ignore
    } finally {
      setSubmittingChallenge(false);
    }
  }

  const ViewToggle = (
    <div className="flex items-center bg-neutral-200/70 dark:bg-neutral-900/90 border border-neutral-300/60 dark:border-neutral-800 rounded-full p-0.5 shadow-inner">
      <button
        id="dev-view-btn"
        onClick={() => setViewMode("developer")}
        title="Developer View"
        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all ${
          viewMode === "developer"
            ? "bg-white dark:bg-neutral-800 text-indigo-600 dark:text-indigo-400 shadow-sm"
            : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300"
        }`}
      >
        <Monitor size={13} strokeWidth={2} /> Dev
      </button>
      <button
        id="simple-view-btn"
        onClick={() => setViewMode("simple")}
        title="Simple View"
        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all ${
          viewMode === "simple"
            ? "bg-white dark:bg-neutral-800 text-indigo-600 dark:text-indigo-400 shadow-sm"
            : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300"
        }`}
      >
        <Eye size={13} strokeWidth={2} /> Simple
      </button>
    </div>
  );

  return (
    <>
      <CommandPalette runs={runs} />
      <div className="flex flex-col h-screen bg-slate-50 dark:bg-[#0a0a0a] text-neutral-900 dark:text-neutral-100 transition-colors">

        {/* Topbar */}
        <header className="flex items-center justify-between px-5 py-2.5 border-b border-neutral-200 dark:border-neutral-800 bg-white/90 dark:bg-[#0a0a0a]/90 backdrop-blur-md shrink-0 z-10 shadow-xs dark:shadow-[0_4px_20px_rgba(0,0,0,0.4)] transition-colors gap-4">
          {/* Left Group */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              id="back-link-btn"
              onClick={() => router.push("/")}
              className="text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300 flex items-center gap-1.5 transition-colors shrink-0 font-medium"
            >
              <img src="/logo-icon.png" alt="GlassBox Logo" className="w-5 h-5 rounded object-contain" />
              <span>← GlassBox</span>
            </button>
            <div className="h-3.5 w-px bg-neutral-200 dark:bg-neutral-800 shrink-0" />
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border border-current/20 flex items-center gap-1.5 shrink-0 ${statusColor[run?.status ?? "running"]}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${run?.status === "completed" ? "bg-emerald-400" : run?.status === "error" ? "bg-red-400" : "bg-amber-400 animate-pulse"}`} />
              {run?.status ?? "…"}
            </span>
            <span className="text-neutral-800 dark:text-neutral-200 text-xs font-semibold truncate max-w-xs">{run?.name ?? run?.goal ?? "Loading…"}</span>
            <NetworkStatusIndicator />
          </div>

          {/* Center View Toggle */}
          <div className="flex justify-center shrink-0">
            {ViewToggle}
          </div>

          {/* Right Group Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <button
              id="sound-toggle-btn"
              onClick={toggleSound}
              title={soundEnabled ? "Mute audio" : "Enable audio"}
              className={`p-1.5 rounded-lg border text-xs flex items-center justify-center transition-colors ${
                soundEnabled
                  ? "bg-indigo-600/10 text-indigo-600 dark:text-indigo-300 border-indigo-500/30 dark:bg-indigo-600/20"
                  : "bg-neutral-100 dark:bg-neutral-900 text-neutral-500 border-neutral-200 dark:border-neutral-800 hover:text-neutral-800 dark:hover:text-neutral-300"
              }`}
            >
              {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            </button>
            <button
              id="share-run-btn"
              onClick={handleShareRun}
              title="Generate public share link"
              className={`text-xs px-2.5 py-1 rounded-lg font-medium flex items-center gap-1 transition-all shadow-xs ${
                copiedToast
                  ? "bg-emerald-600 text-white"
                  : "bg-indigo-600 hover:bg-indigo-500 text-white"
              }`}
            >
              {copiedToast ? <Check size={12} /> : <Share2 size={12} />}
              {copiedToast ? "Copied!" : "Share"}
            </button>
            {aggregatorNode && (
              <button
                id="view-final-plan-topbar-btn"
                onClick={() => setSelectedNodeId(aggregatorNode.id)}
                className="text-xs bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30 px-2.5 py-1 rounded-lg font-medium flex items-center gap-1 transition-colors"
              >
                <span>✨</span> View Plan &amp; Export
              </button>
            )}
            {run?.status === "completed" && (
              <>
                <button
                  id="roast-ai-btn"
                  onClick={handleFetchRoast}
                  className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-500 dark:text-red-400 border border-red-500/30 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-colors"
                >
                  🔥 Roast AI
                </button>
                <button
                  id="report-card-btn"
                  onClick={handleFetchReportCard}
                  className="text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-colors"
                >
                  🏆 Report Card
                </button>
                <button
                  id="submit-challenge-btn"
                  onClick={() => {
                    if (nodes.length > 0) setChallengeNodeId(nodes[0].id);
                    setShowChallengeModal(true);
                  }}
                  className="text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-lg font-medium flex items-center gap-1 transition-colors"
                >
                  <Trophy size={12} className="text-amber-500 dark:text-amber-400" />
                  Submit Challenge
                </button>
              </>
            )}
            <kbd
              onClick={() => useGlassboxStore.getState().setPaletteOpen(true)}
              className="cursor-pointer text-[11px] font-mono text-neutral-500 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 px-1.5 py-0.5 rounded hover:border-neutral-400 dark:hover:border-neutral-700 transition-colors"
            >
              ⌘K
            </kbd>
            <div className="ml-1">
              <UserButton />
            </div>
          </div>
        </header>

        {/* DEVELOPER VIEW */}
        {viewMode === "developer" && (
          <>
            {run?.status === "completed" && nodes.length > 0 && <RunStatsBar nodes={nodes} />}
            <div className="flex-1 flex overflow-hidden">
              {run?.status === "awaiting_input" && clarificationNode ? (
                <div className="flex-1 flex items-center justify-center bg-[#0a0a0a] overflow-y-auto">
                  <ClarificationPrompt runId={runId} node={clarificationNode} onAnswerSubmitted={handleAnswerSubmitted} />
                </div>
              ) : (
                <>
                  <div className="flex-1 relative overflow-hidden">

                    {/* SEMANTIC SEARCH UI */}
                    <div className="absolute top-4 left-4 z-20 w-80 bg-white/90 dark:bg-neutral-900/90 backdrop-blur border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xl flex flex-col max-h-[70vh] overflow-hidden">
                      <form onSubmit={handleSearch} className="flex border-b border-neutral-200 dark:border-neutral-800/50">
                        <input 
                          type="text" 
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Semantic node search..." 
                          className="w-full bg-transparent text-sm px-4 py-3 outline-none text-neutral-900 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-500"
                        />
                        <button type="submit" className="px-4 text-neutral-500 hover:text-white transition-colors" disabled={isSearching}>
                          {isSearching ? <span className="animate-pulse">...</span> : <Search size={16} />}
                        </button>
                      </form>
                      {searchResults.length > 0 && (
                        <div className="overflow-y-auto p-2 space-y-1">
                          {searchResults.map(n => (
                            <div 
                              key={n.id} 
                              onClick={() => setSelectedNodeId(n.id)}
                              className="p-3 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg cursor-pointer flex flex-col gap-1 transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-indigo-400 text-xs uppercase tracking-wide">{n.agent_name}</span>
                                <span className="text-[10px] text-neutral-600">ID: {n.id}</span>
                              </div>
                              <div className="text-neutral-300 text-sm line-clamp-2 leading-relaxed">
                                {n.prompt_text || "No prompt text"}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <AnimatePresence>
                      {loadingInitial && (
                        <motion.div key="skeleton" initial={{ opacity: 1 }} exit={{ opacity: 0 }}
                          className="absolute inset-0 flex items-center justify-center z-10 bg-slate-50 dark:bg-[#0a0a0a]">
                          <div className="flex flex-col items-center gap-4">
                            <div className="flex gap-2">
                              {["planner", "worker", "aggregator"].map((_, i) => (
                                <motion.div key={i} className="w-[160px] h-[80px] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl"
                                  animate={{ opacity: [0.4, 0.8, 0.4] }} transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }} />
                              ))}
                            </div>
                            <p className="text-neutral-600 text-sm animate-pulse">Starting pipeline…</p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    {!loadingInitial && nodes.length === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <p className="text-neutral-600 text-sm">No nodes yet — pipeline may still be initializing.</p>
                      </div>
                    )}
                    {!loadingInitial && nodes.length > 0 && !selectedNodeId && (
                      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="absolute bottom-16 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
                        <p className="text-neutral-600 dark:text-neutral-400 text-xs bg-white/80 dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800 rounded-full px-4 py-1.5 backdrop-blur-sm">
                          Click any node to inspect its output →
                        </p>
                      </motion.div>
                    )}
                    {nodes.length > 0 && <RunGraph apiNodes={nodes} runId={runId} />}
                  </div>
                  <NodeSidebar
                    onOpenLinkedInPost={(text, tags) => {
                      setLinkedInPostData({ post_text: text, hashtags: tags });
                      setShowLinkedInModal(true);
                    }}
                    onOpenReel={() => setShowReelModal(true)}
                  />
                </>
              )}
            </div>
          </>
        )}

        {/* SIMPLE VIEW */}
        {viewMode === "simple" && (
          <div className="flex-1 overflow-y-auto">
            {run?.status === "awaiting_input" && clarificationNode ? (
              <div className="max-w-2xl mx-auto px-6 py-10 flex items-center justify-center">
                <ClarificationPrompt runId={runId} node={clarificationNode} onAnswerSubmitted={handleAnswerSubmitted} />
              </div>
            ) : loadingInitial || run?.status === "running" ? (
              <div className="max-w-2xl mx-auto px-6 py-12 space-y-4 animate-pulse">
                <div className="h-6 bg-neutral-800 rounded w-1/2" />
                <div className="h-4 bg-neutral-800 rounded w-full" />
                <div className="h-4 bg-neutral-800 rounded w-5/6" />
                <div className="h-32 bg-neutral-900 rounded-xl border border-neutral-800 mt-6" />
                <p className="text-neutral-600 text-sm text-center pt-4">{run?.status === "running" ? "Pipeline is running…" : "Loading…"}</p>
              </div>
            ) : aggregatorNode && isValidAggregatorOutput(aggregatorNode.output_json) ? (
              <div className="max-w-2xl mx-auto px-6 py-10"><AggregatorResult data={aggregatorNode.output_json} /></div>
            ) : run?.status === "error" ? (
              <div className="max-w-2xl mx-auto px-6 py-12 text-center">
                <div className="inline-flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-5 py-3">
                  <span className="text-lg">⚠️</span>
                  <span className="text-sm">Pipeline error. Switch to Developer View to inspect.</span>
                </div>
              </div>
            ) : (
              <div className="max-w-2xl mx-auto px-6 py-12 text-center"><p className="text-neutral-600 text-sm">No result yet.</p></div>
            )}
          </div>
        )}

        {/* Challenge Modal */}
        {showChallengeModal && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-[#111111] border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 max-w-md w-full space-y-5 shadow-2xl relative">
              <button onClick={() => setShowChallengeModal(false)} className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-800 dark:text-neutral-500 dark:hover:text-white">
                <X size={16} />
              </button>

              <div className="flex items-center gap-2 text-amber-400 font-bold text-base">
                <Trophy size={18} />
                <span>Submit to Community Leaderboard</span>
              </div>

              <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                Turn this run into a public puzzle. Pick which node had a flaw so community members can test their intuition!
              </p>

              {challengeSuccess ? (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-center text-emerald-300 text-xs flex items-center justify-center gap-2">
                  <Check size={16} />
                  <span>Challenge posted! Redirecting to Leaderboard…</span>
                </div>
              ) : (
                <form onSubmit={handleCreateChallenge} className="space-y-4">
                  <div>
                    <label className="text-[10px] text-neutral-500 uppercase tracking-widest font-semibold block mb-1">Your Creator Name</label>
                    <input
                      type="text"
                      value={creatorName}
                      onChange={(e) => setCreatorName(e.target.value)}
                      placeholder="e.g. Alex, AgentArchitect"
                      className="w-full bg-neutral-50 dark:bg-[#0a0a0a] border border-neutral-200 dark:border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-neutral-900 dark:text-neutral-200 focus:outline-none focus:border-amber-500/50"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-neutral-500 uppercase tracking-widest font-semibold block mb-1">Select the Flawed Node</label>
                    <select
                      value={challengeNodeId ?? ""}
                      onChange={(e) => setChallengeNodeId(Number(e.target.value))}
                      className="w-full bg-neutral-50 dark:bg-[#0a0a0a] border border-neutral-200 dark:border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-neutral-900 dark:text-neutral-200 focus:outline-none focus:border-amber-500/50"
                    >
                      {nodes.map((n) => (
                        <option key={n.id} value={n.id}>
                          Node #{n.id} — {n.agent_name} ({n.node_type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={() => setShowChallengeModal(false)} className="px-4 py-2 text-xs text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white bg-neutral-100 dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800">
                      Cancel
                    </button>
                    <button type="submit" disabled={submittingChallenge || !challengeNodeId} className="px-5 py-2 text-xs font-semibold text-neutral-950 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 rounded-xl transition-colors">
                      {submittingChallenge ? "Posting…" : "Post Challenge"}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}

        {/* Viral Feature Modals */}
        {roastData && (
          <RoastCard
            isOpen={showRoastModal}
            onClose={() => setShowRoastModal(false)}
            roastText={roastData.roast_text}
            roastGrade={roastData.roast_grade}
            runGoal={run?.goal || "AI Run"}
          />
        )}

        {reportCardData && (
          <ReportCard
            isOpen={showReportCard}
            onClose={() => setShowReportCard(false)}
            report={reportCardData}
            runGoal={run?.goal || "AI Run"}
          />
        )}

        {linkedInPostData && (
          <LinkedInPostModal
            isOpen={showLinkedInModal}
            onClose={() => setShowLinkedInModal(false)}
            initialPostText={linkedInPostData.post_text}
            hashtags={linkedInPostData.hashtags}
          />
        )}

        <ReelGenerator
          isOpen={showReelModal}
          onClose={() => setShowReelModal(false)}
          runGoal={run?.goal || "AI Task"}
          beforeSummary="Allocated 90% budget to single category."
          afterSummary="Balanced multi-tier itinerary across train, hotel, and dining."
        />

        <AnimatePresence>
          {run?.status === "running" && (
            <motion.div key="running-bar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="h-0.5 bg-gradient-to-r from-indigo-500 via-teal-500 to-amber-500 shrink-0"
              style={{ backgroundSize: "200% 100%", animation: "runningBar 2s linear infinite" }} />
          )}
        </AnimatePresence>
      </div>
      <style jsx global>{`
        @keyframes runningBar { 0% { background-position: 0% 0%; } 100% { background-position: 200% 0%; } }
        .json-key { color: #818cf8; } .json-string { color: #34d399; } .json-bool { color: #fb923c; }
        .json-null { color: #6b7280; } .json-number { color: #38bdf8; }
      `}</style>
    </>
  );
}