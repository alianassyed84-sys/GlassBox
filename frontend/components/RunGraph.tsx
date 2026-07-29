"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  BackgroundVariant,
  MarkerType,
  EdgeProps,
  getBezierPath,
  BaseEdge,
  useReactFlow,
  ReactFlowProvider,
  Panel,
  MiniMap,
} from "reactflow";
import dagre from "@dagrejs/dagre";
import "reactflow/dist/style.css";
import { Search, ZoomIn, ZoomOut, Maximize, X } from "lucide-react";

import { api, type Node as ApiNode } from "@/lib/api";
import AgentNode, { AGENT_CONFIG, AgentNodeData } from "./AgentNode";
import { useGlassboxStore } from "@/lib/store";

// ── Node & Edge type registry ────────────────────────────────────────────────
const nodeTypes = { agentNode: AgentNode };
const edgeTypes = { animatedFlow: AnimatedFlowEdge };

// ── Dagre Layout Configuration (PART 5.1: rankSep 100, nodeSep 80 minimum) ──
const DAGRE_GRAPH = new dagre.graphlib.Graph();
DAGRE_GRAPH.setDefaultEdgeLabel(() => ({}));
const NODE_W = 240;
const NODE_H = 100;

function layoutGraph(nodes: Node[], edges: Edge[]) {
  DAGRE_GRAPH.setGraph({ rankdir: "TB", nodesep: 80, ranksep: 100 });
  nodes.forEach((n) => DAGRE_GRAPH.setNode(n.id, { width: NODE_W, height: NODE_H }));
  edges.forEach((e) => DAGRE_GRAPH.setEdge(e.source, e.target));
  dagre.layout(DAGRE_GRAPH);
  return nodes.map((n) => {
    const pos = DAGRE_GRAPH.node(n.id);
    return { ...n, position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 } };
  });
}

// ── Node Label Generator ─────────────────────────────────────────────────────
function nodeLabel(apiNode: ApiNode): string {
  if (apiNode.node_type === "clarification_request") {
    if (apiNode.status === "answered" && apiNode.output_json?.answers) {
      const ansObj = apiNode.output_json.answers as Record<string, unknown>;
      const summary = Object.values(ansObj)
        .flatMap((v) => (Array.isArray(v) ? v : [v]))
        .join(", ");
      return `Clarified: ${summary}`;
    }
    return "Clarification Request";
  }
  if (apiNode.agent_name === "planner") return "Planning subtasks…";
  if (apiNode.node_type === "tool_call") return "budget_calculator";
  if (apiNode.agent_name === "worker") {
    const title = (apiNode.input_json as Record<string, unknown>)?.title;
    return typeof title === "string" ? title : "Executing subtask";
  }
  if (apiNode.agent_name === "aggregator") return "Synthesising results";
  return apiNode.agent_name;
}

// ── Animated Flow Edge ────────────────────────────────────────────────────────
interface AnimatedFlowEdgeData {
  animated?: boolean;
  isReplay?: boolean;
  sourceAgent?: "planner" | "worker" | "aggregator";
}

function AnimatedFlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
  style = {},
}: EdgeProps<AnimatedFlowEdgeData>) {
  const agentName = data?.sourceAgent ?? "planner";
  const cfg = AGENT_CONFIG[agentName] ?? AGENT_CONFIG.planner;
  const isReplay = data?.isReplay ?? false;
  const isAnimated = data?.animated ?? false;

  const [edgePath] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, curvature: 0.45 });

  const strokeColor = isReplay ? "rgba(107,114,128,0.7)" : `${cfg.accent}99`;
  const strokeWidth = isAnimated ? 2.5 : 2;

  return (
    <g>
      <path
        d={edgePath}
        fill="none"
        stroke={isReplay ? "rgba(107,114,128,0.15)" : `${cfg.accent}22`}
        strokeWidth={10}
        style={{ filter: "blur(4px)", pointerEvents: "none" }}
      />
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke: strokeColor,
          strokeWidth,
          strokeDasharray: isReplay ? "6 4" : undefined,
          transition: "stroke 0.3s ease, stroke-width 0.2s ease, filter 0.2s ease",
          cursor: "pointer",
        }}
      />
      {isAnimated && !isReplay && (
        <path
          d={edgePath}
          fill="none"
          stroke={cfg.accent}
          strokeWidth={strokeWidth}
          strokeDasharray="4 8"
          className="n8n-animated-edge"
          style={{ pointerEvents: "none" }}
        />
      )}
    </g>
  );
}

// ── Custom Controls ─────────────────────────────────────────────────────────
function GlassControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  return (
    <div className="flex flex-col gap-1 p-1 bg-white/80 dark:bg-[#111111]/80 backdrop-blur-md border border-neutral-200 dark:border-white/10 rounded-xl shadow-lg transition-colors">
      {[
        { icon: ZoomIn, label: "Zoom in", action: () => zoomIn({ duration: 200 }) },
        { icon: ZoomOut, label: "Zoom out", action: () => zoomOut({ duration: 200 }) },
        { icon: Maximize, label: "Fit view", action: () => fitView({ duration: 300, padding: 0.2 }) },
      ].map(({ icon: Icon, label, action }) => (
        <button
          key={label}
          title={label}
          onClick={action}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors"
        >
          <Icon size={15} strokeWidth={2} />
        </button>
      ))}
    </div>
  );
}

// ── Inner Graph Canvas Component ─────────────────────────────────────────────
interface RunGraphProps {
  apiNodes: ApiNode[];
  runId: number;
}

function RunGraphInner({ apiNodes, runId }: RunGraphProps) {
  const { setSelectedNodeId, selectedNodeId } = useGlassboxStore();
  const { fitView } = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Semantic search state
  const [searchQuery, setSearchQuery] = useState("");

  const { rfNodes, rfEdges } = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const rfNodes: Node<AgentNodeData>[] = apiNodes.map((n) => {
      const lbl = nodeLabel(n);
      const isMatch = query === "" || lbl.toLowerCase().includes(query) || n.agent_name.toLowerCase().includes(query);

      return {
        id: String(n.id),
        type: "agentNode",
        position: { x: 0, y: 0 },
        selected: selectedNodeId === n.id,
        style: {
          opacity: isMatch ? 1 : 0.25,
          transition: "opacity 0.3s ease",
        },
        data: {
          label: lbl,
          agentName: n.agent_name,
          nodeType: n.node_type,
          status: n.status,
          isReplay: n.is_replay,
          evalScore: n.eval_score,
        },
      };
    });

    const idToAgent: Record<string, ApiNode["agent_name"]> = {};
    apiNodes.forEach((n) => { idToAgent[String(n.id)] = n.agent_name; });

    const rfEdges: Edge[] = apiNodes
      .filter((n) => n.parent_id !== null)
      .map((n) => {
        const sourceAgent = idToAgent[String(n.parent_id)] ?? "planner";
        const cfg = AGENT_CONFIG[sourceAgent] ?? AGENT_CONFIG.planner;
        return {
          id: `e${n.parent_id}-${n.id}`,
          source: String(n.parent_id),
          target: String(n.id),
          type: "animatedFlow",
          data: {
            animated: n.status === "running",
            isReplay: n.is_replay,
            sourceAgent,
          } as AnimatedFlowEdgeData,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: n.is_replay ? "rgba(107,114,128,0.7)" : `${cfg.accent}99`,
            width: 12,
            height: 12,
          },
        };
      });

    const laid = layoutGraph(rfNodes, rfEdges);
    return { rfNodes: laid, rfEdges };
  }, [apiNodes, selectedNodeId, searchQuery]);

  useEffect(() => {
    setNodes(rfNodes);
    setEdges(rfEdges);
  }, [rfNodes, rfEdges, setNodes, setEdges]);

  // Auto-fit graph canvas on load
  useEffect(() => {
    if (apiNodes.length > 0) {
      setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 100);
    }
  }, [apiNodes.length, fitView]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedNodeId(Number(node.id));
    },
    [setSelectedNodeId]
  );

  return (
    <>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#ffffff_0%,#f1f5f9_85%)] dark:bg-[radial-gradient(circle_at_50%_50%,#16161a_0%,#0a0a0a_85%)] z-0 pointer-events-none transition-colors duration-200" />

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.2, includeHiddenNodes: false }}
        minZoom={0.15}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
        style={{ background: "transparent" }}
        deleteKeyCode={null}
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable={true}
        defaultEdgeOptions={{ type: "animatedFlow" }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.2}
          className="text-neutral-400/40 dark:text-white/20"
          style={{ background: "transparent" }}
        />

        <MiniMap
          nodeStrokeColor={(n) => {
            const data = n.data as AgentNodeData;
            const cfg = AGENT_CONFIG[data.agentName] ?? AGENT_CONFIG.planner;
            return data.status === "error" ? "#ef4444" : cfg.accent;
          }}
          nodeColor={(n) => {
            const data = n.data as AgentNodeData;
            return data.status === "error" ? "rgba(239,68,68,0.2)" : "rgba(100,116,139,0.1)";
          }}
          nodeBorderRadius={4}
          maskColor="rgba(0,0,0,0.2)"
          className="!bg-white/80 dark:!bg-neutral-900/80 !border-neutral-200 dark:!border-neutral-800 backdrop-blur-md shadow-lg"
          style={{
            borderRadius: 12,
            right: 12,
            bottom: 12,
          }}
        />

        {/* Repositioned Top Semantic Search Bar (Part 5.2) */}
        <Panel position="top-left">
          <div className="mt-3 ml-3 w-80 sm:w-96 bg-white/80 dark:bg-neutral-900/90 backdrop-blur-md border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-lg p-1.5 flex items-center gap-2 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
            <Search size={16} className="text-neutral-400 ml-2 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search nodes semantically..."
              className="w-full bg-transparent text-xs text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none py-1"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded-md transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </Panel>

        {/* Custom Glass Controls */}
        <Panel position="bottom-left">
          <div style={{ marginBottom: 16, marginLeft: 12 }}>
            <GlassControls />
          </div>
        </Panel>
      </ReactFlow>
    </>
  );
}

// ── Public Export ────────────────────────────────────────────────────────────
export default function RunGraph(props: RunGraphProps) {
  return (
    <div className="w-full h-full relative bg-slate-50 dark:bg-[#0a0a0a] transition-colors duration-200">
      <ReactFlowProvider>
        <RunGraphInner {...props} />
      </ReactFlowProvider>
    </div>
  );
}
