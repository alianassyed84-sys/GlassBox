# Glassbox Engineering Architecture Document

## Executive Summary

Glassbox is an observability and interactive replay engine for multi-agent LLM systems. Existing agent frameworks (LangChain, AutoGen, CrewAI) treat agent reasoning as ephemeral execution traces, rendering introspection and targeted error recovery difficult. Glassbox models agent workflows as persistent Directed Acyclic Graphs (DAGs) with time-travel re-execution primitives.

---

## 1. Traced Execution Pattern (`traced_call`)

### Problem Statement
Standard async agent loops lack fine-grained state persistence. If step 4 of a 6-step agent pipeline fails due to a rate limit or bad LLM formatting, the developer must restart the entire pipeline, wasting compute and token budget.

### Architectural Solution
Every call to an LLM or tool is encapsulated inside a generic `traced_call()` context block:

```
+-------------------------------------------------------------------+
|                           traced_call()                            |
|  1. Insert Node row in DB (status='running', parent_id=parent_id) |
|  2. Broadcast Node Event via WebSocket to Client                  |
|  3. OpenTelemetry Span Initialization                             |
|  4. Execute Target Function (LLM query / tool payload)            |
|  5. Update Node row (status='success'|'error', output_json=...)    |
|  6. Broadcast Completion Event via WebSocket                     |
+-------------------------------------------------------------------+
```

### Key Design Rationale
- **Atomic Persistence**: Every intermediate node is written to relational storage *before* and *after* execution, guaranteeing non-volatile observability even during runtime process crashes.
- **Span Correlation**: OpenTelemetry spans share exact `run_id` and `node_id` identifiers, enabling seamless integration with external APMs (Honeycomb, Datadog, Jaeger).

---

## 2. DAG Storage Schema & Traversal (`parent_id` Self-Reference)

### Schema Structure
The fundamental execution primitive is the `Node` entity represented with an explicit self-referential foreign key:

```sql
CREATE TABLE nodes (
    id SERIAL PRIMARY KEY,
    run_id INTEGER REFERENCES runs(id) ON DELETE CASCADE,
    parent_id INTEGER REFERENCES nodes(id) ON DELETE SET NULL,
    agent_name VARCHAR(100) NOT NULL,
    node_type VARCHAR(50) NOT NULL,
    prompt_text TEXT,
    output_json JSONB,
    status VARCHAR(20) NOT NULL,
    execution_time_ms FLOAT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_nodes_run_parent ON nodes(run_id, parent_id);
```

### Directed Acyclic Graph (DAG) Mechanics
- **Parent Self-Reference**: `parent_id` points to the immediately preceding execution node. Multi-parent merge points (e.g., aggregation nodes) collect outputs from preceding step siblings by matching run step metadata.
- **Tree Reconstruction**: The UI client fetches `GET /runs/{id}/nodes` and executes a topological sort to render the execution tree in React Flow, mapping execution sequences into a visual graph structure.

---

## 3. The Replay Cascade Algorithm

### Overview
Time-travel replay allows a user to select any historic node $N_k$, edit its input prompt or parameters, and fork execution from $N_k$ forward without repeating steps $N_1 \dots N_{k-1}$.

```
Original Run:  [N1] -> [N2] -> [N3 (Bug)] -> [N4] -> [N5]
                                  |
                               Replay(N3, modified_input)
                                  v
Replay Run:    [N1] -> [N2] -> [N3'] -------> [N4'] -> [N5']
```

### Step-by-Step Cascade Logic

1. **Ancestor Preservation**: The engine retrieves node $N_k$ and verifies ownership. All ancestors $A(N_k) = \{N_1, \dots, N_{k-1}\}$ are marked immutable.
2. **State Isolation**: A new `Run` entity (or run branch) is instantiated. Ancestor nodes up to $N_{k-1}$ are copied or referenced as historical context.
3. **Target Node Re-execution**: Node $N_k'$ is initialized with the modified input. `traced_call()` executes $N_k'$ with the user's revised inputs.
4. **Downstream Cascade**: Subsequent pipeline steps ($N_{k+1}' \dots N_m'$) execute sequentially, consuming outputs from the newly computed parent node $N_k'$.
5. **Real-Time Client Notification**: Each step in the replayed branch emits `node_event` payloads via WebSocket, allowing the UI to render the fork animation side-by-side with the original execution run.

---

## 4. Real-Time Streaming & Background Workers (WebSocket + Arq)

### Dual Execution Pipeline Architecture

```
                      +-------------------+
                      |   FastAPI Main    |
                      +---------+---------+
                                |
             +------------------+------------------+
             |                                     |
             v                                     v
   +-------------------+                 +-------------------+
   | ThreadPoolWorker  |                 | Arq Redis Worker  |
   | (Local Dev MVP)   |                 | (Durable Prod Job)|
   +---------+---------+                 +---------+---------+
             |                                     |
             +------------------+------------------+
                                |
                                v
                      +-------------------+
                      | ConnectionManager |
                      |   (ws_manager)    |
                      +---------+---------+
                                | WS Broadcast
                                v
                      +-------------------+
                      |  React Frontend   |
                      +-------------------+
```

### Connection Management & Event Delivery
- **In-Memory ThreadPoolExecutor**: For zero-dependency local setup, FastAPI dispatches asynchronous tasks to a bounded thread pool.
- **Arq Redis Workers**: For production deployment (Render/Kubernetes), background tasks are enqueued to Arq Redis queues with automatic retry logic and job timeouts.
- **WebSocket Broadcast Guard**: `ws_manager` maintains active WebSocket connections per `run_id`. Broadcasts are safe and non-blocking — if a socket disconnects, the manager gracefully unregisters the connection without failing the underlying agent worker thread.

---

## 5. Client Offline Persistence & IndexedDB Sync Strategy

### Offline-First Client Architecture
The Next.js frontend uses an IndexedDB store via the `idb` library (`localdb.ts`) paired with Zustand for state management:

```
+------------------+      Online Sync      +-------------------+
|  React Component | <===================> |   FastAPI Server  |
+--------+---------+                       +-------------------+
         |
         | Local Read/Write
         v
+------------------+
| IndexedDB Cache  |  (Persists runs, node detail, drafts offline)
+------------------+
```

### Sync & Fallback Protocol
1. **Network First for Mutations**: When user initiates a run, POST request is issued to FastAPI.
2. **IndexedDB Local Cache**: Incoming WebSocket `node_event` updates write immediately to IndexedDB.
3. **Offline Fallback**: If network disconnects or API server is unreachable, the UI seamlessly renders historic runs, graph visualizations, and trace metrics directly from local IndexedDB storage.
4. **HTTP Polling Fallback**: If WebSocket connection fails, the frontend automatically degrades to 2-second HTTP polling against `GET /runs/{id}/nodes`.
