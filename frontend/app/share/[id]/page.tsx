import { Metadata } from "next";
import PublicRunView from "./PublicRunView";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://glassbox-9uf2.onrender.com";

interface SharePageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: SharePageProps): Promise<Metadata> {
  const { id } = await params;
  let title = "Shared AI Agent Run Trace — Synapse";
  let description = "See every step of this AI agent pipeline, inspect execution nodes, and try replaying it yourself.";

  try {
    const res = await fetch(`${API_BASE}/public/runs/${id}`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (data.goal) {
        title = `${data.goal} — Synapse Run`;
      }
    }
  } catch {
    // fallback defaults
  }

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "Synapse AI",
      images: [
        {
          url: `/share/${id}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`/share/${id}/opengraph-image`],
    },
  };
}

export default async function SharePage({ params }: SharePageProps) {
  const { id } = await params;
  return <PublicRunView runId={Number(id)} />;
}
