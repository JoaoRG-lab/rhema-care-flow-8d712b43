import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { recordTimelineEvent } from '@/lib/timeline';
import { toast } from 'sonner';

export interface ProblemGoal {
  id: string;
  user_id: string;
  problem_id: string;
  patient_card_id: string | null;
  title: string;
  description: string | null;
  target_date: string | null;
  status: string;
  metrics: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ProblemFollowup {
  id: string;
  user_id: string;
  problem_id: string;
  patient_card_id: string | null;
  note: string;
  next_steps: string | null;
  metrics: Record<string, unknown>;
  followup_date: string;
  created_at: string;
}

export function useProblemGoals(problemId?: string | null, patientCardId?: string | null) {
  const { user } = useAuth();
  const [goals, setGoals] = useState<ProblemGoal[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user || !problemId) return;
    setLoading(true);
    const { data } = await supabase
      .from('problem_goals')
      .select('*')
      .eq('user_id', user.id)
      .eq('problem_id', problemId)
      .order('created_at', { ascending: false });
    setGoals((data ?? []) as unknown as ProblemGoal[]);
    setLoading(false);
  }, [user, problemId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const addGoal = useCallback(async (input: { title: string; description?: string; target_date?: string | null; metrics?: Record<string, unknown> }) => {
    if (!user || !problemId) return null;
    const { data, error } = await supabase
      .from('problem_goals')
      .insert({
        user_id: user.id,
        problem_id: problemId,
        patient_card_id: patientCardId ?? null,
        title: input.title,
        description: input.description ?? null,
        target_date: input.target_date ?? null,
        metrics: (input.metrics ?? {}) as never,
      })
      .select()
      .single();
    if (error || !data) { toast.error('Falha ao criar meta'); return null; }
    const goal = data as unknown as ProblemGoal;
    if (patientCardId) {
      await recordTimelineEvent({
        userId: user.id,
        patientCardId,
        problemId,
        eventType: 'goal_created',
        title: `Meta: ${goal.title}`,
        description: goal.description,
        referenceTable: 'problem_goals',
        referenceId: goal.id,
        metadata: { target_date: goal.target_date },
      });
    }
    toast.success('Meta adicionada');
    await refresh();
    return goal;
  }, [user, problemId, patientCardId, refresh]);

  return { goals, loading, addGoal, refresh };
}

export function useProblemFollowups(problemId?: string | null, patientCardId?: string | null) {
  const { user } = useAuth();
  const [followups, setFollowups] = useState<ProblemFollowup[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user || !problemId) return;
    setLoading(true);
    const { data } = await supabase
      .from('problem_followups')
      .select('*')
      .eq('user_id', user.id)
      .eq('problem_id', problemId)
      .order('followup_date', { ascending: false });
    setFollowups((data ?? []) as unknown as ProblemFollowup[]);
    setLoading(false);
  }, [user, problemId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const addFollowup = useCallback(async (input: { note: string; next_steps?: string; metrics?: Record<string, unknown>; followup_date?: string }) => {
    if (!user || !problemId) return null;
    const { data, error } = await supabase
      .from('problem_followups')
      .insert({
        user_id: user.id,
        problem_id: problemId,
        patient_card_id: patientCardId ?? null,
        note: input.note,
        next_steps: input.next_steps ?? null,
        metrics: (input.metrics ?? {}) as never,
        followup_date: input.followup_date ?? new Date().toISOString().slice(0, 10),
      })
      .select()
      .single();
    if (error || !data) { toast.error('Falha ao registrar acompanhamento'); return null; }
    const fu = data as unknown as ProblemFollowup;
    if (patientCardId) {
      await recordTimelineEvent({
        userId: user.id,
        patientCardId,
        problemId,
        eventType: 'followup_created',
        title: 'Acompanhamento registrado',
        description: fu.note,
        referenceTable: 'problem_followups',
        referenceId: fu.id,
        metadata: { next_steps: fu.next_steps },
      });
    }
    toast.success('Acompanhamento registrado');
    await refresh();
    return fu;
  }, [user, problemId, patientCardId, refresh]);

  return { followups, loading, addFollowup, refresh };
}
