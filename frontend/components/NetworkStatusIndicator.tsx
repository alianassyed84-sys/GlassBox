"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

export default function NetworkStatusIndicator() {
  const { isOnline, wasOffline } = useNetworkStatus();

  return (
    <AnimatePresence mode="wait">
      {!isOnline && (
        <motion.div
          key="offline"
          initial={{ opacity: 0, scale: 0.9, y: -5 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -5 }}
          transition={{ duration: 0.2 }}
          className="text-xs font-semibold px-3 py-1.5 rounded-full border bg-amber-500/10 text-amber-500 border-amber-500/20 flex items-center gap-1.5 shadow-sm font-sans"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          <span>Offline — viewing cached data</span>
        </motion.div>
      )}

      {isOnline && wasOffline && (
        <motion.div
          key="online-reconnected"
          initial={{ opacity: 0, scale: 0.9, y: -5 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -5 }}
          transition={{ duration: 0.2 }}
          className="text-xs font-semibold px-3 py-1.5 rounded-full border bg-emerald-500/10 text-emerald-500 border-emerald-500/20 flex items-center gap-1.5 shadow-sm font-sans"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Back online</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
