import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const QuizInput = z.object({
  notesText: z.string().min(10).max(60_000),
  difficulty: z.string().min(2).max(20),
  questionType: z.string().min(2).max(20),
  subject: z.string().min(2).max(100),
});

export interface QuizQuestion {
  id: string;
  type: "mcq" | "true_false" | "fill_blanks";
  question: string;
  options: string[];
  answer: string;
  explanation: string;
}

export interface QuizResult {
  questions: QuizQuestion[];
  weak_topics: string[];
  suggestions: string[];
}

const QUIZ_SYS = `You are a Quiz AI engine. Generate a comprehensive quiz of 5 questions from the user's study notes.
Return ONLY valid JSON matching this TypeScript shape (do not wrap in markdown or fences, output raw JSON):

{
  "questions": [
    {
      "id": string,
      "type": "mcq" | "true_false" | "fill_blanks",
      "question": string,
      "options": string[],
      "answer": string,
      "explanation": string
    }
  ],
  "weak_topics": string[],
  "suggestions": string[]
}

Rules:
- MCQ: Provide exactly 4 options.
- True/False: Provide exactly ["True", "False"]. The answer must be "True" or "False".
- Fill Blanks: Provide 1 correct word as the answer, and options can be empty or have 4 candidate words.
- Tailor questions specifically to the notes content.`;

function stripFences(s: string) {
  return s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
}

export const generateQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => QuizInput.parse(input))
  .handler(async ({ data }): Promise<QuizResult> => {
    const geminiKey = process.env.GEMINI_API_KEY;
    const lovableKey = process.env.LOVABLE_API_KEY;

    let parsed: QuizResult;

    if (geminiKey && geminiKey !== "YOUR_GEMINI_API_KEY") {
      const prompt = `Subject: ${data.subject}\nDifficulty: ${data.difficulty}\nQuestion Type: ${data.questionType}\n\n--- STUDY NOTES ---\n${data.notesText}\n--- END STUDY NOTES ---\n\nGenerate the quiz JSON now.`;
      
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              systemInstruction: { parts: [{ text: QUIZ_SYS }] },
              generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.5,
              },
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`Gemini API error (Status ${response.status})`);
        }

        const resData = await response.json();
        const text = resData?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("Empty response");

        parsed = JSON.parse(stripFences(text)) as QuizResult;
      } catch (err: any) {
        console.error("Gemini failed, falling back to mock", err);
        parsed = getMockQuiz(data.subject, data.difficulty, data.questionType);
      }
    } else if (lovableKey) {
      const gateway = createLovableAiGatewayProvider(lovableKey);
      const prompt = `Subject: ${data.subject}\nDifficulty: ${data.difficulty}\nQuestion Type: ${data.questionType}\n\n--- STUDY NOTES ---\n${data.notesText}\n--- END STUDY NOTES ---\n\nGenerate the quiz JSON now.`;

      try {
        const { text } = await generateText({
          model: gateway("google/gemini-3-flash-preview"),
          system: QUIZ_SYS,
          prompt,
          temperature: 0.5,
        });
        parsed = JSON.parse(stripFences(text)) as QuizResult;
      } catch (err: any) {
        console.error("Lovable failed, falling back to mock", err);
        parsed = getMockQuiz(data.subject, data.difficulty, data.questionType);
      }
    } else {
      console.log("No AI keys found. Falling back to mock generator.");
      parsed = getMockQuiz(data.subject, data.difficulty, data.questionType);
    }

    return parsed;
  });

export const saveQuizResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    subject: z.string(),
    difficulty: z.string(),
    questions: z.any(),
    score: z.number(),
    totalQuestions: z.number(),
    weakTopics: z.array(z.string()),
    suggestions: z.array(z.string()),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: inserted, error } = await supabase
      .from("quizzes" as any)
      .insert({
        user_id: userId,
        subject: data.subject,
        difficulty: data.difficulty,
        questions: data.questions,
        score: data.score,
        total_questions: data.totalQuestions,
        weak_topics: data.weakTopics,
        suggestions: data.suggestions,
      } as any)
      .select("id")
      .single();

    if (error) {
      console.error("Supabase insert error, quiz will run locally", error);
      return { id: "local-only", success: false };
    }
    const evalId = (inserted as any)?.id;
    return { id: evalId ?? "unknown", success: true };
  });

export const listQuizResults = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("quizzes" as any)
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to query quizzes", error);
      return [];
    }
    return data || [];
  });

function getMockQuiz(subject: string, difficulty: string, questionType: string): QuizResult {
  const type = questionType === "mixed" ? "mcq" : questionType;
  return {
    questions: [
      {
        id: "q1",
        type: type as any,
        question: `What is the primary objective of studying ${subject}?`,
        options: type === "true_false" ? ["True", "False"] : ["To master core fundamentals", "To ignore design patterns", "To complete tests without understanding", "To avoid practical implementations"],
        answer: type === "true_false" ? "True" : "To master core fundamentals",
        explanation: `${subject} is best understood by grasping its core fundamentals first.`,
      },
      {
        id: "q2",
        type: type as any,
        question: `Which of the following is considered a key concept in ${subject}?`,
        options: type === "true_false" ? ["True", "False"] : ["Efficiency and Optimization", "Redundancy", "Ignoring Constraints", "Brute-force only"],
        answer: type === "true_false" ? "True" : "Efficiency and Optimization",
        explanation: "Efficiency is paramount in technical and computing subjects.",
      },
      {
        id: "q3",
        type: type as any,
        question: `Adaptive AI models modify quiz complexity based on user performance.`,
        options: ["True", "False"],
        answer: "True",
        explanation: "Adaptive systems dynamically adjust difficulty to match candidate knowledge.",
      },
      {
        id: "q4",
        type: type === "fill_blanks" ? "fill_blanks" : "mcq",
        question: `To build highly modular software, engineers use the SOLID ____________.`,
        options: type === "true_false" ? ["True", "False"] : ["Principles", "Libraries", "Scripts", "Compilers"],
        answer: "Principles",
        explanation: "The SOLID Principles are five design principles intended to make software designs more understandable, flexible, and maintainable.",
      },
      {
        id: "q5",
        type: "mcq",
        question: `Under ${difficulty} difficulty, which is the best approach to tackle complex tasks?`,
        options: ["Deconstruct into smaller sub-tasks", "Guess randomly", "Postpone indefinitely", "Ask external resources immediately"],
        answer: "Deconstruct into smaller sub-tasks",
        explanation: "Deconstruction allows structured problem solving under pressure.",
      }
    ],
    weak_topics: ["Structural Decomposition", "Optimization Algorithms", "Design Patterns"],
    suggestions: [
      "Review the core definitions of SOLID principles and clean architecture.",
      "Practice breaking down complicated programs into small, verifiable chunks.",
      "Re-attempt this quiz under Hard mode to test advanced comprehension."
    ]
  };
}
