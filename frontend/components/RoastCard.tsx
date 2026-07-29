"use client";

import { useState } from "react";
import { Flame, Copy, Check, X, Share2, Skull } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface RoastCardProps {
  isOpen: boolean;
  onClose: () => void;
  roastText: string;
  roastGrade: string;
  runGoal: string;
}

const GRADE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  "Mildly embarrassing": { bg: "bg-amber-500/10", text: "text-amber-500", border: "border-amber-500/30" },
  "Genuinely bad": { bg: "bg-orange-500/10", text: "text-orange-500", border: "border-orange-500/30" },
  "Catastrophically wrong": { bg: "bg-red-500/10", text: "text-red-500", border: "border-red-500/30" },
  "Impressively terrible": { bg: "bg-rose-500/10", text: "text-rose-500", border: "border-rose-500/30" },
};

export default function RoastCard({ isOpen, onClose, roastText, roastGrade, runGoal }: RoastCardProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const style = GRADE_STYLES[roastGrade] || GRADE_STYLES["Mildly embarrassing"];

  const handleCopyPost = () => {
    const postCaption = `I asked GlassBox to roast my AI agent on the task: "${runGoal.slice(0, 50)}...".\n\nIt said: "${roastText}"\n\nThe grade? ${roastGrade} 💀\n\nSee how your AI performs: ${window.location.origin}\n#AIAgents #GlassBox #BuildInPublic #RoastMyAI`;
    navigator.clipboard.writeText(postCaption).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl space-y-5 text-white relative overflow-hidden"
        >
          {/* Top glow */}
          <div className="absolute -top-12 -right-12 w-36 h-36 bg-red-500/20 rounded-full blur-3xl pointer-events-none" />

          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500">
                <Flame size={18} />
              </div>
              <h3 className="text-base font-extrabold tracking-tight">AI Execution Roast</h3>
            </div>
            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Grade Badge */}
          <div className="flex items-center justify-between bg-neutral-950 p-3.5 rounded-xl border border-neutral-800">
            <span className="text-xs text-neutral-400 uppercase font-bold tracking-wider flex items-center gap-1.5">
              <Skull size={14} className="text-neutral-500" /> Verdict Rating
            </span>
            <span className={`text-xs font-extrabold px-3 py-1 rounded-full border ${style.bg} ${style.text} ${style.border}`}>
              {roastGrade}
            </span>
          </div>

          {/* Roast text card */}
          <div className="bg-gradient-to-br from-neutral-950 to-neutral-900 border border-neutral-800/80 p-4 rounded-xl space-y-2">
            <p className="text-sm font-medium leading-relaxed italic text-neutral-200">
              &ldquo;{roastText}&rdquo;
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold rounded-xl transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleCopyPost}
              className="flex-1 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md"
            >
              {copied ? <Check size={15} /> : <Share2 size={15} />}
              {copied ? "Copied Post + Link!" : "Share Roast to LinkedIn"}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
