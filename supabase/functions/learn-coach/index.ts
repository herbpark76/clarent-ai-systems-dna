import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const CLAUDE_MODEL = "claude-sonnet-5";
const DAILY_CALL_LIMIT = 30;

interface JwtPayload {
  sub: string;
  app_metadata?: { role?: string };
}

function parseJwt(token: string): JwtPayload | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload as JwtPayload;
  } catch {
    return null;
  }
}

async function callClaude(
  system: string,
  userMessage: string,
  tools: Array<{
    name: string;
    description: string;
    input_schema: Record<string, unknown>;
  }>,
  toolChoice: { type: "tool"; name: string },
  maxTokens = 4000,
): Promise<Record<string, unknown> | null> {
  if (!ANTHROPIC_API_KEY) throw new Error("Anthropic API key not configured.");

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      system,
      tools,
      tool_choice: toolChoice,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`Claude API error (${resp.status}): ${errBody.slice(0, 300)}`);
  }

  const data = await resp.json();
  const blocks: Array<{ type: string; name?: string; input?: Record<string, unknown> }> =
    data?.content ?? [];
  const toolUse = blocks.find((b) => b.type === "tool_use" && b.name === toolChoice.name);
  return toolUse?.input ?? null;
}

// ── Mode: feedback ──────────────────────────────────────
async function handleFeedback(
  supabase: ReturnType<typeof createClient>,
  callerId: string,
  isAdmin: boolean,
  body: Record<string, unknown>,
): Promise<Response> {
  const { task_title, task_description, learner_note, learner_link, resources, attachment_files, target_learner_id } =
    body as {
      task_title: string;
      task_description?: string;
      learner_note: string;
      learner_link?: string;
      resources?: Array<{ title: string; url: string; kind: string }>;
      attachment_files?: string[];
      target_learner_id?: string;
    };

  if (!task_title || !learner_note) {
    return json({ error: "task_title and learner_note are required." }, 400);
  }

  const effectiveLearnerId = isAdmin && target_learner_id ? target_learner_id : callerId;

  const resourceList = (resources || [])
    .map((r) => `- ${r.title} (${r.kind}): ${r.url}`)
    .join("\n");

  const system = `You are an AI coaching assistant for a learner training program. A learner just submitted a task. Review their submission and give constructive feedback.

Return EXACTLY:
- whats_good: 1-2 lines on what they did well
- whats_missing: 1-2 lines on what could be improved or is missing
- follow_up: ONE specific follow-up question that tests deeper understanding

Keep it encouraging but honest. Be specific to the task and their note.`;

  const tools = [{
    name: "give_feedback",
    description: "Return coaching feedback for a task submission.",
    input_schema: {
      type: "object" as const,
      properties: {
        whats_good: { type: "string" as const, description: "1-2 lines on what was done well" },
        whats_missing: { type: "string" as const, description: "1-2 lines on what's missing or could improve" },
        follow_up: { type: "string" as const, description: "One specific follow-up question" },
      },
      required: ["whats_good", "whats_missing", "follow_up"] as const,
    },
  }];

  const userMsg = `TASK: ${task_title}
${task_description ? `DESCRIPTION: ${task_description}` : ""}

LEARNER'S NOTE: ${learner_note}
${learner_link ? `LINK: ${learner_link}` : ""}
${attachment_files && attachment_files.length > 0 ? `ATTACHED FILES: ${attachment_files.join(", ")}` : ""}

RESOURCES:
${resourceList || "(none)"}`;

  const result = await callClaude(system, userMsg, tools, { type: "tool", name: "give_feedback" });

  if (!result) {
    return json({ error: "Claude did not return structured feedback." }, 502);
  }

  return json({
    whats_good: String(result.whats_good || ""),
    whats_missing: String(result.whats_missing || ""),
    follow_up: String(result.follow_up || ""),
    learner_id: effectiveLearnerId,
  });
}

// ── Mode: quiz ──────────────────────────────────────────
async function handleQuiz(
  supabase: ReturnType<typeof createClient>,
  callerId: string,
  isAdmin: boolean,
  body: Record<string, unknown>,
): Promise<Response> {
  const { action } = body as { action: "generate" | "grade" };

  if (action === "generate") {
    const { week_title, week_goal, tasks, resources, target_learner_id } = body as {
      week_title: string;
      week_goal?: string;
      tasks: Array<{ title: string; description?: string }>;
      resources?: Array<{ title: string; url: string; kind: string }>;
      target_learner_id?: string;
    };

    if (!week_title || !tasks || !Array.isArray(tasks)) {
      return json({ error: "week_title and tasks are required." }, 400);
    }

    const taskList = tasks.map((t) => `- ${t.title}${t.description ? `: ${t.description}` : ""}`).join("\n");
    const resourceList = (resources || []).map((r) => `- ${r.title} (${r.kind}): ${r.url}`).join("\n");

    const system = `You are a quiz generator for a learner training program. Generate 4 questions covering the week's tasks and resources.

MIX of question types:
- 2-3 multiple choice questions (with 4 options each, one correct)
- 1-2 short answer questions

Return as a JSON array of question objects:
- For multiple_choice: { type: "multiple_choice", question, options: [4 strings], correct_index: 0-3 }
- For short_answer: { type: "short_answer", question, reference_answer: string (for grading) }

Questions should test practical understanding, not just memorization.`;

    const tools = [{
      name: "save_quiz",
      description: "Return the 4 quiz questions.",
      input_schema: {
        type: "object" as const,
        properties: {
          questions: {
            type: "array" as const,
            items: {
              type: "object" as const,
              properties: {
                type: { type: "string" as const, enum: ["multiple_choice", "short_answer"] },
                question: { type: "string" as const },
                options: { type: "array" as const, items: { type: "string" as const }, description: "For multiple_choice only" },
                correct_index: { type: "integer" as const, description: "For multiple_choice only" },
                reference_answer: { type: "string" as const, description: "For short_answer only" },
              },
              required: ["type", "question"] as const,
            },
          },
        },
        required: ["questions"] as const,
      },
    }];

    const userMsg = `WEEK: ${week_title}
${week_goal ? `GOAL: ${week_goal}` : ""}

TASKS:
${taskList}

RESOURCES:
${resourceList || "(none)"}`;

    const result = await callClaude(system, userMsg, tools, { type: "tool", name: "save_quiz" }, 4000);

    if (!result || !Array.isArray(result.questions)) {
      return json({ error: "Claude did not return valid quiz questions." }, 502);
    }

    let questions = result.questions as Array<Record<string, unknown>>;
    if (questions.length > 4) {
      questions = questions.slice(0, 4);
    }
    while (questions.length < 4) {
      questions.push({
        type: "short_answer",
        question: `Bonus question ${questions.length + 1}: In your own words, explain a key concept from this week's material.`,
        reference_answer: "Any answer demonstrating understanding of the week's concepts.",
      });
    }

    return json({ questions });
  }

  if (action === "grade") {
    const { questions, answers, week_id, target_learner_id } = body as {
      questions: Array<{
        type: string;
        question: string;
        options?: string[];
        correct_index?: number;
        reference_answer?: string;
      }>;
      answers: Array<string>;
      week_id?: string;
      target_learner_id?: string;
    };

    if (!questions || !answers || !Array.isArray(questions) || !Array.isArray(answers)) {
      return json({ error: "questions and answers arrays are required." }, 400);
    }

    const effectiveLearnerId = isAdmin && target_learner_id ? target_learner_id : callerId;

    // Grade multiple choice deterministically, short answer via Claude
    const shortAnswerIndices: number[] = [];
    let mcCorrect = 0;
    let mcTotal = 0;

    for (let i = 0; i < questions.length; i++) {
      if (questions[i].type === "multiple_choice") {
        mcTotal++;
        if (answers[i] !== undefined && parseInt(answers[i], 10) === questions[i].correct_index) {
          mcCorrect++;
        }
      } else if (questions[i].type === "short_answer") {
        shortAnswerIndices.push(i);
      }
    }

    let saFeedback: Array<{ index: number; correct: boolean; feedback: string }> = [];

    if (shortAnswerIndices.length > 0) {
      const saContext = shortAnswerIndices.map((idx) => {
        return `Question ${idx + 1}: ${questions[idx].question}
Reference answer: ${questions[idx].reference_answer || ""}
Learner's answer: ${answers[idx] || "(blank)"}`;
      }).join("\n\n");

      const system = `You are grading short-answer quiz questions. For each, determine if the answer is correct (demonstrates understanding of the key concept) and give brief feedback (1 sentence).

Return an array of grading results, one per short-answer question, in the order they were given.`;

      const tools = [{
        name: "grade_answers",
        description: "Return grading results for short-answer questions.",
        input_schema: {
          type: "object" as const,
          properties: {
            results: {
              type: "array" as const,
              items: {
                type: "object" as const,
                properties: {
                  correct: { type: "boolean" as const },
                  feedback: { type: "string" as const, description: "1 sentence feedback" },
                },
                required: ["correct", "feedback"] as const,
              },
            },
          },
          required: ["results"] as const,
        },
      }];

      const result = await callClaude(system, saContext, tools, { type: "tool", name: "grade_answers" }, 2000);

      if (result && Array.isArray(result.results)) {
        saFeedback = (result.results as Array<{ correct: boolean; feedback: string }>).map((r, i) => ({
          index: shortAnswerIndices[i],
          correct: r.correct,
          feedback: r.feedback,
        }));
      }
    }

    // Calculate score: each question worth equal points (100 / total)
    const totalQuestions = questions.length;
    let correctCount = mcCorrect;
    for (const sa of saFeedback) {
      if (sa.correct) correctCount++;
    }
    const score = Math.round((correctCount / totalQuestions) * 100);
    const passed = score >= 75;

    // Build per-question feedback
    const questionFeedback: Array<{ question: string; correct: boolean; feedback: string }> = [];
    for (let i = 0; i < questions.length; i++) {
      const sa = saFeedback.find((s) => s.index === i);
      if (sa) {
        questionFeedback.push({ question: questions[i].question, correct: sa.correct, feedback: sa.feedback });
      } else {
        const isCorrect = parseInt(answers[i], 10) === questions[i].correct_index;
        questionFeedback.push({
          question: questions[i].question,
          correct: isCorrect,
          feedback: isCorrect ? "Correct!" : `Correct answer: ${questions[i].options?.[questions[i].correct_index ?? 0] || ""}`,
        });
      }
    }

    const overallFeedback = `You scored ${score} out of 100. ${passed ? "Great job — you passed!" : `You need 75 to pass. Review the week's materials and try again.`}`;

    // Save the attempt via service role (bypasses RLS)
    if (week_id && effectiveLearnerId) {
      // Verify week is unlocked for this learner before saving
      const { data: unlockCheck } = await supabase.rpc("lp_is_week_unlocked", {
        p_learner_id: effectiveLearnerId,
        p_week_id: week_id,
      });
      if (unlockCheck !== true) {
        return json({ error: "This week is locked. Complete the previous week first." }, 403);
      }

      const { error: insertError } = await supabase.from("lp_quiz_attempts").insert({
        learner_id: effectiveLearnerId,
        week_id,
        questions: JSON.stringify(questions),
        answers: JSON.stringify(answers),
        score,
        passed,
        feedback: overallFeedback + "\n\n" + questionFeedback.map((qf) => `Q: ${qf.question}\n${qf.correct ? "✓" : "✗"} ${qf.feedback}`).join("\n\n"),
      });
      if (insertError) {
        console.error("[learn-coach] Failed to save quiz attempt:", insertError.message);
      }
    }

    return json({ score, passed, feedback: overallFeedback, question_feedback: questionFeedback, saved: true });
  }

  return json({ error: "Invalid quiz action. Use 'generate' or 'grade'." }, 400);
}

// ── Mode: interview ─────────────────────────────────────
async function handleInterview(
  supabase: ReturnType<typeof createClient>,
  callerId: string,
  isAdmin: boolean,
  body: Record<string, unknown>,
): Promise<Response> {
  const { action } = body as { action: "question" | "grade" };

  if (action === "question") {
    const { journal_entries, approved_tasks, target_learner_id } = body as {
      journal_entries?: Array<{ entry_text: string; entry_date: string }>;
      approved_tasks?: Array<{ title: string; completion_note: string }>;
      target_learner_id?: string;
    };

    const effectiveLearnerId = isAdmin && target_learner_id ? target_learner_id : callerId;

    const journalText = (journal_entries || []).slice(0, 5)
      .map((j) => `- ${j.entry_date}: ${j.entry_text.slice(0, 200)}`)
      .join("\n");
    const approvedText = (approved_tasks || []).slice(0, 10)
      .map((t) => `- ${t.title}: ${t.completion_note.slice(0, 200)}`)
      .join("\n");

    if (!journalText && !approvedText) {
      return json({ error: "Not enough journal entries or approved tasks to generate an interview question." }, 400);
    }

    const system = `You are an interview coach for a learner in an AI systems training program. Generate ONE interview-style question drawn from the learner's own journal entries and approved task submissions.

The question should be realistic for a junior AI engineer role and should prompt the learner to reflect on their hands-on experience. Examples:
- "Tell me about an agent you built and how you knew it was working."
- "Describe a time something broke in your pipeline. How did you debug it?"

Return just the question.`;

    const tools = [{
      name: "ask_question",
      description: "Return one interview question.",
      input_schema: {
        type: "object" as const,
        properties: {
          question: { type: "string" as const, description: "One interview-style question" },
        },
        required: ["question"] as const,
      },
    }];

    const userMsg = `LEARNER'S JOURNAL ENTRIES:
${journalText || "(none)"}

LEARNER'S APPROVED TASK SUBMISSIONS:
${approvedText || "(none)"}`;

    const result = await callClaude(system, userMsg, tools, { type: "tool", name: "ask_question" }, 1000);

    if (!result) {
      return json({ error: "Claude did not return a question." }, 502);
    }

    return json({ question: String(result.question || ""), learner_id: effectiveLearnerId });
  }

  if (action === "grade") {
    const { question, answer, target_learner_id } = body as { question: string; answer: string; target_learner_id?: string };

    if (!question || !answer) {
      return json({ error: "question and answer are required." }, 400);
    }

    const effectiveLearnerId = isAdmin && target_learner_id ? target_learner_id : callerId;

    const system = `You are an interview coach. Grade the learner's answer to an interview question on three dimensions, each scored 1-5:
- clarity: How clearly and coherently did they explain their thinking?
- technical_depth: Did they demonstrate real technical understanding?
- use_of_specifics: Did they reference specific details from their own experience?

Also provide:
- feedback: 2-3 sentences of constructive feedback
- suggested_version: A stronger version of their answer (3-5 sentences) they can learn from`;

    const tools = [{
      name: "grade_interview",
      description: "Return interview answer scores and feedback.",
      input_schema: {
        type: "object" as const,
        properties: {
          scores: {
            type: "object" as const,
            properties: {
              clarity: { type: "integer" as const, minimum: 1, maximum: 5 },
              technical_depth: { type: "integer" as const, minimum: 1, maximum: 5 },
              use_of_specifics: { type: "integer" as const, minimum: 1, maximum: 5 },
            },
            required: ["clarity", "technical_depth", "use_of_specifics"] as const,
          },
          feedback: { type: "string" as const },
          suggested_version: { type: "string" as const },
        },
        required: ["scores", "feedback", "suggested_version"] as const,
      },
    }];

    const userMsg = `INTERVIEW QUESTION: ${question}

LEARNER'S ANSWER: ${answer}`;

    const result = await callClaude(system, userMsg, tools, { type: "tool", name: "grade_interview" }, 2000);

    if (!result) {
      return json({ error: "Claude did not return grading." }, 502);
    }

    // Save the practice attempt via service role (bypasses RLS)
    const { error: insertError } = await supabase.from("lp_interview_practice").insert({
      learner_id: effectiveLearnerId,
      question,
      answer: answer.trim(),
      scores: JSON.stringify(result.scores),
      feedback: String(result.feedback || ""),
    });
    if (insertError) {
      console.error("[learn-coach] Failed to save interview practice:", insertError.message);
    }

    return json({
      scores: result.scores,
      feedback: String(result.feedback || ""),
      suggested_version: String(result.suggested_version || ""),
      saved: true,
    });
  }

  return json({ error: "Invalid interview action. Use 'question' or 'grade'." }, 400);
}

function json(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── Mode: session_prep ─────────────────────────────────
async function handleSessionPrep(
  supabase: ReturnType<typeof createClient>,
  callerId: string,
  _isAdmin: boolean,
  body: Record<string, unknown>,
): Promise<Response> {
  const {
    learner_name, week_title, week_number,
    approved_tasks, submitted_tasks, overdue_tasks,
    quiz_scores, journal_questions,
  } = body as {
    learner_name?: string;
    week_title?: string;
    week_number?: number;
    approved_tasks?: Array<{ title: string; note: string }>;
    submitted_tasks?: Array<{ title: string; note: string }>;
    overdue_tasks?: Array<{ title: string; due_date: string }>;
    quiz_scores?: Array<{ week: string; score: number; passed: boolean }>;
    journal_questions?: Array<string>;
  };

  const approvedList = (approved_tasks || []).map((t) => `- ${t.title}${t.note ? `: ${t.note.slice(0, 100)}` : ""}`).join("\n") || "(none)";
  const submittedList = (submitted_tasks || []).map((t) => `- ${t.title}${t.note ? `: ${t.note.slice(0, 100)}` : ""}`).join("\n") || "(none)";
  const overdueList = (overdue_tasks || []).map((t) => `- ${t.title} (was due ${t.due_date})`).join("\n") || "(none)";
  const quizList = (quiz_scores || []).map((q) => `- Week ${q.week}: ${q.score}/100 ${q.passed ? "✓" : "✗"}`).join("\n") || "(none)";
  const journalList = (journal_questions || []).slice(0, 5).map((q) => `- ${q}`).join("\n") || "(none)";

  const system = `You are a training program assistant helping an admin prepare for a 1-on-1 session with a learner. Generate a concise, one-page session prep summary in plain text (no markdown). Structure it as:

SESSION PREP — [Learner Name] — [Date]

✅ COMPLETED & APPROVED THIS WEEK
[list tasks]

📤 SUBMITTED, AWAILING REVIEW
[list tasks]

⏰ OVERDUE
[list tasks or "None"]

📊 QUIZ SCORES
[list scores]

💬 OPEN QUESTIONS FROM JOURNAL
[list questions]

🗣️ SUGGESTED DISCUSSION TOPICS
[3 specific, actionable topics the admin should discuss, each in 1-2 sentences]

Keep it concise and practical. Use the data provided to make the discussion topics specific to what the learner has been working on.`;

  const userMsg = `LEARNER: ${learner_name || "Learner"}
WEEK: ${week_number ? `Week ${week_number}` : "Current"} — ${week_title || ""}

APPROVED THIS WEEK:
${approvedList}

SUBMITTED, AWAITING REVIEW:
${submittedList}

OVERDUE:
${overdueList}

QUIZ SCORES:
${quizList}

OPEN JOURNAL QUESTIONS:
${journalList}`;

  const tools = [{
    name: "save_prep",
    description: "Return the session prep summary.",
    input_schema: {
      type: "object" as const,
      properties: {
        summary: { type: "string" as const, description: "The full session prep text" },
      },
      required: ["summary"] as const,
    },
  }];

  const result = await callClaude(system, userMsg, tools, { type: "tool", name: "save_prep" }, 2000);

  if (!result || !result.summary) {
    return json({ error: "Claude did not return a session prep summary." }, 502);
  }

  return json({ summary: String(result.summary) });
}

// ── Main handler ────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");

    if (!token) {
      return json({ error: "Authentication required." }, 401);
    }

    const payload = parseJwt(token);
    if (!payload || !payload.sub) {
      return json({ error: "Invalid authentication token." }, 401);
    }

    const callerId = payload.sub;
    const isAdmin = payload.app_metadata?.role === "admin";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ── Rate limiting: 30 calls per learner per day ──
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const startOfDay = `${todayStr}T00:00:00.000Z`;

    const { count, error: countError } = await supabase
      .from("lp_coach_calls")
      .select("*", { count: "exact", head: true })
      .eq("learner_id", callerId)
      .gte("created_at", startOfDay);

    if (countError) {
      return json({ error: "Failed to check rate limit." }, 500);
    }

    if ((count ?? 0) >= DAILY_CALL_LIMIT) {
      return json({
        error: `You've reached the daily limit of ${DAILY_CALL_LIMIT} AI coaching calls. Please try again tomorrow.`,
      }, 429);
    }

    // Log the call
    const body = await req.json();
    const { mode } = body as { mode: string };

    await supabase.from("lp_coach_calls").insert({
      learner_id: callerId,
      call_type: mode || "unknown",
    });

    // ── Route to handler ──
    switch (mode) {
      case "feedback":
        return await handleFeedback(supabase, callerId, isAdmin, body);
      case "quiz":
        return await handleQuiz(supabase, callerId, isAdmin, body);
      case "interview":
        return await handleInterview(supabase, callerId, isAdmin, body);
      case "session_prep":
        return await handleSessionPrep(supabase, callerId, isAdmin, body);
      default:
        return json({ error: `Unknown mode: ${mode}. Use 'feedback', 'quiz', 'interview', or 'session_prep'.` }, 400);
    }
  } catch (err) {
    console.error(`[learn-coach] Unhandled error: ${(err as Error)?.message ?? err}`);
    return json({ error: (err as Error)?.message || "Internal server error" }, 500);
  }
});
