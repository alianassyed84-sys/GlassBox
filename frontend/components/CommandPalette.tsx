"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import Fuse from "fuse.js";
import {
  Sparkles,
  Sun,
  Moon,
  Trophy,
  LayoutDashboard,
  Download,
  Key,
  LogOut,
  Volume2,
  VolumeX,
  History,
  ArrowUpRight,
  Monitor,
  Eye,
  SlidersHorizontal,
  Search,
} from "lucide-react";

import { Run } from "@/lib/api";
import { useGlassboxStore } from "@/lib/store";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

export interface CommandItem {
  id: string;
  group: "Actions" | "Navigate" | "Settings" | "Recent";
  label: string;
  description?: string;
  icon: React.ElementType;
  shortcut?: string;
  keywords?: string[];
  runId?: number;
  action?: () => void;
}

const RECENT_COMMANDS_KEY = "glassbox_recent_commands";

function getRecentCommandIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_COMMANDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecentCommandId(id: string) {
  try {
    const existing = getRecentCommandIds().filter((existingId) => existingId !== id);
    const updated = [id, ...existing].slice(0, 5);
    localStorage.setItem(RECENT_COMMANDS_KEY, JSON.stringify(updated));
  } catch {
    // Ignore localStorage errors
  }
}

export default function CommandPalette({ runs }: { runs?: Run[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { isOnline } = useNetworkStatus();
  const {
    paletteOpen,
    setPaletteOpen,
    soundEnabled,
    toggleSound,
    viewMode,
    setViewMode,
    nodes,
  } = useGlassboxStore();

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [recentIds, setRecentIds] = useState<string[]>([]);

  const isDark = (theme === "system" ? resolvedTheme : theme) === "dark";

  // Sync recent IDs when palette opens
  useEffect(() => {
    if (paletteOpen) {
      setRecentIds(getRecentCommandIds());
      setSelectedIndex(0);
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [paletteOpen]);

  // Construct command inventory
  const baseCommands = useMemo<CommandItem[]>(() => {
    const isRunPage = pathname?.startsWith("/runs/");
    const hasCompletedRun = isRunPage && nodes.length > 0;

    const list: CommandItem[] = [];

    if (isOnline) {
      list.push({
        id: "action-new-run",
        group: "Actions",
        label: "New Run",
        description: "Start a new multi-agent pipeline run",
        icon: Sparkles,
        shortcut: "⌘N",
        keywords: ["new", "run", "start", "agent", "pipeline", "goal", "create"],
        action: () => {
          router.push("/dashboard");
        },
      });
    } else {
      list.push({
        id: "action-new-run",
        group: "Actions",
        label: "New Run (Offline)",
        description: "Requires internet connection to run agents",
        icon: Sparkles,
        keywords: ["new", "run", "start", "agent", "pipeline", "goal", "create"],
        action: () => {
          // No-op when offline
        },
      });
    }

    if (hasCompletedRun) {
      list.push({
        id: "action-export-trace",
        group: "Actions",
        label: "Export Trace JSON",
        description: "Download full execution trace of current run",
        icon: Download,
        shortcut: "⌘E",
        keywords: ["export", "trace", "json", "download", "run", "data"],
        action: () => {
          const btn = document.getElementById("download-trace-btn");
          if (btn) btn.click();
        },
      });
    }

    list.push(
      // Navigation
      {
        id: "nav-dashboard",
        group: "Navigate",
        label: "Go to Dashboard",
        description: "View active runs, stats & start new runs",
        icon: LayoutDashboard,
        shortcut: "G D",
        keywords: ["dashboard", "home", "main", "overview", "runs"],
        action: () => router.push("/dashboard"),
      },
      {
        id: "nav-leaderboard",
        group: "Navigate",
        label: "Go to Leaderboard",
        description: "Explore public agent challenges & community runs",
        icon: Trophy,
        shortcut: "G L",
        keywords: ["leaderboard", "challenges", "public", "rankings", "hall of fame"],
        action: () => router.push("/leaderboard"),
      },
      // Settings
      {
        id: "setting-toggle-theme",
        group: "Settings",
        label: isDark ? "Switch to Light Theme" : "Switch to Dark Theme",
        description: `Currently ${isDark ? "Dark Mode" : "Light Mode"}`,
        icon: isDark ? Sun : Moon,
        shortcut: "⌘T",
        keywords: ["theme", "dark", "light", "toggle", "mode", "color", "appearance"],
        action: () => setTheme(isDark ? "light" : "dark"),
      },
      {
        id: "setting-toggle-viewmode",
        group: "Settings",
        label: viewMode === "developer" ? "Switch to Simple View" : "Switch to Developer View",
        description: `Currently in ${viewMode === "developer" ? "Developer View" : "Simple View"}`,
        icon: viewMode === "developer" ? Eye : Monitor,
        shortcut: "⌘V",
        keywords: ["view", "developer", "simple", "mode", "toggle", "graph"],
        action: () => setViewMode(viewMode === "developer" ? "simple" : "developer"),
      },
      {
        id: "setting-toggle-sound",
        group: "Settings",
        label: soundEnabled ? "Mute Sound Effects" : "Enable Sound Effects",
        description: soundEnabled ? "Sound ticks active" : "Silent mode active",
        icon: soundEnabled ? VolumeX : Volume2,
        shortcut: "⌘M",
        keywords: ["sound", "audio", "mute", "unmute", "effects", "volume", "tick"],
        action: () => toggleSound(),
      },
      {
        id: "setting-api-keys",
        group: "Settings",
        label: "API Keys & Integrations",
        description: "Manage API credentials & webhooks",
        icon: Key,
        shortcut: "⌘K",
        keywords: ["api", "key", "token", "auth", "settings", "integrations"],
        action: () => router.push("/settings"),
      }
    );

    // Dynamic Recent Runs from database props
    if (runs && runs.length > 0) {
      runs.slice(0, 5).forEach((r) => {
        list.push({
          id: `run-${r.id}`,
          group: "Navigate",
          label: r.name || r.goal,
          description: `Run #${r.id} • ${r.status}`,
          icon: ArrowUpRight,
          shortcut: `#${r.id}`,
          keywords: ["run", r.name || "", r.goal || "", `run ${r.id}`, `#${r.id}`],
          runId: r.id,
          action: () => router.push(`/runs/${r.id}`),
        });
      });
    }

    return list;
  }, [pathname, nodes.length, viewMode, setViewMode, soundEnabled, toggleSound, isDark, setTheme, runs, router, isOnline]);

  // Fuse.js Instance for instant fuzzy search
  const fuse = useMemo(() => {
    return new Fuse(baseCommands, {
      keys: [
        { name: "label", weight: 0.5 },
        { name: "keywords", weight: 0.3 },
        { name: "description", weight: 0.2 },
      ],
      threshold: 0.4,
      distance: 100,
      ignoreLocation: true,
    });
  }, [baseCommands]);

  // Filter & Group Items
  const { groupedItems, visualItems } = useMemo(() => {
    let items: CommandItem[] = [];

    if (!query.trim()) {
      // Build Recent group first if empty query
      const recentList: CommandItem[] = [];
      recentIds.forEach((id) => {
        const found = baseCommands.find((c) => c.id === id);
        if (found) {
          recentList.push({
            ...found,
            group: "Recent",
          });
        }
      });

      // Filter out commands that are already in Recent group to prevent duplicates
      const remainingBase = baseCommands.filter(
        (c) => !recentList.some((r) => r.id === c.id)
      );

      items = [...recentList, ...remainingBase];
    } else {
      const results = fuse.search(query.trim());
      items = results.map((res) => res.item);
    }

    // Grouping with a specific order
    const groupOrder = ["Recent", "Actions", "Navigate", "Settings"];
    const groups: { [key: string]: CommandItem[] } = {};
    items.forEach((item) => {
      if (!groups[item.group]) {
        groups[item.group] = [];
      }
      groups[item.group].push(item);
    });

    const orderedGroups: { [key: string]: CommandItem[] } = {};
    const visualOrderItems: CommandItem[] = [];

    groupOrder.forEach((g) => {
      if (groups[g] && groups[g].length > 0) {
        orderedGroups[g] = groups[g];
        visualOrderItems.push(...groups[g]);
      }
    });

    // Fallback for any unknown groups
    Object.entries(groups).forEach(([g, arr]) => {
      if (!orderedGroups[g]) {
        orderedGroups[g] = arr;
        visualOrderItems.push(...arr);
      }
    });

    return { groupedItems: orderedGroups, visualItems: visualOrderItems };
  }, [query, fuse, baseCommands, recentIds]);

  // Reset selectedIndex if out of bounds
  useEffect(() => {
    if (selectedIndex >= visualItems.length) {
      setSelectedIndex(Math.max(0, visualItems.length - 1));
    }
  }, [visualItems.length, selectedIndex]);

  // Handle immediate execution
  const executeCommand = useCallback(
    (item: CommandItem) => {
      saveRecentCommandId(item.id);
      setPaletteOpen(false);
      setQuery("");
      if (item.action) {
        item.action();
      }
    },
    [setPaletteOpen]
  );

  // Global Keyboard listener for triggers (Cmd+K / Ctrl+K and /)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(!paletteOpen);
        return;
      }

      // '/' trigger when not in an editable field
      if (e.key === "/" && !paletteOpen) {
        const target = e.target as HTMLElement | null;
        const isEditable =
          target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.tagName === "SELECT" ||
            target.isContentEditable);

        if (!isEditable) {
          e.preventDefault();
          setPaletteOpen(true);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [paletteOpen, setPaletteOpen]);

  // Palette Navigation keyboard handlers
  const handlePaletteKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      setPaletteOpen(false);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (visualItems.length > 0) {
        setSelectedIndex((prev) => (prev + 1) % visualItems.length);
      }
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (visualItems.length > 0) {
        setSelectedIndex((prev) => (prev - 1 + visualItems.length) % visualItems.length);
      }
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (visualItems.length > 0 && selectedIndex < visualItems.length) {
        executeCommand(visualItems[selectedIndex]);
      }
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  // Flattened index tracking across groups for hover / keyboard selection
  let currentFlatIndex = 0;

  return (
    <AnimatePresence>
      {paletteOpen && (
        <>
          {/* Dimmed & Blurred Backdrop */}
          <motion.div
            key="cmd-palette-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setPaletteOpen(false)}
            className="fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-md z-50 transition-colors"
          />

          {/* Floating Command Palette Modal */}
          <motion.div
            key="cmd-palette-modal"
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            onKeyDown={handlePaletteKeyDown}
            className="fixed top-[18%] left-1/2 -translate-x-1/2 w-[92vw] max-w-xl bg-white/95 dark:bg-[#121214]/95 border border-neutral-200/80 dark:border-neutral-800/80 rounded-2xl shadow-2xl z-50 overflow-hidden backdrop-blur-xl transition-colors"
          >
            {/* Header / Input Field */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-neutral-200/80 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-neutral-900/50">
              <Search size={20} className="text-neutral-400 dark:text-neutral-500 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                placeholder="Type a command or search..."
                className="w-full bg-transparent text-neutral-900 dark:text-neutral-100 text-base md:text-lg placeholder-neutral-400 dark:placeholder-neutral-500 outline-none font-medium tracking-tight"
              />
              <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[11px] font-mono text-neutral-400 dark:text-neutral-500 bg-neutral-200/60 dark:bg-neutral-800 px-2 py-0.5 rounded-md border border-neutral-300/50 dark:border-neutral-700/50 shrink-0">
                ESC
              </kbd>
            </div>

            {/* Command Results List */}
            <ul
              ref={listRef}
              className="py-2 max-h-[60vh] min-h-[140px] overflow-y-auto divide-y-0"
            >
              {visualItems.length === 0 ? (
                <div className="py-12 px-4 text-center">
                  <div className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto mb-3 text-neutral-400 dark:text-neutral-500">
                    <Search size={18} />
                  </div>
                  <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    No commands found for &ldquo;{query}&rdquo;
                  </p>
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
                    Try searching for &quot;New Run&quot;, &quot;Leaderboard&quot;, or &quot;Theme&quot;
                  </p>
                </div>
              ) : (
                Object.entries(groupedItems).map(([groupName, groupCommands]) => {
                  if (groupCommands.length === 0) return null;
                  return (
                    <div key={groupName} className="mb-2 last:mb-0">
                      {/* Section Header */}
                      <div className="px-4 py-1.5 text-[11px] font-semibold tracking-wider text-neutral-400 dark:text-neutral-500 uppercase">
                        {groupName}
                      </div>

                      {/* Items */}
                      {groupCommands.map((item) => {
                        const index = currentFlatIndex++;
                        const isSelected = index === selectedIndex;
                        const Icon = item.icon;

                        return (
                          <motion.li
                            key={item.id}
                            layout
                            data-index={index}
                            onClick={() => executeCommand(item)}
                            onMouseEnter={() => setSelectedIndex(index)}
                            className={`group relative flex items-center justify-between mx-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150 ${
                              isSelected
                                ? "bg-indigo-500/10 dark:bg-indigo-500/15 text-indigo-900 dark:text-indigo-100 font-medium"
                                : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
                            }`}
                          >
                            {/* Left Active Accent Pill */}
                            {isSelected && (
                              <motion.div
                                layoutId="active-pill"
                                className="absolute left-0 top-2 bottom-2 w-1 bg-indigo-600 dark:bg-indigo-400 rounded-r-full"
                                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                              />
                            )}

                            {/* Label & Icon */}
                            <div className="flex items-center gap-3 min-w-0 pr-2">
                              <div
                                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                                  isSelected
                                    ? "bg-indigo-500/20 text-indigo-600 dark:text-indigo-400"
                                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 group-hover:text-neutral-700 dark:group-hover:text-neutral-200"
                                }`}
                              >
                                <Icon size={16} />
                              </div>

                              <div className="min-w-0 flex flex-col">
                                <span className="text-sm truncate leading-snug">
                                  {item.label}
                                </span>
                                {item.description && (
                                  <span className="text-xs text-neutral-400 dark:text-neutral-500 truncate leading-normal">
                                    {item.description}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Keyboard Shortcut Hint */}
                            {item.shortcut && (
                              <span
                                className={`text-[11px] font-mono shrink-0 px-2 py-0.5 rounded-md border transition-colors ${
                                  isSelected
                                    ? "bg-indigo-500/20 border-indigo-500/30 text-indigo-600 dark:text-indigo-300"
                                    : "bg-neutral-100 dark:bg-neutral-800/70 border-neutral-200 dark:border-neutral-700/50 text-neutral-400 dark:text-neutral-500"
                                }`}
                              >
                                {item.shortcut}
                              </span>
                            )}
                          </motion.li>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </ul>

            {/* Footer Toolbar */}
            <div className="px-4 py-2 border-t border-neutral-200/80 dark:border-neutral-800/80 bg-neutral-50/70 dark:bg-neutral-900/70 flex items-center justify-between text-xs text-neutral-400 dark:text-neutral-500">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-neutral-200/80 dark:bg-neutral-800 font-mono text-[10px]">
                    ↑↓
                  </kbd>{" "}
                  Navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-neutral-200/80 dark:bg-neutral-800 font-mono text-[10px]">
                    ↵
                  </kbd>{" "}
                  Execute
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>GlassBox Engine</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
