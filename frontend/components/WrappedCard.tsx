"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Share2, Check, X, Flame, ShieldCheck, Zap, DollarSign, Trophy } from "lucide-react";

export interface WrappedData {
  total_runs_month: number;
  total_mistakes_caught: number;
  tokens_saved: number;
  cost_saved_usd: number;
  most_used_category: string;
  longest_run_nodes: number;
  fastest_fix_seconds: number;
  streak_days: number;
  rarest_catch_summary: string;
}

interface WrappedCardProps {
  isOpen: boolean;
  onClose: () => void;
  data: WrappedData;
}

export default function WrappedCard({ isOpen, onClose, data }: WrappedCardProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleShare = () => {
    const text = `This month I caught ${data.total_mistakes_caught} AI mistakes and saved an estimated ${(data.tokens_saved / 1000).toFixed(1)}k tokens using GlassBox.\n\nMy most impactful fix: "${data.rarest_catch_summary}"\n\nHere's my debugging Wrapped 👇\n${window.location.origin}\n#GlassBoxWrapped #AIAgents #BuildInPublic`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="w-full max-w-md bg-gradient-to-b from-neutral-900 via-[#0d0d0d] to-neutral-950 border border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-6 text-white relative overflow-hidden"
        >
          {/* Background Ambient Glow */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-teal-500/20 rounded-full blur-3xl pointer-events-none" />

          {/* Top Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-indigo-400" />
              <span className="text-xs font-black uppercase tracking-widest text-indigo-400">
                GlassBox Wrapped
              </span>
            </div>
            <button onClick={onClose} className="text-neutral-400 hover:text-white p-1 rounded-lg">
              <X size={18} />
            </button>
          </div>

          {/* Sequential Animated Stat Cards */}
          <div className="space-y-4">
            {/* Stat 1: Mistakes Caught */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-4 flex items-center justify-between"
            >
              <div>
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                  Mistakes Caught
                </span>
                <span className="text-4xl font-black text-white">{data.total_mistakes_caught}</span>
              </div>
              <ShieldCheck size={36} className="text-emerald-400" />
            </motion.div>

            {/* Stat 2: Tokens & Cost Saved */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="grid grid-cols-2 gap-3"
            >
              <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-3.5">
                <Zap size={18} className="text-teal-400 mb-1" />
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Tokens Saved</span>
                <span className="text-xl font-extrabold text-white">{(data.tokens_saved / 1000).toFixed(1)}k</span>
              </div>
              <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-3.5">
                <DollarSign size={18} className="text-emerald-400 mb-1" />
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Est. Cost Saved</span>
                <span className="text-xl font-extrabold text-white">${data.cost_saved_usd}</span>
              </div>
            </motion.div>

            {/* Stat 3: Rarest Catch */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.4 }}
              className="bg-gradient-to-br from-indigo-950/40 to-neutral-900 border border-indigo-500/20 rounded-2xl p-4 space-y-1"
            >
              <div className="flex items-center gap-1.5 text-indigo-400 text-xs font-bold uppercase tracking-wider">
                <Trophy size={14} /> Rarest Catch of the Month
              </div>
              <p className="text-xs text-neutral-200 leading-relaxed italic">
                &ldquo;{data.rarest_catch_summary}&rdquo;
              </p>
            </motion.div>

            {/* Stat 4: Streak */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.4 }}
              className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-3.5 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Flame size={20} className="text-amber-500" />
                <span className="text-xs font-bold text-neutral-300">Active Debug Streak</span>
              </div>
              <span className="text-sm font-black text-amber-400">{data.streak_days} Days</span>
            </motion.div>
          </div>

          {/* Action button */}
          <button
            onClick={handleShare}
            className="w-full bg-gradient-to-r from-indigo-600 via-teal-600 to-indigo-600 hover:from-indigo-500 hover:to-teal-500 text-white font-bold text-xs py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg"
          >
            {copied ? <Check size={16} /> : <Share2 size={16} />}
            {copied ? "Wrapped Caption Copied!" : "Share Wrapped to LinkedIn"}
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
