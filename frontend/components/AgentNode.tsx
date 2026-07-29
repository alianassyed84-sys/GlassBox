"use client";

import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { motion, AnimatePresence } from "framer-motion";
import { BrainCircuit, Settings2, Layers, AlertCircle, HelpCircle } from "lucide-react";
import { useTheme } from "next-themes";

export type AgentNodeData = {
  label: string;
  agentName: "planner" | "worker" | "aggregator";
  nodeType: "llm_call" | "tool_call" | "handoff" | "clarification_request";
  status: "running" | "success" | "error" | "awaiting_answer" | "answered";
  isReplay: boolean;
  selected?: boolean;
  evalScore?: {
    overall_score?: number;
    quality_score?: number;
    verdict?: string;
  } | null;
};

export const AGENT_CONFIG = {
  planner: {
    bg: "rgba(99,102,241,0.08)",
    border: "rgba(99,102,241,0.35)",
    borderSelected: "rgba(99,102,241,0.8)",
    glow: "0 0 0 1px rgba(99,102,241,0.35), 0 0 20px rgba(99,102,241,0.15), 0 4px 12px rgba(0,0,0,0.6)",
    glowSelected: "0 0 0 1.5px rgba(99,102,241,0.7), 0 0 32px rgba(99,102,241,0.3), 0 4px 16px rgba(0,0,0,0.7)",
    glowRunning: "0 0 0 1px rgba(99,102,241,0.6), 0 0 36px rgba(99,102,241,0.4), 0 4px 12px rgba(0,0,0,0.6)",
    text: "#a5b4fc",
    accent: "#6366f1",
    iconBg: "rgba(99,102,241,0.15)",
    dot: "#6366f1",
    icon: BrainCircuit,
  },
  worker: {
    bg: "rgba(20,184,166,0.08)",
    border: "rgba(20,184,166,0.35)",
    borderSelected: "rgba(20,184,166,0.8)",
    glow: "0 0 0 1px rgba(20,184,166,0.35), 0 0 20px rgba(20,184,166,0.15), 0 4px 12px rgba(0,0,0,0.6)",
    glowSelected: "0 0 0 1.5px rgba(20,184,166,0.7), 0 0 32px rgba(20,184,166,0.3), 0 4px 16px rgba(0,0,0,0.7)",
    glowRunning: "0 0 0 1px rgba(20,184,166,0.6), 0 0 36px rgba(20,184,166,0.4), 0 4px 12px rgba(0,0,0,0.6)",
    text: "#5eead4",
    accent: "#14b8a6",
    iconBg: "rgba(20,184,166,0.15)",
    dot: "#14b8a6",
    icon: Settings2,
  },
  aggregator: {
    bg: "rgba(245,158,11,0.08)",
    border: "rgba(245,158,11,0.35)",
    borderSelected: "rgba(245,158,11,0.8)",
    glow: "0 0 0 1px rgba(245,158,11,0.35), 0 0 20px rgba(245,158,11,0.15), 0 4px 12px rgba(0,0,0,0.6)",
    glowSelected: "0 0 0 1.5px rgba(245,158,11,0.7), 0 0 32px rgba(245,158,11,0.3), 0 4px 16px rgba(0,0,0,0.7)",
    glowRunning: "0 0 0 1px rgba(245,158,11,0.6), 0 0 36px rgba(245,158,11,0.4), 0 4px 12px rgba(0,0,0,0.6)",
    text: "#fcd34d",
    accent: "#f59e0b",
    iconBg: "rgba(245,158,11,0.15)",
    dot: "#f59e0b",
    icon: Layers,
  },
  clarification: {
    bg: "rgba(100,116,139,0.08)",
    border: "rgba(100,116,139,0.35)",
    borderSelected: "rgba(148,163,184,0.8)",
    glow: "0 0 0 1px rgba(100,116,139,0.35), 0 0 20px rgba(100,116,139,0.15), 0 4px 12px rgba(0,0,0,0.6)",
    glowSelected: "0 0 0 1.5px rgba(148,163,184,0.7), 0 0 32px rgba(100,116,139,0.3), 0 4px 16px rgba(0,0,0,0.7)",
    glowRunning: "0 0 0 1px rgba(100,116,139,0.6), 0 0 36px rgba(100,116,139,0.4), 0 4px 12px rgba(0,0,0,0.6)",
    text: "#cbd5e1",
    accent: "#64748b",
    iconBg: "rgba(100,116,139,0.15)",
    dot: "#64748b",
    icon: HelpCircle,
  },
};

const NODE_TYPE_LABEL: Record<AgentNodeData["nodeType"], string> = {
  llm_call: "LLM",
  tool_call: "Tool",
  handoff: "→",
  clarification_request: "Clarify",
};

const AgentNode = memo(({ data, selected }: NodeProps<AgentNodeData>) => {
  const { theme, resolvedTheme } = useTheme();
  const isDark = (theme === "system" ? resolvedTheme : theme) !== "light"; // default to dark if undefined
  const cfg = data.nodeType === "clarification_request" ? AGENT_CONFIG.clarification : (AGENT_CONFIG[data.agentName] ?? AGENT_CONFIG.planner);
  const isError = data.status === "error";
  const isRunning = data.status === "running" || data.status === "awaiting_answer";
  const Icon = isError ? AlertCircle : cfg.icon;

  const getGlow = (baseGlow: string) => {
    if (isDark) return baseGlow;
    // For light mode, soften the heavy black shadows and reduce the bright colored glow spread
    return baseGlow.replace(/rgba\(0,0,0,0\.[67]\)/g, "rgba(0,0,0,0.1)").replace(/0 0 [23]\dpx/g, "0 0 10px");
  };

  const boxShadow = isError
    ? getGlow("0 0 0 1px rgba(239,68,68,0.5), 0 0 20px rgba(239,68,68,0.15), 0 4px 12px rgba(0,0,0,0.6)")
    : selected
    ? getGlow(cfg.glowSelected)
    : isRunning
    ? getGlow(cfg.glowRunning)
    : getGlow(cfg.glow);

  const borderColor = isError
    ? "rgba(239,68,68,0.5)"
    : selected
    ? cfg.borderSelected
    : cfg.border;

  return (
    <>
      {/* Running pulse ring */}
      <AnimatePresence>
        {isRunning && (
          <motion.div
            key="pulse-ring"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: [0.3, 0, 0.3], scale: [1, 1.05, 1], boxShadow: [cfg.glow, cfg.glowRunning, cfg.glow] }}
            exit={{ opacity: 0, scale: 1, boxShadow: cfg.glow }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 16,
              pointerEvents: "none",
              zIndex: 0,
            }}
          />
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, scale: 0.82, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0, boxShadow }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        style={{
          position: "relative",
          minWidth: 160,
          maxWidth: 220,
          borderRadius: 16,
          border: `1px solid ${borderColor}`,
          background: isError ? "rgba(239,68,68,0.08)" : cfg.bg,
          padding: "8px 10px",
          backdropFilter: "blur(8px)",
          transition: "border-color 0.3s ease",
          cursor: "pointer",
          zIndex: 1,
        }}
      >
        <Handle
          type="target"
          position={Position.Top}
          style={{
            background: isError ? "#ef4444" : cfg.accent,
            border: `2px solid ${isDark ? "rgba(10,10,10,0.8)" : "rgba(255,255,255,0.8)"}`,
            width: 9,
            height: 9,
          }}
        />

        {/* Replay badge */}
        {data.isReplay && (
          <span
            className="absolute -top-3 left-1/2 -translate-x-1/2 bg-neutral-100 dark:bg-[#1a1a1a] border border-neutral-300 dark:border-[#333] text-neutral-500 dark:text-neutral-400 text-[9px] px-2 py-[1px] rounded-full whitespace-nowrap tracking-wider"
          >
            ↻ replay
          </span>
        )}

        {/* Header row: icon badge + agent name + type pill */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          {/* Icon badge */}
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: "50%",
              background: isError ? "rgba(239,68,68,0.15)" : cfg.iconBg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              border: `1px solid ${isError ? "rgba(239,68,68,0.3)" : `${cfg.accent}40`}`,
            }}
          >
            <Icon
              size={14}
              color={isError ? "#ef4444" : cfg.accent}
              strokeWidth={2.2}
            />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {/* Status dot */}
              <motion.div
                animate={isRunning ? { opacity: [1, 0.3, 1] } : { opacity: 1 }}
                transition={isRunning ? { duration: 1.2, repeat: Infinity } : {}}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: isError ? "#ef4444" : cfg.dot,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  color: isError ? "#f87171" : isDark ? cfg.text : cfg.accent,
                  lineHeight: 1,
                }}
              >
                {data.agentName}
              </span>
              <span
                className="ml-auto text-[9px] bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-neutral-500 dark:text-neutral-400 px-1.5 py-0.5 rounded flex items-center gap-1"
              >
                {NODE_TYPE_LABEL[data.nodeType]}
                {data.evalScore?.overall_score !== undefined && (
                  <span className={`text-[8.5px] font-bold px-1 rounded ${
                    (data.evalScore.overall_score ?? 0) >= 80
                      ? "text-emerald-400 bg-emerald-950/40"
                      : (data.evalScore.overall_score ?? 0) >= 50
                      ? "text-amber-400 bg-amber-950/40"
                      : "text-rose-400 bg-rose-950/40"
                  }`}>
                    {data.evalScore.overall_score}%
                  </span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Label */}
        <p
          className="text-neutral-800 dark:text-gray-200 text-[11.5px] leading-snug font-medium overflow-hidden text-ellipsis whitespace-nowrap mt-0.5"
          title={data.label}
        >
          {data.label}
        </p>

        {/* Running shimmer overlay */}
        {isRunning && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 14,
              overflow: "hidden",
              pointerEvents: "none",
            }}
          >
            <motion.div
              animate={{ x: ["-100%", "200%"] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)",
              }}
            />
          </div>
        )}

        <Handle
          type="source"
          position={Position.Bottom}
          style={{
            background: isError ? "#ef4444" : cfg.accent,
            border: `2px solid ${isDark ? "rgba(10,10,10,0.8)" : "rgba(255,255,255,0.8)"}`,
            width: 9,
            height: 9,
          }}
        />
      </motion.div>
    </>
  );
});

AgentNode.displayName = "AgentNode";
export default AgentNode;

