"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { MessageSquare, ArrowRight, Check, Sparkles } from "lucide-react";
import { api, Node } from "@/lib/api";

export interface ClarificationQuestion {
  id: string;
  question: string;
  type: "text" | "single_select" | "multi_select";
  options?: string[];
}

interface ClarificationPromptProps {
  runId: number;
  node: Node;
  onAnswerSubmitted: () => void;
}

export default function ClarificationPrompt({
  runId,
  node,
  onAnswerSubmitted,
}: ClarificationPromptProps) {
  const questions: ClarificationQuestion[] =
    (node.output_json?.questions as ClarificationQuestion[]) || [];

  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTextChange = (id: string, val: string) => {
    setAnswers((prev) => ({ ...prev, [id]: val }));
  };

  const handleSingleSelect = (id: string, option: string) => {
    setAnswers((prev) => ({ ...prev, [id]: option }));
  };

  const handleMultiSelect = (id: string, option: string) => {
    setAnswers((prev) => {
      const current = (prev[id] as string[]) || [];
      const updated = current.includes(option)
        ? current.filter((o) => o !== option)
        : [...current, option];
      return { ...prev, [id]: updated };
    });
  };

  // Validate all questions have an answer
  const isComplete =
    questions.length > 0 &&
    questions.every((q) => {
      const ans = answers[q.id];
      if (q.type === "text") {
        return typeof ans === "string" && ans.trim().length > 0;
      }
      if (q.type === "single_select") {
        return typeof ans === "string" && ans.length > 0;
      }
      if (q.type === "multi_select") {
        return Array.isArray(ans) && ans.length > 0;
      }
      return false;
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isComplete || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      await api.answerClarification(runId, node.id, answers);
      onAnswerSubmitted();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to submit answers");
      setSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center p-6 w-full max-w-2xl mx-auto my-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="w-full bg-white dark:bg-[#111111] border border-neutral-200 dark:border-neutral-800/80 rounded-2xl p-7 shadow-[0_8px_32px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.6)] space-y-6 relative overflow-hidden transition-colors"
      >
        {/* Subtle accent backdrop glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/10 blur-3xl rounded-full pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-500/10 blur-3xl rounded-full pointer-events-none" />

        {/* Header */}
        <div className="flex items-start gap-3.5 border-b border-neutral-200 dark:border-neutral-800/60 pb-5">
          <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400 shrink-0 mt-0.5">
            <MessageSquare size={20} strokeWidth={2} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 tracking-tight">
                Quick Clarification
              </h2>
              <span className="text-[10px] bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                <Sparkles size={10} /> Planner Assistant
              </span>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed">
              Help the Planner tailor your plan by answering a few quick questions about your goal.
            </p>
          </div>
        </div>

        {/* Questions form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {questions.map((q, idx) => {
            const currentAns = answers[q.id];

            return (
              <div key={q.id || idx} className="space-y-3">
                <label className="block text-xs font-medium text-neutral-800 dark:text-neutral-200">
                  <span className="text-neutral-500 font-mono text-[11px] mr-1.5">
                    0{idx + 1}.
                  </span>
                  {q.question}
                </label>

                {/* Open-ended Text input */}
                {q.type === "text" && (
                  <input
                    type="text"
                    value={(currentAns as string) || ""}
                    onChange={(e) => handleTextChange(q.id, e.target.value)}
                    placeholder="Type your answer here..."
                    className="w-full bg-neutral-50 dark:bg-[#0a0a0a] border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-neutral-800 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600 focus:outline-none focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/30 transition-all"
                  />
                )}

                {/* Single Select Pills */}
                {q.type === "single_select" && q.options && (
                  <div className="flex flex-wrap gap-2 pt-0.5">
                    {q.options.map((opt) => {
                      const isSelected = currentAns === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => handleSingleSelect(q.id, opt)}
                          className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition-all flex items-center gap-1.5 ${
                            isSelected
                              ? "bg-indigo-600/20 border-indigo-500 text-indigo-200 shadow-sm"
                              : "bg-neutral-50 dark:bg-[#0a0a0a] border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 hover:border-neutral-300 dark:hover:border-neutral-700"
                          }`}
                        >
                          {isSelected && <Check size={12} className="text-indigo-400" />}
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Multi Select Pills */}
                {q.type === "multi_select" && q.options && (
                  <div className="flex flex-wrap gap-2 pt-0.5">
                    {q.options.map((opt) => {
                      const selectedList = (currentAns as string[]) || [];
                      const isSelected = selectedList.includes(opt);
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => handleMultiSelect(q.id, opt)}
                          className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition-all flex items-center gap-1.5 ${
                            isSelected
                              ? "bg-indigo-600/20 border-indigo-500 text-indigo-200 shadow-sm"
                              : "bg-neutral-50 dark:bg-[#0a0a0a] border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 hover:border-neutral-300 dark:hover:border-neutral-700"
                          }`}
                        >
                          <div
                            className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${
                              isSelected
                                ? "bg-indigo-500 border-indigo-400 text-white dark:text-black"
                                : "border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                            }`}
                          >
                            {isSelected && <Check size={10} strokeWidth={3} />}
                          </div>
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
              {error}
            </div>
          )}

          {/* Action button */}
          <div className="pt-2 flex items-center justify-end border-t border-neutral-200 dark:border-neutral-800/60">
            <button
              type="submit"
              disabled={!isComplete || submitting}
              className={`px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shadow-md ${
                isComplete && !submitting
                  ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20"
                  : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 cursor-not-allowed border border-neutral-200 dark:border-neutral-700/50"
              }`}
            >
              <span>{submitting ? "Resuming Pipeline..." : "Continue Pipeline"}</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
