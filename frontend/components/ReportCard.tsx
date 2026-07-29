"use client";

import { useState } from "react";
import { Award, Share2, Check, X, RefreshCw, BarChart2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { addPendingAction } from "@/lib/localdb";
import { useGlassboxStore } from "@/lib/store";

export interface ReportCardData {
  total_score: number;
  grade: string;
  breakdown: {
    planner_score: number;
    worker_score: number;
    aggregator_score: number;
    overall_goal_score: number;
  };
  one_line_verdict: string;
}

interface ReportCardProps {
  isOpen: boolean;
  onClose: () => void;
  report: ReportCardData;
  runGoal: string;
}

const GRADE_COLORS: Record<string, string> = {
  "A+": "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  A: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  B: "text-indigo-400 border-indigo-500/30 bg-indigo-500/10",
  C: "text-amber-400 border-amber-500/30 bg-amber-500/10",
  F: "text-rose-500 border-rose-500/30 bg-rose-500/10",
};

export default function ReportCard({ isOpen, onClose, report, runGoal }: ReportCardProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const gradeStyle = GRADE_COLORS[report.grade] || GRADE_COLORS.C;

  const handleShare = () => {
    const postCaption = `My AI agent scored a grade of [${report.grade}] (${report.total_score}/100) running: "${runGoal}".\n\nVerdict: "${report.one_line_verdict}"\n\nCan your AI do better? Test your agents on GlassBox: ${window.location.origin}\n#AIAgents #GlassBox #AIReportCard #BuildInPublic`;
    
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      addPendingAction({
        type: "share-report",
        runId: 0,
        content: postCaption,
        createdAt: new Date().toISOString(),
      }).then(() => {
        useGlassboxStore.getState().addToast("Offline — share action queued for sync!", "info");
      });
    }

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
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Award size={18} />
              </div>
              <h3 className="text-base font-extrabold tracking-tight">AI Report Card</h3>
            </div>
            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Big Grade display */}
          <div className="flex items-center justify-between bg-neutral-950 p-5 rounded-xl border border-neutral-800">
            <div>
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest block mb-1">
                Overall Agent Performance
              </span>
              <p className="text-sm text-neutral-300 font-medium italic">&ldquo;{report.one_line_verdict}&rdquo;</p>
            </div>
            <div className={`w-16 h-16 rounded-2xl border flex items-center justify-center text-3xl font-black ${gradeStyle} shadow-lg shrink-0`}>
              {report.grade}
            </div>
          </div>

          {/* Breakdown Bar Chart */}
          <div className="space-y-3 bg-neutral-950 p-4 rounded-xl border border-neutral-800">
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
              <BarChart2 size={14} className="text-indigo-400" /> Score Breakdown ({report.total_score}/100)
            </span>

            {[
              { label: "Planner Subtask Logic", score: report.breakdown.planner_score, max: 25 },
              { label: "Worker Execution Accuracy", score: report.breakdown.worker_score, max: 25 },
              { label: "Aggregator Synthesis", score: report.breakdown.aggregator_score, max: 25 },
              { label: "Goal Completion Success", score: report.breakdown.overall_goal_score, max: 25 },
            ].map((item) => (
              <div key={item.label} className="space-y-1 text-xs">
                <div className="flex justify-between text-[11px] font-semibold text-neutral-300">
                  <span>{item.label}</span>
                  <span className="font-mono text-indigo-400">{item.score} / {item.max}</span>
                </div>
                <div className="h-2 w-full bg-neutral-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-teal-400 rounded-full transition-all duration-500"
                    style={{ width: `${(item.score / item.max) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold rounded-xl transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleShare}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md"
            >
              {copied ? <Check size={15} /> : <Share2 size={15} />}
              {copied ? "Copied Grade + Link!" : "Share Grade to LinkedIn"}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
