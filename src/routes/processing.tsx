import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";
import { analyzeResume } from "@/lib/analysis.functions";
import { AuthGate } from "@/components/AuthGate";
import { ParticleField } from "@/components/effects/ParticleField";
import { CursorGlow } from "@/components/effects/CursorGlow";
import { ProcessingOrb } from "@/components/three/ProcessingOrb";
import { toast } from "sonner";

const STAGES = [
  { pct: 25, label: "Reading Resume" },
  { pct: 50, label: "Extracting Skills" },
  { pct: 75, label: "Comparing Skills" },
  { pct: 100, label: "Generating Roadmap" },
];

export const Route = createFileRoute("/processing")({
  head: () => ({ meta: [{ title: "Analyzing — SkillGap Analyzer" }] }),
  component: () => <AuthGate><Processing /></AuthGate>,
});

function Processing() {
  const navigate = useNavigate();
  const analyze = useServerFn(analyzeResume);
  const [progress, setProgress] = useState(8);
  const [stage, setStage] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const raw = sessionStorage.getItem("sg_pending");
    if (!raw) { navigate({ to: "/dashboard" }); return; }
    const { resumeText, targetRole } = JSON.parse(raw) as { resumeText: string; targetRole: string };

    // animate progress while AI runs
    const tick = setInterval(() => {
      setProgress((p) => {
        const next = p + (95 - p) * 0.06;
        const nextStage = next >= 75 ? 3 : next >= 50 ? 2 : next >= 25 ? 1 : 0;
        setStage(nextStage);
        return Math.min(next, 95);
      });
    }, 160);

    analyze({ data: { resumeText, targetRole } })
      .then((res) => {
        clearInterval(tick);
        setProgress(100);
        setStage(3);
        sessionStorage.removeItem("sg_pending");
        setTimeout(() => navigate({ to: "/dashboard", search: { id: res.id } }), 700);
      })
      .catch((err: Error) => {
        clearInterval(tick);
        toast.error(err.message || "Analysis failed");
        navigate({ to: "/dashboard" });
      });

    return () => clearInterval(tick);
  }, [analyze, navigate]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-night text-night-foreground">
      <CursorGlow />
      <div className="absolute inset-0 grid-bg-dark opacity-30" />
      <ParticleField density={50} />

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6">
        <div className="relative aspect-square w-[min(70vw,440px)]">
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.4),transparent_60%)] blur-3xl" />
          <ProcessingOrb />
          {/* Circular progress */}
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="92" fill="none" stroke="rgba(139,92,246,0.15)" strokeWidth="3" />
            <motion.circle cx="100" cy="100" r="92" fill="none" stroke="url(#g)" strokeWidth="3" strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 92}
              strokeDashoffset={(2 * Math.PI * 92) * (1 - progress / 100)}
              transition={{ duration: 0.4 }} />
            <defs>
              <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#8B5CF6" />
                <stop offset="100%" stopColor="#06B6D4" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <div className="mt-10 text-center">
          <div className="text-5xl font-bold tabular-nums gradient-text">{Math.round(progress)}%</div>
          <AnimatePresence mode="wait">
            <motion.div key={stage} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="mt-3 text-base text-white/80">{STAGES[stage].label}…</motion.div>
          </AnimatePresence>

          <div className="mt-6 flex items-center justify-center gap-2">
            {STAGES.map((s, i) => (
              <div key={s.label} className={`h-1.5 w-10 rounded-full transition-colors ${i <= stage ? "gradient-aurora-bg" : "bg-white/15"}`} />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
