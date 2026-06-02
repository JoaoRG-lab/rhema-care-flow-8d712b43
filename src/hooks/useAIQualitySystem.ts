import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFn } from '@/lib/invokeEdgeFn';
import { describeEdgeFunctionRuntimeError } from '@/lib/edgeFunctionDiagnostics';
import { toast } from 'sonner';

interface JudgeResult {
  success: boolean;
  decision: 'auto_approve' | 'human_review';
  evidence_level: string;
  grade: string;
  confidence: number;
  requires_human_review: boolean;
  auto_approved: boolean;
  reasoning: string;
}

interface SentinelResult {
  success: boolean;
  status: 'clean' | 'flagged';
  quality_score: number;
  issues_found: number;
  recommendation: string;
  flagged: boolean;
  details: any;
}

interface SentinelAlert {
  id: string;
  pipeline_id: string | null;
  content_id: string | null;
  alert_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  suggested_action: string | null;
  is_resolved: boolean;
  created_at: string;
}

export function useAIQualitySystem() {
  const [isJudging, setIsJudging] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [alerts, setAlerts] = useState<SentinelAlert[]>([]);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);

  const reportRuntimeError = useCallback((functionName: string, err: unknown, fallback: string) => {
    const message = describeEdgeFunctionRuntimeError(
      functionName,
      err instanceof Error ? err.message : '',
      fallback
    );
    setRuntimeError(message);
    toast.error(message);
    return message;
  }, []);

  const judgeContent = useCallback(async (
    pipelineId: string, 
    adminEmail?: string
  ): Promise<JudgeResult | null> => {
    setIsJudging(true);
    setRuntimeError(null);
    try {
      const { data, error } = await invokeEdgeFn<any>('ai-judge', { action: 'judge', pipeline_id: pipelineId, admin_email: adminEmail });

      if (error) throw new Error(error);

      if (data.auto_approved) {
        toast.success(`Article auto-approved! Evidence: ${data.evidence_level}, Grade: ${data.grade}`);
      } else if (data.requires_human_review) {
        toast.info(`Article requires human review. Confidence: ${data.confidence}%`);
      }

      return data as JudgeResult;
    } catch (err) {
      console.error('Judge error:', err);
      reportRuntimeError('ai-judge', err, 'Failed to judge content');
      return null;
    } finally {
      setIsJudging(false);
    }
  }, [reportRuntimeError]);

  const batchJudge = useCallback(async (adminEmail?: string) => {
    setIsJudging(true);
    setRuntimeError(null);
    try {
      const { data, error } = await invokeEdgeFn<any>('ai-judge', { action: 'batch_judge', admin_email: adminEmail });

      if (error) throw new Error(error);

      const autoApproved = data.results?.filter((r: any) => r.auto_approved).length || 0;
      const needsReview = data.results?.filter((r: any) => r.requires_human_review).length || 0;

      toast.success(`Processed ${data.processed} items: ${autoApproved} auto-approved, ${needsReview} need review`);
      return data;
    } catch (err) {
      console.error('Batch judge error:', err);
      reportRuntimeError('ai-judge', err, 'Failed to batch judge');
      return null;
    } finally {
      setIsJudging(false);
    }
  }, [reportRuntimeError]);

  const monitorContent = useCallback(async (
    contentId?: string,
    pipelineId?: string
  ): Promise<SentinelResult | null> => {
    setIsMonitoring(true);
    setRuntimeError(null);
    try {
      const { data, error } = await invokeEdgeFn<any>('ai-sentinel', { action: 'monitor', content_id: contentId, pipeline_id: pipelineId });

      if (error) throw new Error(error);

      if (data.flagged) {
        toast.warning(`Content flagged! ${data.issues_found} issues found. Recommendation: ${data.recommendation}`);
      } else {
        toast.success(`Content verified. Quality score: ${data.quality_score}/100`);
      }

      return data as SentinelResult;
    } catch (err) {
      console.error('Sentinel error:', err);
      reportRuntimeError('ai-sentinel', err, 'Failed to monitor content');
      return null;
    } finally {
      setIsMonitoring(false);
    }
  }, [reportRuntimeError]);

  const runSentinelPatrol = useCallback(async () => {
    setIsMonitoring(true);
    setRuntimeError(null);
    try {
      const { data, error } = await invokeEdgeFn<any>('ai-sentinel', { action: 'patrol' });

      if (error) throw new Error(error);

      const flagged = data.results?.filter((r: any) => r.flagged).length || 0;
      toast.success(`Patrol complete: ${data.patrolled} items checked, ${flagged} flagged`);
      return data;
    } catch (err) {
      console.error('Patrol error:', err);
      reportRuntimeError('ai-sentinel', err, 'Sentinel patrol failed');
      return null;
    } finally {
      setIsMonitoring(false);
    }
  }, [reportRuntimeError]);

  const fetchAlerts = useCallback(async () => {
    try {
      const { data, error } = await invokeEdgeFn<any>('ai-sentinel', { action: 'get_alerts' });

      if (error) throw new Error(error);
      setAlerts(data.alerts || []);
      return data.alerts;
    } catch (err) {
      console.error('Fetch alerts error:', err);
      setRuntimeError(describeEdgeFunctionRuntimeError(
        'ai-sentinel',
        err instanceof Error ? err.message : '',
        'Failed to fetch sentinel alerts'
      ));
      return [];
    }
  }, []);

  const resolveAlert = useCallback(async (alertId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase
      .from('sentinel_alerts')
      .update({
        is_resolved: true,
        resolved_by: user.id,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', alertId);

    if (error) {
      toast.error('Failed to resolve alert');
      return false;
    }

    toast.success('Alert resolved');
    await fetchAlerts();
    return true;
  }, [fetchAlerts]);

  return {
    isJudging,
    isMonitoring,
    alerts,
    runtimeError,
    judgeContent,
    batchJudge,
    monitorContent,
    runSentinelPatrol,
    fetchAlerts,
    resolveAlert,
  };
}
