"use client";

import React, { useEffect } from "react";
import { Cpu, Zap, Hash, DollarSign, Layers } from "lucide-react";
import { motion, useSpring, useTransform } from "framer-motion";
import { Node } from "@/lib/api";

const GROQ_PRICING: Record<string, [number, number]> = {
  "llama-3.3-70b-versatile": [0.59, 0.79],
  "llama-3.1-8b-instant": [0.05, 0.08],
  "mixtral-8x7b-32768": [0.24, 0.24],
  "gemma2-9b-it": [0.20, 0.20],
};

interface NodeWithTokens extends Node {
  token_count_input?: number | null;
  token_count_output?: number | null;
}

interface RunStatsBarProps {
  nodes: Node[];
}

function AnimatedNumber({ value }: { value: number }) {
  const spring = useSpring(0, { bounce: 0, duration: 800 });
  const display = useTransform(spring, (current) => Math.round(current).toLocaleString());

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  return <motion.span>{display}</motion.span>;
}

export default function RunStatsBar({ nodes }: RunStatsBarProps) {
  const typed = nodes as NodeWithTokens[];

  const totalNodes = nodes.length;
  const totalLatencyMs = nodes.reduce((sum, n) => sum + (n.latency_ms ?? 0), 0);
  const totalLatencySec = (totalLatencyMs / 1000).toFixed(1);

  const totalInputTokens = typed.reduce((sum, n) => sum + (n.token_count_input ?? 0), 0);
  const totalOutputTokens = typed.reduce((sum, n) => sum + (n.token_count_output ?? 0), 0);
  const totalTokens = totalInputTokens + totalOutputTokens;

  // Cost estimation
  let costUsd = 0;
  for (const n of typed) {
    const model = n.model_name || "llama-3.3-70b-versatile";
    const pricing = GROQ_PRICING[model] || [0.59, 0.79];
    const [priceIn, priceOut] = pricing;
    costUsd += ((n.token_count_input ?? 0) / 1_000_000) * priceIn;
    costUsd += ((n.token_count_output ?? 0) / 1_000_000) * priceOut;
  }
  if (costUsd === 0 && totalTokens > 0) {
    costUsd = (totalTokens / 1_000_000) * 0.69;
  }
  const formattedCost = costUsd < 0.001 ? "<$0.001" : `$${costUsd.toFixed(4)}`;

  return (
    <div className="shrink-0 border-b border-neutral-200/80 dark:border-neutral-800/80 bg-white/70 dark:bg-[#0a0a0a]/70 backdrop-blur-md px-5 py-2 flex items-center gap-3 overflow-x-auto text-xs z-10 transition-colors">
      <div className="flex items-center gap-1.5 text-neutral-400 dark:text-neutral-500 font-bold text-[10px] uppercase tracking-wider pr-1">
        <Layers size={13} className="text-indigo-500" />
        Run Stats
      </div>

      <div className="h-3.5 w-px bg-neutral-200 dark:bg-neutral-800" />

      {/* Nodes Chip */}
      <div className="flex items-center gap-1.5 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800/80 px-2.5 py-1 rounded-full text-neutral-800 dark:text-neutral-200 font-medium">
        <Cpu size={13} className="text-indigo-500" />
        <span className="font-mono font-bold">
          <AnimatedNumber value={totalNodes} />
        </span>
        <span className="text-[11px] text-neutral-500">nodes</span>
      </div>

      {/* Latency Chip */}
      <div className="flex items-center gap-1.5 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800/80 px-2.5 py-1 rounded-full text-neutral-800 dark:text-neutral-200 font-medium">
        <Zap size={13} className="text-amber-500" />
        <span className="font-mono font-bold">{totalLatencySec}s</span>
        <span className="text-[11px] text-neutral-500">latency</span>
      </div>

      {/* Tokens Chip */}
      <div className="flex items-center gap-1.5 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800/80 px-2.5 py-1 rounded-full text-neutral-800 dark:text-neutral-200 font-medium">
        <Hash size={13} className="text-teal-500" />
        <span className="font-mono font-bold">
          <AnimatedNumber value={totalTokens} />
        </span>
        <span className="text-[11px] text-neutral-500">tokens</span>
      </div>

      {/* Cost Chip */}
      <div className="flex items-center gap-1.5 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800/80 px-2.5 py-1 rounded-full text-neutral-800 dark:text-neutral-200 font-medium">
        <DollarSign size={13} className="text-emerald-500" />
        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">~{formattedCost}</span>
        <span className="text-[11px] text-neutral-500">est</span>
      </div>
    </div>
  );
}