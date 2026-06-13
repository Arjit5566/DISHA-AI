import { useState, useRef, useEffect, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic, MicOff, Target, ArrowRight, Loader2, CheckCircle2,
  AlertTriangle, RotateCcw, Sparkles, Clock, ChevronRight,
  Award, TrendingUp, MessageSquare, Lightbulb, Play, Square
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { generateInterviewQuestions, evaluateInterviewAnswer } from "@/lib/interview.functions";
import type { InterviewQuestion, InterviewEvaluation } from "@/lib/interview.functions";

const CATEGORY_STYLES: Record<string, { gradient: string; text: string }> = {
  Technical: { gradient: "from-blue-500/25 to-cyan-500/25", text: "text-blue-400" },
  Behavioral: { gradient: "from-emerald-500/25 to-green-500/25", text: "text-emerald-400" },
  Situational: { gradient: "from-amber-500/25 to-orange-500/25", text: "text-amber-400" },
  "Problem Solving": { gradient: "from-purple-500/25 to-violet-500/25", text: "text-purple-400" },
};

type Screen = "setup" | "loading" | "interview" | "evaluating" | "feedback" | "results";

interface QuestionResult {
  question: InterviewQuestion;
  answer: string;
  evaluation: InterviewEvaluation;
}

export default function InterviewClient() {
  const genQuestionsFn = useServerFn(generateInterviewQuestions);
  const evalAnswerFn = useServerFn(evaluateInterviewAnswer);

  const [screen, setScreen] = useState<Screen>("setup");
  const [targetRole, setTargetRole] = useState("");
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [currentEval, setCurrentEval] = useState<InterviewEvaluation | null>(null);
  const [results, setResults] = useState<QuestionResult[]>([]);
  const [speechSupported, setSpeechSupported] = useState(true);

  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) setSpeechSupported(false);
  }, []);

  useEffect(() => {
    if (screen === "interview") {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(v => v + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [screen, currentIdx]);

  const startRecording = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    let finalText = transcript;
    recognition.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript + " ";
        else interim += e.results[i][0].transcript;
      }
      setTranscript(finalText + interim);
    };
    recognition.onerror = () => { setIsRecording(false); toast.error("Microphone error. Try again."); };
    recognition.onend = () => setIsRecording(false);
    recognition.start();
    recognitionRef.current = recognition;
    setIsRecording(true);
  }, [transcript]);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    setIsRecording(false);
  }, []);

  async function handleStart() {
    if (!targetRole.trim()) { toast.error("Please enter a career role."); return; }
    setScreen("loading");
    try {
      const res = await genQuestionsFn({ data: { targetRole: targetRole.trim() } });
      setQuestions(res.questions || []);
      setCurrentIdx(0);
      setTranscript("");
      setResults([]);
      setScreen("interview");
    } catch (err) {
      toast.error("Failed to generate questions.");
      setScreen("setup");
    }
  }

  async function handleSubmitAnswer() {
    if (!transcript.trim()) { toast.error("Please provide an answer first."); return; }
    stopRecording();
    setScreen("evaluating");
    const q = questions[currentIdx];
    try {
      const evaluation = await evalAnswerFn({
        data: { question: q.question, answer: transcript.trim(), targetRole, category: q.category },
      });
      setCurrentEval(evaluation);
      setResults(prev => [...prev, { question: q, answer: transcript.trim(), evaluation }]);
      setScreen("feedback");
    } catch (err) {
      toast.error("Evaluation failed.");
      setScreen("interview");
    }
  }

  function handleNext() {
    setCurrentEval(null);
    setTranscript("");
    if (currentIdx + 1 < questions.length) {
      setCurrentIdx(currentIdx + 1);
      setScreen("interview");
    } else {
      setScreen("results");
    }
  }

  function handleRestart() {
    setScreen("setup");
    setQuestions([]);
    setResults([]);
    setCurrentIdx(0);
    setTranscript("");
    setCurrentEval(null);
  }

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const avgScore = results.length ? Math.round(results.reduce((s, r) => s + r.evaluation.score, 0) / results.length * 10) / 10 : 0;

  return (
    <AppShell>
      <div className="min-h-[80vh] relative">
        <AnimatePresence mode="wait">
          {/* ─── SETUP ─── */}
          {screen === "setup" && (
            <motion.div key="setup" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="max-w-2xl mx-auto py-12">
              <div className="text-center mb-10">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary mb-4">
                  <Mic className="h-3.5 w-3.5" /> AI Mock Interview
                </div>
                <h1 className="text-3xl font-extrabold text-foreground mb-3">Mock Interview Practice</h1>
                <p className="text-muted-foreground text-sm max-w-md mx-auto">
                  Practice role-specific interview questions with voice answers. Get instant AI feedback on each response.
                </p>
              </div>

              <motion.div
                whileHover={{ y: -4, scale: 1.01, rotateX: 1, rotateY: -1 }}
                style={{ transformStyle: "preserve-3d", perspective: 1000 }}
                className="card rounded-3xl p-8 border border-border hover:border-primary/30 hover:shadow-[0_0_25px_rgba(139,92,246,0.08)] transition-all duration-300"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-primary/25 to-violet-500/25 text-primary border border-primary/20">
                    <Target className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground">Target Career Role</h3>
                    <p className="text-xs text-muted-foreground">Questions will be tailored to this role</p>
                  </div>
                </div>

                <input
                  type="text"
                  value={targetRole}
                  onChange={e => setTargetRole(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleStart()}
                  placeholder="e.g. Full Stack Developer, Data Scientist, DevOps Engineer..."
                  className="w-full rounded-xl border border-border bg-muted px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 mb-6"
                />

                {!speechSupported && (
                  <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-2.5 text-xs text-amber-400 mb-6">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Voice input not supported in this browser. You can type your answers instead.
                  </div>
                )}

                <button
                  onClick={handleStart}
                  disabled={!targetRole.trim()}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-violet-600 px-6 py-3 text-sm font-bold text-white shadow-lg hover:shadow-primary/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Play className="h-4 w-4" /> Start Interview
                </button>
              </motion.div>
            </motion.div>
          )}

          {/* ─── LOADING ─── */}
          {screen === "loading" && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid h-[60vh] place-items-center">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">Generating interview questions for <span className="font-bold text-foreground">{targetRole}</span>...</p>
              </div>
            </motion.div>
          )}

          {/* ─── INTERVIEW ─── */}
          {screen === "interview" && questions[currentIdx] && (
            <motion.div key={`interview-${currentIdx}`} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="max-w-3xl mx-auto py-8">
              {/* Progress bar */}
              <div className="flex items-center justify-between mb-6">
                <span className="text-xs font-semibold text-muted-foreground">Question {currentIdx + 1} of {questions.length}</span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" /> {formatTime(elapsed)}
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-muted mb-8 overflow-hidden">
                <motion.div className="h-full rounded-full bg-gradient-to-r from-primary to-violet-500" initial={{ width: 0 }} animate={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }} transition={{ duration: 0.5 }} />
              </div>

              {/* Question card */}
              <motion.div
                whileHover={{ y: -2 }}
                className="card rounded-3xl p-8 border border-border mb-6"
              >
                <div className="flex items-center gap-2 mb-4">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border bg-gradient-to-r ${CATEGORY_STYLES[questions[currentIdx].category]?.gradient || "from-gray-500/25 to-gray-400/25"} ${CATEGORY_STYLES[questions[currentIdx].category]?.text || "text-gray-400"} border-current/20`}>
                    {questions[currentIdx].category}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-foreground mb-3">{questions[currentIdx].question}</h2>
                <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <Lightbulb className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-400" />
                  <span><strong>Tip:</strong> {questions[currentIdx].tips}</span>
                </p>
              </motion.div>

              {/* Answer area */}
              <div className="card rounded-3xl p-6 border border-border mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-primary" /> Your Answer
                  </h3>
                  {speechSupported && (
                    <button
                      onClick={isRecording ? stopRecording : startRecording}
                      className={`relative flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
                        isRecording
                          ? "bg-red-500/15 text-red-400 border border-red-500/30"
                          : "bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25"
                      }`}
                    >
                      {isRecording && (
                        <motion.span
                          className="absolute inset-0 rounded-xl border-2 border-red-500/40"
                          animate={{ scale: [1, 1.08, 1], opacity: [0.6, 0.2, 0.6] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        />
                      )}
                      {isRecording ? <><Square className="h-3.5 w-3.5" /> Stop Recording</> : <><Mic className="h-3.5 w-3.5" /> Record Answer</>}
                    </button>
                  )}
                </div>

                <textarea
                  value={transcript}
                  onChange={e => setTranscript(e.target.value)}
                  placeholder={speechSupported ? "Click 'Record Answer' to speak, or type here..." : "Type your answer here..."}
                  rows={5}
                  className="w-full rounded-xl border border-border bg-muted px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                />

                {isRecording && (
                  <div className="flex items-center gap-2 mt-3 text-xs text-red-400">
                    <motion.span className="h-2 w-2 rounded-full bg-red-500" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }} />
                    Listening... speak clearly
                  </div>
                )}
              </div>

              <button
                onClick={handleSubmitAnswer}
                disabled={!transcript.trim()}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-violet-600 px-6 py-3 text-sm font-bold text-white shadow-lg hover:shadow-primary/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                Submit Answer <ArrowRight className="h-4 w-4" />
              </button>
            </motion.div>
          )}

          {/* ─── EVALUATING ─── */}
          {screen === "evaluating" && (
            <motion.div key="evaluating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid h-[60vh] place-items-center">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">Evaluating your answer...</p>
              </div>
            </motion.div>
          )}

          {/* ─── FEEDBACK ─── */}
          {screen === "feedback" && currentEval && (
            <motion.div key="feedback" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="max-w-3xl mx-auto py-8">
              <div className="text-center mb-8">
                <motion.div
                  initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-gradient-to-br from-primary/20 to-violet-500/20 border-2 border-primary/30 mb-4"
                >
                  <span className="text-2xl font-extrabold text-primary">{currentEval.score}/10</span>
                </motion.div>
                <h2 className="text-xl font-bold text-foreground">Question {currentIdx + 1} Feedback</h2>
              </div>

              <div className="grid gap-4 md:grid-cols-2 mb-6">
                <div className="card rounded-2xl p-5 border border-emerald-500/20">
                  <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2 mb-3"><CheckCircle2 className="h-4 w-4" /> Strengths</h3>
                  <ul className="space-y-2">{currentEval.strengths.map((s, i) => <li key={i} className="text-xs text-muted-foreground flex gap-2"><span className="text-emerald-400 mt-0.5">•</span>{s}</li>)}</ul>
                </div>
                <div className="card rounded-2xl p-5 border border-amber-500/20">
                  <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2 mb-3"><TrendingUp className="h-4 w-4" /> Improvements</h3>
                  <ul className="space-y-2">{currentEval.improvements.map((s, i) => <li key={i} className="text-xs text-muted-foreground flex gap-2"><span className="text-amber-400 mt-0.5">•</span>{s}</li>)}</ul>
                </div>
              </div>

              <div className="card rounded-2xl p-5 border border-primary/20 mb-8">
                <h3 className="text-sm font-bold text-primary flex items-center gap-2 mb-3"><Sparkles className="h-4 w-4" /> Sample Answer</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{currentEval.sampleAnswer}</p>
              </div>

              <button
                onClick={handleNext}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-violet-600 px-6 py-3 text-sm font-bold text-white shadow-lg hover:shadow-primary/25 transition-all cursor-pointer"
              >
                {currentIdx + 1 < questions.length ? <><ChevronRight className="h-4 w-4" /> Next Question</> : <><Award className="h-4 w-4" /> View Final Results</>}
              </button>
            </motion.div>
          )}

          {/* ─── RESULTS ─── */}
          {screen === "results" && (
            <motion.div key="results" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="max-w-3xl mx-auto py-8">
              <div className="text-center mb-10">
                <motion.div
                  initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 15 }}
                  className="inline-flex items-center justify-center h-24 w-24 rounded-full bg-gradient-to-br from-primary/20 to-violet-500/20 border-2 border-primary/30 mb-4"
                >
                  <span className="text-3xl font-extrabold text-primary">{avgScore}</span>
                </motion.div>
                <h1 className="text-2xl font-extrabold text-foreground mb-2">Interview Complete!</h1>
                <p className="text-sm text-muted-foreground">Role: <span className="font-semibold text-foreground">{targetRole}</span> · {results.length} questions answered</p>
              </div>

              <div className="space-y-3 mb-8">
                {results.map((r, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                    className="card rounded-2xl p-4 border border-border flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`shrink-0 inline-flex items-center rounded-lg px-2 py-1 text-[10px] font-bold bg-gradient-to-r ${CATEGORY_STYLES[r.question.category]?.gradient} ${CATEGORY_STYLES[r.question.category]?.text}`}>
                        {r.question.category}
                      </span>
                      <span className="text-xs text-foreground truncate">{r.question.question}</span>
                    </div>
                    <span className={`shrink-0 text-sm font-extrabold ${r.evaluation.score >= 7 ? "text-emerald-400" : r.evaluation.score >= 5 ? "text-amber-400" : "text-red-400"}`}>
                      {r.evaluation.score}/10
                    </span>
                  </motion.div>
                ))}
              </div>

              <button
                onClick={handleRestart}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-violet-600 px-6 py-3 text-sm font-bold text-white shadow-lg hover:shadow-primary/25 transition-all cursor-pointer"
              >
                <RotateCcw className="h-4 w-4" /> Start New Interview
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppShell>
  );
}
