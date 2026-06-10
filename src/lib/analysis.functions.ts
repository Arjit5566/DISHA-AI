import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const AnalyzeInput = z.object({
  resumeText: z.string().min(20).max(60_000),
  targetRole: z.string().min(2).max(120),
});

type Roadmap = { week: number; title: string; objectives: string[]; outcomes: string[] }[];
type Resource = { title: string; provider: string; url: string; skill: string };

export interface AnalysisResult {
  summary: string;
  extracted_skills: string[];
  missing_skills: string[];
  readiness_score: number;
  roadmap: Roadmap;
  resources: Resource[];
}

const SYS = `You are SkillGap Analyzer, an expert career coach for tech roles.
You receive a candidate's resume text and a target role.

Return ONLY valid JSON matching this TypeScript shape (no markdown, no commentary):

{
  "summary": string,                       // 1-2 sentence resume summary
  "extracted_skills": string[],            // concrete skills found in the resume (max 25)
  "missing_skills": string[],              // important skills for the target role NOT in resume (max 12)
  "readiness_score": number,               // 0-100 readiness for target role
  "roadmap": [
    { "week": 1, "title": string, "objectives": string[], "outcomes": string[] },
    ... 4 to 6 weeks total
  ],
  "resources": [
    { "title": string, "provider": string, "url": string, "skill": string },
    ... 3 to 6 high-quality resources covering the missing skills
  ]
}

Be specific to the target role. Use real, well-known providers (Coursera, freeCodeCamp,
Kaggle, official docs, YouTube channels) with real URLs. Output strict JSON.`;

function stripFences(s: string) {
  return s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
}

export const analyzeResume = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AnalyzeInput.parse(input))
  .handler(async ({ data, context }): Promise<{ id: string; result: AnalysisResult }> => {
    const geminiKey = process.env.GEMINI_API_KEY;
    const lovableKey = process.env.LOVABLE_API_KEY;

    let parsed: AnalysisResult;

    if (geminiKey && geminiKey !== "YOUR_GEMINI_API_KEY") {
      // Use direct Google Gemini API call with the user's key
      const prompt = `Target role: ${data.targetRole}\n\n--- RESUME ---\n${data.resumeText}\n--- END RESUME ---\n\nReturn the JSON now.`;
      
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
              systemInstruction: { parts: [{ text: SYS }] },
              generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.4,
              },
            }),
          }
        );

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Gemini API error (Status ${response.status}): ${errText}`);
        }

        const resData = await response.json();
        const responseText = resData?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!responseText) {
          throw new Error("Empty response received from Gemini API");
        }

        parsed = JSON.parse(stripFences(responseText)) as AnalysisResult;
      } catch (err: unknown) {
        throw new Error("Gemini AI analysis failed: " + (err instanceof Error ? err.message : String(err)));
      }
    } else if (lovableKey) {
      // Fallback to Lovable AI Gateway if configured
      const gateway = createLovableAiGatewayProvider(lovableKey);
      const prompt = `Target role: ${data.targetRole}\n\n--- RESUME ---\n${data.resumeText}\n--- END RESUME ---\n\nReturn the JSON now.`;

      try {
        const { text } = await generateText({
          model: gateway("google/gemini-3-flash-preview"),
          system: SYS,
          prompt,
          temperature: 0.4,
        });
        parsed = JSON.parse(stripFences(text)) as AnalysisResult;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("429")) throw new Error("AI rate limit reached. Please try again in a moment.");
        if (msg.includes("402")) throw new Error("AI credits exhausted. Please add credits in Settings → Workspace.");
        throw new Error("AI analysis failed: " + msg);
      }
    } else {
      throw new Error("AI is not configured. Please add GEMINI_API_KEY to your .env file.");
    }

    // sanitize
    parsed.readiness_score = Math.max(0, Math.min(100, Math.round(parsed.readiness_score || 0)));
    parsed.extracted_skills = (parsed.extracted_skills || []).slice(0, 25);
    parsed.missing_skills = (parsed.missing_skills || []).slice(0, 12);
    parsed.roadmap = (parsed.roadmap || []).slice(0, 6);
    parsed.resources = (parsed.resources || []).slice(0, 8);
    parsed.summary = parsed.summary || "";

    const { supabase, userId } = context;
    const { data: inserted, error } = await supabase
      .from("analyses")
      .insert({
        user_id: userId,
        target_role: data.targetRole,
        resume_text: data.resumeText.slice(0, 20_000),
        extracted_skills: parsed.extracted_skills,
        missing_skills: parsed.missing_skills,
        readiness_score: parsed.readiness_score,
        roadmap: parsed.roadmap,
        resources: parsed.resources,
        summary: parsed.summary,
      })
      .select("id")
      .single();

    if (error || !inserted) throw new Error("Failed to save analysis: " + (error?.message ?? "unknown"));

    return { id: inserted.id, result: parsed };
  });

export const listMyAnalyses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("analyses")
      .select("id, target_role, readiness_score, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("analyses")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error || !row) throw new Error(error?.message ?? "Not found");
    return row;
  });

export interface JobRecommendation {
  title: string;
  type: "job" | "internship";
  companyType: string;
  salary: string;
  matchScore: number;
  matchReason: string;
  searchUrl: string;
}

const JOB_SYS = `You are a Career Matchmaker for Naukri.com.
You will receive the user's target role and their matched skills from their resume analysis.

Return ONLY valid JSON matching this TypeScript shape:
{
  "recommendations": [
    {
      "title": string,           // Exact Job Title on Naukri (e.g., "Junior Data Analyst")
      "type": "job" | "internship",
      "companyType": string,     // Type of companies hiring for this (e.g., "MNCs, Startups")
      "salary": string,          // Realistic Indian salary string (e.g., "₹4L - ₹8L PA")
      "matchScore": number,      // 0-100 score of how well their skills match this specific role
      "matchReason": string,     // 1 short sentence why they fit this role
      "searchUrl": string        // A valid naukri search URL (e.g., "https://www.naukri.com/data-analyst-jobs")
    }
  ]
}

Provide exactly 3 "job" options and 2 "internship" options tailored to their skills.`;

export const getNaukriRecommendations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ recommendations: JobRecommendation[] }> => {
    // 1. Fetch analysis to get context
    const analysis = await getAnalysis({ data: { id: data.id } });
    
    const geminiKey = process.env.GEMINI_API_KEY;
    const lovableKey = process.env.LOVABLE_API_KEY;

    const prompt = `Target Role: ${analysis.target_role}\nExtracted Skills: ${(analysis.extracted_skills as string[]).join(", ")}\nReadiness Score: ${analysis.readiness_score}\n\nGenerate Naukri recommendations based on these skills. Return JSON.`;

    let parsed: { recommendations: JobRecommendation[] } = { recommendations: [] };

    try {
      if (geminiKey && geminiKey !== "YOUR_GEMINI_API_KEY") {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              systemInstruction: { parts: [{ text: JOB_SYS }] },
              generationConfig: { responseMimeType: "application/json", temperature: 0.5 },
            }),
          }
        );
        if (!response.ok) throw new Error("Gemini API error");
        const resData = await response.json();
        const text = resData?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) parsed = JSON.parse(stripFences(text));
      } else if (lovableKey) {
        const gateway = createLovableAiGatewayProvider(lovableKey);
        const { text } = await generateText({
          model: gateway("google/gemini-3-flash-preview"),
          system: JOB_SYS,
          prompt,
          temperature: 0.5,
        });
        parsed = JSON.parse(stripFences(text));
      } else {
        throw new Error("No AI configured.");
      }
    } catch (e) {
      console.error("Job recommendation failed", e);
      // Fallback mock data if AI fails
      parsed = {
        recommendations: [
          { title: `${analysis.target_role}`, type: "job", companyType: "Top IT Companies", salary: "₹5L - ₹10L PA", matchScore: analysis.readiness_score as number, matchReason: "Direct match for your target role.", searchUrl: `https://www.naukri.com/${String(analysis.target_role).replace(/\s+/g, '-').toLowerCase()}-jobs` },
          { title: `Associate ${analysis.target_role}`, type: "job", companyType: "Mid-size Tech", salary: "₹3L - ₹6L PA", matchScore: Math.min(100, (analysis.readiness_score as number) + 10), matchReason: "Great entry-level position for your current skill set.", searchUrl: `https://www.naukri.com/associate-${String(analysis.target_role).replace(/\s+/g, '-').toLowerCase()}-jobs` },
          { title: `${analysis.target_role} Intern`, type: "internship", companyType: "Startups", salary: "₹15K - ₹30K /mo", matchScore: 95, matchReason: "Perfect for gaining hands-on experience.", searchUrl: `https://www.naukri.com/${String(analysis.target_role).replace(/\s+/g, '-').toLowerCase()}-internship-jobs` }
        ]
      };
    }
    
    return parsed;
  });

export interface AdzunaJob {
  id: string;
  title: string;
  company: string;
  location: string;
  salary: string;
  redirectUrl: string;
  created: string;
  matchScore: number;
  matchReason: string;
  type: "job" | "internship";
}

export const getAdzunaOpportunities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      analysisId: z.string().uuid(),
      country: z.string().min(2).max(3).default("in"),
    }).parse(input)
  )
  .handler(async ({ data, context }): Promise<{ opportunities: AdzunaJob[]; isMock: boolean }> => {
    const { supabase } = context;
    
    // Fetch the analysis
    const { data: analysis, error } = await supabase
      .from("analyses")
      .select("target_role, extracted_skills")
      .eq("id", data.analysisId)
      .single();
      
    if (error || !analysis) {
      throw new Error(error?.message ?? "Analysis not found");
    }

    const targetRole = analysis.target_role;
    const userSkills = (analysis.extracted_skills as string[]) || [];

    const appId = process.env.ADZUNA_APP_ID;
    const appKey = process.env.ADZUNA_APP_KEY;
    const country = data.country.toLowerCase();

    // Local function to clean HTML tags from title/description
    const cleanHtml = (text: string): string => {
      if (!text) return "";
      return text.replace(/<\/?[^>]+(>|$)/g, "").trim();
    };

    // Local function to format salary based on country
    const formatSalary = (min?: number, max?: number, c: string = "in") => {
      if (!min && !max) return "Competitive Salary";
      
      const currency = c === "in" ? "₹" : c === "us" ? "$" : c === "gb" ? "£" : "$";
      
      const formatNum = (num: number) => {
        if (c === "in") {
          if (num >= 100000) {
            return `${(num / 100000).toFixed(1)}L`;
          }
          if (num >= 1000) {
            return `${(num / 1000).toFixed(0)}k`;
          }
        } else {
          if (num >= 1000) {
            return `${(num / 1000).toFixed(0)}k`;
          }
        }
        return num.toLocaleString();
      };

      const period = c === "in" && (min || 0) < 100000 ? "/mo" : " PA";
      
      if (min && max) {
        return `${currency}${formatNum(min)} - ${currency}${formatNum(max)}${period}`;
      }
      return `${currency}${formatNum(min || max!)}${period}`;
    };

    // Local function to calculate match score
    const calculateMatch = (title: string, description: string) => {
      const t = title.toLowerCase();
      const d = description.toLowerCase();
      
      const matched = userSkills.filter(skill => {
        const s = skill.toLowerCase();
        return t.includes(s) || d.includes(s);
      });
      
      let baseScore = 55;
      const targetKeywords = targetRole.toLowerCase().split(/\s+/);
      const keywordMatches = targetKeywords.filter(kw => kw.length > 2 && t.includes(kw));
      baseScore += (keywordMatches.length / Math.max(1, targetKeywords.length)) * 20;
      
      const score = Math.min(98, Math.round(baseScore + matched.length * 8));
      const reason = matched.length > 0
        ? `Matches your skill${matched.length > 1 ? "s" : ""}: ${matched.slice(0, 3).join(", ")}`
        : `Good alignment with your target role: ${targetRole}`;
        
      return { score, reason };
    };

    // If API credentials are not set, return mock data
    if (!appId || !appKey || appId === "your_adzuna_app_id" || appKey === "your_adzuna_app_key") {
      console.log("Adzuna API keys not set. Returning high-fidelity mock data.");
      return {
        opportunities: generateMockOpportunities(targetRole, userSkills, country, formatSalary),
        isMock: true
      };
    }

    try {
      // Fetch jobs
      const jobsUrl = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?app_id=${appId}&app_key=${appKey}&what=${encodeURIComponent(targetRole)}&results_per_page=6&content-type=application/json`;
      // Fetch internships
      const internshipsUrl = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?app_id=${appId}&app_key=${appKey}&what=${encodeURIComponent(targetRole + " internship")}&results_per_page=6&content-type=application/json`;

      const [jobsRes, internshipsRes] = await Promise.all([
        fetch(jobsUrl),
        fetch(internshipsUrl)
      ]);

      const jobsData = jobsRes.ok ? await jobsRes.json() : { results: [] };
      const internshipsData = internshipsRes.ok ? await internshipsRes.json() : { results: [] };

      const opportunities: AdzunaJob[] = [];

      // Process jobs
      if (jobsData.results) {
        for (const job of jobsData.results) {
          const title = cleanHtml(job.title);
          const desc = cleanHtml(job.description);
          const { score, reason } = calculateMatch(title, desc);
          opportunities.push({
            id: job.id || String(Math.random()),
            title,
            company: job.company?.display_name || "Confidential",
            location: job.location?.display_name || "Multiple Locations",
            salary: formatSalary(job.salary_min, job.salary_max, country),
            redirectUrl: job.redirect_url,
            created: job.created || new Date().toISOString(),
            matchScore: score,
            matchReason: reason,
            type: "job"
          });
        }
      }

      // Process internships
      if (internshipsData.results) {
        for (const intern of internshipsData.results) {
          const title = cleanHtml(intern.title);
          const desc = cleanHtml(intern.description);
          const { score, reason } = calculateMatch(title, desc);
          opportunities.push({
            id: intern.id || String(Math.random()),
            title,
            company: intern.company?.display_name || "Confidential",
            location: intern.location?.display_name || "Multiple Locations",
            salary: formatSalary(intern.salary_min, intern.salary_max, country),
            redirectUrl: intern.redirect_url,
            created: intern.created || new Date().toISOString(),
            matchScore: score,
            matchReason: reason,
            type: "internship"
          });
        }
      }

      // If we got nothing from the API, fall back to mock data
      if (opportunities.length === 0) {
        return {
          opportunities: generateMockOpportunities(targetRole, userSkills, country, formatSalary),
          isMock: true
        };
      }

      // Sort by match score descending
      opportunities.sort((a, b) => b.matchScore - a.matchScore);

      return {
        opportunities,
        isMock: false
      };
    } catch (err) {
      console.error("Failed to fetch jobs from Adzuna:", err);
      return {
        opportunities: generateMockOpportunities(targetRole, userSkills, country, formatSalary),
        isMock: true
      };
    }
  });

// Helper function to generate mock opportunities when keys are not configured or request fails
function generateMockOpportunities(
  targetRole: string,
  userSkills: string[],
  country: string,
  formatSalary: (min?: number, max?: number, c?: string) => string
): AdzunaJob[] {
  const isIn = country === "in";
  
  const companyPool = isIn 
    ? ["Tata Consultancy Services", "Infosys", "Wipro", "Razorpay", "Cred", "Swiggy", "Zomato", "Jio Platforms", "Flipkart"]
    : ["Google", "Meta", "Amazon", "Microsoft", "Stripe", "Netflix", "Atlassian", "Uber", "Airbnb"];
    
  const locations = isIn
    ? ["Bengaluru, Karnataka", "Mumbai, Maharashtra", "Hyderabad, Telangana", "Gurugram, Haryana", "Pune, Maharashtra", "Remote, India"]
    : ["San Francisco, CA", "Seattle, WA", "New York, NY", "Austin, TX", "London, UK", "Remote, US"];

  const opportunities: AdzunaJob[] = [];

  // Helper to get random item
  const random = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

  // Generate 4 jobs
  const jobTitles = [
    `${targetRole}`,
    `Senior ${targetRole}`,
    `Associate ${targetRole}`,
    `Lead ${targetRole}`
  ];

  jobTitles.forEach((title, idx) => {
    const salaryMin = isIn ? 400000 + idx * 250000 : 70000 + idx * 25000;
    const salaryMax = isIn ? 800000 + idx * 350000 : 110000 + idx * 35000;
    
    // Customize match score
    let matchScore = 95 - idx * 7;
    let matchReason = "";
    if (userSkills.length > 0) {
      const skillsToShow = userSkills.slice(0, 2 + (idx % 2));
      matchReason = `Matches your skill${skillsToShow.length > 1 ? "s" : ""}: ${skillsToShow.join(", ")}`;
    } else {
      matchReason = `Good alignment with your target role of ${targetRole}`;
    }

    opportunities.push({
      id: `mock-job-${idx}`,
      title,
      company: random(companyPool),
      location: random(locations),
      salary: formatSalary(salaryMin, salaryMax, country),
      redirectUrl: "https://www.adzuna.com",
      created: new Date(Date.now() - idx * 24 * 60 * 60 * 1000).toISOString(),
      matchScore,
      matchReason,
      type: "job"
    });
  });

  // Generate 3 internships
  const internTitles = [
    `${targetRole} Intern`,
    `Graduate ${targetRole} Trainee`,
    `Summer Intern - ${targetRole}`
  ];

  internTitles.forEach((title, idx) => {
    const salaryMin = isIn ? 15000 + idx * 5000 : 2500 + idx * 500;
    const salaryMax = isIn ? 30000 + idx * 8000 : 4500 + idx * 800;
    
    let matchScore = 90 - idx * 5;
    let matchReason = "";
    if (userSkills.length > 0) {
      const skillsToShow = userSkills.slice(0, 2);
      matchReason = `Excellent chance to apply ${skillsToShow.join(" and ")}`;
    } else {
      matchReason = `Perfect gateway role for ${targetRole}`;
    }

    opportunities.push({
      id: `mock-intern-${idx}`,
      title,
      company: random(companyPool),
      location: random(locations),
      salary: formatSalary(salaryMin, salaryMax, country),
      redirectUrl: "https://www.adzuna.com",
      created: new Date(Date.now() - (idx + 1) * 24 * 60 * 60 * 1000).toISOString(),
      matchScore,
      matchReason,
      type: "internship"
    });
  });

  return opportunities;
}

