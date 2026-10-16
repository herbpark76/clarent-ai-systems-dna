import { supabase } from './supabase';

const COACH_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/learn-coach`;

async function getHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  };
}

async function callCoach(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const headers = await getHeaders();
  const resp = await fetch(COACH_URL, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: `Request failed (${resp.status})` }));
    throw new Error((err as { error?: string }).error || `Request failed (${resp.status})`);
  }
  return resp.json();
}

export interface CoachFeedback {
  whats_good: string;
  whats_missing: string;
  follow_up: string;
  learner_id: string;
}

export async function getCoachFeedback(params: {
  task_title: string;
  task_description?: string;
  learner_note: string;
  learner_link?: string;
  resources?: Array<{ title: string; url: string; kind: string }>;
  attachment_files?: string[];
  target_learner_id?: string;
}): Promise<CoachFeedback> {
  return callCoach({ mode: 'feedback', ...params }) as Promise<CoachFeedback>;
}

export interface QuizQuestion {
  type: 'multiple_choice' | 'short_answer';
  question: string;
  options?: string[];
  correct_index?: number;
  reference_answer?: string;
}

export async function generateQuiz(params: {
  week_title: string;
  week_goal?: string;
  tasks: Array<{ title: string; description?: string }>;
  resources?: Array<{ title: string; url: string; kind: string }>;
  target_learner_id?: string;
}): Promise<{ questions: QuizQuestion[] }> {
  return callCoach({ mode: 'quiz', action: 'generate', ...params }) as Promise<{ questions: QuizQuestion[] }>;
}

export interface QuizGradeResult {
  score: number;
  passed: boolean;
  feedback: string;
  question_feedback: Array<{ question: string; correct: boolean; feedback: string }>;
}

export async function gradeQuiz(params: {
  questions: QuizQuestion[];
  answers: Array<string>;
  week_id?: string;
  target_learner_id?: string;
}): Promise<QuizGradeResult> {
  return callCoach({ mode: 'quiz', action: 'grade', ...params }) as Promise<QuizGradeResult>;
}

export async function generateInterviewQuestion(params: {
  journal_entries?: Array<{ entry_text: string; entry_date: string }>;
  approved_tasks?: Array<{ title: string; completion_note: string }>;
  target_learner_id?: string;
}): Promise<{ question: string; learner_id: string }> {
  return callCoach({ mode: 'interview', action: 'question', ...params }) as Promise<{ question: string; learner_id: string }>;
}

export interface InterviewGrade {
  scores: { clarity: number; technical_depth: number; use_of_specifics: number };
  feedback: string;
  suggested_version: string;
}

export async function gradeInterview(params: {
  question: string;
  answer: string;
  target_learner_id?: string;
}): Promise<InterviewGrade> {
  return callCoach({ mode: 'interview', action: 'grade', ...params }) as Promise<InterviewGrade>;
}

export async function generateSessionPrep(params: {
  learner_name: string;
  week_title?: string;
  week_number?: number;
  approved_tasks?: Array<{ title: string; note: string }>;
  submitted_tasks?: Array<{ title: string; note: string }>;
  overdue_tasks?: Array<{ title: string; due_date: string }>;
  quiz_scores?: Array<{ week: string; score: number; passed: boolean }>;
  journal_questions?: Array<string>;
}): Promise<{ summary: string }> {
  return callCoach({ mode: 'session_prep', ...params }) as Promise<{ summary: string }>;
}

export interface QuizAttempt {
  id: string;
  learner_id: string;
  week_id: string;
  questions: QuizQuestion[];
  answers: string[] | null;
  score: number | null;
  passed: boolean | null;
  feedback: string | null;
  created_at: string;
}

export interface InterviewPracticeRow {
  id: string;
  learner_id: string;
  question: string;
  answer: string | null;
  scores: { clarity: number; technical_depth: number; use_of_specifics: number } | null;
  feedback: string | null;
  created_at: string;
}
