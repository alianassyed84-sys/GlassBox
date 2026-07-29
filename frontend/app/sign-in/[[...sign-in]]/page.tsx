import { SignIn } from "@clerk/nextjs";
import Link from "next/link";

export default function SignInPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center px-4 py-12">
      <div className="mb-8 text-center flex flex-col items-center">
        <img src="/logo-icon.png" alt="GlassBox Logo" className="w-16 h-16 rounded-2xl mb-4 object-contain shadow-lg shadow-indigo-500/10" />
        <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-4 py-1.5 mb-3">
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
          <span className="text-indigo-300 text-xs font-medium tracking-wider uppercase">
            Multi-Agent Debugger
          </span>
        </div>
        <h1 className="text-3xl font-bold text-white tracking-tight mb-2">
          Sign in to GlassBox
        </h1>
        <p className="text-sm text-neutral-400">
          Welcome back! Access your multi-agent AI pipelines.
        </p>
      </div>

      <div className="w-full max-w-md flex flex-col items-center">
        <SignIn
          path="/sign-in"
          routing="path"
          signUpUrl="/sign-up"
          forceRedirectUrl="/dashboard"
        />

        <div className="mt-6 text-center text-sm text-neutral-400">
          New to GlassBox?{" "}
          <Link
            href="/sign-up"
            className="text-indigo-400 hover:text-indigo-300 font-medium underline transition-colors"
          >
            Create an account
          </Link>
        </div>
      </div>
    </main>
  );
}
