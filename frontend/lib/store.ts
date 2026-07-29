/**
 * store.ts — Zustand global state for Glassbox.
 */
import { create } from "zustand";
import type { Node, Run } from "./api";

export type ViewMode = "simple" | "developer";

const VIEW_MODE_KEY = "glassbox_view_mode";

function readViewMode(): ViewMode {
  if (typeof window === "undefined") return "developer";
  try {
    const v = localStorage.getItem(VIEW_MODE_KEY);
    if (v === "simple" || v === "developer") return v;
  } catch {
    // SSR or localStorage blocked
  }
  return "developer";
}

function writeViewMode(mode: ViewMode) {
  try {
    localStorage.setItem(VIEW_MODE_KEY, mode);
  } catch {
    // ignore
  }
}

interface GlassboxState {
  // Selected node (for drawer)
  selectedNodeId: number | null;
  setSelectedNodeId: (id: number | null) => void;

  // Dark mode
  isDark: boolean;
  toggleDark: () => void;

  // Recent runs cache (for command palette)
  runs: Run[];
  setRuns: (runs: Run[]) => void;

  // Command palette open
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;

  // Focused run nodes (for the graph)
  nodes: Node[];
  setNodes: (nodes: Node[]) => void;

  // Sound effects toggle
  soundEnabled: boolean;
  toggleSound: () => void;

  // Simple / Developer view toggle
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  // Clear all user session data on logout
  reset: () => void;

  // Global toast system
  toasts: { id: string; message: string; type?: "info" | "success" | "warning" }[];
  addToast: (message: string, type?: "info" | "success" | "warning") => void;
  removeToast: (id: string) => void;
}

const SOUND_KEY = "glassbox_sound_enabled";

function readSoundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const v = localStorage.getItem(SOUND_KEY);
    return v === "true";
  } catch {
    return false;
  }
}

export const useGlassboxStore = create<GlassboxState>((set) => ({
  selectedNodeId: null,
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),

  isDark: true,
  toggleDark: () => set((s) => ({ isDark: !s.isDark })),

  runs: [],
  setRuns: (runs) => set({ runs }),

  paletteOpen: false,
  setPaletteOpen: (open) => set({ paletteOpen: open }),

  nodes: [],
  setNodes: (nodes) => set({ nodes }),

  soundEnabled: readSoundEnabled(),
  toggleSound: () => set((s) => {
    const next = !s.soundEnabled;
    try { localStorage.setItem(SOUND_KEY, String(next)); } catch {}
    return { soundEnabled: next };
  }),

  // Default to 'developer'; will be overridden from localStorage on client mount
  viewMode: "developer",
  setViewMode: (mode) => {
    writeViewMode(mode);
    set({ viewMode: mode });
  },

  toasts: [],
  addToast: (message, type = "info") => set((s) => {
    const id = Math.random().toString(36).substring(2, 9);
    return { toasts: [...s.toasts, { id, message, type }] };
  }),
  removeToast: (id) => set((s) => ({
    toasts: s.toasts.filter((t) => t.id !== id),
  })),

  reset: () => {
    try {
      localStorage.removeItem("glassbox_recent_runs");
      localStorage.removeItem("glassbox_command_history");
      sessionStorage.clear();
    } catch {}
    set({
      selectedNodeId: null,
      runs: [],
      nodes: [],
      paletteOpen: false,
      toasts: [],
    });
  },
}));
