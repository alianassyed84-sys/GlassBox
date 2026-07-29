"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useGlassboxStore } from "@/lib/store";

interface Toast {
  id: string;
  message: string;
  type?: "info" | "success" | "warning";
}

function SingleToast({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove();
    }, 5000);
    return () => clearTimeout(timer);
  }, [onRemove]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      className="pointer-events-auto p-4 rounded-xl shadow-lg border text-xs font-semibold flex items-center justify-between gap-3 text-white bg-neutral-900 border-neutral-800"
      style={{
        boxShadow: "0 10px 30px -10px rgba(0, 0, 0, 0.5)",
      }}
    >
      <div className="flex items-center gap-2">
        {toast.type === "success" && <span className="text-emerald-400">🎉</span>}
        {toast.type === "warning" && <span className="text-amber-400">⚠️</span>}
        {toast.type === "info" && <span className="text-indigo-400">ℹ️</span>}
        <span>{toast.message}</span>
      </div>
      <button
        onClick={onRemove}
        className="text-neutral-500 hover:text-white hover:bg-neutral-800 p-1.5 rounded-lg transition-all"
      >
        ✕
      </button>
    </motion.div>
  );
}

export default function ToastNotification() {
  const { toasts, removeToast } = useGlassboxStore();

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <SingleToast key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}
