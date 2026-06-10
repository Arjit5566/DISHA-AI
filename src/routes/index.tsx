import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight, Rocket, Target, Brain } from "lucide-react";
import { ClientOnly } from "@tanstack/react-router";

// other imports remain unchanged
import { CursorGlow } from "@/components/effects/CursorGlow";
import { MagneticButton } from "@/components/effects/MagneticButton";
import { ParticleField } from "@/components/effects/ParticleField";
import { HeroScene } from "@/components/three/HeroScene";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "SkillGap Analyzer — Discover Your Skill Gaps. Build Your Future." },
    { name: "description", content: "AI-powered career readiness platform. Upload your resume, pick a role, get a personalized learning roadmap." },
    { property: "og:title", content: "SkillGap Analyzer" },
    { property: "og:description", content: "Discover Your Skill Gaps. Build Your Future." },
  ]}),
  component: Landing,
});

function Landing() {
  return (
    <main suppressHydrationWarning className="relative min-h-screen overflow-hidden bg-night text-night-foreground">
      <ClientOnly fallback={null}>
        <CursorGlow />
        <div className="absolute inset-0 grid-bg-dark opacity-30" />
        <ParticleField density={50} />
      </ClientOnly>

      {/* Nav */}
      <motion.header initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.6 }}
        className="relative z-20 flex items-center justify-between px-6 py-6 md:px-12">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl gradient-primary-bg shadow-[0_0_24px_rgba(139,92,246,0.6)]">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="block text-lg font-bold leading-none tracking-tight text-white">SkillGap</span>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-primary mt-0.5">Analyzer</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/auth" search={{ tab: "login" }} className="rounded-full border border-white/20 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10">Log in</Link>
          <Link to="/auth" search={{ tab: "signup" }} className="rounded-full gradient-primary-bg px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90">Sign up</Link>
        </div>
      </motion.header>

      {/* Hero */}
      <section className="relative z-10 flex min-h-[calc(100vh-100px)] flex-col items-center justify-center px-6 pb-24 text-center">
        
        {/* 3D scene (Logo) */}
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1, duration: 1 }}
          className="relative mb-6 h-32 w-32 md:h-40 md:w-40">
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.5),transparent_60%)] blur-3xl" />
          <ClientOnly fallback={null}>
            <HeroScene />
          </ClientOnly>
        </motion.div>

        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.8 }}
          className="text-5xl font-bold tracking-tight text-white md:text-7xl">
          SkillGap
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.8 }}
          className="mt-3 text-sm font-semibold uppercase tracking-[0.4em] text-primary md:text-base">
          Analyzer
        </motion.p>

        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45, duration: 0.8 }}
          className="mt-8 text-lg text-white/80 md:text-xl">
          Discover your skill gaps.<br />
          Build your <span className="text-primary font-medium">future.</span>
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.7 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link to="/auth" search={{ tab: "login" }} className="flex items-center gap-3 rounded-2xl border border-white/20 bg-white/5 px-8 py-3.5 text-base font-medium text-white transition-colors hover:bg-white/10">
            Log in <ArrowRight className="h-4 w-4 text-white/60" />
          </Link>
          <Link to="/auth" search={{ tab: "signup" }} className="flex items-center gap-3 rounded-2xl gradient-primary-bg px-8 py-3.5 text-base font-medium text-white transition-opacity hover:opacity-90">
            Sign up <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2, duration: 1 }}
          className="absolute bottom-10 flex flex-col items-center gap-3 text-white/40">
          <div className="flex h-10 w-6 items-start justify-center rounded-full border border-white/20 p-1">
            <motion.div animate={{ y: [0, 12, 0] }} transition={{ repeat: Infinity, duration: 1.5 }} className="h-1.5 w-1.5 rounded-full bg-white/40" />
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-widest">Scroll to explore</span>
        </motion.div>
      </section>
    </main>
  );
}
