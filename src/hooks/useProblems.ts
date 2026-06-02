import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { recordTimelineEvent } from '@/lib/timeline';
import { toast } from 'sonner';

export interface ProblemInstance {
  id: string;
  user_id: string;
  patient_card_id: string | null;
  specialty: string;
  problem_code: string;
  title: string;
  summary: string | null;
  status: string;
  severity: string | null;
  onset_date: string | null;
  resolved_date: string | null;
  red_flags: string[];
  safety_flags: string[];
  linked_modules: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateProblemInput {
  patient_card_id?: string | null;
  specialty?: string;
  problem_code: string;
  title: string;
  summary?: string | null;
  severity?: string | null;
  status?: string;
  red_flags?: string[];
  safety_flags?: string[];
  linked_modules?: string[];
}

export function useProblems(patientId?: string | null) {
  const { user } = useAuth();
  const [problems, setProblems] = useState<ProblemInstance[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProblems = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let q = supabase
      .from('problem_instances')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (patientId) q = q.eq('patient_card_id', patientId);
    const { data, error } = await q;
    if (error) toast.error('Falha ao carregar problemas');
    setProblems((data ?? []) as unknown as ProblemInstance[]);
    setLoading(false);
  }, [user, patientId]);

  useEffect(() => { void fetchProblems(); }, [fetchProblems]);

  const createProblem = useCallback(async (input: CreateProblemInput): Promise<ProblemInstance | null> => {
    if (!user) return null;
    const { data, error } = await supabase
      .from('problem_instances')
      .insert({
        user_id: user.id,
        patient_card_id: input.patient_card_id ?? null,
        specialty: input.specialty ?? 'general',
        problem_code: input.problem_code,
        title: input.title,
        summary: input.summary ?? null,
        status: input.status ?? 'active',
        severity: input.severity ?? null,
        red_flags: (input.red_flags ?? []) as never,
        safety_flags: (input.safety_flags ?? []) as never,
        linked_modules: (input.linked_modules ?? []) as never,
      })
      .select()
      .single();
    if (error || !data) { toast.error('Falha ao criar problema'); return null; }
    const created = data as unknown as ProblemInstance;
    if (created.patient_card_id) {
      await recordTimelineEvent({
        userId: user.id,
        patientCardId: created.patient_card_id,
        problemId: created.id,
        eventType: 'problem_created',
        title: `Problema: ${created.title}`,
        description: created.summary,
        specialty: created.specialty,
        referenceTable: 'problem_instances',
        referenceId: created.id,
      });
    }
    toast.success('Problema criado');
    await fetchProblems();
    return created;
  }, [user, fetchProblems]);

  const updateProblem = useCallback(async (id: string, patch: Partial<CreateProblemInput> & { status?: string }) => {
    if (!user) return false;
    const { error } = await supabase
      .from('problem_instances')
      .update(patch as never)
      .eq('id', id)
      .eq('user_id', user.id);
    if (error) { toast.error('Falha ao atualizar'); return false; }
    await fetchProblems();
    return true;
  }, [user, fetchProblems]);

  const deleteProblem = useCallback(async (id: string) => {
    if (!user) return false;
    const { error } = await supabase
      .from('problem_instances')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    if (error) { toast.error('Falha ao excluir'); return false; }
    await fetchProblems();
    return true;
  }, [user, fetchProblems]);

  return { problems, loading, fetchProblems, createProblem, updateProblem, deleteProblem };
}

export function useProblem(problemId?: string | null) {
  const { user } = useAuth();
  const [problem, setProblem] = useState<ProblemInstance | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user || !problemId) return;
    setLoading(true);
    const { data } = await supabase
      .from('problem_instances')
      .select('*')
      .eq('id', problemId)
      .eq('user_id', user.id)
      .maybeSingle();
    setProblem((data as unknown as ProblemInstance) ?? null);
    setLoading(false);
  }, [user, problemId]);

  useEffect(() => { void refresh(); }, [refresh]);
  return { problem, loading, refresh };
}
