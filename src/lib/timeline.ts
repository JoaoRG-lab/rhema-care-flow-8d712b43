import { supabase } from '@/integrations/supabase/client';

export type TimelineEventType =
  | 'problem_created'
  | 'problem_updated'
  | 'goal_created'
  | 'followup_created'
  | 'score_recorded'
  | 'prescription_created'
  | 'safety_checklist'
  | 'note';

export interface TimelineEventInput {
  userId: string;
  patientCardId?: string | null;
  problemId?: string | null;
  eventType: TimelineEventType;
  title: string;
  description?: string | null;
  specialty?: string | null;
  referenceTable?: string | null;
  referenceId?: string | null;
  metadata?: Record<string, unknown>;
  eventAt?: string;
}

/**
 * Append a single clinical_timeline_events row. Never throws — timeline
 * writes are best-effort and must not break the originating action.
 */
export async function recordTimelineEvent(input: TimelineEventInput): Promise<void> {
  if (!input.userId) return;
  try {
    await supabase.from('clinical_timeline_events').insert({
      user_id: input.userId,
      patient_card_id: input.patientCardId ?? null,
      problem_id: input.problemId ?? null,
      event_type: input.eventType,
      title: input.title,
      description: input.description ?? null,
      specialty: input.specialty ?? null,
      reference_table: input.referenceTable ?? null,
      reference_id: input.referenceId ?? null,
      metadata: (input.metadata ?? {}) as never,
      event_at: input.eventAt ?? new Date().toISOString(),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[timeline] failed to record event', err);
  }
}
