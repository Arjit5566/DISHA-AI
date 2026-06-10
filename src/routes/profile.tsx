// src/routes/profile.tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Download, Loader2, Mail, Pencil, Award, Brain, CheckCircle2, 
  FileCheck, Database, Play, Clock, Star, Flame, Trophy, Trash2,
  AlertCircle, ArrowRight, Eye, ShieldCheck, Check
} from "lucide-react";
import { listMyAnalyses, getAnalysis } from "@/lib/analysis.functions";
import { listQuizResults } from "@/lib/quiz.functions";
import { listLabEvaluations } from "@/lib/lab.functions";
import { AuthGate } from "@/components/AuthGate";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import jsPDF from "jspdf";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { ProfileScene } from "@/components/three/ProfileScene";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile — Disha AI" }] }),
  component: () => <AuthGate><Profile /></AuthGate>,
});

function Profile() {
  const { user } = useAuth();
  const list = useServerFn(listMyAnalyses);
  const fetchOne = useServerFn(getAnalysis);
  const listQuizzes = useServerFn(listQuizResults);
  const listLabs = useServerFn(listLabEvaluations);

  // Queries
  const { data: analyses, isLoading: loadingAnalyses } = useQuery({ queryKey: ["my-analyses"], queryFn: () => list() });
  const { data: quizzes, isLoading: loadingQuizzes } = useQuery({ queryKey: ["my-quizzes"], queryFn: () => listQuizzes() });
  const { data: labs, isLoading: loadingLabs } = useQuery({ queryKey: ["my-labs"], queryFn: () => listLabs() });

  // Profile data
  const fullName = (user?.user_metadata as { full_name?: string } | undefined)?.full_name || user?.email?.split("@")[0] || "User";
  const meta = (user?.user_metadata ?? {}) as Record<string, any>;
  const profilePic = meta.profilePic ?? 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80';
  const careerGoal = meta.career_goal ?? 'Full Stack Developer';
  const preferredRole = meta.preferred_role ?? 'Software Engineer';
  const linkedIn = meta.linkedin ?? '#';
  const github = meta.github ?? '#';
  const skills = meta.skills ?? [];

  // Editing state
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');

  function openEdit(field: string) {
    const meta = (user?.user_metadata as Record<string, any>) ?? {};
    setEditingValue(meta[field] ?? '');
    setEditingField(field);
  }

  async function saveEdit() {
    if (!editingField) return;
    try {
      let val: any = editingValue;
      if (editingField === 'skills') {
        val = editingValue.split(',').map(s => s.trim()).filter(Boolean);
      }
      await supabase.auth.updateUser({ data: { [editingField]: val } });
      await supabase.auth.refreshSession();
      toast.success('Profile updated');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setEditingField(null);
    }
  }

  // Stats calculation
  const latestResumeScore = analyses && analyses.length > 0 ? analyses[0].readiness_score : 0;
  const latestAtsScore = analyses && analyses.length > 0 ? Math.max(45, Math.min(95, Math.round(analyses[0].readiness_score * 0.9 + 10))) : 0;
  const avgQuizScore = quizzes && quizzes.length > 0 ? Math.round(quizzes.reduce((acc, q) => acc + ((q as any)?.score ?? 0), 0) / quizzes.length) : 0;
  const avgLabScore = labs && labs.length > 0 ? Math.round(labs.reduce((acc, l) => acc + ((l as any)?.score ?? 0), 0) / labs.length) : 0;

  // Badges lists
  const badges = [
    { name: "Resume Master", desc: "Readiness score >= 80%", earned: latestResumeScore >= 80, icon: Award, color: "text-amber-400 border-amber-400/30 bg-amber-400/10" },
    { name: "ATS Expert", desc: "ATS compatibility >= 80%", earned: latestAtsScore >= 80, icon: ShieldCheck, color: "text-cyan-400 border-cyan-400/30 bg-cyan-400/10" },
    { name: "Code Wizard", desc: "Avg Lab score >= 75%", earned: avgLabScore >= 75, icon: Database, color: "text-purple-400 border-purple-400/30 bg-purple-400/10" },
    { name: "Perfect Quizzer", desc: "Avg Quiz score >= 85%", earned: avgQuizScore >= 85, icon: Brain, color: "text-pink-400 border-pink-400/30 bg-pink-400/10" },
    { name: "Consistent Learner", desc: "Completed 3 activities", earned: ((analyses?.length || 0) + (quizzes?.length || 0) + (labs?.length || 0)) >= 3, icon: Trophy, color: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10" },
  ];

  // Learning journey steps
  const journeySteps = [
    { title: "Resume Analysis", desc: "Evaluate credentials and format parsed ATS scores.", completed: (analyses?.length || 0) > 0 },
    { title: "Skill Gap Detection", desc: "Identify technology deficits against target role requirements.", completed: (analyses?.length || 0) > 0 },
    { title: "Quiz Practice", desc: "Challenge notes comprehension with adaptive AI quizzes.", completed: (quizzes?.length || 0) > 0 },
    { title: "Lab Evaluation", desc: "Submit practical code assignments for automatic AST validation.", completed: (labs?.length || 0) > 0 },
    { title: "Career Growth", desc: "Scale up to target roles and build comprehensive PDF reports.", completed: (analyses?.length || 0) > 0 && (quizzes?.length || 0) > 0 && (labs?.length || 0) > 0 },
  ];

  const chart = (analyses ?? []).slice().reverse().map((a) => ({
    name: new Date(a.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    score: a.readiness_score,
  }));

  async function downloadPdf(id: string, role: string) {
    try {
      const a = await fetchOne({ data: { id } });
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      let y = 50;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.text("Disha AI — Performance Evaluation", 40, y);
      y += 28;
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text(`Candidate: ${fullName}`, 40, y); y += 16;
      doc.text(`Email: ${user?.email ?? ""}`, 40, y); y += 16;
      doc.text(`Target role: ${role}`, 40, y); y += 16;
      doc.text(`Readiness score: ${a.readiness_score} / 100`, 40, y); y += 24;

      if (a.summary) {
        doc.setFont("helvetica", "bold");
        doc.text("Summary", 40, y); y += 16;
        doc.setFont("helvetica", "normal");
        const lines = doc.splitTextToSize(a.summary as string, 510);
        doc.text(lines, 40, y);
        y += lines.length * 14 + 10;
      }

      const section = (title: string, items: string[]) => {
        if (y > 740) { doc.addPage(); y = 50; }
        doc.setFont("helvetica", "bold");
        doc.text(title, 40, y); y += 16;
        doc.setFont("helvetica", "normal");
        items.forEach(it => {
          if (y > 770) { doc.addPage(); y = 50; }
          const lines = doc.splitTextToSize("• " + it, 510);
          doc.text(lines, 40, y);
          y += lines.length * 14;
        });
        y += 10;
      };

      section("Skills Found", (a.extracted_skills as string[]) || []);
      section("Missing Skills", (a.missing_skills as string[]) || []);

      doc.setFont("helvetica", "bold");
      if (y > 720) { doc.addPage(); y = 50; }
      doc.text("Personalized Roadmap", 40, y); y += 16;
      doc.setFont("helvetica", "normal");
      ((a.roadmap as { week: number; title: string; objectives?: string[] }[]) || []).forEach(w => {
        if (y > 760) { doc.addPage(); y = 50; }
        doc.setFont("helvetica", "bold");
        doc.text(`Week ${w.week}: ${w.title}`, 40, y); y += 14;
        doc.setFont("helvetica", "normal");
        (w.objectives || []).forEach(o => {
          if (y > 780) { doc.addPage(); y = 50; }
          const lines = doc.splitTextToSize("• " + o, 500);
          doc.text(lines, 50, y); y += lines.length * 13;
        });
        y += 6;
      });

      doc.save(`DishaAI-Report-${role.replace(/\s+/g, "_")}.pdf`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate PDF");
    }
  }

  return (
    <AppShell>
      {/* 3D scene background */}
      <ProfileScene />

      <div className="space-y-8 max-w-5xl mx-auto py-6">
        
        {/* Header Title */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="border-b border-white/5 pb-4">
          <h1 className="text-3xl font-bold md:text-4xl">Your Profile & growth</h1>
          <p className="text-sm text-muted-foreground mt-1">Monitor credentials, quiz analytics, and achievement badges.</p>
        </motion.div>

        {/* Editing Modal */}
        {editingField && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-zinc-900 border border-white/10 p-6 rounded-2xl w-full max-w-sm">
              <h2 className="text-lg font-semibold mb-4 text-white">Edit {editingField?.replace('_', ' ').toUpperCase()}</h2>
              <input 
                type="text" 
                value={editingValue} 
                onChange={e => setEditingValue(e.target.value)} 
                placeholder={editingField === 'skills' ? 'React, TypeScript, CSS (comma separated)' : ''}
                className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-xs outline-none text-white focus:border-primary" 
              />
              <div className="flex justify-end gap-2 mt-6">
                <button onClick={() => setEditingField(null)} className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-white">Cancel</button>
                <button onClick={saveEdit} className="px-5 py-2 bg-primary hover:bg-primary/90 rounded-xl text-xs font-bold text-white">Save Changes</button>
              </div>
            </div>
          </div>
        )}

        {/* Top Grid: Personal Details & Performance Metrics */}
        <div className="grid gap-6 md:grid-cols-3">
          
          {/* Card 1: Personal Details */}
          <div className="glass-dark rounded-3xl p-6 border border-white/5 md:col-span-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Candidate Details</h3>
              </div>
              
              <div className="flex items-center gap-4 mb-6">
                <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-primary/40 shrink-0">
                  <img src={profilePic} alt="Profile" className="w-full h-full object-cover" />
                  <button className="absolute inset-0 bg-black/40 text-white opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center" onClick={() => openEdit('profilePic')}>
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="min-w-0">
                  <div className="text-base font-bold truncate text-white">{fullName}</div>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground truncate mt-0.5">
                    <Mail className="h-3 w-3" /> {user?.email}
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-white/5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Career Goal</span>
                  <div className="flex items-center gap-1.5 font-semibold text-white">
                    <span>{careerGoal}</span>
                    <button className="text-muted-foreground hover:text-white" onClick={() => openEdit('career_goal')}>
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Preferred Role</span>
                  <div className="flex items-center gap-1.5 font-semibold text-white">
                    <span>{preferredRole}</span>
                    <button className="text-muted-foreground hover:text-white" onClick={() => openEdit('preferred_role')}>
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">LinkedIn</span>
                  <div className="flex items-center gap-1.5 font-semibold text-white">
                    <a href={linkedIn} target="_blank" rel="noreferrer" className="text-primary hover:underline max-w-[150px] truncate">{linkedIn?.replace(/^https?:\/\/(www\.)?/, '') || 'Link'}</a>
                    <button className="text-muted-foreground hover:text-white" onClick={() => openEdit('linkedin')}>
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">GitHub</span>
                  <div className="flex items-center gap-1.5 font-semibold text-white">
                    <a href={github} target="_blank" rel="noreferrer" className="text-primary hover:underline max-w-[150px] truncate">{github?.replace(/^https?:\/\/(www\.)?/, '') || 'Link'}</a>
                    <button className="text-muted-foreground hover:text-white" onClick={() => openEdit('github')}>
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Skills</span>
                  <button className="text-muted-foreground hover:text-white" onClick={() => openEdit('skills')}>
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex flex-wrap gap-1 mt-1">
                  {Array.isArray(skills) && skills.length > 0 ? (
                    skills.map((s: string) => (
                      <span key={s} className="px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded text-[10px] font-semibold">{s}</span>
                    ))
                  ) : (
                    <span className="text-[10px] text-muted-foreground">No custom skills loaded</span>
                  )}
                </div>
              </div>
            </div>

            <div className="text-[9px] text-muted-foreground mt-6 pt-3 border-t border-white/5">
              Click pencil icons to edit metadata fields.
            </div>
          </div>

          {/* Card 2: Performance Statistics */}
          <div className="glass-dark rounded-3xl p-6 border border-white/5 md:col-span-2 space-y-6">
            <h3 className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Growth Statistics</h3>
            
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              
              {/* Stat 1: Resume Score */}
              <div className="p-4 bg-white/5 border border-white/5 rounded-2xl text-center">
                <Award className="h-5 w-5 text-primary mx-auto mb-2" />
                <div className="text-xl font-extrabold text-foreground">{latestResumeScore}%</div>
                <div className="text-[9px] text-muted-foreground uppercase font-bold mt-1">Resume Fit</div>
              </div>

              {/* Stat 2: ATS Score */}
              <div className="p-4 bg-white/5 border border-white/5 rounded-2xl text-center">
                <FileCheck className="h-5 w-5 text-cyan-400 mx-auto mb-2" />
                <div className="text-xl font-extrabold text-foreground">{latestAtsScore}%</div>
                <div className="text-[9px] text-muted-foreground uppercase font-bold mt-1">ATS Match</div>
              </div>

              {/* Stat 3: Quiz Score */}
              <div className="p-4 bg-white/5 border border-white/5 rounded-2xl text-center">
                <Brain className="h-5 w-5 text-pink-400 mx-auto mb-2" />
                <div className="text-xl font-extrabold text-foreground">{avgQuizScore}%</div>
                <div className="text-[9px] text-muted-foreground uppercase font-bold mt-1">Avg Quiz</div>
              </div>

              {/* Stat 4: Lab Score */}
              <div className="p-4 bg-white/5 border border-white/5 rounded-2xl text-center">
                <Database className="h-5 w-5 text-purple-400 mx-auto mb-2" />
                <div className="text-xl font-extrabold text-foreground">{avgLabScore}%</div>
                <div className="text-[9px] text-muted-foreground uppercase font-bold mt-1">Avg Lab</div>
              </div>

            </div>

            {/* Progress chart */}
            <div>
              <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-3">Resume Score Progression</div>
              <div className="h-[140px] w-full">
                {chart.length === 0 ? (
                  <div className="grid h-full place-items-center text-xs text-muted-foreground">
                    Perform a resume analysis to visualize score growth.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chart} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.08)" />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} />
                      <YAxis domain={[0, 100]} stroke="#94a3b8" fontSize={9} />
                      <Tooltip />
                      <Line type="monotone" dataKey="score" stroke="#8B5CF6" strokeWidth={2.5} dot={{ r: 4, fill: "#8B5CF6" }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

          </div>

        </div>

        {/* Middle Row: Achievements Section & Learning Journey Timeline */}
        <div className="grid gap-6 md:grid-cols-2">
          
          {/* Achievements & Badges */}
          <div className="glass-dark rounded-3xl p-6 border border-white/5 space-y-4">
            <h3 className="text-sm font-bold text-foreground">Achievements & Badges</h3>
            
            <div className="space-y-3">
              {badges.map((b) => {
                const Icon = b.icon;
                return (
                  <div 
                    key={b.name} 
                    className={`flex items-center justify-between border rounded-2xl p-3.5 transition-all ${b.earned ? b.color : "opacity-35 border-white/5 bg-white/2"}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="grid h-8 w-8 place-items-center rounded-xl bg-black/20">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-foreground">{b.name}</h4>
                        <span className="text-[9px] text-muted-foreground block mt-0.5">{b.desc}</span>
                      </div>
                    </div>

                    <div className="text-[10px] font-bold">
                      {b.earned ? (
                        <span className="flex items-center gap-1"><Check className="h-3 w-3" /> Earned</span>
                      ) : (
                        <span className="text-white/40">Locked</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Learning Journey Timeline */}
          <div className="glass-dark rounded-3xl p-6 border border-white/5 space-y-4">
            <h3 className="text-sm font-bold text-foreground">Learning Journey</h3>
            
            <div className="relative pl-6 py-1">
              <div className="absolute left-[9px] top-4 bottom-4 w-[1px] border-l border-dashed border-white/10" />
              
              <div className="space-y-4">
                {journeySteps.map((step, idx) => (
                  <div key={idx} className="relative flex gap-3.5">
                    
                    {/* Circle Dot indicator */}
                    <div className={`absolute left-[-22px] top-0.5 h-3 w-3 rounded-full border ${step.completed ? "bg-success border-success" : "bg-black border-white/20"}`} />

                    <div className="min-w-0">
                      <h4 className={`text-xs font-bold ${step.completed ? "text-foreground" : "text-white/40"}`}>{step.title}</h4>
                      <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{step.desc}</p>
                    </div>

                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>

        {/* Historical Records of Resume Evaluations */}
        <div className="glass-dark rounded-3xl p-6 border border-white/5">
          <h3 className="text-sm font-bold text-foreground mb-4">Historical Resume Evaluations</h3>
          {loadingAnalyses ? (
            <div className="flex py-6 justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : (analyses ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">
              No evaluations found. <Link to="/dashboard" className="text-primary hover:underline">Run your first analysis →</Link>
            </p>
          ) : (
            <div className="divide-y divide-white/5">
              {(analyses ?? []).map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-4 py-3 text-xs">
                  <div>
                    <div className="font-bold text-white">{a.target_role}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{new Date(a.created_at).toLocaleString()}</div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-sm font-bold text-primary">{a.readiness_score}</div>
                      <div className="text-[8px] uppercase tracking-wider text-muted-foreground">/ 100</div>
                    </div>
                    
                    <Link 
                      to="/dashboard" 
                      search={{ id: a.id }} 
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold text-muted-foreground hover:text-white transition-colors"
                    >
                      View
                    </Link>

                    <button 
                      onClick={() => downloadPdf(a.id, a.target_role)} 
                      className="inline-flex items-center gap-1 rounded-full bg-primary/20 text-primary border border-primary/20 px-3 py-1.5 text-[10px] font-bold hover:bg-primary/30 transition-colors"
                    >
                      <Download className="h-3 w-3" /> PDF
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </AppShell>
  );
}
