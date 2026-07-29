import { openDB, IDBPDatabase } from "idb";
import { Run, Node } from "./api";

const DB_NAME = "glassbox-local";
const DB_VERSION = 1;

export interface PendingAction {
  id?: number;
  type: "share-run" | "share-fix" | "share-report";
  runId: number;
  content: string;
  createdAt: string;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

export function initDB() {
  if (typeof window === "undefined") return null;
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Store 1: runs (keyPath: id)
        if (!db.objectStoreNames.contains("runs")) {
          db.createObjectStore("runs", { keyPath: "id" });
        }
        // Store 2: nodes (keyPath: id, index on run_id)
        if (!db.objectStoreNames.contains("nodes")) {
          const nodeStore = db.createObjectStore("nodes", { keyPath: "id" });
          nodeStore.createIndex("run_id", "run_id", { unique: false });
        }
        // Store 3: pending-actions (keyPath: id, autoIncrement: true)
        if (!db.objectStoreNames.contains("pending-actions")) {
          db.createObjectStore("pending-actions", { keyPath: "id", autoIncrement: true });
        }
      },
    });
  }
  return dbPromise;
}

export async function saveRun(run: Run) {
  const db = await initDB();
  if (!db) return;
  await db.put("runs", run);
}

export async function saveNodes(nodes: Node[]) {
  const db = await initDB();
  if (!db) return;
  const tx = db.transaction("nodes", "readwrite");
  for (const node of nodes) {
    await tx.store.put(node);
  }
  await tx.done;
}

export async function getRun(runId: number): Promise<Run | null> {
  const db = await initDB();
  if (!db) return null;
  return (await db.get("runs", runId)) || null;
}

export async function getNodesForRun(runId: number): Promise<Node[]> {
  const db = await initDB();
  if (!db) return [];
  const index = db.transaction("nodes", "readonly").store.index("run_id");
  return await index.getAll(runId);
}

export async function getRuns(): Promise<Run[]> {
  const db = await initDB();
  if (!db) return [];
  return await db.getAll("runs");
}

export async function addPendingAction(action: Omit<PendingAction, "id">) {
  const db = await initDB();
  if (!db) return;
  await db.add("pending-actions", action);
}

export async function getPendingActions(): Promise<PendingAction[]> {
  const db = await initDB();
  if (!db) return [];
  return await db.getAll("pending-actions");
}

export async function deletePendingAction(id: number) {
  const db = await initDB();
  if (!db) return;
  await db.delete("pending-actions", id);
}

export async function cleanOldRuns(days = 30) {
  const db = await initDB();
  if (!db) return;
  try {
    const runs = await getRuns();
    const threshold = Date.now() - days * 24 * 60 * 60 * 1000;
    
    const txRuns = db.transaction("runs", "readwrite");
    const txNodes = db.transaction("nodes", "readwrite");
    const nodesStore = txNodes.store;
    const nodesIndex = nodesStore.index("run_id");

    for (const run of runs) {
      const runTime = new Date(run.created_at).getTime();
      if (runTime < threshold) {
        console.log(`Cleaning up old run #${run.id} (${run.created_at})`);
        await txRuns.store.delete(run.id);
        
        // Delete nodes associated with this run
        const runNodes = await nodesIndex.getAll(run.id);
        for (const node of runNodes) {
          await nodesStore.delete(node.id);
        }
      }
    }
    await txRuns.done;
    await txNodes.done;
  } catch (e) {
    console.error("Failed to run cleanOldRuns job:", e);
  }
}
