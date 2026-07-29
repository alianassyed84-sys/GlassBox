"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Sparkles, ArrowLeft, Monitor, Eye, AlertCircle, Share2, Volume2, VolumeX } from "lucide-react";
import { api, Node, Run, PublicRunDetail } from "@/lib/api";
import { useGlassboxStore } from "@/lib/store";
import NodeSidebar from "@/components/NodeSidebar";
import RunStatsBar from "@/components/RunStatsBar";
import ThemeToggle from "@/components/ThemeToggle";

const RunGraph = dynamic(() => import("@/components/RunGraph"), { ssr: false });

interface PublicRunViewProps {
  runId: number;
}

export default function PublicRunView({ runId }: PublicRunViewProps) {
  const router = useRouter();
  const [run, setRun] = useState<Run | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const { selectedNodeId, setSelectedNodeId, viewMode, setViewMode, soundEnabled, toggleSound } = useGlassboxStore();

  useEffect(() => {
    let active = true;
    async function loadPublicRun() {
      try {
        setLoading(true);
        const data: PublicRunDetail = await api.getPublicRun(runId);
        if (active) {
          setRun(data);
          setNodes(data.nodes || []);
          setNotFound(false);
        }
      } catch (err) {
        if (active) {
          console.error("Failed to load public run", err);
          setNotFound(true);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    if (runId) {
      loadPublicRun();
    } else {
      setNotFound(true);
      setLoading(false);
    }

    return () => {
      active = false;
    };
  }, [runId]);

  const statusColor: Record<string, string> = {
    running: "text-amber-400",
    awaiting_input: "text-blue-400",
    completed: "text-emerald-400",
    error: "text-red-400",
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0a0a0a] text-neutral-900 dark:text-neutral-100 flex flex-col items-center justify-center p-6">
        <div className="flex items-center gap-3 text-indigo-500 font-medium">
          <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          Loading shared run trace…
        </div>
      </div>
    );
  }

  if (notFound || !run) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0a0a0a] text-neutral-900 dark:text-neutral-100 flex flex-col items-center justify-center p-6 transition-colors">
        <div className="max-w-md w-full bg-white dark:bg-[#111111] border border-neutral-200 dark:border-neutral-800 rounded-2xl p-8 text-center shadow-xl">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={24} />
          </div>
          <h2 className="text-xl font-bold tracking-tight mb-2">This run isn't public or doesn't exist</h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6 leading-relaxed">
            The run link you are trying to access may have been marked private or removed by its author.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-xl transition-all shadow-sm"
          >
            <ArrowLeft size={16} />
            Go to Synapse Homepage
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-[#0a0a0a] text-neutral-900 dark:text-neutral-100 transition-colors">
      {/* ── Public Banner ──────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-950 text-indigo-100 px-6 py-2.5 flex items-center justify-between text-xs font-medium shrink-0 border-b border-indigo-700/50 shadow-xs">
        <div className="flex items-center gap-2 truncate">
          <span className="bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded-full font-semibold border border-indigo-400/30">
            PUBLIC READ-ONLY VIEW
          </span>
          <span className="truncate">
            You're viewing a shared Synapse run trace. Sign up to build and debug your own agent pipelines.
          </span>
        </div>
        <Link
          href="/sign-up"
          className="bg-white text-indigo-950 hover:bg-indigo-50 px-3.5 py-1 rounded-lg font-bold flex items-center gap-1.5 transition-colors shrink-0 shadow-xs"
        >
          <Sparkles size={12} className="text-indigo-600" />
          Sign Up Free
        </Link>
      </div>

      {/* ── Topbar ──────────────────────────────────────────────────────── */}
      <header className="flex items-center gap-4 px-5 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-white/90 dark:bg-[#0a0a0a]/90 backdrop-blur-md shrink-0 z-10 shadow-xs dark:shadow-[0_4px_20px_rgba(0,0,0,0.4)] transition-colors">
        <Link
          href="/"
          className="text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300 text-sm flex items-center gap-1.5 transition-colors font-medium"
        >
          <img src="/logo-icon.png" alt="GlassBox Logo" className="w-5 h-5 rounded object-contain" />
          <span>← GlassBox</span>
        </Link>
        <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-800" />
        <div className="flex items-center gap-3 min-w-0">
          <span className={`text-sm font-medium flex items-center gap-1.5 ${statusColor[run.status]}`}>
            <span
              className={`w-2 h-2 rounded-full ${
                run.status === "completed"
                  ? "bg-emerald-400"
                  : run.status === "error"
                  ? "bg-red-400"
                  : "bg-amber-400 animate-pulse"
              }`}
            />
            {run.status}
          </span>
          <span className="text-neutral-600 dark:text-neutral-400 text-sm truncate max-w-md font-medium">
            {run.name ?? run.goal}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2.5">
          <ThemeToggle />
          <button
            onClick={toggleSound}
            title={soundEnabled ? "Mute audio" : "Enable audio"}
            className={`p-1.5 rounded-lg border text-xs flex items-center justify-center transition-colors ${
              soundEnabled
                ? "bg-indigo-600/10 text-indigo-600 dark:text-indigo-300 border-indigo-500/30 dark:bg-indigo-600/20"
                : "bg-neutral-100 dark:bg-neutral-900 text-neutral-500 border-neutral-200 dark:border-neutral-800 hover:text-neutral-800 dark:hover:text-neutral-300"
            }`}
          >
            {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
          </button>
          <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode("developer")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                viewMode === "developer" ? "bg-indigo-600 text-white shadow-xs" : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              <Monitor size={12} /> Dev
            </button>
            <button
              onClick={() => setViewMode("simple")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                viewMode === "simple" ? "bg-neutral-700 text-white shadow-xs" : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              <Eye size={12} /> Simple
            </button>
          </div>
          <Link
            href="/sign-up"
            className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-3.5 py-1.5 rounded-lg transition-colors shadow-xs"
          >
            Sign Up
          </Link>
        </div>
      </header>

      {/* ── Main View ─────────────────────────────────────────────────── */}
      {viewMode === "developer" && (
        <>
          {nodes.length > 0 && <RunStatsBar nodes={nodes} />}
          <div className="flex-1 flex overflow-hidden relative">
            <div className="flex-1 relative">
              <RunGraph apiNodes={nodes} runId={runId} />
            </div>
            <NodeSidebar isReadOnly={true} />
          </div>
        </>
      )}

      {viewMode === "simple" && (
        <div className="flex-1 overflow-auto p-6 max-w-4xl mx-auto w-full">
          <div className="bg-white dark:bg-[#111111] border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm">
            <h1 className="text-xl font-bold mb-4">{run.goal}</h1>
            <div className="space-y-4">
              {nodes.map((n) => (
                <div key={n.id} className="p-4 border border-neutral-200 dark:border-neutral-800 rounded-xl bg-neutral-50 dark:bg-neutral-900/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm capitalize">{n.agent_name} ({n.node_type})</span>
                    <span className="text-xs text-neutral-500">{n.status}</span>
                  </div>
                  <pre className="text-xs font-mono bg-neutral-100 dark:bg-neutral-950 p-3 rounded-lg overflow-auto max-h-40">
                    {JSON.stringify(n.output_json ?? n.prompt_text, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </div>
          <NodeSidebar isReadOnly={true} />
        </div>
      )}
    </div>
  );
}
