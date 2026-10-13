export type TaskStatus = 'not_started' | 'in_progress' | 'submitted' | 'approved' | 'changes_requested';

export interface Track {
  id: string;
  title: string;
  description: string | null;
}

export interface Week {
  id: string;
  track_id: string;
  week_number: number;
  title: string;
  goal: string | null;
  start_date: string | null;
  end_date: string | null;
}

export interface Task {
  id: string;
  week_id: string;
  title: string;
  description: string | null;
  sort_order: number;
  due_date: string | null;
}

export type ResourceKind = 'doc' | 'video' | 'concept' | 'tutorial';

export interface TaskResource {
  id: string;
  task_id: string;
  title: string;
  url: string;
  kind: ResourceKind;
  sort_order: number;
}

export interface ProgressRow {
  id: string;
  learner_id: string;
  task_id: string;
  status: TaskStatus;
  completed_at: string | null;
  completion_note: string | null;
  link: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  review_comment: string | null;
  coach_feedback?: string | null;
  coach_question?: string | null;
  coach_answer?: string | null;
  coach_completed?: boolean | null;
}

export interface JournalEntry {
  id: string;
  learner_id: string;
  week_id: string;
  entry_text: string;
  entry_date: string;
}
