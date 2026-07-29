"use client";

import { useEffect, useState } from "react";
import { Search, Zap, ShieldAlert, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ActivityEvent {
  id: string;
  agent: string;
  category: string;
  tokens_saved: number;
}

const SAMPLE_EVENTS: ActivityEvent[] = [
  { id: "1", agent: "planner", category: "travel", tokens_saved: 847 },
  { id: "2", agent: "worker", category: "business", tokens_saved: 1204 },
  { id: "3", agent: "aggregator", category: "career", tokens_saved: 950 },
];

export default function ActivityFeed() {
  const [currentEvent, setCurrentEvent] = useState<ActivityEvent | null>(null);

  useEffect(() => {
    let index = 0;
    const showNext = () => {
      setCurrentEvent(SAMPLE_EVENTS[index % SAMPLE_EVENTS.length]);
      index++;
      setTimeout(() => setCurrentEvent(null), 5000);
    };

    showNext();
    const interval = setInterval(showNext, 25000);
    return () => clearInterval(interval);
  }, []);

  return (
    <AnimatePresence>
      {currentEvent && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          className="fixed bottom-5 left-5 z-40 bg-neutral-900/90 border border-neutral-800 backdrop-blur-md px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 text-xs text-neutral-200 max-w-sm pointer-events-none"
        >
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            <Search size={16} />
          </div>
          <div>
            <p className="font-medium text-neutral-200">
              Someone just caught a <strong className="text-indigo-400 capitalize">{currentEvent.agent}</strong> mistake in a {currentEvent.category} run
            </p>
            <span className="text-[10px] text-teal-400 font-mono font-bold flex items-center gap-1 mt-0.5">
              <Zap size={10} /> Saved {currentEvent.tokens_saved} tokens
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
