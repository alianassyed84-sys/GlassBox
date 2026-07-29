"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Plus, Sparkles, Layers, ArrowRight, User } from "lucide-react";
import { api } from "@/lib/api";
import ThemeToggle from "@/components/ThemeToggle";

interface TemplateItem {
  id: number;
  goal: string;
  template_title: string | null;
  template_description: string | null;
  clone_count: number;
  user_id: string;
  created_at: string;
}

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cloningId, setCloningId] = useState<number | null>(null);

  useEffect(() => {
    api
      .listTemplates()
      .then((res) => setTemplates(res as TemplateItem[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleClone = async (id: number) => {
    setCloningId(id);
    try {
      const res = await api.cloneTemplate(id);
      router.push(`/runs/${res.cloned_run_id}`);
    } catch (err) {
      alert("Failed to clone template: " + (err instanceof Error ? err.message : String(err)));
      setCloningId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0a0a0a] text-neutral-900 dark:text-neutral-100 flex flex-col transition-colors">
      {/* Navbar */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-neutral-200 dark:border-neutral-800 bg-white/90 dark:bg-[#0a0a0a]/90 backdrop-blur-md shrink-0 transition-colors">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={() => router.push("/")}
            className="text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300 text-xs sm:text-sm flex items-center gap-1.5 transition-colors font-medium shrink-0"
          >
            <img src="/logo-icon.png" alt="GlassBox Logo" className="w-5 h-5 rounded object-contain" />
            <span className="hidden xs:inline">← GlassBox</span>
            <span className="xs:hidden">←</span>
          </button>
          <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-800 shrink-0" />
          <span className="font-semibold text-xs sm:text-sm flex items-center gap-1.5 sm:gap-2 text-neutral-900 dark:text-white truncate">
            <Layers size={16} className="text-indigo-500 shrink-0" />
            <span className="truncate">Public Templates</span>
          </span>
        </div>
        <div className="shrink-0 ml-2">
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-10 space-y-6 sm:space-y-8">
        <div>
          <h1 className="text-2xl font-black text-neutral-900 dark:text-white tracking-tight flex items-center gap-2">
            <Sparkles size={24} className="text-indigo-500" />
            Clone &amp; Run AI Agent Templates
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Community-curated agent pipelines ready to execute in one click.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-44 bg-neutral-200 dark:bg-neutral-900 rounded-2xl" />
            ))}
          </div>
        ) : templates.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 rounded-2xl space-y-3">
            <p className="text-sm text-neutral-500">No public templates published yet.</p>
            <p className="text-xs text-neutral-400">Complete a run in GlassBox and click &ldquo;Publish as Template&rdquo;!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                className="bg-white dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:border-indigo-500/40 transition-all shadow-sm"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                      Template
                    </span>
                    <span className="text-xs text-neutral-400 font-mono">Cloned {tpl.clone_count}x</span>
                  </div>
                  <h3 className="text-base font-extrabold text-neutral-900 dark:text-white leading-snug">
                    {tpl.template_title || tpl.goal}
                  </h3>
                  {tpl.template_description && (
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
                      {tpl.template_description}
                    </p>
                  )}
                  <p className="text-xs font-mono text-neutral-500 bg-neutral-50 dark:bg-neutral-950 p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800">
                    Goal: {tpl.goal}
                  </p>
                </div>

                <button
                  onClick={() => handleClone(tpl.id)}
                  disabled={cloningId === tpl.id}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  {cloningId === tpl.id ? (
                    "Cloning & Launching..."
                  ) : (
                    <>
                      <span>Clone &amp; Run</span>
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
