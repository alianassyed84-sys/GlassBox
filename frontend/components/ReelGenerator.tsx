"use client";

import { useState } from "react";
import { Film, Download, Check, X, ChevronRight, ChevronLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ReelGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  runGoal: string;
  beforeSummary: string;
  afterSummary: string;
}

export default function ReelGenerator({ isOpen, onClose, runGoal, beforeSummary, afterSummary }: ReelGeneratorProps) {
  const [slideIndex, setSlideIndex] = useState(0);
  const [downloaded, setDownloaded] = useState(false);

  if (!isOpen) return null;

  const slides = [
    {
      title: "Slide 1 / 4",
      tag: "THE GOAL",
      content: `I asked my AI agent to: "${runGoal}"`,
      bg: "bg-indigo-950/60 border-indigo-500/30 text-indigo-200",
    },
    {
      title: "Slide 2 / 4",
      tag: "THE MISTAKE",
      content: beforeSummary || "It made a flawed budget allocation mistake mid-pipeline.",
      bg: "bg-rose-950/60 border-rose-500/30 text-rose-200",
    },
    {
      title: "Slide 3 / 4",
      tag: "THE ONE-CLICK FIX",
      content: "Instead of re-running the entire expensive pipeline, I edited the node input and replayed it instantly.",
      bg: "bg-amber-950/60 border-amber-500/30 text-amber-200",
    },
    {
      title: "Slide 4 / 4",
      tag: "THE CORRECTED RESULT",
      content: afterSummary || "Clean, optimized output generated in 2 seconds.",
      bg: "bg-emerald-950/60 border-emerald-500/30 text-emerald-200",
    },
  ];

  const handleDownloadSequence = () => {
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2500);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-5 text-white relative overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Film size={18} className="text-teal-400" />
              <h3 className="text-base font-extrabold tracking-tight">Before/After LinkedIn Carousel Reel</h3>
            </div>
            <button onClick={onClose} className="text-neutral-400 hover:text-white p-1 rounded-lg">
              <X size={18} />
            </button>
          </div>

          {/* Slide Preview */}
          <div className={`p-6 rounded-2xl border ${slides[slideIndex].bg} min-h-[200px] flex flex-col justify-between space-y-4 shadow-lg transition-all`}>
            <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-white/10 w-fit">
              {slides[slideIndex].tag}
            </span>
            <p className="text-base font-extrabold leading-snug">
              {slides[slideIndex].content}
            </p>
            <div className="flex justify-between items-center text-xs font-mono opacity-60">
              <span>GlassBox Time-Travel</span>
              <span>{slides[slideIndex].title}</span>
            </div>
          </div>

          {/* Slide Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSlideIndex(Math.max(0, slideIndex - 1))}
              disabled={slideIndex === 0}
              className="p-2 bg-neutral-800 disabled:opacity-30 rounded-xl"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-mono text-neutral-400">
              Slide {slideIndex + 1} of 4
            </span>
            <button
              onClick={() => setSlideIndex(Math.min(3, slideIndex + 1))}
              disabled={slideIndex === 3}
              className="p-2 bg-neutral-800 disabled:opacity-30 rounded-xl"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Action Button */}
          <button
            onClick={handleDownloadSequence}
            className="w-full bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md"
          >
            {downloaded ? <Check size={16} /> : <Download size={16} />}
            {downloaded ? "Carousel Sequence Saved!" : "Export 4-Slide LinkedIn Carousel"}
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
