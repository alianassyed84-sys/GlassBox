"use client";

import { useState } from "react";
import { Share2, Copy, Check, X, Sparkles, Hash } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { addPendingAction } from "@/lib/localdb";
import { useGlassboxStore } from "@/lib/store";

interface LinkedInPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPostText: string;
  hashtags: string[];
}

export default function LinkedInPostModal({ isOpen, onClose, initialPostText, hashtags }: LinkedInPostModalProps) {
  const [postText, setPostText] = useState(initialPostText);
  const [selectedHashtags, setSelectedHashtags] = useState<string[]>(hashtags);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const fullContent = `${postText}\n\n${selectedHashtags.join(" ")}`;
  const charCount = fullContent.length;

  const handleCopy = () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      addPendingAction({
        type: "share-fix",
        runId: 0,
        content: fullContent,
        createdAt: new Date().toISOString(),
      }).then(() => {
        useGlassboxStore.getState().addToast("Offline — share action queued for sync!", "info");
      });
    }

    navigator.clipboard.writeText(fullContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const toggleHashtag = (tag: string) => {
    if (selectedHashtags.includes(tag)) {
      setSelectedHashtags(selectedHashtags.filter((t) => t !== tag));
    } else {
      setSelectedHashtags([...selectedHashtags, tag]);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="w-full max-w-xl bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl space-y-4 text-white relative overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Share2 size={18} />
              </div>
              <div>
                <h3 className="text-base font-extrabold tracking-tight">Post This Fix to LinkedIn</h3>
                <p className="text-[11px] text-neutral-400">Generated from your real execution trace data</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Textarea */}
          <div className="space-y-1.5">
            <textarea
              value={postText}
              onChange={(e) => setPostText(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-4 text-xs font-sans leading-relaxed text-neutral-100 resize-none focus:outline-none focus:border-blue-500 min-h-[160px]"
              spellCheck={false}
            />
            <div className="flex justify-end text-[10px] font-mono text-neutral-500">
              <span className={charCount > 1300 ? "text-red-400 font-bold" : ""}>
                {charCount} / 1300 chars
              </span>
            </div>
          </div>

          {/* Hashtag Chips */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1">
              <Hash size={12} className="text-blue-400" /> Suggested Hashtags
            </span>
            <div className="flex flex-wrap gap-1.5">
              {hashtags.map((tag) => {
                const active = selectedHashtags.includes(tag);
                return (
                  <button
                    key={tag}
                    onClick={() => toggleHashtag(tag)}
                    className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border transition-all ${
                      active
                        ? "bg-blue-600/20 text-blue-300 border-blue-500/40"
                        : "bg-neutral-950 text-neutral-500 border-neutral-800 hover:text-neutral-300"
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCopy}
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md"
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? "Copied Post + Hashtags!" : "Copy Post to Clipboard"}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
