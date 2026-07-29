"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Bot,
  Brain,
  Layers,
  CheckCircle2,
  ShieldAlert,
  Cpu,
  Activity,
  Zap,
  RefreshCw,
  Code2,
  Flame,
  ArrowRight,
  Database,
  Globe
} from "lucide-react";

interface Scenario {
  id: string;
  badge: string;
  badgeColor: string;
  targetText: string;
  plannerTitle: string;
  plannerBadge: string;
  plannerDesc: string;
  worker1Title: string;
  worker1Tag: string;
  worker1Desc: string;
  worker1Color: string;
  worker2Title: string;
  worker2Tag: string;
  worker2Desc: string;
  worker2Color: string;
  aggregatorTitle: string;
  aggregatorBadge: string;
  aggregatorSummary: string;
  simpleTitle: string;
  simpleBadge: string;
  simpleDesc: string;
  metric1Label: string;
  metric1Value: string;
  metric2Label: string;
  metric2Value: string;
  drawerWorkerName: string;
  drawerInput: string;
  drawerOutput: string;
  drawerTokens: string;
  drawerLatency: string;
}

const SCENARIOS: Scenario[] = [
  {
    id: "traffic_defense",
    badge: "⚡ AI Traffic Engine",
    badgeColor: "border-teal-500/30 text-teal-400 bg-teal-500/10",
    targetText: "Detect traffic anomaly on /api/checkout & auto-deploy edge rate limiters",
    plannerTitle: "Autonomous Traffic Planner",
    plannerBadge: "Zero-Downtime Mitigation",
    plannerDesc: "Target: /api/checkout | Live Surge: 150,000 req/sec | Engine: GlassBox Traffic Shield",
    worker1Title: "Telemetry Monitor",
    worker1Tag: "#w1",
    worker1Desc: "Analyzed 150k req/sec stream -> Isolated anomaly spike to IP block 192.0.2.0/24",
    worker1Color: "teal",
    worker2Title: "Edge Security Worker",
    worker2Tag: "#w2",
    worker2Desc: "Configured Redis sliding-window limiters & Edge CDN 60s stale-while-revalidate headers",
    worker2Color: "amber",
    aggregatorTitle: "Traffic Mitigation Active",
    aggregatorBadge: "99.4% Shed | 0 Downtime",
    aggregatorSummary: "99.4% malicious traffic shed | Edge Latency: 14ms | 0 downstream errors",
    simpleTitle: "Traffic Spike Defense Protocol Active",
    simpleBadge: "Protected: 150,000 Req/Sec",
    simpleDesc: "GlassBox Multi-Agent OS autonomously isolated the traffic spike, deployed Redis rate-limiting rules, and safeguarded backend API infrastructure.",
    metric1Label: "Mitigation Ratio",
    metric1Value: "99.4% Malicious Shed",
    metric2Label: "Edge Latency",
    metric2Value: "14ms Response Time",
    drawerWorkerName: "Telemetry Monitor (#w1)",
    drawerInput: "Detect latency spikes and malicious bot clusters on /api/checkout in real-time...",
    drawerOutput: '{\n  "anomaly_detected": true,\n  "surge_rate": "150,000 rps",\n  "threat_ip_block": "192.0.2.0/24",\n  "shed_ratio": "99.4%",\n  "edge_rule_id": "RULE_CDN_9918"\n}',
    drawerTokens: "412 tokens",
    drawerLatency: "14ms"
  },
  {
    id: "microservices",
    badge: "🚀 Fullstack Architecture",
    badgeColor: "border-indigo-500/30 text-indigo-400 bg-indigo-500/10",
    targetText: "Architect microservice backend: FastAPI, pgvector search, & Redis Celery queue",
    plannerTitle: "System Architecture Planner",
    plannerBadge: "3 Microservices Decomposed",
    plannerDesc: "Stack: FastAPI + pgvector + Redis Celery | Goal: High-throughput async pipeline",
    worker1Title: "FastAPI Code Generator",
    worker1Tag: "#w1",
    worker1Desc: "Compiled REST router, Pydantic v2 schemas & RS256 JWT auth middleware",
    worker1Color: "indigo",
    worker2Title: "Vector DB & Queue Agent",
    worker2Tag: "#w2",
    worker2Desc: "Provisioned PostgreSQL pgvector schema with HNSW index & Celery background tasks",
    worker2Color: "emerald",
    aggregatorTitle: "Microservice Suite Ready",
    aggregatorBadge: "Docker Build Verified",
    aggregatorSummary: "Fullstack async infrastructure generated & benchmarked at 12,000 req/sec",
    simpleTitle: "High-Performance Microservices Blueprint",
    simpleBadge: "12,000 Req/Sec Capacity",
    simpleDesc: "GlassBox generated production-ready FastAPI endpoints, vector database schema, and background worker queues with 100% test coverage.",
    metric1Label: "Generated Stack",
    metric1Value: "FastAPI + pgvector + Redis",
    metric2Label: "Simulated Load",
    metric2Value: "12,000 req/sec (0% loss)",
    drawerWorkerName: "FastAPI Code Generator (#w1)",
    drawerInput: "Generate async Python REST endpoints with JWT validation and Pydantic schemas...",
    drawerOutput: '{\n  "routes": ["/api/v1/vectors", "/api/v1/auth", "/api/v1/jobs"],\n  "auth": "RS256 JWT validation",\n  "schema_status": "Pydantic v2 Strict",\n  "docker_compose": "HEALTHY"\n}',
    drawerTokens: "680 tokens",
    drawerLatency: "32ms"
  },
  {
    id: "market_intelligence",
    badge: "📊 Market AI & Scraper",
    badgeColor: "border-purple-500/30 text-purple-400 bg-purple-500/10",
    targetText: "Synthesize tech trends across 5 sources & extract high-intent buyer leads",
    plannerTitle: "Growth Intelligence Planner",
    plannerBadge: "Multi-Source Extraction",
    plannerDesc: "Sources: GitHub Trending, HackerNews, ProductHunt | Objective: Conversion Lead Engine",
    worker1Title: "Multi-Source Web Scraper",
    worker1Tag: "#w1",
    worker1Desc: "Crawled 420 tech repositories & discussion threads with real-time DOM parsing",
    worker1Color: "rose",
    worker2Title: "NLP Lead Classifier",
    worker2Tag: "#w2",
    worker2Desc: "Applied sentiment scoring to extract 18 high-intent engineering lead profiles",
    worker2Color: "violet",
    aggregatorTitle: "Lead Intelligence Compiled",
    aggregatorBadge: "18 Qualified Leads",
    aggregatorSummary: "18 high-intent buyer profiles identified with 94.2% intent match score",
    simpleTitle: "Automated Competitor & Lead Intelligence",
    simpleBadge: "18 High-Intent Leads",
    simpleDesc: "Multi-agent crawler synthesized market signals across developer forums and compiled actionable high-intent prospect accounts.",
    metric1Label: "Data Sources Crawled",
    metric1Value: "GitHub, HackerNews, ProductHunt",
    metric2Label: "Match Score",
    metric2Value: "94.2% Intent Precision",
    drawerWorkerName: "NLP Lead Classifier (#w2)",
    drawerInput: "Classify public intent signals from tech discussions into qualified lead metrics...",
    drawerOutput: '{\n  "qualified_leads": 18,\n  "avg_intent_score": 94.2,\n  "top_topics": ["Multi-Agent OS", "Traffic Engineering"],\n  "outreach_template": "Generated"\n}',
    drawerTokens: "520 tokens",
    drawerLatency: "28ms"
  }
];

export default function LiveDemoMockup() {
  const [scenarioIdx, setScenarioIdx] = useState<number>(0);
  const [phase, setPhase] = useState<number>(0);
  const [typedText, setTypedText] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"graph" | "simple">("graph");

  const currentScenario = SCENARIOS[scenarioIdx];

  // Typewriter and phase progression loop
  useEffect(() => {
    let charIdx = 0;
    setTypedText("");
    const targetText = currentScenario.targetText;

    const typeInterval = setInterval(() => {
      if (charIdx <= targetText.length) {
        setTypedText(targetText.slice(0, charIdx));
        charIdx++;
      } else {
        clearInterval(typeInterval);
      }
    }, 35);

    // Timeline phases
    const t1 = setTimeout(() => setPhase(1), 1800); // Planner appears
    const t2 = setTimeout(() => setPhase(2), 3600); // Workers appear
    const t3 = setTimeout(() => {
      setPhase(3);
      setDrawerOpen(true); // Drawer slides open to show developer trace
    }, 5800);
    const t4 = setTimeout(() => {
      setDrawerOpen(false);
      setPhase(4); // Aggregator & Simple view preview
    }, 8500);

    // Auto cycle to next scenario after 12.5 seconds
    const loopTimer = setTimeout(() => {
      setPhase(0);
      setDrawerOpen(false);
      setScenarioIdx((prev) => (prev + 1) % SCENARIOS.length);
    }, 12500);

    return () => {
      clearInterval(typeInterval);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(loopTimer);
    };
  }, [scenarioIdx]);

  const selectScenario = (index: number) => {
    setScenarioIdx(index);
    setPhase(0);
    setDrawerOpen(false);
  };

  return (
    <div className="w-full bg-neutral-900/90 border border-neutral-800 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl shadow-indigo-500/10 font-sans">
      {/* Top Bar with Windows/Mac style controls + Scenario selector pills */}
      <div className="px-3.5 py-3 bg-[#111115] border-b border-neutral-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 justify-between sm:justify-start">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-amber-500/80" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
            <span className="ml-2 text-xs font-mono text-neutral-400 font-semibold hidden md:inline">
              glassbox-trace // run #{1040 + scenarioIdx * 7}
            </span>
          </div>

          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border whitespace-nowrap ${currentScenario.badgeColor}`}>
            {currentScenario.badge}
          </span>
        </div>

        <div className="flex items-center gap-2 justify-between w-full sm:w-auto">
          {/* Interactive Scenario Buttons */}
          <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-xl border border-neutral-800 text-[11px] font-medium overflow-x-auto max-w-[220px] xs:max-w-none no-scrollbar">
            {SCENARIOS.map((sc, i) => (
              <button
                key={sc.id}
                onClick={() => selectScenario(i)}
                className={`px-2.5 py-1 rounded-lg transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  scenarioIdx === i
                    ? "bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-600/30"
                    : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50"
                }`}
              >
                <span>{sc.badge.split(" ")[0]}</span>
                <span className="hidden lg:inline">{sc.badge.split(" ").slice(1).join(" ")}</span>
              </button>
            ))}
          </div>

          {/* View Switcher Tabs */}
          <div className="flex items-center bg-neutral-950 border border-neutral-800 p-0.5 rounded-lg text-xs font-medium shrink-0">
            <button
              onClick={() => setActiveTab("graph")}
              className={`px-2.5 sm:px-3 py-1 rounded-md transition-all text-[11px] sm:text-xs ${
                activeTab === "graph"
                  ? "bg-neutral-800 text-white shadow"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              Agent DAG
            </button>
            <button
              onClick={() => setActiveTab("simple")}
              className={`px-2.5 sm:px-3 py-1 rounded-md transition-all text-[11px] sm:text-xs ${
                activeTab === "simple"
                  ? "bg-neutral-800 text-white shadow"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              Summary
            </button>
          </div>
        </div>
      </div>

      {/* Main Execution Workspace */}
      <div className="p-3.5 sm:p-6 min-h-[420px] sm:min-h-[460px] relative flex flex-col justify-between bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950/20 via-[#0d0d11] to-[#07070a]">
        
        {/* Goal Input Simulation (Complex Command Typewriter) */}
        <div className="mb-3.5">
          <div className="bg-[#121218] border border-neutral-800 rounded-xl p-3 flex items-center justify-between shadow-inner">
            <div className="flex items-center gap-2.5 w-full min-w-0">
              <Sparkles size={16} className="text-indigo-400 shrink-0 animate-pulse" />
              <span className="text-xs sm:text-sm font-semibold text-white font-mono tracking-tight truncate">
                {typedText}
                <span className="inline-block w-2 h-3.5 bg-indigo-400 ml-0.5 animate-pulse" />
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-2">
              <span className="text-[9px] sm:text-[10px] uppercase font-mono text-indigo-300 bg-indigo-500/10 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md border border-indigo-500/20 flex items-center gap-1">
                <RefreshCw size={10} className={phase < 4 ? "animate-spin" : ""} />
                {phase === 0 ? "Parsing" : phase < 4 ? "Executing" : "Complete"}
              </span>
            </div>
          </div>
        </div>

        {/* Tab 1: Agent Graph View */}
        {activeTab === "graph" && (
          <div className="flex-1 flex flex-col items-center justify-between relative py-2 gap-2">
            
            {/* Planner Node */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: phase >= 1 ? 1 : 0.3, y: phase >= 1 ? 0 : -5 }}
              transition={{ duration: 0.4 }}
              className="w-full max-w-md bg-[#161620] border border-indigo-500/40 rounded-xl p-3 sm:p-3.5 shadow-xl shadow-indigo-500/10 z-10"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400 shrink-0">
                    <Brain size={14} />
                  </div>
                  <span className="text-xs font-bold text-white uppercase tracking-wider font-mono truncate">
                    {currentScenario.plannerTitle}
                  </span>
                </div>
                <span className="text-[9px] sm:text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-mono font-semibold shrink-0">
                  {phase >= 1 ? currentScenario.plannerBadge : "Initializing"}
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-neutral-300 font-mono truncate">
                {currentScenario.plannerDesc}
              </p>
            </motion.div>

            {/* Connecting Edges SVG */}
            <div className="h-6 sm:h-10 w-full max-w-md relative flex justify-center">
              <svg className="absolute inset-0 w-full h-full stroke-indigo-500/40 overflow-visible" fill="none">
                <path d="M 120 0 L 70 30" strokeWidth="1.5" strokeDasharray="3 3" />
                <path d="M 320 0 L 370 30" strokeWidth="1.5" strokeDasharray="3 3" />
                {phase >= 2 && (
                  <>
                    <motion.circle cx="70" cy="30" r="3.5" fill="#14b8a6" initial={{ r: 0 }} animate={{ r: 3.5 }} />
                    <motion.circle cx="370" cy="30" r="3.5" fill="#f59e0b" initial={{ r: 0 }} animate={{ r: 3.5 }} />
                  </>
                )}
              </svg>
            </div>

            {/* Parallel Worker Nodes Row */}
            <div className="w-full max-w-xl grid grid-cols-1 sm:grid-cols-2 gap-3 z-10">
              
              {/* Worker Node 1 */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: phase >= 2 ? 1 : 0.3, y: phase >= 2 ? 0 : 10 }}
                transition={{ duration: 0.4 }}
                onClick={() => setDrawerOpen(!drawerOpen)}
                className={`cursor-pointer bg-[#12161b] border rounded-xl p-3 sm:p-3.5 shadow-lg transition-all ${
                  drawerOpen
                    ? "border-teal-400 ring-2 ring-teal-500/30"
                    : "border-teal-500/30 hover:border-teal-400"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="p-1 rounded bg-teal-500/20 text-teal-400 shrink-0">
                      <Cpu size={13} />
                    </div>
                    <span className="text-xs font-bold text-neutral-100 truncate">
                      {currentScenario.worker1Title}
                    </span>
                  </div>
                  <span className="text-[9px] sm:text-[10px] text-teal-400 bg-teal-500/10 px-1.5 py-0.5 rounded font-mono shrink-0">
                    {currentScenario.worker1Tag}
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-neutral-300 line-clamp-2 leading-relaxed">
                  {currentScenario.worker1Desc}
                </p>
                <div className="mt-2 pt-1.5 border-t border-neutral-800 flex items-center justify-between text-[9px] sm:text-[10px] text-neutral-400 font-mono">
                  <span>Latency: {currentScenario.drawerLatency}</span>
                  <span className="text-teal-400 underline hover:text-teal-300">Inspect Trace →</span>
                </div>
              </motion.div>

              {/* Worker Node 2 */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: phase >= 2 ? 1 : 0.3, y: phase >= 2 ? 0 : 10 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="bg-[#181418] border border-amber-500/30 rounded-xl p-3 sm:p-3.5 shadow-lg"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="p-1 rounded bg-amber-500/20 text-amber-400 shrink-0">
                      <Layers size={13} />
                    </div>
                    <span className="text-xs font-bold text-neutral-100 truncate">
                      {currentScenario.worker2Title}
                    </span>
                  </div>
                  <span className="text-[9px] sm:text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded font-mono shrink-0">
                    {currentScenario.worker2Tag}
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-neutral-300 line-clamp-2 leading-relaxed">
                  {currentScenario.worker2Desc}
                </p>
                <div className="mt-2 pt-1.5 border-t border-neutral-800 flex items-center justify-between text-[9px] sm:text-[10px] text-neutral-400 font-mono">
                  <span>Status: Verified</span>
                  <span className="text-amber-400">Parallel Exec</span>
                </div>
              </motion.div>
            </div>

            {/* Connecting Edge to Aggregator */}
            <div className="h-6 sm:h-8 w-full max-w-md relative flex justify-center">
              <svg className="w-full h-full stroke-purple-500/40" fill="none">
                <line x1="50%" y1="0" x2="50%" y2="100%" strokeWidth="1.5" strokeDasharray="3 3" />
              </svg>
            </div>

            {/* Aggregator Final Node */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: phase >= 4 ? 1 : 0.3, scale: phase >= 4 ? 1 : 0.95 }}
              transition={{ duration: 0.4 }}
              className="w-full max-w-md bg-[#16121f] border border-purple-500/40 rounded-xl p-3 sm:p-3.5 shadow-xl z-10"
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1 rounded bg-purple-500/20 text-purple-400 shrink-0">
                    <CheckCircle2 size={14} />
                  </div>
                  <span className="text-xs font-bold text-white uppercase tracking-wider font-mono truncate">
                    {currentScenario.aggregatorTitle}
                  </span>
                </div>
                <span className="text-[9px] sm:text-[10px] text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded-full font-mono font-medium border border-purple-500/20 shrink-0">
                  {currentScenario.aggregatorBadge}
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-neutral-300 font-mono truncate">
                {currentScenario.aggregatorSummary}
              </p>
            </motion.div>
          </div>
        )}

        {/* Tab 2: Simple Output View */}
        {activeTab === "simple" && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 bg-[#111116] border border-neutral-800 rounded-xl p-4 sm:p-5 text-sans flex flex-col justify-between shadow-inner"
          >
            <div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3 border-b border-neutral-800 pb-3">
                <h3 className="text-xs sm:text-sm font-extrabold text-white flex items-center gap-2">
                  <Zap size={15} className="text-amber-400 shrink-0" />
                  {currentScenario.simpleTitle}
                </h3>
                <span className="text-[10px] sm:text-xs text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full font-mono font-semibold">
                  {currentScenario.simpleBadge}
                </span>
              </div>

              <p className="text-xs text-neutral-300 mb-4 leading-relaxed">
                {currentScenario.simpleDesc}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div className="bg-[#171720] border border-neutral-800 p-2.5 sm:p-3 rounded-xl">
                  <span className="text-neutral-400 font-mono text-[9px] sm:text-[10px] uppercase block mb-1">
                    {currentScenario.metric1Label}
                  </span>
                  <span className="text-white font-bold block text-xs sm:text-sm">
                    {currentScenario.metric1Value}
                  </span>
                </div>
                <div className="bg-[#171720] border border-neutral-800 p-2.5 sm:p-3 rounded-xl">
                  <span className="text-neutral-400 font-mono text-[9px] sm:text-[10px] uppercase block mb-1">
                    {currentScenario.metric2Label}
                  </span>
                  <span className="text-white font-bold block text-xs sm:text-sm">
                    {currentScenario.metric2Value}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-2.5 border-t border-neutral-800 flex items-center justify-between text-[10px] sm:text-[11px] text-neutral-400 font-mono">
              <span>Trace ID: #run_9942</span>
              <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                <CheckCircle2 size={12} /> GlassBox Verified
              </span>
            </div>
          </motion.div>
        )}

        {/* Drawer Overlay for Live Code / JSON Inspection — Responsive Bottom Sheet on Mobile */}
        <AnimatePresence>
          {drawerOpen && activeTab === "graph" && (
            <motion.div
              initial={{ y: "100%", x: 0 }}
              animate={{ y: 0, x: 0 }}
              exit={{ y: "100%", x: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 280 }}
              className="absolute inset-x-0 bottom-0 top-12 sm:top-0 sm:right-0 sm:left-auto sm:w-80 bg-[#0e1114] border-t sm:border-t-0 sm:border-l border-teal-500/40 p-4 shadow-2xl z-30 flex flex-col justify-between rounded-t-2xl sm:rounded-t-none"
            >
              <div>
                <div className="flex items-center justify-between mb-3 border-b border-neutral-800 pb-2.5">
                  <span className="text-xs font-bold text-teal-400 uppercase font-mono flex items-center gap-1.5 truncate">
                    <Code2 size={14} className="shrink-0" /> Trace: {currentScenario.drawerWorkerName}
                  </span>
                  <button
                    onClick={() => setDrawerOpen(false)}
                    className="text-neutral-400 hover:text-white text-xs px-2.5 py-1 rounded bg-neutral-800 shrink-0 ml-2"
                  >
                    ✕ Close
                  </button>
                </div>

                <div className="space-y-2.5 text-[11px]">
                  <div className="bg-[#080a0c] border border-neutral-800 p-2.5 rounded-lg font-mono text-neutral-300">
                    <span className="text-neutral-500 block text-[9px] uppercase font-bold mb-1">
                      Input Task Specification
                    </span>
                    {currentScenario.drawerInput}
                  </div>

                  <div className="bg-[#080a0c] border border-teal-500/30 p-2.5 rounded-lg font-mono text-teal-300 overflow-x-auto max-h-36 sm:max-h-48">
                    <span className="text-teal-400 block text-[9px] uppercase font-bold mb-1">
                      Raw Agent LLM Response
                    </span>
                    <pre className="text-[10px] leading-relaxed whitespace-pre-wrap">
                      {currentScenario.drawerOutput}
                    </pre>
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-neutral-400 font-mono flex items-center justify-between border-t border-neutral-800 pt-2.5 mt-2">
                <span>Tokens: {currentScenario.drawerTokens}</span>
                <span className="text-teal-400 font-semibold">Latency: {currentScenario.drawerLatency}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
