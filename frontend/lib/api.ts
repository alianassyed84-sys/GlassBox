/**
 * api.ts — Typed fetch wrappers for the Glassbox backend API with Clerk auth support.
 */

import {
  saveRun,
  saveNodes,
  getRun as getLocalRun,
  getNodesForRun as getLocalNodesForRun,
  getRuns as getLocalRuns,
} from "./localdb";

export function getApiBase(): string {
  if (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.trim()) {
    return process.env.NEXT_PUBLIC_API_URL.trim();
  }
  if (typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
    return "https://glassbox-9uf2.onrender.com";
  }
  return "http://localhost:8000";
}

const API_BASE = getApiBase();


export interface Run {
  id: number;
  name: string | null;
  goal: string;
  status: "running" | "completed" | "error" | "awaiting_input";
  user_id?: string | null;
  share_token?: string | null;
  is_public?: boolean;
  created_at: string;
}

export interface PublicRunDetail extends Run {
  nodes: Node[];
}

export interface Node {
  id: number;
  run_id: number;
  parent_id: number | null;
  agent_name: "planner" | "worker" | "aggregator";
  node_type: "llm_call" | "tool_call" | "handoff" | "clarification_request";
  prompt_text: string | null;
  input_json: Record<string, unknown> | null;
  output_json: Record<string, unknown> | null;
  status: "running" | "success" | "error" | "awaiting_answer" | "answered";
  is_replay: boolean;
  replayed_from_id: number | null;
  // Langfuse-inspired observability fields
  model_name: string | null;
  latency_ms: number | null;
  status_message: string | null;
  token_count_input?: number | null;
  token_count_output?: number | null;
  eval_score?: {
    overall_score?: number;
    quality_score?: number;
    hallucination_score?: number;
    coherence_score?: number;
    verdict?: "pass" | "warning" | "fail";
    reasoning?: string;
  } | null;
  created_at: string;
  completed_at: string | null;
}

export interface ReplayResponse {
  nodes: Node[];
}

let customTokenGetter: (() => Promise<string | null>) | null = null;

export function setAuthTokenGetter(getter: () => Promise<string | null>) {
  customTokenGetter = getter;
}

let _cachedToken: string | null = null;
let _tokenExpiry = 0;

async function getAuthToken(): Promise<string | null> {
  const now = Date.now();
  if (_cachedToken && now < _tokenExpiry) {
    return _cachedToken;
  }

  let token: string | null = null;

  if (customTokenGetter) {
    try {
      token = await customTokenGetter();
    } catch {
      // fallback to global window.Clerk
    }
  }

  if (!token && typeof window !== "undefined" && (window as unknown as { Clerk?: { session?: { getToken: () => Promise<string | null> } } }).Clerk?.session) {
    try {
      token = await (window as unknown as { Clerk: { session: { getToken: () => Promise<string | null> } } }).Clerk.session.getToken();
    } catch {
      token = null;
    }
  }

  if (token) {
    _cachedToken = token;
    _tokenExpiry = now + 45000; // cache for 45 seconds for instant zero-latency sub-requests
  }

  return token;
}

async function apiFetch<T>(path: string, options?: RequestInit, retries: number = 3): Promise<T> {
  const token = await getAuthToken();
  
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string> || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`API ${res.status}: ${err}`);
      }
      return await res.json() as T;
    } catch (e: any) {
      lastError = e;
      if (attempt < retries - 1) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      }
    }
  }

  throw lastError || new Error("Failed to fetch");
}

export const api = {
  createRun: (goal: string) =>
    apiFetch<{ run_id: number }>("/runs", {
      method: "POST",
      body: JSON.stringify({ goal }),
    }),

  listRuns: async (): Promise<Run[]> => {
    try {
      const runs = await apiFetch<Run[]>("/runs");
      const completedRuns = runs.filter(r => r.status === "completed");
      for (const run of completedRuns) {
        await saveRun(run);
      }
      return runs;
    } catch (err) {
      console.warn("listRuns failed, falling back to local DB:", err);
      const cached = await getLocalRuns();
      if (cached && cached.length > 0) return cached;
      throw err;
    }
  },

  getRun: async (runId: number): Promise<Run> => {
    try {
      const run = await apiFetch<Run>(`/runs/${runId}`);
      if (run.status === "completed") {
        await saveRun(run);
      }
      return run;
    } catch (err) {
      console.warn(`getRun(${runId}) failed, falling back to local DB:`, err);
      const cached = await getLocalRun(runId);
      if (cached) return cached;
      throw err;
    }
  },

  getRunNodes: async (runId: number): Promise<Node[]> => {
    try {
      const nodes = await apiFetch<Node[]>(`/runs/${runId}/nodes`);
      const cachedRun = await getLocalRun(runId);
      if (cachedRun && cachedRun.status === "completed") {
        await saveNodes(nodes);
      } else {
        const hasCompletedAggregator = nodes.some(n => n.agent_name === "aggregator" && n.status === "success");
        if (hasCompletedAggregator) {
          await saveNodes(nodes);
        }
      }
      return nodes;
    } catch (err) {
      console.warn(`getRunNodes(${runId}) failed, falling back to local DB:`, err);
      const cachedNodes = await getLocalNodesForRun(runId);
      if (cachedNodes && cachedNodes.length > 0) return cachedNodes;
      throw err;
    }
  },

  getNode: (nodeId: number) => apiFetch<Node>(`/nodes/${nodeId}`),

  replayNode: (nodeId: number, input_json: Record<string, unknown>) =>
    apiFetch<ReplayResponse>(`/nodes/${nodeId}/replay`, {
      method: "POST",
      body: JSON.stringify({ input_json }),
    }),

  answerClarification: (runId: number, nodeId: number, answers: Record<string, unknown>) =>
    apiFetch<Node>(`/runs/${runId}/answer-clarification`, {
      method: "POST",
      body: JSON.stringify({ node_id: nodeId, answers }),
    }),

  searchNodes: (runId: number, query: string) =>
    apiFetch<Node[]>(`/runs/${runId}/search?q=${encodeURIComponent(query)}`),

  evaluateNode: (nodeId: number) =>
    apiFetch<Node>(`/nodes/${nodeId}/eval`, { method: "POST" }),

  createShareLink: (runId: number) =>
    apiFetch<{ share_token: string; run_id: number; is_public: boolean }>(`/runs/${runId}/share`, { method: "POST" }),

  getPublicRun: (runId: number) =>
    apiFetch<PublicRunDetail>(`/public/runs/${runId}`),

  listApiKeys: () =>
    apiFetch<any[]>("/api-keys"),

  createApiKey: (label: string) =>
    apiFetch<any>("/api-keys", {
      method: "POST",
      body: JSON.stringify({ label }),
    }),

  deleteApiKey: (keyId: number) =>
    apiFetch<{ revoked: boolean; id: number }>(`/api-keys/${keyId}`, {
      method: "DELETE",
    }),

  roastRun: (runId: number) =>
    apiFetch<{ roast_text: string; roast_grade: string }>(`/runs/${runId}/roast`, { method: "POST" }),

  gradeRun: (runId: number) =>
    apiFetch<{
      total_score: number;
      grade: string;
      breakdown: { planner_score: number; worker_score: number; aggregator_score: number; overall_goal_score: number };
      one_line_verdict: string;
    }>(`/runs/${runId}/grade`, { method: "POST" }),

  generateLinkedInPost: (replayId: number) =>
    apiFetch<{ post_text: string; suggested_hashtags: string[] }>(`/nodes/${replayId}/generate-post`, { method: "POST" }),

  getUserWrapped: () =>
    apiFetch<any>("/users/me/wrapped"),

  getGlobalStats: () =>
    apiFetch<any>("/stats/global"),

  listTemplates: () =>
    apiFetch<any[]>("/templates"),

  publishTemplate: (runId: number, title: string, description?: string) =>
    apiFetch<{ published: boolean; template_id: number }>(`/runs/${runId}/publish-template`, {
      method: "POST",
      body: JSON.stringify({ title, description }),
    }),

  cloneTemplate: (templateId: number) =>
    apiFetch<{ cloned_run_id: number; goal: string }>(`/templates/${templateId}/clone`, { method: "POST" }),
};
