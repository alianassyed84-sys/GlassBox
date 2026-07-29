import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Synapse Agent Run Trace Preview";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let title = "Synapse AI Agent Run";
  let status = "Completed";
  let nodeCount = 0;

  try {
    const res = await fetch(`${API_BASE}/public/runs/${id}`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      title = data.goal || title;
      status = data.status || status;
      nodeCount = Array.isArray(data.nodes) ? data.nodes.length : 0;
    }
  } catch {
    // fallback defaults if backend is unreachable at build/meta generation time
  }

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "space-between",
          backgroundColor: "#0a0a0c",
          backgroundImage: "radial-gradient(circle at 25px 25px, rgba(255, 255, 255, 0.05) 2px, transparent 0)",
          backgroundSize: "50px 50px",
          padding: "60px",
          fontFamily: "sans-serif",
          color: "#ffffff",
        }}
      >
        {/* Header Badge */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "24px",
              color: "#ffffff",
              fontWeight: "bold",
              boxShadow: "0 8px 20px rgba(99, 102, 241, 0.4)",
            }}
          >
            ⚡
          </div>
          <span style={{ fontSize: "28px", fontWeight: "700", letterSpacing: "-0.5px" }}>
            Synapse <span style={{ color: "#818cf8" }}>Agent Traces</span>
          </span>
        </div>

        {/* Card Body */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            maxWidth: "1000px",
            background: "rgba(255, 255, 255, 0.03)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "24px",
            padding: "40px",
            width: "100%",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span
              style={{
                fontSize: "16px",
                fontWeight: "600",
                color: status === "completed" ? "#34d399" : "#fbbf24",
                backgroundColor: status === "completed" ? "rgba(52, 211, 153, 0.1)" : "rgba(251, 191, 36, 0.1)",
                padding: "6px 16px",
                borderRadius: "999px",
                textTransform: "uppercase",
                letterSpacing: "1px",
              }}
            >
              {status}
            </span>
            <span style={{ fontSize: "16px", color: "#9ca3af" }}>
              • {nodeCount} Execution Step{nodeCount !== 1 ? "s" : ""}
            </span>
          </div>

          <div
            style={{
              fontSize: "38px",
              fontWeight: "800",
              lineHeight: "1.2",
              color: "#f3f4f6",
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
            }}
          >
            "{title}"
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
          <span style={{ fontSize: "20px", color: "#9ca3af" }}>
            Interactive AI Agent Execution Graph & Debugger
          </span>
          <span style={{ fontSize: "20px", color: "#818cf8", fontWeight: "600" }}>
            synapse-ai.app
          </span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
