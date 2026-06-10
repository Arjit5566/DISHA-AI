import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useState } from "react";
import { 
  CheckCircle2, ArrowRight, Loader2, Sparkles, ArrowLeft, Info, 
  AlertCircle, Database, FileSpreadsheet, MessageSquare, Code, 
  BarChart3, Calculator, Target, Lock, FileText, Briefcase, 
  GraduationCap, Building2, MapPin, Globe, RefreshCw, AlertTriangle 
} from "lucide-react";
import { getAnalysis, getAdzunaOpportunities } from "@/lib/analysis.functions";
import { AuthGate } from "@/components/AuthGate";
import { AppShell } from "@/components/AppShell";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/results/$id")({
  head: () => ({ meta: [{ title: "Analysis Result — SkillGap Analyzer" }] }),
  component: () => <AuthGate><Results /></AuthGate>,
});

// Helper for generic icons
function getSkillIcon(skill: string) {
  const s = skill.toLowerCase();
  if (s.includes("sql") || s.includes("data")) return <Database className="h-4 w-4" />;
  if (s.includes("excel") || s.includes("spreadsheet")) return <FileSpreadsheet className="h-4 w-4" />;
  if (s.includes("communication") || s.includes("talk")) return <MessageSquare className="h-4 w-4" />;
  if (s.includes("bi") || s.includes("tableau") || s.includes("visual")) return <BarChart3 className="h-4 w-4" />;
  if (s.includes("stat") || s.includes("math")) return <Calculator className="h-4 w-4" />;
  return <Code className="h-4 w-4" />;
}

function Results() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const fetchAnalysis = useServerFn(getAnalysis);
  const { user } = useAuth();
  
  const { data, isLoading, error } = useQuery({
    queryKey: ["analysis", id],
    queryFn: () => fetchAnalysis({ data: { id } }),
  });

  const name = (user?.user_metadata as { full_name?: string } | undefined)?.full_name || user?.email?.split("@")[0] || "there";

  const [activeTab, setActiveTab] = useState<"analysis" | "opportunities">("analysis");
  const [selectedCountry, setSelectedCountry] = useState<string>("in");
  const [subTab, setSubTab] = useState<"job" | "internship">("job");

  const fetchOpportunities = useServerFn(getAdzunaOpportunities);
  const { data: oppData, isLoading: loadingOpps, error: oppsError, refetch: refetchOpps } = useQuery({
    queryKey: ["opportunities", id, selectedCountry],
    queryFn: () => fetchOpportunities({ data: { analysisId: id, country: selectedCountry } }),
    enabled: activeTab === "opportunities",
  });

  if (isLoading) return <AppShell><div className="grid h-[60vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div></AppShell>;
  if (error || !data) return <AppShell><div className="grid h-[60vh] place-items-center text-destructive">Couldn't load results.</div></AppShell>;

  const found = (data.extracted_skills as string[]) || [];
  const missing = (data.missing_skills as string[]) || [];
  const score = data.readiness_score as number;
  const total = found.length + missing.length || 1;
  const currentPct = Math.round((found.length / total) * 100);
  const missingPct = Math.round((missing.length / total) * 100);
  
  const pieData = [
    { name: "Current Skills", value: currentPct, color: "#8B5CF6" },
    { name: "Missing Skills", value: missingPct, color: "#ef4444" },
  ];

  return (
    <AppShell>
      <div className="mb-8 flex items-start justify-between">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <button onClick={() => navigate({ to: "/dashboard" })} className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold md:text-3xl">Analysis Result</h1>
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <p className="text-primary mt-1 text-sm font-medium">{data.target_role}</p>
        </motion.div>
        
        {/* Right side 3D icon placeholder - matched from screenshot */}
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="hidden md:block relative h-24 w-24">
           <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.3),transparent_70%)] blur-2xl" />
           <div className="relative h-full w-full rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md flex items-center justify-center rotate-12 transform shadow-xl">
             <BarChart3 className="h-10 w-10 text-primary opacity-80" />
           </div>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-8">
        <h2 className="text-2xl font-bold">Great job, {name}! 👋</h2>
        <p className="mt-1 text-muted-foreground">Here's your skill gap analysis result.</p>
      </motion.div>

      {/* Sleek Tab Bar */}
      <div className="mb-8 flex border-b border-white/10">
        <button
          onClick={() => setActiveTab("analysis")}
          className={`pb-4 px-6 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === "analysis"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Skill Analysis & Roadmap
        </button>
        <button
          onClick={() => setActiveTab("opportunities")}
          className={`pb-4 px-6 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === "opportunities"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Job & Internship Matcher <Sparkles className="h-3.5 w-3.5" />
        </button>
      </div>

      {activeTab === "analysis" && (
        <>
          <div className="grid gap-6 md:grid-cols-3">
            {/* Score */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className="glass-dark relative flex flex-col items-center rounded-3xl p-6 border border-primary/20 shadow-[0_0_30px_rgba(139,92,246,0.1)]">
              <div className="absolute left-6 top-6 flex items-center gap-2 text-sm font-bold text-foreground">
                1. Career Readiness Score <Info className="h-4 w-4 text-muted-foreground" />
              </div>
              
              <div className="mt-12 flex flex-col items-center">
                <ScoreRing score={score} />
                <div className="mt-6 text-lg font-semibold text-primary">{score >= 80 ? "Excellent" : score >= 50 ? "Good" : "Needs Work"}</div>
                <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> You're on the right track!
                </div>
              </div>
            </motion.div>

            {/* Found Skills */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="glass-dark rounded-3xl p-6 border border-success/20 shadow-[0_0_30px_rgba(16,185,129,0.05)] flex flex-col h-full">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground">2. Skills Found</h3>
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>
              <div className="flex flex-col gap-3 flex-1 overflow-y-auto max-h-[250px] scrollbar-none">
                {found.length === 0 && <span className="text-sm text-muted-foreground">None detected.</span>}
                {found.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl bg-success/10 px-4 py-3 text-sm font-medium text-success ring-1 ring-success/20">
                    <div className="grid h-6 w-6 place-items-center rounded-md bg-success/20">
                      {getSkillIcon(s)}
                    </div>
                    {s}
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Missing Skills */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
              className="glass-dark rounded-3xl p-6 border border-destructive/20 shadow-[0_0_30px_rgba(239,68,68,0.05)] flex flex-col h-full">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground">3. Missing Skills</h3>
                <AlertCircle className="h-5 w-5 text-destructive" />
              </div>
              <div className="flex flex-col gap-3 flex-1 overflow-y-auto max-h-[250px] scrollbar-none">
                {missing.length === 0 && <span className="text-sm text-muted-foreground">None detected.</span>}
                {missing.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive ring-1 ring-destructive/20">
                    <div className="grid h-6 w-6 place-items-center rounded-md bg-destructive/20">
                      {getSkillIcon(s)}
                    </div>
                    {s}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Overview Row */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="mt-6 glass-dark rounded-3xl p-6 border border-white/10">
            <div className="mb-6 flex items-center gap-2 text-sm font-bold text-foreground">
              4. Skill Match Overview <Info className="h-4 w-4 text-muted-foreground" />
            </div>
            
            <div className="grid md:grid-cols-2 gap-8 items-center">
              {/* Chart area */}
              <div className="flex items-center gap-8 justify-center md:justify-start pl-4">
                <div className="h-[120px] w-[120px] relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" innerRadius={40} outerRadius={60} stroke="none">
                        {pieData.map((d, i) => <Cell key={i} fill={d.color as string} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-6">
                    <div className="flex items-center gap-2 text-sm text-foreground"><span className="h-3 w-3 rounded-full bg-primary" /> Current Skills</div>
                    <div className="text-lg font-bold text-primary">{currentPct}%</div>
                  </div>
                  <div className="flex items-center justify-between gap-6">
                    <div className="flex items-center gap-2 text-sm text-foreground"><span className="h-3 w-3 rounded-full bg-destructive" /> Missing Skills</div>
                    <div className="text-lg font-bold text-destructive">{missingPct}%</div>
                  </div>
                </div>
              </div>

              {/* Target callout */}
              <div className="flex items-center gap-4 rounded-2xl bg-white/5 p-6 border border-white/5">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/30">
                  <Target className="h-6 w-6" />
                </div>
                <div>
                  <div className="font-bold text-foreground">You're {currentPct}% aligned with your goal!</div>
                  <div className="text-sm text-muted-foreground">Keep going, you're almost there!</div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Bottom Actions */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} 
            className="mt-8 flex flex-col items-center">
            <div className="flex flex-wrap items-center justify-center gap-4">
              <button className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3.5 text-sm font-medium text-foreground transition-colors hover:bg-white/10">
                <FileText className="h-4 w-4" /> View Detailed Analysis
              </button>
              <Link to="/roadmap/$id" params={{ id }}
                className="group flex items-center gap-2 rounded-xl gradient-primary-bg px-8 py-3.5 text-sm font-medium text-white transition-all hover:opacity-90 shadow-[0_0_20px_rgba(139,92,246,0.4)] hover:-translate-y-0.5">
                Get My Personalized Roadmap <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" /> Roadmap will be tailored based on your skill gaps
            </div>
          </motion.div>
        </>
      )}

      {activeTab === "opportunities" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Country Selector & Sub-Tabs */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 bg-white/5 border border-white/10 rounded-3xl p-4">
            <div className="flex items-center gap-2 bg-black/30 border border-white/15 rounded-2xl p-1 w-full sm:w-auto justify-between sm:justify-start">
              <button
                onClick={() => setSubTab("job")}
                className={`px-5 py-2.5 text-sm font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                  subTab === "job"
                    ? "bg-primary text-white shadow-lg shadow-primary/25"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Briefcase className="h-4 w-4" /> Jobs
              </button>
              <button
                onClick={() => setSubTab("internship")}
                className={`px-5 py-2.5 text-sm font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                  subTab === "internship"
                    ? "bg-primary text-white shadow-lg shadow-primary/25"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <GraduationCap className="h-4 w-4" /> Internships
              </button>
            </div>
            
            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
              <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5">
                <Globe className="h-4 w-4 text-primary" /> Target Country:
              </span>
                <select
                  value={selectedCountry}
                  onChange={(e) => setSelectedCountry(e.target.value)}
                  className="bg-black/50 border border-white/15 rounded-2xl px-4 py-2.5 text-xs font-bold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 cursor-pointer min-w-[160px]"
                >
                  {/* Expanded country options for Adzuna API */}
                  <option value="in">🇮🇳 India (INR)</option>
                  <option value="us">🇺🇸 United States (USD)</option>
                  <option value="gb">🇬🇧 United Kingdom (GBP)</option>
                  <option value="ca">🇨🇦 Canada (CAD)</option>
                  <option value="au">🇦🇺 Australia (AUD)</option>
                  <option value="de">🇩🇪 Germany (EUR)</option>
                  <option value="fr">🇫🇷 France (EUR)</option>
                  <option value="nl">🇳🇱 Netherlands (EUR)</option>
                  <option value="sg">🇸🇬 Singapore (SGD)</option>
                  <option value="ae">🇦🇪 United Arab Emirates (AED)</option>
                  <option value="jp">🇯🇵 Japan (JPY)</option>
                  <option value="br">🇧🇷 Brazil (BRL)</option>
                  <option value="mx">🇲🇽 Mexico (MXN)</option>
                  <option value="za">🇿🇦 South Africa (ZAR)</option>
                </select>
            </div>
          </div>

          {/* Alert for Mock Data */}
          {oppData?.isMock && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-8 rounded-3xl bg-amber-500/10 border border-amber-500/20 p-5 flex items-start gap-4 shadow-xl"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500/20 text-amber-500">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-amber-500">Demo Recommendations Mode</h4>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  We are showing dynamic, high-fidelity suggestions customized to your target role and skills.
                  To see real-time job and internship postings, add your <code className="bg-black/40 px-1.5 py-0.5 rounded text-amber-500 font-mono">ADZUNA_APP_ID</code> and <code className="bg-black/40 px-1.5 py-0.5 rounded text-amber-500 font-mono">ADZUNA_APP_KEY</code> to the <code className="bg-black/40 px-1.5 py-0.5 rounded text-amber-500 font-mono">.env</code> file.
                </p>
              </div>
            </motion.div>
          )}

          {/* Loader State */}
          {loadingOpps && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="glass-dark border border-white/5 rounded-3xl p-6 h-[250px] animate-pulse flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="h-4 bg-white/10 rounded-md w-1/3" />
                      <div className="h-6 bg-white/10 rounded-full w-20" />
                    </div>
                    <div className="h-6 bg-white/10 rounded-md w-3/4" />
                    <div className="space-y-2 mt-2">
                      <div className="h-3 bg-white/10 rounded w-full" />
                      <div className="h-3 bg-white/10 rounded w-5/6" />
                    </div>
                  </div>
                  <div className="h-10 bg-white/10 rounded-xl w-full" />
                </div>
              ))}
            </div>
          )}

          {/* Error State */}
          {oppsError && (
            <div className="glass-dark border border-white/10 rounded-3xl p-12 text-center flex flex-col items-center">
              <AlertCircle className="h-12 w-12 text-destructive mb-4" />
              <h3 className="text-lg font-bold">Failed to load postings</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-6 max-w-md">An error occurred while communicating with the Adzuna API search engine.</p>
              <button
                onClick={() => refetchOpps()}
                className="flex items-center gap-2 rounded-xl gradient-primary-bg px-6 py-3 text-xs font-bold text-white shadow-lg hover:opacity-90 transition-opacity cursor-pointer"
              >
                <RefreshCw className="h-4 w-4 animate-spin" /> Retry Fetch
              </button>
            </div>
          )}

          {/* Opportunities Cards Grid */}
          {!loadingOpps && !oppsError && (
            <>
              {(() => {
                const filtered = (oppData?.opportunities || []).filter(opp => opp.type === subTab);
                
                if (filtered.length === 0) {
                  return (
                    <div className="glass-dark border border-white/10 rounded-3xl p-16 text-center">
                      <Briefcase className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-55" />
                      <h3 className="text-lg font-bold text-foreground">No matches in this region</h3>
                      <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
                        We couldn't find any listings matching "{data.target_role}" in the selected region. Try changing the target country.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {filtered.map((opp, idx) => (
                      <motion.div
                        key={opp.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="glass-dark border border-white/5 rounded-3xl p-6 flex flex-col justify-between relative overflow-hidden group hover:border-primary/40 hover:shadow-[0_0_30px_rgba(139,92,246,0.1)] transition-all duration-300"
                      >
                        <div className="absolute top-0 right-0 h-24 w-24 bg-gradient-to-br from-primary/10 to-transparent rounded-bl-full pointer-events-none group-hover:from-primary/15 transition-all duration-300" />
                        
                        <div>
                          <div className="flex items-center justify-between gap-4 mb-4">
                            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold truncate max-w-[60%]">
                              {opp.company}
                            </span>
                            <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 text-primary px-3 py-1 rounded-full text-xs font-bold shrink-0">
                              <Sparkles className="h-3 w-3" /> {opp.matchScore}% Match
                            </div>
                          </div>

                          <h4 className="text-base font-bold text-foreground line-clamp-2 group-hover:text-primary transition-colors duration-250 leading-snug">
                            {opp.title}
                          </h4>
                          
                          <div className="flex flex-col gap-2 mt-4">
                            <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                              <MapPin className="h-4 w-4 text-muted-foreground/75" />
                              <span className="truncate">{opp.location}</span>
                            </div>
                            <div className="flex items-center gap-2.5 text-xs text-white/90 font-bold">
                              <Building2 className="h-4 w-4 text-primary" />
                              <span>{opp.salary}</span>
                            </div>
                          </div>

                          <p className="text-xs text-muted-foreground mt-5 line-clamp-2 bg-white/5 rounded-2xl p-4 border border-white/5 italic relative">
                            {opp.matchReason}
                          </p>
                        </div>

                        <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground font-semibold">
                            Posted {new Date(opp.created).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </span>
                          <a
                            href={opp.redirectUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary-hover group/btn bg-primary/5 hover:bg-primary/10 border border-primary/20 rounded-xl px-4 py-2 transition-all duration-200"
                          >
                            Apply Now <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover/btn:translate-x-0.5" />
                          </a>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                );
              })()}
            </>
          )}
        </motion.div>
      )}
    </AppShell>
  );
}

function ScoreRing({ score }: { score: number }) {
  const R = 60;
  const C = 2 * Math.PI * R;
  return (
    <div className="relative grid h-40 w-40 place-items-center">
      <svg viewBox="0 0 200 200" className="-rotate-90">
        {/* Background track */}
        <circle cx="100" cy="100" r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="16" />
        {/* Progress */}
        <motion.circle cx="100" cy="100" r={R} fill="none" stroke="url(#ringGrad2)" strokeLinecap="round" strokeWidth="16"
          strokeDasharray={C} initial={{ strokeDashoffset: C }} animate={{ strokeDashoffset: C * (1 - score / 100) }}
          transition={{ duration: 1.4, ease: "easeOut" }} />
        <defs>
          <linearGradient id="ringGrad2" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute flex flex-col items-center">
        <div className="text-4xl font-bold tabular-nums text-white">{score}</div>
        <div className="text-sm font-medium text-white/50">/100</div>
      </div>
    </div>
  );
}
