"use client";

import React, { useState } from "react";
import {
  Train,
  Hotel,
  Utensils,
  Plane,
  MapPin,
  Clock,
  Compass,
  DollarSign,
  Calendar,
  Sparkles,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Tag,
  Sun,
  Moon,
  Info,
  Copy,
  Check,
  FileText,
} from "lucide-react";

export interface SectionItem {
  heading?: string;
  type?: "list" | "text" | "table" | string;
  content?: string | string[] | Array<{ label: string; value: string }>;
}

export interface BudgetTier {
  tier: "Budget" | "Mid-range" | "Elite" | string;
  total_cost?: string;
  accommodation?: string;
  food?: string;
  transport?: string;
  notes?: string;
}

export interface ActivityObject {
  time?: string;
  description?: string;
  activity?: string;
  cost?: string | number;
  [key: string]: unknown;
}

export interface DetailedPlanItem {
  day?: string | number;
  title?: string;
  activities?: Array<string | ActivityObject>;
}

export interface PriceEstimate {
  category: string;
  priceInr: string;
  priceUsd?: string;
  detail?: string;
}

export interface AggregatorOutput {
  title?: string;
  summary?: string;
  executive_summary?: string;
  sections?: SectionItem[];
  detailed_plan?: DetailedPlanItem[];
  budget_tiers?: BudgetTier[];
  price_estimates?: PriceEstimate[];
  total_cost_estimate?: Record<string, string | number> | string | number;
  tips?: string[];
  [key: string]: unknown;
}

export interface AggregatorResultProps {
  data: unknown;
}

export function isValidAggregatorOutput(data: unknown): data is AggregatorOutput {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.title === "string" ||
    typeof obj.summary === "string" ||
    typeof obj.executive_summary === "string" ||
    Array.isArray(obj.sections) ||
    Array.isArray(obj.detailed_plan) ||
    Array.isArray(obj.tips) ||
    Array.isArray(obj.budget_tiers)
  );
}

// ── Reading Length Control ───────────────────────────────────────────────────
function ExpandableText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 220 || text.split("\n").length > 3;

  return (
    <div className="relative">
      <p
        className={`text-xs text-neutral-700 dark:text-neutral-300 leading-relaxed font-normal ${
          !expanded && isLong ? "line-clamp-3" : ""
        }`}
      >
        {text}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1.5 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 transition-colors"
        >
          {expanded ? (
            <>
              Show less <ChevronUp size={12} />
            </>
          ) : (
            <>
              Show more <ChevronDown size={12} />
            </>
          )}
        </button>
      )}
    </div>
  );
}

// ── Price Card Component ─────────────────────────────────────────────────────
function PriceCard({
  category,
  priceInr,
  priceUsd,
  detail,
  accent = "indigo",
}: {
  category: string;
  priceInr: string;
  priceUsd?: string;
  detail?: string;
  accent?: "indigo" | "teal" | "amber" | "emerald";
}) {
  const accentClasses = {
    indigo: "border-indigo-500/20 bg-indigo-500/5 text-indigo-400",
    teal: "border-teal-500/20 bg-teal-500/5 text-teal-400",
    amber: "border-amber-500/20 bg-amber-500/5 text-amber-400",
    emerald: "border-emerald-500/20 bg-emerald-500/5 text-emerald-400",
  }[accent];

  const getIcon = (cat: string) => {
    const l = cat.toLowerCase();
    if (l.includes("train") || l.includes("rail") || l.includes("sleeper")) return <Train size={15} />;
    if (l.includes("hotel") || l.includes("stay") || l.includes("resort")) return <Hotel size={15} />;
    if (l.includes("food") || l.includes("meal") || l.includes("dining")) return <Utensils size={15} />;
    if (l.includes("flight") || l.includes("air")) return <Plane size={15} />;
    return <Tag size={15} />;
  };

  return (
    <div
      className={`p-3.5 rounded-xl border ${accentClasses} flex flex-col justify-between space-y-1.5 transition-all hover:border-indigo-500/40 shadow-sm`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
          {getIcon(category)}
          {category}
        </span>
      </div>
      <div>
        <div className="text-base font-extrabold text-neutral-900 dark:text-white flex items-baseline gap-1.5">
          <span>{priceInr}</span>
          {priceUsd && <span className="text-xs font-normal text-neutral-500 dark:text-neutral-400">({priceUsd})</span>}
        </div>
        {detail && <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 leading-snug">{detail}</p>}
      </div>
    </div>
  );
}

// ── Timeline Itinerary Component ─────────────────────────────────────────────
function TimelineItinerary({ activities }: { activities: Array<string | ActivityObject> }) {
  return (
    <div className="relative pl-5 border-l-2 border-indigo-500/30 dark:border-indigo-500/20 space-y-5 my-4">
      {activities.map((act, idx) => {
        let time = "Activity";
        let title = "";
        let desc = "";
        let icon = <MapPin size={14} className="text-indigo-400" />;

        if (typeof act === "string") {
          desc = act;
          const lower = act.toLowerCase();
          if (lower.includes("morning")) {
            time = "🌅 Morning";
            icon = <Sun size={14} className="text-amber-400" />;
          } else if (lower.includes("afternoon")) {
            time = "🌞 Afternoon";
            icon = <Sun size={14} className="text-amber-500" />;
          } else if (lower.includes("evening") || lower.includes("night")) {
            time = "<ctrl42> Evening";
            icon = <Moon size={14} className="text-indigo-400" />;
          }
        } else if (typeof act === "object" && act !== null) {
          time = act.time || "Activity";
          title = act.activity || "";
          desc = act.description || JSON.stringify(act);
          const lowerTime = time.toLowerCase();
          if (lowerTime.includes("morning")) {
            icon = <Sun size={14} className="text-amber-400" />;
          } else if (lowerTime.includes("afternoon")) {
            icon = <Sun size={14} className="text-amber-500" />;
          } else if (lowerTime.includes("evening") || lowerTime.includes("night")) {
            icon = <Moon size={14} className="text-indigo-400" />;
          }
        }

        return (
          <div key={idx} className="relative group">
            {/* Timeline node dot */}
            <div className="absolute -left-[27px] top-0.5 w-3.5 h-3.5 rounded-full bg-indigo-600 border-2 border-white dark:border-[#0a0a0a] shadow-sm group-hover:scale-125 transition-transform" />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                  {icon}
                  {time}
                </span>
                {title && <span className="text-xs font-bold text-neutral-900 dark:text-white">• {title}</span>}
              </div>
              <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed pl-0.5">{desc}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Budget Tier Card ──────────────────────────────────────────────────────────
const TIER_CONFIG = {
  Budget: {
    label: "Budget",
    emoji: "🎒",
    accent: "indigo",
    badge: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
    bg: "bg-indigo-500/5 border-indigo-500/20",
  },
  "Mid-range": {
    label: "Mid-range",
    emoji: "⭐",
    accent: "teal",
    badge: "bg-teal-500/15 text-teal-400 border-teal-500/30",
    bg: "bg-teal-500/5 border-teal-500/20",
  },
  Elite: {
    label: "Elite",
    emoji: "💎",
    accent: "amber",
    badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    bg: "bg-amber-500/5 border-amber-500/20",
  },
};

function BudgetTierCard({ tier, idx }: { tier: BudgetTier; idx: number }) {
  const tierKey = (tier.tier ?? "Budget") as keyof typeof TIER_CONFIG;
  const cfg = TIER_CONFIG[tierKey] ?? TIER_CONFIG.Budget;

  return (
    <div
      key={idx}
      className={`p-4 rounded-xl border ${cfg.bg} flex flex-col justify-between gap-3 shadow-sm hover:border-indigo-500/40 transition-all`}
    >
      <div className="flex items-center justify-between">
        <span className="text-base">{cfg.emoji}</span>
        <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${cfg.badge}`}>
          {cfg.label}
        </span>
      </div>

      {tier.total_cost && (
        <div>
          <p className="text-[10px] text-neutral-500 uppercase tracking-wider mb-0.5 font-bold">Est. Total Cost</p>
          <p className="text-sm font-extrabold text-neutral-900 dark:text-white">{tier.total_cost}</p>
        </div>
      )}

      <div className="space-y-2 text-xs">
        {tier.accommodation && (
          <div>
            <p className="text-[10px] text-neutral-500 font-semibold flex items-center gap-1">🏨 Stay</p>
            <p className="text-neutral-700 dark:text-neutral-300 leading-snug">{tier.accommodation}</p>
          </div>
        )}
        {tier.food && (
          <div>
            <p className="text-[10px] text-neutral-500 font-semibold flex items-center gap-1">🍽️ Dining</p>
            <p className="text-neutral-700 dark:text-neutral-300 leading-snug">{tier.food}</p>
          </div>
        )}
        {tier.transport && (
          <div>
            <p className="text-[10px] text-neutral-500 font-semibold flex items-center gap-1">🚆 Transport</p>
            <p className="text-neutral-700 dark:text-neutral-300 leading-snug">{tier.transport}</p>
          </div>
        )}
      </div>

      {tier.notes && (
        <p className="text-[11px] text-neutral-500 italic border-t border-neutral-200 dark:border-neutral-800 pt-2 mt-1">
          {tier.notes}
        </p>
      )}
    </div>
  );
}

// ── Main Aggregator Result Component ──────────────────────────────────────────
export default function AggregatorResult({ data }: AggregatorResultProps) {
  const [copied, setCopied] = useState(false);

  if (!isValidAggregatorOutput(data)) {
    return (
      <div className="p-4 bg-neutral-900 text-neutral-200 rounded-xl space-y-2">
        <ExpandableText text={typeof data === "string" ? data : JSON.stringify(data, null, 2)} />
      </div>
    );
  }

  const parsed = data as AggregatorOutput;
  const title = parsed.title || (typeof parsed.goal === "string" ? parsed.goal : "Final Aggregated Plan");
  const summary = parsed.summary || parsed.executive_summary;
  const hasBudgetTiers = Array.isArray(parsed.budget_tiers) && parsed.budget_tiers.length > 0;

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(parsed, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-6 text-neutral-800 dark:text-neutral-200">
      {/* Title */}
      {title && (
        <div className="border-b border-neutral-200 dark:border-neutral-800 pb-3 flex items-center justify-between">
          <h2 className="text-base font-extrabold text-neutral-900 dark:text-white tracking-tight flex items-center gap-2">
            <Sparkles size={18} className="text-indigo-500" />
            {title}
          </h2>
          <button
            onClick={handleCopy}
            className="text-[11px] text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-800 transition-colors"
          >
            {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
            {copied ? "Copied" : "Copy Raw"}
          </button>
        </div>
      )}

      {/* Summary Overview */}
      {summary && (
        <div className="bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800/80 rounded-xl p-4 space-y-1.5">
          <span className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
            <Info size={13} /> Summary Overview
          </span>
          <ExpandableText text={summary} />
        </div>
      )}

      {/* Price Estimates / Budget Cards */}
      {Array.isArray(parsed.price_estimates) && parsed.price_estimates.length > 0 && (
        <div className="mt-8 pt-2">
          <div className="flex items-center gap-2 pb-2 border-b border-neutral-200 dark:border-neutral-800 mb-4">
            <DollarSign size={16} className="text-emerald-500" />
            <h3 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
              Price &amp; Budget Information
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {parsed.price_estimates.map((p, idx) => (
              <PriceCard
                key={idx}
                category={p.category}
                priceInr={p.priceInr}
                priceUsd={p.priceUsd}
                detail={p.detail}
                accent={idx % 2 === 0 ? "indigo" : "teal"}
              />
            ))}
          </div>
        </div>
      )}

      {/* Budget Tier Cards (3 Columns) */}
      {hasBudgetTiers && (
        <div className="mt-8 pt-2">
          <div className="flex items-center gap-2 pb-2 border-b border-neutral-200 dark:border-neutral-800 mb-4">
            <Compass size={16} className="text-amber-500" />
            <h3 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
              Budget Tiers
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {parsed.budget_tiers!.map((tier, idx) => (
              <BudgetTierCard key={idx} tier={tier} idx={idx} />
            ))}
          </div>
        </div>
      )}

      {/* Standard Sections */}
      {Array.isArray(parsed.sections) && parsed.sections.length > 0 && (
        <div className="space-y-6">
          {parsed.sections.map((sec, idx) => (
            <div key={idx} className="mt-8 pt-2 space-y-3">
              {sec.heading && (
                <div className="flex items-center gap-2 pb-2 border-b border-neutral-200 dark:border-neutral-800">
                  <FileText size={15} className="text-indigo-500" />
                  <h3 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
                    {sec.heading}
                  </h3>
                </div>
              )}

              {/* Text type */}
              {sec.type === "text" && typeof sec.content === "string" && <ExpandableText text={sec.content} />}

              {/* List type */}
              {(sec.type === "list" || Array.isArray(sec.content)) && Array.isArray(sec.content) && (
                <ul className="space-y-2 pl-1">
                  {(sec.content as string[]).map((item, itemIdx) => (
                    <li key={itemIdx} className="text-xs text-neutral-700 dark:text-neutral-300 flex items-start gap-2">
                      <span className="text-indigo-500 font-bold shrink-0 mt-0.5">•</span>
                      <span className="leading-relaxed">{typeof item === "string" ? item : JSON.stringify(item)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Detailed Plan (Timeline) */}
      {Array.isArray(parsed.detailed_plan) && parsed.detailed_plan.length > 0 && (
        <div className="mt-8 pt-2">
          <div className="flex items-center gap-2 pb-2 border-b border-neutral-200 dark:border-neutral-800 mb-4">
            <Calendar size={16} className="text-indigo-500" />
            <h3 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">
              Detailed Timeline &amp; Itinerary
            </h3>
          </div>
          <div className="space-y-4">
            {parsed.detailed_plan.map((dayItem, idx) => (
              <div
                key={idx}
                className="bg-white dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800/80 rounded-xl p-4 space-y-2"
              >
                <h4 className="text-xs font-extrabold text-neutral-900 dark:text-white flex items-center gap-2">
                  <Clock size={14} className="text-teal-400" />
                  {typeof dayItem.day === "number"
                    ? `Day ${dayItem.day}`
                    : dayItem.day || dayItem.title || `Phase ${idx + 1}`}
                </h4>
                {Array.isArray(dayItem.activities) && <TimelineItinerary activities={dayItem.activities} />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tips */}
      {Array.isArray(parsed.tips) && parsed.tips.length > 0 && (
        <div className="mt-8 pt-2 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 rounded-xl p-4 space-y-2.5">
          <div className="flex items-center gap-2 border-b border-amber-500/20 pb-2">
            <Sparkles size={15} className="text-amber-400" />
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Key Tips &amp; Recommendations</h3>
          </div>
          <ul className="space-y-2 pl-1">
            {parsed.tips.map((tip, tipIdx) => (
              <li key={tipIdx} className="text-xs text-neutral-700 dark:text-neutral-300 flex items-start gap-2">
                <CheckCircle2 size={14} className="text-amber-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
