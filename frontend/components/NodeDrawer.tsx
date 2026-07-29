"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api, Node } from "@/lib/api";
import { useGlassboxStore } from "@/lib/store";
import { playReplaySuccessSound } from "@/lib/sound";
import MagneticButton from "@/components/MagneticButton";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

// ── JSON syntax highlighter ────────────────────────────────────────────────────
function highlightJson(obj: unknown): string {
  const str = JSON.stringify(obj, null, 2);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(
      /("(\\u[\dA-Fa-f]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
      (match) => {
        if (/^"/.test(match))
          return /:$/.test(match)
            ? `<span class="json-key">${match}</span>`
            : `<span class="json-string">${match}</span>`;
        if (/true|false/.test(match)) return `<span class="json-bool">${match}</span>`;
        if (/null/.test(match)) return `<span class="json-null">${match}</span>`;
        return `<span class="json-number">${match}</span>`;
      }
    );
}

// ── Agent / type config (AgentPrism-inspired: distinct per type) ──────────────
const AGENT_COLOR: Record<string, { text: string; border: string; bg: string; accent: string }> = {
  planner:    { text: "#a5b4fc", border: "rgba(99,102,241,0.3)",  bg: "rgba(99,102,241,0.06)",  accent: "#6366f1" },
  worker:     { text: "#5eead4", border: "rgba(20,184,166,0.3)",  bg: "rgba(20,184,166,0.06)",  accent: "#14b8a6" },
  aggregator: { text: "#fcd34d", border: "rgba(245,158,11,0.3)", bg: "rgba(245,158,11,0.06)", accent: "#f59e0b" },
};

// AgentPrism pattern: each node_type gets its own icon + label treatment
const NODE_TYPE_META: Record<string, { label: string; icon: string; desc: string }> = {
  llm_call:  { label: "LLM Call",   icon: "✦", desc: "Direct language model inference" },
  tool_call: { label: "Tool Call",  icon: "⚙", desc: "External tool or function execution" },
  handoff:   { label: "Handoff",    icon: "→", desc: "Agent-to-agent delegation" },
};

const STATUS_STYLE: Record<string, { text: string; bg: string; border: string }> = {
  running: { text: "#fbbf24", bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.25)" },
  success: { text: "#34d399", bg: "rgba(52,211,153,0.1)",  border: "rgba(52,211,153,0.25)" },
  error:   { text: "#f87171", bg: "rgba(248,113,113,0.1)", border: "rgba(248,113,113,0.25)" },
};

function formatLatency(ms: number | null | undefined): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// ── Section label ─────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#4b5563", marginBottom: 6 }}>
      {children}
    </p>
  );
}

// ── JSON block ────────────────────────────────────────────────────────────────
function JsonBlock({ data, editable, value, onChange }: {
  data: unknown;
  editable?: boolean;
  value?: string;
  onChange?: (v: string) => void;
}) {
  if (editable) {
    return (
      <textarea
        id="edit-input-textarea"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        spellCheck={false}
        style={{
          width: "100%",
          minHeight: 140,
          background: "#0d0d0d",
          border: "1px solid rgba(99,102,241,0.4)",
          borderRadius: 8,
          padding: "10px 12px",
          color: "#e5e7eb",
          fontSize: 11,
          fontFamily: "var(--font-mono)",
          lineHeight: 1.7,
          resize: "vertical",
          outline: "none",
          marginTop: 4,
        }}
      />
    );
  }
  return (
    <pre
      className="bg-neutral-50 dark:bg-[#0d0d0d] border border-neutral-200 dark:border-white/10 rounded-lg p-2.5 text-xs font-mono leading-relaxed overflow-x-auto max-h-[220px] mt-1 whitespace-pre-wrap word-break-break-word text-neutral-800 dark:text-neutral-200 transition-colors"
      dangerouslySetInnerHTML={{ __html: highlightJson(data) }}
    />
  );
}

// ── AgentPrism-inspired: Timeline strip showing node lifecycle ─────────────────
function TimelineStrip({ node }: { node: Node }) {
  const start = new Date(node.created_at).getTime();
  const end = node.completed_at ? new Date(node.completed_at).getTime() : Date.now();
  const ms = end - start;

  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: "#6b7280", fontFamily: "var(--font-mono)" }}>
          {formatTime(node.created_at)}
        </span>
        {node.completed_at && (
          <span style={{ fontSize: 10, color: "#6b7280", fontFamily: "var(--font-mono)" }}>
            {formatTime(node.completed_at)}
          </span>
        )}
      </div>
      {/* Progress bar representing % of total run time this node took */}
      <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: node.status === "running" ? "60%" : "100%" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          style={{
            height: "100%",
            background: node.status === "error"
              ? "#ef4444"
              : node.status === "running"
              ? "linear-gradient(90deg, #6366f1, #14b8a6)"
              : AGENT_COLOR[node.agent_name]?.accent ?? "#6366f1",
            borderRadius: 2,
          }}
        />
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
        <Metric label="Latency" value={formatLatency(node.latency_ms)} />
        {node.model_name && <Metric label="Model" value={node.model_name.split("/").pop() ?? node.model_name} />}
        <Metric label="Status" value={node.status} color={STATUS_STYLE[node.status]?.text} />
      </div>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p style={{ fontSize: 9, color: "#4b5563", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>{label}</p>
      <p style={{ fontSize: 11, color: color ?? "#9ca3af", fontFamily: "var(--font-mono)", marginTop: 2 }}>{value}</p>
    </div>
  );
}

// ── Main drawer ───────────────────────────────────────────────────────────────
export default function NodeDrawer() {
  const { selectedNodeId, setSelectedNodeId } = useGlassboxStore();
  const { isOnline } = useNetworkStatus();
  const [node, setNode] = useState<Node | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [replaying, setReplaying] = useState(false);
  const [replayError, setReplayError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedNodeId) { setTimeout(() => setNode(null), 0); return; }
    setLoading(true);
    setEditing(false);
    setReplayError(null);
    api.getNode(selectedNodeId).then((n) => {
      setNode(n);
      setEditValue(JSON.stringify(n.input_json ?? {}, null, 2));
    }).finally(() => setLoading(false));
  }, [selectedNodeId]);

  async function handleReplay() {
    if (!node) return;
    setReplaying(true);
    setReplayError(null);
    try {
      const parsed = JSON.parse(editValue);
      await api.replayNode(node.id, parsed);
      playReplaySuccessSound();
      setSelectedNodeId(null);
    } catch (err) {
      setReplayError(err instanceof Error ? err.message : "Replay failed");
    } finally {
      setReplaying(false);
    }
  }

  const open = selectedNodeId !== null;
  const cfg = node ? (AGENT_COLOR[node.agent_name] ?? AGENT_COLOR.planner) : AGENT_COLOR.planner;
  const typeMeta = node ? (NODE_TYPE_META[node.node_type] ?? NODE_TYPE_META.llm_call) : NODE_TYPE_META.llm_call;
  const statusSt = node ? (STATUS_STYLE[node.status] ?? STATUS_STYLE.success) : STATUS_STYLE.success;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setSelectedNodeId(null)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 30 }}
          />

          <motion.aside
            key="drawer"
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
            className="fixed top-0 right-0 h-full w-full max-w-[480px] bg-white dark:bg-[#111111] text-neutral-900 dark:text-neutral-100 z-40 flex flex-col overflow-hidden shadow-2xl transition-colors"
            style={{
              borderLeft: `1px solid ${cfg.border}`,
            }}
          >
            {/* ── Header: AgentPrism pattern — agent name + type icon + status ── */}
            <div style={{
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              padding: "14px 18px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: cfg.bg,
              flexShrink: 0,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* Type icon pill — AgentPrism-style distinct treatment */}
                <div style={{
                  background: "rgba(255,255,255,0.05)",
                  border: `1px solid ${cfg.border}`,
                  borderRadius: 8, padding: "3px 8px",
                  display: "flex", alignItems: "center", gap: 5,
                }}>
                  <span style={{ fontSize: 12 }}>{typeMeta.icon}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: cfg.text, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                    {typeMeta.label}
                  </span>
                </div>

                {node && (
                  <>
                    <span style={{ fontSize: 13, fontWeight: 700, color: cfg.text }}>
                      {node.agent_name}
                    </span>
                    <span style={{ fontSize: 10, color: "#4b5563" }}>#{node.id}</span>

                    {/* Status pill */}
                    <span style={{
                      fontSize: 9, fontWeight: 600, padding: "2px 8px",
                      borderRadius: 999, border: `1px solid ${statusSt.border}`,
                      background: statusSt.bg, color: statusSt.text,
                      letterSpacing: "0.08em", textTransform: "uppercase",
                    }}>
                      {node.status}
                    </span>

                    {node.is_replay && (
                      <span style={{
                        fontSize: 9, color: "#6b7280", border: "1px solid #333",
                        borderRadius: 999, padding: "2px 8px",
                      }}>↻ replay</span>
                    )}
                  </>
                )}
              </div>

              <button
                id="close-drawer-btn"
                onClick={() => setSelectedNodeId(null)}
                style={{ color: "#6b7280", fontSize: 18, cursor: "pointer", background: "none", border: "none", lineHeight: 1 }}
              >✕</button>
            </div>

            {/* ── Body ── */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px" }}>
              {loading && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[180, 120, 240, 160, 200].map((w, i) => (
                    <div key={i} style={{ height: 10, width: w, background: "#1f1f1f", borderRadius: 4,
                      animation: "pulse 1.5s ease-in-out infinite", animationDelay: `${i * 0.1}s` }} />
                  ))}
                </div>
              )}

              {!loading && node && (
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

                  {/* AgentPrism-inspired: type description */}
                  <div style={{
                    fontSize: 11, color: "#6b7280", background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.05)", borderRadius: 8, padding: "8px 12px",
                  }}>
                    {typeMeta.desc}
                    {node.status_message && node.status !== "error" && (
                      <span style={{ color: "#4b5563", marginLeft: 8 }}>· {node.status_message}</span>
                    )}
                  </div>

                  {/* Error message (AgentPrism: prominently surfaced, not buried in output_json) */}
                  {node.status === "error" && node.status_message && (
                    <div style={{
                      background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                      borderRadius: 8, padding: "10px 14px",
                    }}>
                      <p style={{ fontSize: 9, fontWeight: 700, color: "#f87171", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>
                        Error
                      </p>
                      <p style={{ fontSize: 11, color: "#fca5a5", fontFamily: "var(--font-mono)", lineHeight: 1.6 }}>
                        {node.status_message}
                      </p>
                    </div>
                  )}

                  {/* Timeline — Langfuse-inspired: latency + model per observation */}
                  <div>
                    <SectionLabel>Timeline</SectionLabel>
                    <TimelineStrip node={node} />
                  </div>

                  {/* LLM Evaluation Panel */}
                  {node.eval_score && (
                    <div style={{
                      background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)",
                      borderRadius: 8, padding: "10px 14px", marginTop: 4,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#34d399" }}>
                          LLM Governance Judge
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: (node.eval_score.overall_score ?? 0) >= 80 ? "#34d399" : "#f59e0b" }}>
                          Score: {node.eval_score.overall_score}% ({node.eval_score.verdict})
                        </span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 6 }}>
                        <div style={{ background: "rgba(0,0,0,0.25)", padding: "4px 6px", borderRadius: 6, textAlign: "center" }}>
                          <p style={{ fontSize: 9, color: "#9ca3af" }}>Quality</p>
                          <p style={{ fontSize: 12, fontWeight: 700, color: "#34d399" }}>{node.eval_score.quality_score ?? 0}%</p>
                        </div>
                        <div style={{ background: "rgba(0,0,0,0.25)", padding: "4px 6px", borderRadius: 6, textAlign: "center" }}>
                          <p style={{ fontSize: 9, color: "#9ca3af" }}>Grounded</p>
                          <p style={{ fontSize: 12, fontWeight: 700, color: "#38bdf8" }}>{node.eval_score.hallucination_score ?? 0}%</p>
                        </div>
                        <div style={{ background: "rgba(0,0,0,0.25)", padding: "4px 6px", borderRadius: 6, textAlign: "center" }}>
                          <p style={{ fontSize: 9, color: "#9ca3af" }}>Coherence</p>
                          <p style={{ fontSize: 12, fontWeight: 700, color: "#a78bfa" }}>{node.eval_score.coherence_score ?? 0}%</p>
                        </div>
                      </div>
                      {node.eval_score.reasoning && (
                        <p style={{ fontSize: 10.5, color: "#9ca3af", fontStyle: "italic", lineHeight: 1.4 }}>
                          "{node.eval_score.reasoning}"
                        </p>
                      )}
                    </div>
                  )}

                  {/* Prompt */}
                  {node.prompt_text && (
                    <div>
                      <SectionLabel>Prompt</SectionLabel>
                      <pre style={{
                        background: "#0d0d0d",
                        border: "1px solid rgba(255,255,255,0.06)",
                        borderRadius: 8, padding: "10px 12px",
                        fontSize: 11, fontFamily: "var(--font-mono)",
                        lineHeight: 1.7, color: "#d1d5db",
                        maxHeight: 200, overflowY: "auto",
                        whiteSpace: "pre-wrap", wordBreak: "break-word",
                      }}>
                        {node.prompt_text}
                      </pre>
                    </div>
                  )}

                  {/* Input — editable when in replay mode */}
                  <div>
                    <SectionLabel>Input</SectionLabel>
                    <JsonBlock
                      data={node.input_json}
                      editable={editing}
                      value={editValue}
                      onChange={setEditValue}
                    />
                  </div>

                  {/* Output */}
                  {node.output_json && (
                    <div>
                      <SectionLabel>Output</SectionLabel>
                      <JsonBlock data={node.output_json} />
                    </div>
                  )}

                  {/* Replay error */}
                  <AnimatePresence>
                    {replayError && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        style={{
                          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                          borderRadius: 8, padding: "8px 12px",
                          fontSize: 11, color: "#fca5a5", fontFamily: "var(--font-mono)",
                        }}
                      >
                        {replayError}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* ── Footer: Replay actions ── */}
            {node && !loading && (
              <div style={{
                borderTop: "1px solid rgba(255,255,255,0.06)",
                padding: "12px 18px", display: "flex", gap: 10, flexShrink: 0,
              }}>
                {!editing ? (
                  <button
                    id="edit-replay-btn"
                    onClick={() => {
                      if (isOnline) {
                        setEditing(true);
                      }
                    }}
                    title={isOnline ? undefined : "Replay requires internet connection"}
                    disabled={!isOnline}
                    style={{
                      flex: 1, padding: "10px 0",
                      background: isOnline ? "rgba(99,102,241,0.1)" : "rgba(255,255,255,0.02)",
                      border: isOnline ? "1px solid rgba(99,102,241,0.3)" : "1px solid rgba(255,255,255,0.05)",
                      borderRadius: 10, cursor: isOnline ? "pointer" : "not-allowed",
                      color: isOnline ? "#a5b4fc" : "#6b7280", fontSize: 13, fontWeight: 600,
                    }}
                  >
                    {isOnline ? "✏️ Edit & Replay from here" : "🔒 Replay requires internet"}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => { setEditing(false); setEditValue(JSON.stringify(node.input_json ?? {}, null, 2)); }}
                      style={{
                        padding: "10px 16px", background: "#1a1a1a",
                        border: "1px solid #2a2a2a", borderRadius: 10,
                        cursor: "pointer", color: "#9ca3af", fontSize: 13,
                      }}
                    >Cancel</button>
                    <button
                      id="confirm-replay-btn"
                      onClick={handleReplay}
                      disabled={replaying}
                      style={{
                        flex: 1, padding: "10px 0",
                        background: replaying ? "rgba(99,102,241,0.4)" : "#6366f1",
                        border: "none", borderRadius: 10, cursor: replaying ? "not-allowed" : "pointer",
                        color: "white", fontSize: 13, fontWeight: 600,
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                        opacity: replaying ? 0.7 : 1,
                      }}
                    >
                      {replaying ? (
                        <>
                          <svg style={{ animation: "spin 1s linear infinite", width: 14, height: 14 }} viewBox="0 0 24 24" fill="none">
                            <circle opacity={0.25} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path opacity={0.75} fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                          </svg>
                          Replaying…
                        </>
                      ) : "↻ Run Replay"}
                    </button>
                  </>
                )}
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
