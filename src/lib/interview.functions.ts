import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/* ─── Input Schemas ─── */
const GenerateInput = z.object({
  targetRole: z.string().min(2).max(120),
});

const EvaluateInput = z.object({
  question: z.string().min(5).max(2000),
  answer: z.string().min(2).max(10000),
  targetRole: z.string().min(2).max(120),
  category: z.string().min(2).max(50),
});

/* ─── Types ─── */
export interface InterviewQuestion {
  id: string;
  question: string;
  category: "Technical" | "Behavioral" | "Situational" | "Problem Solving";
  tips: string;
}

export interface InterviewEvaluation {
  score: number; // 1-10
  strengths: string[];
  improvements: string[];
  sampleAnswer: string;
}

/* ─── System Prompts ─── */
const GENERATE_SYS = `You are an expert interview coach for tech and professional roles.
Generate exactly 8 interview questions tailored to the given target role.
Include a good mix of categories: Technical (3-4), Behavioral (2), Situational (1-2), and Problem Solving (1).

Return ONLY valid JSON matching this shape (no markdown, no commentary, no fences):

{
  "questions": [
    {
      "id": string,
      "question": string,
      "category": "Technical" | "Behavioral" | "Situational" | "Problem Solving",
      "tips": string
    }
  ]
}

Rules:
- Generate exactly 8 questions.
- Questions must be specific to the target role, not generic.
- "tips" should be a brief 1-sentence hint on how to approach the question.
- Make questions progressively harder.
- For Technical questions, ask about specific technologies, algorithms, or concepts relevant to the role.
- For Behavioral questions, use the STAR format prompts.
- Output strict JSON only.`;

const EVALUATE_SYS = `You are an expert interview evaluator. Evaluate the candidate's answer to the given interview question for the specified role.

Return ONLY valid JSON matching this shape (no markdown, no commentary, no fences):

{
  "score": number,
  "strengths": string[],
  "improvements": string[],
  "sampleAnswer": string
}

Rules:
- "score" is 1-10 where 1=terrible, 5=average, 8=good, 10=exceptional.
- "strengths" should list 2-4 specific things the candidate did well (be encouraging).
- "improvements" should list 2-4 specific, actionable suggestions.
- "sampleAnswer" should be a concise ideal answer (3-5 sentences max).
- Be fair but constructive. Even weak answers should get at least one strength noted.
- Evaluate based on relevance, depth, clarity, and role-specific knowledge.
- Output strict JSON only.`;

function stripFences(s: string) {
  return s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
}

/* ─── Server Functions ─── */

export const generateInterviewQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => GenerateInput.parse(input))
  .handler(async ({ data }): Promise<{ questions: InterviewQuestion[] }> => {
    const geminiKey = process.env.GEMINI_API_KEY;

    if (geminiKey && geminiKey !== "YOUR_GEMINI_API_KEY") {
      const prompt = `Target Role: ${data.targetRole}\n\nGenerate 8 interview questions for this role.`;

      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              systemInstruction: { parts: [{ text: GENERATE_SYS }] },
              generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.6,
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

        return JSON.parse(stripFences(text));
      } catch (err: any) {
        console.error("Gemini interview generation failed, falling back to mock", err);
        return getMockQuestions(data.targetRole);
      }
    }

    return getMockQuestions(data.targetRole);
  });

export const evaluateInterviewAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => EvaluateInput.parse(input))
  .handler(async ({ data }): Promise<InterviewEvaluation> => {
    const geminiKey = process.env.GEMINI_API_KEY;

    if (geminiKey && geminiKey !== "YOUR_GEMINI_API_KEY") {
      const prompt = `Role: ${data.targetRole}\nCategory: ${data.category}\n\nQuestion: ${data.question}\n\nCandidate's Answer: ${data.answer}\n\nEvaluate this answer.`;

      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              systemInstruction: { parts: [{ text: EVALUATE_SYS }] },
              generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.4,
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

        return JSON.parse(stripFences(text)) as InterviewEvaluation;
      } catch (err: any) {
        console.error("Gemini evaluation failed, falling back to mock", err);
        return getMockEvaluation();
      }
    }

    return getMockEvaluation();
  });

/* ─── Mock Fallbacks ─── */

function getMockQuestions(targetRole: string): { questions: InterviewQuestion[] } {
  return {
    questions: [
      {
        id: "iq1",
        question: `Explain how you would design a scalable system architecture for a ${targetRole} project.`,
        category: "Technical",
        tips: "Focus on scalability patterns, load balancing, and database choices.",
      },
      {
        id: "iq2",
        question: `What are the most important technical skills a ${targetRole} should master in 2025?`,
        category: "Technical",
        tips: "Mention specific technologies and explain why they matter.",
      },
      {
        id: "iq3",
        question: "Tell me about a time you faced a significant challenge at work or in a project. How did you overcome it?",
        category: "Behavioral",
        tips: "Use the STAR method: Situation, Task, Action, Result.",
      },
      {
        id: "iq4",
        question: `How would you debug a critical production issue in a ${targetRole} environment?`,
        category: "Technical",
        tips: "Walk through your systematic debugging process step by step.",
      },
      {
        id: "iq5",
        question: "Describe a situation where you had to work with a difficult team member. What was the outcome?",
        category: "Behavioral",
        tips: "Focus on communication, empathy, and conflict resolution.",
      },
      {
        id: "iq6",
        question: `If you were given a project with unclear requirements and a tight deadline as a ${targetRole}, how would you handle it?`,
        category: "Situational",
        tips: "Discuss prioritization, stakeholder communication, and iterative delivery.",
      },
      {
        id: "iq7",
        question: `Walk me through your approach to optimizing the performance of a slow application.`,
        category: "Problem Solving",
        tips: "Cover profiling, bottleneck identification, and iterative optimization.",
      },
      {
        id: "iq8",
        question: `What emerging trends in the ${targetRole} field excite you the most, and why?`,
        category: "Situational",
        tips: "Show passion and awareness of industry developments.",
      },
    ],
  };
}

function getMockEvaluation(): InterviewEvaluation {
  return {
    score: 7,
    strengths: [
      "Demonstrated clear communication skills",
      "Showed relevant technical knowledge",
      "Provided structured and logical response",
    ],
    improvements: [
      "Could provide more specific examples from past experience",
      "Consider mentioning metrics or measurable outcomes",
      "Try to connect your answer more directly to the role requirements",
    ],
    sampleAnswer:
      "A strong answer would include specific examples from your experience, mention relevant technologies or methodologies, and demonstrate how your approach led to measurable results. Structure your response using the STAR method for behavioral questions.",
  };
}
