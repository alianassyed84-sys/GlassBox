"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserButton, useAuth } from "@clerk/nextjs";
import { Key, Plus, Trash2, Copy, Check, ShieldAlert } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { api, setAuthTokenGetter } from "@/lib/api";

interface ApiKeyItem {
  id: number;
  key_prefix: string;
  label: string | null;
  created_at: string;
}

interface ApiKeyCreated extends ApiKeyItem {
  plain_key: string;
}

import { getApiBase } from "@/lib/api";

const API_BASE = getApiBase();

export default function SettingsPage() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [labelInput, setLabelInput] = useState("");
  const [newKeyModal, setNewKeyModal] = useState<ApiKeyCreated | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);

  useEffect(() => {
    setAuthTokenGetter(() => getToken());
  }, [getToken]);

  useEffect(() => {
    fetchKeys();
  }, []);

  async function fetchKeys() {
    try {
      const data = await api.listApiKeys();
      setKeys(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateKey(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const created = await api.createApiKey(labelInput.trim() || "Default Key");
      setNewKeyModal(created);
      setLabelInput("");
      fetchKeys();
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  }

  async function handleRevokeKey(id: number) {
    if (!confirm("Revoke this API key? Applications using it will lose access.")) return;
    try {
      await api.deleteApiKey(id);
      setKeys((prev) => prev.filter((k) => k.id !== id));
    } catch {
      // ignore
    }
  }

  const sampleKey = newKeyModal ? newKeyModal.plain_key : "syn_your_api_key_here";
  const curlExample = `curl -H "X-GlassBox-Key: ${sampleKey}" \\\n  ${API_BASE}/api/v1/runs/1`;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0a0a0a] text-neutral-900 dark:text-neutral-100 flex flex-col transition-colors">
      {/* Top Navbar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-white/90 dark:bg-[#0a0a0a]/90 backdrop-blur-md shrink-0 transition-colors">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300 text-sm flex items-center gap-1.5 transition-colors font-medium"
          >
            <img src="/logo-icon.png" alt="GlassBox Logo" className="w-5 h-5 rounded object-contain" />
            <span>← GlassBox</span>
          </button>
          <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-800" />
          <span className="font-semibold text-sm flex items-center gap-2 text-neutral-900 dark:text-white">
            <Key size={15} className="text-indigo-600 dark:text-indigo-400" />
            API Keys &amp; Developer Settings
          </span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <UserButton />
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-10 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white tracking-tight mb-2">
            Read-Only API Keys
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 text-sm leading-relaxed">
            Generate programmatic keys for fetching run traces directly from external scripts, custom evaluation tools, or CI pipelines.
          </p>
        </div>

        {/* Create Key Form */}
        <form onSubmit={handleCreateKey} className="bg-white dark:bg-[#111111] border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 space-y-4 shadow-sm transition-colors">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-200">Generate New API Key</h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={labelInput}
              onChange={(e) => setLabelInput(e.target.value)}
              placeholder="Key label (e.g. Production Inspector, Local Test)"
              className="flex-1 bg-neutral-50 dark:bg-[#0a0a0a] border border-neutral-200 dark:border-neutral-800 focus:border-indigo-500/60 rounded-xl px-4 py-2.5 text-xs text-neutral-900 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600 focus:outline-none"
            />
            <button
              type="submit"
              disabled={creating}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium px-4 py-2.5 rounded-xl flex items-center gap-2 transition-colors shrink-0"
            >
              <Plus size={14} />
              {creating ? "Generating…" : "Generate Key"}
            </button>
          </div>
        </form>

        {/* Newly Created Key Modal Banner */}
        {newKeyModal && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-300 font-semibold text-xs">
              <ShieldAlert size={16} />
              <span>Save your new API key now! It will not be shown again.</span>
            </div>
            <div className="flex items-center justify-between bg-white dark:bg-[#0a0a0a] border border-amber-500/20 rounded-xl px-4 py-3 font-mono text-xs text-emerald-600 dark:text-emerald-400">
              <span className="truncate mr-4">{newKeyModal.plain_key}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(newKeyModal.plain_key);
                  setCopiedKey(true);
                  setTimeout(() => setCopiedKey(false), 2000);
                }}
                className="text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white flex items-center gap-1 shrink-0 text-[11px]"
              >
                {copiedKey ? <Check size={14} className="text-emerald-600 dark:text-emerald-400" /> : <Copy size={14} />}
                {copiedKey ? "Copied" : "Copy"}
              </button>
            </div>
            <button
              onClick={() => setNewKeyModal(null)}
              className="text-xs text-neutral-500 dark:text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300 underline"
            >
              Done, I have saved this key
            </button>
          </div>
        )}

        {/* Existing Keys Table */}
        <div className="bg-white dark:bg-[#111111] border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 space-y-4 shadow-sm transition-colors">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-200">Active Keys</h2>

          {loading ? (
            <p className="text-neutral-500 text-xs py-4 text-center animate-pulse">Loading API keys…</p>
          ) : keys.length === 0 ? (
            <p className="text-neutral-500 text-xs py-4 text-center">No API keys created yet.</p>
          ) : (
            <div className="divide-y divide-neutral-200 dark:divide-neutral-800/60">
              {keys.map((k) => (
                <div key={k.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">{k.label || "Unnamed Key"}</span>
                      <span className="text-[10px] font-mono text-neutral-500 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 px-2 py-0.5 rounded">
                        {k.key_prefix}…
                      </span>
                    </div>
                    <span className="text-[10px] text-neutral-500">
                      Created {new Date(k.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <button
                    onClick={() => handleRevokeKey(k.id)}
                    title="Revoke key"
                    className="text-neutral-500 hover:text-red-500 p-2 rounded-lg hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Curl Usage Example */}
        <div className="bg-white dark:bg-[#111111] border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 space-y-3 shadow-sm transition-colors">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-200">Usage Example (cURL)</h2>
            <button
              onClick={() => {
                navigator.clipboard.writeText(curlExample);
                setCopiedCurl(true);
                setTimeout(() => setCopiedCurl(false), 2000);
              }}
              className="text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-white flex items-center gap-1.5"
            >
              {copiedCurl ? <Check size={13} className="text-emerald-500 dark:text-emerald-400" /> : <Copy size={13} />}
              {copiedCurl ? "Copied" : "Copy cURL"}
            </button>
          </div>

          <pre className="bg-neutral-50 dark:bg-neutral-900 text-indigo-600 dark:text-indigo-300 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 text-xs font-mono leading-relaxed overflow-x-auto whitespace-pre">
            {curlExample}
          </pre>
          <p className="text-[11px] text-neutral-500">
            Returns JSON containing run details, status, timestamps, and all traced execution nodes.
          </p>
        </div>
      </main>
    </div>
  );
}