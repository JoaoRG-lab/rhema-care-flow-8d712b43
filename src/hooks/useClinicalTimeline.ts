import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface TimelineEvent {
  id: string;
  user_id: string;
  patient_card_id: string | null;
  problem_id: string | null;
  event_type: string;
  title: string;
  description: string | null;
  specialty: string | null;
  reference_table: string | null;
  reference_id: string | null;
  metadata: Record<string, unknown>;
  event_at: string;
  created_at: string;
}

interface Options {
  patientId?: string | null;
  problemId?: string | null;
  limit?: number;
}

export function useClinicalTimeline({ patientId, problemId, limit = 100 }: Options) {
  const { user } = useAuth();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let q = supabase
      .from('clinical_timeline_events')
      .select('*')
      .eq('user_id', user.id)
      .order('event_at', { ascending: false })
      .limit(limit);
    if (patientId) q = q.eq('patient_card_id', patientId);
    if (problemId) q = q.eq('problem_id', problemId);
    const { data } = await q;
    setEvents((data ?? []) as unknown as TimelineEvent[]);
    setLoading(false);
  }, [user, patientId, problemId, limit]);

  useEffect(() => { void refresh(); }, [refresh]);
  return { events, loading, refresh };
}
