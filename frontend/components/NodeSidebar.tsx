"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Settings, Sparkles, Pencil, X, ArrowRight, Code, FileText, CheckCircle2, Clock, Cpu, RefreshCw } from "lucide-react";
import { api, Node } from "@/lib/api";
import { useGlassboxStore } from "@/lib/store";
import AggregatorResult, { isValidAggregatorOutput } from "./AggregatorResult";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

interface NodeWithTokens extends Node {
  token_count_input?: number | null;
  token_count_output?: number | null;
}

// ── Simple LCS Line-by-Line Diff Helper ──────────────────────────────────────
interface DiffLine {
  type: "add" | "remove" | "same";
  text: string;
}

function computeLineDiff(oldStr: string, newStr: string): DiffLine[] {
  const oldLines = oldStr.split("\n");
  const newLines = newStr.split("\n");
  const m = oldLines.length;
  const n = newLines.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const diff: DiffLine[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      diff.unshift({ type: "same", text: oldLines[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diff.unshift({ type: "add", text: newLines[j - 1] });
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      diff.unshift({ type: "remove", text: oldLines[i - 1] });
      i--;
    }
  }
  return diff;
}

function highlightJson(obj: unknown): string {
  const str = JSON.stringify(obj, null, 2);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(
      /("(\\u[\dA-Fa-f]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
      (match) => {
        if (/^"/.test(match)) {
          return /:$/.test(match)
            ? `<span class="json-key">${match}</span>`
            : `<span class="json-string">${match}</span>`;
        }
        if (/true|false/.test(match)) return `<span class="json-bool">${match}</span>`;
        if (/null/.test(match)) return `<span class="json-null">${match}</span>`;
        return `<span class="json-number">${match}</span>`;
      }
    );
}

const STATUS_STYLES: Record<string, { badge: string; dot: string; label: string }> = {
  running: {
    badge: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30",
    dot: "bg-amber-500 animate-pulse",
    label: "Running",
  },
  awaiting_answer: {
    badge: "text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/30",
    dot: "bg-blue-500 animate-pulse",
    label: "Awaiting Input",
  },
  answered: {
    badge: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    dot: "bg-emerald-500",
    label: "Answered",
  },
  success: {
    badge: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    dot: "bg-emerald-500",
    label: "Success",
  },
  error: {
    badge: "text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/30",
    dot: "bg-red-500",
    label: "Error",
  },
};

const AGENT_CONFIG: Record<string, { color: string; bg: string; icon: React.ReactNode; accent: string }> = {
  planner: { color: "text-indigo-600 dark:text-indigo-300", bg: "bg-indigo-500/10 border-indigo-500/20", icon: <Brain size={14} />, accent: "#6366f1" },
  worker: { color: "text-teal-600 dark:text-teal-300", bg: "bg-teal-500/10 border-teal-500/20", icon: <Settings size={14} />, accent: "#14b8a6" },
  aggregator: { color: "text-amber-600 dark:text-amber-300", bg: "bg-amber-500/10 border-amber-500/20", icon: <Sparkles size={14} />, accent: "#f59e0b" },
};

function FormattedInputView({ data }: { data: unknown }) {
  if (!data || typeof data !== "object") {
    return <p className="text-xs text-neutral-400 italic">No input available</p>;
  }

  const entries = Object.entries(data as Record<string, unknown>);
  if (entries.length === 0) {
    return <p className="text-xs text-neutral-400 italic font-mono">{"{}"}</p>;
  }

  return (
    <div className="space-y-2">
      {entries.map(([key, val]) => (
        <div key={key} className="bg-neutral-50 dark:bg-[#0d0d0d] border border-neutral-200 dark:border-neutral-800/80 rounded-lg p-3 space-y-1">
          <span className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider">
            {key.replace(/_/g, " ")}
          </span>
          <div className="text-xs text-neutral-800 dark:text-neutral-200 font-mono break-all leading-relaxed">
            {typeof val === "object" ? JSON.stringify(val, null, 2) : String(val)}
          </div>
        </div>
      ))}
    </div>
  );
}

function JsonBlock({ data, maxH = "max-h-52" }: { data: unknown; maxH?: string }) {
  return (
    <pre
      className={`bg-neutral-50 dark:bg-[#0d0d0d] border border-neutral-200 dark:border-neutral-800 rounded-lg px-4 py-3 text-xs font-mono leading-relaxed overflow-auto ${maxH} scrollbar-thin`}
      dangerouslySetInnerHTML={{ __html: highlightJson(data) }}
    />
  );
}

interface NodeSidebarProps {
  isReadOnly?: boolean;
  onOpenLinkedInPost?: (postText: string, hashtags: string[]) => void;
  onOpenReel?: () => void;
}

export default function NodeSidebar({
  isReadOnly = false,
  onOpenLinkedInPost,
  onOpenReel,
}: NodeSidebarProps) {
  const { selectedNodeId, setSelectedNodeId } = useGlassboxStore();
  const { isOnline } = useNetworkStatus();
  const [node, setNode] = useState<NodeWithTokens | null>(null);
  const [originalNode, setOriginalNode] = useState<NodeWithTokens | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [replaying, setReplaying] = useState(false);
  const [replayError, setReplayError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"output" | "input" | "prompt" | "diff">("output");
  const [inputViewMode, setInputViewMode] = useState<"formatted" | "raw">("formatted");
  const [outputViewMode, setOutputViewMode] = useState<"formatted" | "raw">("formatted");

  useEffect(() => {
    if (!selectedNodeId) {
      setTimeout(() => { setNode(null); setOriginalNode(null); }, 0);
      return;
    }
    setLoading(true);
    setEditing(false);
    setReplayError(null);
    setActiveTab("output");
    setInputViewMode("formatted");
    setOutputViewMode("formatted");
    setOriginalNode(null);

    api
      .getNode(selectedNodeId)
      .then(async (n) => {
        const typedNode = n as NodeWithTokens;
        setNode(typedNode);
        setEditValue(JSON.stringify(typedNode.input_json ?? {}, null, 2));

        if (typedNode.replayed_from_id) {
          try {
            const orig = await api.getNode(typedNode.replayed_from_id);
            setOriginalNode(orig as NodeWithTokens);
          } catch {
            setOriginalNode(null);
          }
        }
      })
      .finally(() => setLoading(false));
  }, [selectedNodeId]);

  async function handleReplay() {
    if (!node) return;
    setReplaying(true);
    setReplayError(null);
    try {
      const parsed = JSON.parse(editValue);
      await api.replayNode(node.id, parsed);
      setSelectedNodeId(null);
    } catch (err) {
      setReplayError(err instanceof Error ? err.message : "Replay failed");
    } finally {
      setReplaying(false);
    }
  }

  const agentCfg = node ? (AGENT_CONFIG[node.agent_name] ?? AGENT_CONFIG.worker) : null;
  const statusStyle = node ? (STATUS_STYLES[node.status] ?? STATUS_STYLES.running) : null;

  const isAggregatorSuccess = node?.agent_name === "aggregator" && node?.status === "success";
  const isValidFormattedSchema = isAggregatorSuccess && node?.output_json && isValidAggregatorOutput(node.output_json);

  let diffLines: DiffLine[] = [];
  if (activeTab === "diff" && node && originalNode) {
    const oldJsonStr = JSON.stringify(originalNode.output_json ?? {}, null, 2);
    const newJsonStr = JSON.stringify(node.output_json ?? {}, null, 2);
    diffLines = computeLineDiff(oldJsonStr, newJsonStr);
  }

  return (
    <AnimatePresence>
      {selectedNodeId !== null && (
        <>
          {/* Mobile Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedNodeId(null)}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden"
          />

          <motion.aside
            key="node-sidebar"
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className="fixed inset-x-0 bottom-0 top-12 md:top-0 md:bottom-auto md:relative md:inset-auto md:h-full md:w-[440px] bg-white dark:bg-[#0f0f0f] border-t md:border-t-0 md:border-l border-neutral-200 dark:border-neutral-900 flex flex-col overflow-hidden shrink-0 z-50 md:z-auto shadow-2xl md:shadow-[-10px_0_30px_rgba(0,0,0,0.5)] transition-colors rounded-t-2xl md:rounded-t-none"
          >
            {/* Subtle Top Accent Bar */}
            <div
              className="h-[3px] w-full shrink-0"
              style={{ backgroundColor: agentCfg?.accent ?? "#6366f1" }}
            />

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-neutral-200 dark:border-neutral-800/80 shrink-0">
            {node && agentCfg && statusStyle ? (
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 border"
                  style={{
                    backgroundColor: `${agentCfg.accent}15`,
                    borderColor: `${agentCfg.accent}40`,
                    color: agentCfg.accent,
                  }}
                >
                  {agentCfg.icon}
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-extrabold text-sm text-neutral-900 dark:text-white capitalize">
                    {node.agent_name}
                  </span>
                  <span className="text-neutral-400 text-xs font-mono">#{node.id}</span>
                </div>
                <span className={`flex items-center gap-1 text-[10px] font-bold border rounded-full px-2.5 py-0.5 ${statusStyle.badge}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
                  {statusStyle.label}
                </span>
              </div>
            ) : (
              <div className="h-5 w-32 bg-neutral-200 dark:bg-neutral-800 rounded animate-pulse" />
            )}

            <button
              id="close-sidebar-btn"
              onClick={() => setSelectedNodeId(null)}
              className="text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Metrics Row: Input tokens: 847 -> Output tokens: 203 • 1.6s */}
          {node && !loading && (
            <div className="px-4 py-2.5 bg-neutral-50 dark:bg-neutral-900/60 border-b border-neutral-200 dark:border-neutral-800/80 flex items-center justify-between text-xs font-mono shrink-0">
              <div className="flex items-center gap-2 text-neutral-700 dark:text-neutral-300">
                <span>Input tokens: <strong className="text-indigo-500">{node.token_count_input ?? 0}</strong></span>
                <ArrowRight size={12} className="text-neutral-400" />
                <span>Output tokens: <strong className="text-teal-500">{node.token_count_output ?? 0}</strong></span>
                <span className="text-neutral-400">•</span>
                <span className="text-amber-500 font-bold">{((node.latency_ms ?? 0) / 1000).toFixed(1)}s</span>
              </div>
              <span className="text-[10px] text-neutral-400 truncate max-w-[130px]" title={node.model_name ?? "Groq"}>
                {node.model_name ?? "llama-3.3-70b-versatile"}
              </span>
            </div>
          )}

          {/* Tab Bar */}
          {node && (
            <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 shrink-0 px-2">
              <div className="flex">
                {(["output", "input", "prompt"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3.5 py-2.5 text-xs font-bold capitalize transition-colors relative ${
                      activeTab === tab
                        ? "text-indigo-600 dark:text-indigo-400"
                        : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300"
                    }`}
                  >
                    {tab}
                    {activeTab === tab && (
                      <motion.div
                        layoutId="sidebar-tab-indicator"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full"
                      />
                    )}
                  </button>
                ))}
                {node.replayed_from_id && originalNode && (
                  <button
                    onClick={() => setActiveTab("diff")}
                    className={`px-3 py-2 text-xs font-bold transition-colors relative ${
                      activeTab === "diff" ? "text-amber-500" : "text-neutral-500 hover:text-neutral-300"
                    }`}
                  >
                    Diff vs #{node.replayed_from_id}
                  </button>
                )}
              </div>

              {/* View Toggle on Input / Output tabs */}
              {activeTab === "input" && (
                <div className="flex items-center bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-0.5 rounded-lg mr-1">
                  <button
                    onClick={() => setInputViewMode("formatted")}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-colors ${
                      inputViewMode === "formatted" ? "bg-indigo-600 text-white" : "text-neutral-400"
                    }`}
                  >
                    Formatted
                  </button>
                  <button
                    onClick={() => setInputViewMode("raw")}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-colors ${
                      inputViewMode === "raw" ? "bg-indigo-600 text-white" : "text-neutral-400"
                    }`}
                  >
                    Raw JSON
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {loading && (
              <div className="space-y-3 animate-pulse pt-2">
                {[100, 60, 80, 140].map((w, i) => (
                  <div key={i} className="h-3 bg-neutral-200 dark:bg-neutral-800 rounded" style={{ width: `${w}%` }} />
                ))}
              </div>
            )}

            {!loading && node && (
              <>
                {/* OUTPUT TAB */}
                {activeTab === "output" && (
                  <div>
                    {node.output_json ? (
                      isAggregatorSuccess ? (
                        <AggregatorResult data={node.output_json} />
                      ) : (
                        <JsonBlock data={node.output_json} maxH="max-h-[calc(100vh-320px)]" />
                      )
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-center text-neutral-400">
                        <Clock size={24} className="animate-spin mb-2" />
                        <p className="text-xs">Node is still running...</p>
                      </div>
                    )}
                  </div>
                )}

                {/* INPUT TAB */}
                {activeTab === "input" && (
                  <div className="space-y-3">
                    <AnimatePresence>
                      {editing && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <textarea
                            id="edit-input-textarea"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-full bg-white dark:bg-[#0d0d0d] border border-indigo-500/50 rounded-xl px-4 py-3 text-neutral-900 dark:text-neutral-200 text-xs font-mono leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/40 min-h-[220px]"
                            spellCheck={false}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {!editing && (
                      inputViewMode === "formatted" ? (
                        <FormattedInputView data={node.input_json} />
                      ) : (
                        <JsonBlock data={node.input_json} maxH="max-h-[calc(100vh-320px)]" />
                      )
                    )}

                    {replayError && (
                      <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg p-2.5">
                        {replayError}
                      </p>
                    )}
                  </div>
                )}

                {/* PROMPT TAB */}
                {activeTab === "prompt" && (
                  <div>
                    {node.prompt_text ? (
                      <pre className="bg-neutral-50 dark:bg-[#0d0d0d] border border-neutral-200 dark:border-neutral-800 rounded-xl p-3.5 text-neutral-800 dark:text-neutral-300 text-xs font-mono leading-relaxed overflow-auto max-h-[calc(100vh-280px)] whitespace-pre-wrap">
                        {node.prompt_text}
                      </pre>
                    ) : (
                      <p className="text-neutral-500 text-xs italic">No prompt recorded.</p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer Actions */}
          {node && !loading && (
            <div className="border-t border-neutral-200 dark:border-neutral-800/80 px-4 py-3 space-y-2 shrink-0">
              {node.is_replay && (
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      try {
                        const res = await api.generateLinkedInPost(node.id);
                        if (onOpenLinkedInPost) onOpenLinkedInPost(res.post_text, res.suggested_hashtags);
                      } catch {
                        alert("Failed to generate LinkedIn post.");
                      }
                    }}
                    className="flex-1 py-2 bg-blue-600/10 hover:bg-blue-600/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <span>💼 Write LinkedIn Post</span>
                  </button>
                  <button
                    onClick={() => {
                      if (onOpenReel) onOpenReel();
                    }}
                    className="py-2 px-3 bg-teal-600/10 hover:bg-teal-600/20 text-teal-600 dark:text-teal-400 border border-teal-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <span>🎬 Reel</span>
                  </button>
                </div>
              )}

              {!editing ? (
                <button
                  id="edit-replay-btn"
                  onClick={() => {
                    if (isOnline) {
                      setActiveTab("input");
                      setEditing(true);
                    }
                  }}
                  title={isOnline ? undefined : "Replay requires internet connection"}
                  disabled={!isOnline}
                  className={`w-full h-[52px] rounded-xl font-bold text-xs relative overflow-hidden transition-all shadow-md group flex items-center justify-center gap-2 duration-500 ${
                    isOnline
                      ? "bg-gradient-to-r from-indigo-600 via-teal-600 to-indigo-600 bg-[length:200%_100%] hover:bg-[position:100%_0] text-white cursor-pointer"
                      : "bg-neutral-800 text-neutral-500 border border-neutral-700 cursor-not-allowed"
                  }`}
                >
                  <Pencil size={15} />
                  <span>{isOnline ? "Edit & Replay" : "Replay requires internet"}</span>
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditing(false);
                      setEditValue(JSON.stringify(node.input_json ?? {}, null, 2));
                    }}
                    className="px-4 h-[52px] bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-bold rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    id="confirm-replay-btn"
                    onClick={handleReplay}
                    disabled={replaying}
                    className="flex-1 h-[52px] bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-colors shadow-md"
                  >
                    {replaying ? <RefreshCw size={16} className="animate-spin" /> : "↻ Run Replay"}
                  </button>
                </div>
              )}
            </div>
          )}
        </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}