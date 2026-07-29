import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "GlassBox — Time-Travel Debugger for Multi-Agent AI",
  description:
    "Watch every step your AI agents take. Catch mistakes, inspect prompts, edit outputs, and replay execution from any node in the graph.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

const clerkAppearance = {
  layout: {
    unsafe_disableDevelopmentModeWarnings: true,
  },
  elements: {
    card: "bg-white dark:bg-[#111111] border border-neutral-200 dark:border-neutral-800 shadow-xl dark:shadow-2xl rounded-2xl p-6 text-neutral-900 dark:text-white",
    headerTitle: "text-neutral-900 dark:text-white font-bold text-xl",
    headerSubtitle: "text-neutral-500 dark:text-neutral-400 text-sm",
    socialButtonsBlockButton:
      "bg-neutral-50 dark:bg-[#181818] border border-neutral-200 dark:border-neutral-800 text-neutral-900 dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors rounded-xl",
    formButtonPrimary:
      "bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl shadow-lg shadow-indigo-600/25 transition-all",
    formFieldLabel: "text-neutral-700 dark:text-neutral-200 text-xs font-medium",
    formFieldInput:
      "bg-white dark:bg-[#161616] border border-neutral-300 dark:border-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 dark:placeholder-neutral-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl",
    footerActionLink: "text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 font-medium",
    identityPreviewText: "text-neutral-700 dark:text-neutral-200",
    identityPreviewEditButton: "text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300",
    formFieldInputShowPasswordButton: "text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white",
    formFieldAction: "text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300",
    devModeBadge: "hidden text-[0px] w-0 h-0 p-0 m-0 overflow-hidden opacity-0 pointer-events-none display-none",
    footer: "bg-transparent text-neutral-500 text-xs",
    otpCodeFieldInput: "bg-[#161616] text-white border-neutral-800 text-center font-mono font-bold text-lg rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500",
  },
};

import { ThemeProvider } from "@/components/ThemeProvider";
import ToastNotification from "@/components/ToastNotification";
import PWAInitializer from "@/components/PWAInitializer";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider appearance={clerkAppearance}>
      <html lang="en" suppressHydrationWarning className={`${inter.variable} ${jetbrainsMono.variable}`}>
        <head>
          <link rel="manifest" href="/manifest.json" />
          <meta name="theme-color" content="#6366f1" />
        </head>
        <body className="bg-[#fafafa] dark:bg-[#0a0a0a] text-neutral-900 dark:text-neutral-100 antialiased font-sans selection:bg-indigo-500/30 selection:text-indigo-600 dark:selection:text-indigo-200 transition-colors duration-200">
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
            {children}
            <ToastNotification />
            <PWAInitializer />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
