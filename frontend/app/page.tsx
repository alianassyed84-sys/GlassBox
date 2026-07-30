"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useScroll, useTransform, useInView, AnimatePresence } from "framer-motion";
import { useAuth, useClerk } from "@clerk/nextjs";
import {
  Sparkles,
  ArrowRight,
  Play,
  Zap,
  RotateCcw,
  HelpCircle,
  Eye,
  Terminal,
  Trophy,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  Sliders,
  Flame,
  Layers,
  Brain,
  X,
  Menu
} from "lucide-react";
import LiveDemoMockup from "@/components/LiveDemoMockup";
import ThemeToggle from "@/components/ThemeToggle";
import LiveCounter from "@/components/LiveCounter";
import ActivityFeed from "@/components/ActivityFeed";
import { usePWAInstall } from "@/hooks/usePWAInstall";

// Count-up stat component
function AnimatedStat({ value, label, prefix = "", suffix = "" }: { value: number; label: string; prefix?: string; suffix?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    let start = 0;
    const end = value;
    const duration = 1500;
    const stepTime = 20;
    const steps = duration / stepTime;
    const increment = (end - start) / steps;

    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [isInView, value]);

  return (
    <div ref={ref} className="text-center sm:text-left p-6 bg-white dark:bg-[#111114] border border-neutral-200 dark:border-neutral-800/80 rounded-2xl relative overflow-hidden group hover:border-indigo-500/40 transition-all duration-300">
      <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl group-hover:bg-indigo-500/10 transition-all" />
      <div className="text-4xl sm:text-5xl font-extrabold text-neutral-900 dark:text-white tracking-tight mb-2 font-mono">
        {prefix}{count.toLocaleString()}{suffix}
      </div>
      <p className="text-neutral-600 dark:text-neutral-400 text-sm font-medium">{label}</p>
    </div>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const { userId, isLoaded } = useAuth();
  const { openSignUp } = useClerk();
  const { isInstallable, installApp } = usePWAInstall();
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [dismissedInstallBanner, setDismissedInstallBanner] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (dismissedInstallBanner) return;
      if (window.scrollY > 400) {
        setShowInstallBanner(true);
      } else {
        setShowInstallBanner(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [dismissedInstallBanner]);

  // Redirection is handled dynamically on action buttons rather than automatically forcing authenticated users away from the landing page.

  // Demo section parallax scroll transform
  const demoRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: demoRef,
    offset: ["start end", "end start"],
  });
  const rotateX = useTransform(scrollYProgress, [0, 0.5, 1], [8, 0, -5]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.94, 1, 0.98]);

  const handleTryItFree = () => {
    if (userId) {
      router.push("/dashboard");
    } else {
      openSignUp({
        fallbackRedirectUrl: "/dashboard",
        forceRedirectUrl: "/dashboard",
      });
    }
  };

  const scrollToDemo = () => {
    document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0a] text-neutral-900 dark:text-neutral-100 relative overflow-hidden font-sans selection:bg-indigo-500/30 selection:text-indigo-600 dark:selection:text-indigo-200 transition-colors">
      
      {/* ── Background Glow Blobs ────────────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <motion.div
          animate={{
            x: [0, 50, 0],
            y: [0, -30, 0],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[140px]"
        />
        <motion.div
          animate={{
            x: [0, -40, 0],
            y: [0, 40, 0],
          }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[35%] right-[10%] w-[450px] h-[450px] bg-teal-500/10 rounded-full blur-[130px]"
        />
        <motion.div
          animate={{
            x: [0, 30, 0],
            y: [0, 50, 0],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-[10%] left-[15%] w-[400px] h-[400px] bg-amber-500/10 rounded-full blur-[120px]"
        />
      </div>

      {/* ── Navbar ──────────────────────────────────────────────────────── */}
      <header className="relative z-30 w-full max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800/50">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <img src="/logo-icon.png" alt="GlassBox Logo" className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg object-contain shadow-sm" />
          <span className="text-xl sm:text-2xl font-extrabold tracking-tight text-neutral-900 dark:text-white bg-gradient-to-r from-neutral-900 dark:from-white via-neutral-600 dark:via-neutral-200 to-indigo-600 dark:to-indigo-300 bg-clip-text text-transparent">
            GlassBox
          </span>
          <span className="text-[9px] sm:text-[10px] font-mono text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider hidden xs:inline-block">
            Multi-Agent OS
          </span>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-4">
          <button
            onClick={scrollToDemo}
            className="text-xs font-semibold text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors hidden md:block"
          >
            Product Demo
          </button>
          <button
            onClick={() => router.push("/leaderboard")}
            className="text-xs font-semibold text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors hidden md:block"
          >
            Leaderboard
          </button>
          <button
            onClick={() => router.push("/templates")}
            className="text-xs font-semibold text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors hidden md:block"
          >
            Templates
          </button>

          <ThemeToggle />
          
          <button
            onClick={handleTryItFree}
            className="hidden sm:inline-flex bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all duration-200 shadow-lg shadow-indigo-600/25 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98]"
          >
            {userId ? "Go to Dashboard" : "Try it for free"}
          </button>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Navigation Menu"
            className="md:hidden p-2 rounded-xl bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile Slide-down Glass Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="absolute top-full left-0 right-0 z-40 bg-white/95 dark:bg-[#0d0d0f]/95 backdrop-blur-xl border-b border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden md:hidden"
            >
              <div className="p-5 flex flex-col gap-3">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    scrollToDemo();
                  }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200/60 dark:border-neutral-800/60 text-left font-semibold text-sm text-neutral-800 dark:text-neutral-200 active:scale-[0.98] transition-all"
                >
                  <Play size={16} className="text-teal-500" />
                  Product Demo
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    router.push("/leaderboard");
                  }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200/60 dark:border-neutral-800/60 text-left font-semibold text-sm text-neutral-800 dark:text-neutral-200 active:scale-[0.98] transition-all"
                >
                  <Trophy size={16} className="text-amber-500" />
                  Community Leaderboard
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    router.push("/templates");
                  }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200/60 dark:border-neutral-800/60 text-left font-semibold text-sm text-neutral-800 dark:text-neutral-200 active:scale-[0.98] transition-all"
                >
                  <Layers size={16} className="text-indigo-500" />
                  Public Templates Gallery
                </button>

                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleTryItFree();
                  }}
                  className="w-full mt-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm py-3 px-4 rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                >
                  <span>{userId ? "Go to Dashboard" : "Try it for free"}</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Live Counter Strip */}
      <LiveCounter />
      <ActivityFeed />

      {/* ── Hero Section ────────────────────────────────────────────────── */}
      <section className="relative z-10 pt-20 pb-16 sm:pt-28 sm:pb-24 px-6 max-w-5xl mx-auto text-center flex flex-col items-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-teal-500/10 border border-indigo-500/30 rounded-full px-4 py-1.5 mb-8 shadow-inner"
        >
          <Sparkles size={14} className="text-indigo-400 animate-pulse" />
          <span className="text-xs font-bold tracking-wider text-indigo-300 uppercase">
            Time-Travel Debugger for Multi-Agent AI
          </span>
        </motion.div>

        {/* Oversized Gen-Z Spotify-bold Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-5xl sm:text-7xl lg:text-8xl font-black text-neutral-900 dark:text-white tracking-tight leading-[1.02] mb-6 max-w-4xl"
        >
          See exactly how your AI thinks.{" "}
          <span className="bg-gradient-to-r from-indigo-400 via-teal-300 to-amber-300 bg-clip-text text-transparent">
            Fix it in one click.
          </span>
        </motion.h1>

        {/* Claude-style restrained sub-headline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-lg sm:text-xl text-neutral-600 dark:text-neutral-400 max-w-2xl leading-relaxed mb-10 font-normal"
        >
          Watch every step your AI agents take. Catch mistakes. Replay just the part that broke without starting over.
        </motion.p>

        {/* Primary & Secondary CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto"
        >
          <button
            onClick={handleTryItFree}
            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-base px-8 py-4 rounded-2xl transition-all duration-200 shadow-[0_0_35px_-5px_rgba(99,102,241,0.5)] hover:shadow-[0_0_45px_-5px_rgba(99,102,241,0.7)] hover:scale-[1.03] active:scale-[0.97] flex items-center justify-center gap-2 group"
          >
            {userId ? "Go to Dashboard" : "Try it for free"}
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </button>

          <button
            onClick={scrollToDemo}
            className="w-full sm:w-auto border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 bg-white/60 dark:bg-neutral-900/60 hover:bg-white dark:hover:bg-neutral-900 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white font-semibold text-base px-7 py-4 rounded-2xl transition-all flex items-center justify-center gap-2"
          >
            <Play size={16} className="text-teal-400 fill-teal-400" />
            Watch it in action
          </button>
        </motion.div>

        {/* Low-friction subtext */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-4 text-xs text-neutral-500 font-mono"
        >
          No credit card required • Instant access
        </motion.p>
      </section>

      {/* ── Live Product Demo Section (Centerpiece) ────────────────────── */}
      <section id="demo" ref={demoRef} className="relative z-10 py-16 sm:py-24 px-4 sm:px-6 max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-300 text-xs font-mono uppercase tracking-wider mb-2">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
            Live Product Demo
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-white tracking-tight">
            Real-time execution graph & instant time-travel replay
          </h2>
        </div>

        {/* Floating Product Frame with Parallax Tilt */}
        <motion.div
          style={{ rotateX, scale }}
          className="perspective-1000 transition-transform duration-200 ease-out"
        >
          <LiveDemoMockup />
        </motion.div>
      </section>

      {/* ── Social Proof / Energy Section ──────────────────────────────── */}
      <section className="relative z-10 py-16 px-6 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <AnimatedStat value={1200} suffix="+" label="LLM logic errors & hallucinations caught" />
          <AnimatedStat value={40000} suffix="+" label="Tokens saved via single-node replay" />
          <AnimatedStat value={99.4} suffix="%" label="Pipeline execution trace accuracy" />
        </div>
      </section>

      {/* ── How It Works — Redesigned with Energy ──────────────────────── */}
      <section className="relative z-10 py-20 sm:py-28 px-6 max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <span className="text-xs font-mono uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
            How GlassBox Works
          </span>
          <h2 className="text-3xl sm:text-5xl font-black text-neutral-900 dark:text-white tracking-tight mt-4">
            Four steps to total agent clarity.
          </h2>
        </div>

        {/* Timeline Steps Container */}
        <div className="relative space-y-16 sm:space-y-24">
          {/* Vertical connecting line */}
          <div className="absolute left-1/2 top-8 bottom-8 -translate-x-1/2 w-0.5 bg-gradient-to-b from-indigo-500/50 via-teal-500/30 to-amber-500/50 hidden md:block" />

          {/* Step 1 */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center"
          >
            <div className="space-y-3">
              <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded border border-indigo-500/20">
                STEP 01
              </span>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-white">
                Type your goal
              </h3>
              <p className="text-neutral-600 dark:text-neutral-400 text-sm sm:text-base leading-relaxed">
                Describe any goal or task in plain English. GlassBox intelligently parses domain requirements and missing constraints.
              </p>
            </div>
            <div className="bg-white dark:bg-[#111114] border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-xl relative overflow-hidden group hover:border-indigo-500/40 transition-colors">
              <div className="flex items-center gap-3 bg-neutral-50 dark:bg-[#18181c] p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 text-xs font-mono text-neutral-800 dark:text-neutral-200">
                <Brain size={16} className="text-indigo-400 shrink-0" />
                "Plan a marketing plan for a coffee shop in Seattle..."
              </div>
            </div>
          </motion.div>

          {/* Step 2 (Reversed) */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center"
          >
            <div className="md:order-2 space-y-3">
              <span className="text-xs font-mono font-bold text-teal-400 bg-teal-500/10 px-2.5 py-1 rounded border border-teal-500/20">
                STEP 02
              </span>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-white">
                Watch it think
              </h3>
              <p className="text-neutral-600 dark:text-neutral-400 text-sm sm:text-base leading-relaxed">
                Watch Planner, Worker, and Aggregator nodes render in real-time with glowing execution edges and live status badges.
              </p>
            </div>
            <div className="md:order-1 bg-white dark:bg-[#111114] border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-xl relative overflow-hidden group hover:border-teal-500/40 transition-colors">
              <div className="flex items-center justify-between text-xs bg-teal-50 dark:bg-teal-950/30 border border-teal-500/30 p-3 rounded-xl">
                <span className="font-semibold text-teal-700 dark:text-teal-300 flex items-center gap-2">
                  <Zap size={14} /> Planner → Worker #1 → Aggregator
                </span>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                  Active Graph
                </span>
              </div>
            </div>
          </motion.div>

          {/* Step 3 */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center"
          >
            <div className="space-y-3">
              <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/20">
                STEP 03
              </span>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-white">
                Click into any step
              </h3>
              <p className="text-neutral-600 dark:text-neutral-400 text-sm sm:text-base leading-relaxed">
                Inspect raw LLM JSON outputs, system prompts, tool call parameters, token counts, and execution timestamps instantly.
              </p>
            </div>
            <div className="bg-white dark:bg-[#111114] border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-xl relative overflow-hidden group hover:border-amber-500/40 transition-colors">
              <div className="bg-neutral-50 dark:bg-[#18181a] border border-neutral-200 dark:border-neutral-800 p-3 rounded-xl font-mono text-xs text-amber-600 dark:text-amber-300">
                <span className="text-neutral-500 block text-[10px]">INSPECT NODE #14</span>
                {"{ \"target_audience\": \"Young Professionals\" }"}
              </div>
            </div>
          </motion.div>

          {/* Step 4 (Reversed) */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center"
          >
            <div className="md:order-2 space-y-3">
              <span className="text-xs font-mono font-bold text-purple-400 bg-purple-500/10 px-2.5 py-1 rounded border border-purple-500/20">
                STEP 04
              </span>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-neutral-900 dark:text-white">
                Fix it, instantly
              </h3>
              <p className="text-neutral-600 dark:text-neutral-400 text-sm sm:text-base leading-relaxed">
                Edit any step's output or prompt directly in the drawer and hit Replay. Only downstream dependent nodes re-run!
              </p>
            </div>
            <div className="md:order-1 bg-white dark:bg-[#111114] border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-xl relative overflow-hidden group hover:border-purple-500/40 transition-colors">
              <div className="flex items-center justify-between text-xs bg-purple-50 dark:bg-purple-950/30 border border-purple-500/30 p-3 rounded-xl">
                <span className="font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-2">
                  <RotateCcw size={14} /> Replaying node #14 downstream
                </span>
                <span className="text-[10px] font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">
                  Saved 3,200 tokens
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Feature Grid ────────────────────────────────────────────────── */}
      <section className="relative z-10 py-20 px-6 max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-5xl font-black text-neutral-900 dark:text-white tracking-tight">
            Built for developers who demand total control.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Feature 1 */}
          <motion.div
            whileHover={{ y: -5 }}
            className="p-6 bg-white dark:bg-[#111114] border border-neutral-200 dark:border-neutral-800/80 rounded-2xl hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/10 transition-all group"
          >
            <div className="p-3 w-fit rounded-xl bg-indigo-500/10 text-indigo-400 mb-4 group-hover:scale-110 group-hover:rotate-3 transition-transform">
              <RotateCcw size={20} />
            </div>
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">Time-Travel Replay</h3>
            <p className="text-neutral-600 dark:text-neutral-400 text-sm leading-relaxed">
              Modify broken steps and rerun only affected downstream agents without burning extra API tokens.
            </p>
          </motion.div>

          {/* Feature 2 */}
          <motion.div
            whileHover={{ y: -5 }}
            className="p-6 bg-white dark:bg-[#111114] border border-neutral-200 dark:border-neutral-800/80 rounded-2xl hover:border-teal-500/50 hover:shadow-xl hover:shadow-teal-500/10 transition-all group"
          >
            <div className="p-3 w-fit rounded-xl bg-teal-500/10 text-teal-400 mb-4 group-hover:scale-110 group-hover:-rotate-3 transition-transform">
              <HelpCircle size={20} />
            </div>
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">Interactive Clarification</h3>
            <p className="text-neutral-600 dark:text-neutral-400 text-sm leading-relaxed">
              Planner agent dynamically generates domain-agnostic clarifying questions before subtask execution.
            </p>
          </motion.div>

          {/* Feature 3 */}
          <motion.div
            whileHover={{ y: -5 }}
            className="p-6 bg-white dark:bg-[#111114] border border-neutral-200 dark:border-neutral-800/80 rounded-2xl hover:border-amber-500/50 hover:shadow-xl hover:shadow-amber-500/10 transition-all group"
          >
            <div className="p-3 w-fit rounded-xl bg-amber-500/10 text-amber-400 mb-4 group-hover:scale-110 group-hover:rotate-3 transition-transform">
              <Eye size={20} />
            </div>
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">Dual View Mode</h3>
            <p className="text-neutral-600 dark:text-neutral-400 text-sm leading-relaxed">
              Toggle seamlessly between high-level executive summaries and full developer graph execution traces.
            </p>
          </motion.div>

          {/* Feature 4 */}
          <motion.div
            whileHover={{ y: -5 }}
            className="p-6 bg-white dark:bg-[#111114] border border-neutral-200 dark:border-neutral-800/80 rounded-2xl hover:border-purple-500/50 hover:shadow-xl hover:shadow-purple-500/10 transition-all group"
          >
            <div className="p-3 w-fit rounded-xl bg-purple-500/10 text-purple-400 mb-4 group-hover:scale-110 group-hover:-rotate-3 transition-transform">
              <Terminal size={20} />
            </div>
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">Full Token & Prompt Trace</h3>
            <p className="text-neutral-600 dark:text-neutral-400 text-sm leading-relaxed">
              Complete visibility into exact system prompts, raw LLM outputs, tool call parameters, and token counts.
            </p>
          </motion.div>

          {/* Feature 5 */}
          <motion.div
            whileHover={{ y: -5 }}
            className="p-6 bg-white dark:bg-[#111114] border border-neutral-200 dark:border-neutral-800/80 rounded-2xl hover:border-emerald-500/50 hover:shadow-xl hover:shadow-emerald-500/10 transition-all group"
          >
            <div className="p-3 w-fit rounded-xl bg-emerald-500/10 text-emerald-400 mb-4 group-hover:scale-110 group-hover:rotate-3 transition-transform">
              <Trophy size={20} />
            </div>
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">Leaderboard & Analytics</h3>
            <p className="text-neutral-600 dark:text-neutral-400 text-sm leading-relaxed">
              Track successful pipeline runs, replay frequencies, and execution benchmarks across your organization.
            </p>
          </motion.div>

          {/* Feature 6 */}
          <motion.div
            whileHover={{ y: -5 }}
            className="p-6 bg-white dark:bg-[#111114] border border-neutral-200 dark:border-neutral-800/80 rounded-2xl hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/10 transition-all group"
          >
            <div className="p-3 w-fit rounded-xl bg-indigo-500/10 text-indigo-400 mb-4 group-hover:scale-110 group-hover:-rotate-3 transition-transform">
              <ShieldCheck size={20} />
            </div>
            <h3 className="text-lg font-bold text-neutral-900 dark:text-white mb-2">Zero-Setup API Keys</h3>
            <p className="text-neutral-600 dark:text-neutral-400 text-sm leading-relaxed">
              Bring your own Groq API keys or run out of the box with built-in model fallbacks and resilience.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────────────── */}
      <section className="relative z-10 py-24 px-6 text-center max-w-4xl mx-auto">
        <div className="bg-gradient-to-b from-white dark:from-[#121217] to-neutral-50 dark:to-[#0a0a0c] border border-neutral-200 dark:border-neutral-800 p-10 sm:p-16 rounded-3xl relative overflow-hidden shadow-2xl shadow-indigo-500/10">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col items-center">
            <h2 className="text-4xl sm:text-6xl font-black text-neutral-900 dark:text-white tracking-tight mb-4 leading-tight">
              Ready to see what your AI is really doing?
            </h2>
            <p className="text-neutral-600 dark:text-neutral-400 text-base sm:text-lg max-w-xl mb-8 font-normal">
              Join developers building resilient, transparent, time-testable multi-agent systems with GlassBox.
            </p>

            <button
              onClick={handleTryItFree}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-lg px-9 py-4 rounded-2xl transition-all duration-200 shadow-[0_0_40px_-5px_rgba(99,102,241,0.6)] hover:shadow-[0_0_50px_-5px_rgba(99,102,241,0.8)] hover:scale-[1.03] active:scale-[0.97] flex items-center gap-2 group"
            >
              Try it for free
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </button>

            <p className="mt-4 text-xs text-neutral-500 font-mono">
              No credit card. Just your goal.
            </p>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-neutral-200 dark:border-neutral-800/60 py-10 px-6 max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-500 font-sans">
        <div className="flex items-center gap-2.5">
          <img src="/logo-icon.png" alt="GlassBox Logo" className="w-5 h-5 rounded-md object-contain" />
          <span className="font-bold text-neutral-900 dark:text-white text-base">GlassBox</span>
          <span>© 2026 GlassBox AI Inc. All rights reserved.</span>
        </div>

        <div className="flex items-center gap-6">
          <button onClick={scrollToDemo} className="hover:text-neutral-900 dark:hover:text-neutral-300 transition-colors">
            Demo
          </button>
          <button onClick={() => router.push("/leaderboard")} className="hover:text-neutral-900 dark:hover:text-neutral-300 transition-colors">
            Leaderboard
          </button>
          <button onClick={() => router.push("/settings")} className="hover:text-neutral-900 dark:hover:text-neutral-300 transition-colors">
            API Keys
          </button>
        </div>
      </footer>

      {/* Floating PWA Install Banner */}
      <AnimatePresence>
        {isInstallable && showInstallBanner && !dismissedInstallBanner && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 260, damping: 25 }}
            className="fixed bottom-6 left-6 right-6 md:left-auto md:right-6 md:w-96 z-50 p-5 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl flex flex-col gap-4 text-white font-sans"
            style={{
              boxShadow: "0 20px 40px -15px rgba(0,0,0,0.7)"
            }}
          >
            <div className="flex items-start justify-between">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 text-lg">
                  📲
                </div>
                <div className="text-left">
                  <h4 className="text-sm font-extrabold tracking-tight">Install Glassbox App</h4>
                  <p className="text-[11px] text-neutral-400 leading-relaxed mt-1">Works completely offline — access trace data instantly from desktop.</p>
                </div>
              </div>
              <button
                onClick={() => setDismissedInstallBanner(true)}
                className="text-neutral-500 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors shrink-0"
              >
                <X size={15} />
              </button>
            </div>
            <div className="flex gap-2 text-xs">
              <button
                onClick={() => setDismissedInstallBanner(true)}
                className="flex-1 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold rounded-xl transition-colors"
              >
                Maybe later
              </button>
              <button
                onClick={async () => {
                  const success = await installApp();
                  if (success) {
                    setDismissedInstallBanner(true);
                  }
                }}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-md"
              >
                Install
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}