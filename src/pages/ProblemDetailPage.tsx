import { Link, useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Activity, Pill, Shield, TrendingUp } from 'lucide-react';
import { useProblem } from '@/hooks/useProblems';
import { ProblemGoalsPanel } from '@/components/problems/ProblemGoalsPanel';
import { ProblemFollowupsPanel } from '@/components/problems/ProblemFollowupsPanel';
import { ProblemTimelinePanel } from '@/components/problems/ProblemTimelinePanel';

export default function ProblemDetailPage() {
  const { patientId, problemId } = useParams<{ patientId: string; problemId: string }>();
  const navigate = useNavigate();
  const { problem, loading } = useProblem(problemId);

  if (loading) {
    return <AppLayout><div className="p-6">Carregando...</div></AppLayout>;
  }
  if (!problem) {
    return (
      <AppLayout>
        <div className="p-6 space-y-3">
          <p>Problema não encontrado.</p>
          <Button variant="outline" onClick={() => navigate(`/patients/${patientId}/problems`)}>Voltar</Button>
        </div>
      </AppLayout>
    );
  }

  const linked = problem.linked_modules ?? [];
  return (
    <AppLayout>
      <div className="p-4 sm:p-6 space-y-4 max-w-5xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/patients/${patientId}/problems`)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar aos problemas
        </Button>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-lg">{problem.title}</CardTitle>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <Badge variant="outline">{problem.problem_code}</Badge>
                  <Badge variant="secondary">{problem.specialty}</Badge>
                  {problem.severity && <Badge>{problem.severity}</Badge>}
                  <Badge variant={problem.status === 'active' ? 'default' : 'outline'}>{problem.status}</Badge>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {patientId && (
                  <>
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/patients/${patientId}/scores`}><TrendingUp className="h-4 w-4 mr-1" /> Scores</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/patients/${patientId}/therapeutic-safety`}><Shield className="h-4 w-4 mr-1" /> Segurança</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/patients/${patientId}`}><Pill className="h-4 w-4 mr-1" /> Prescrições</Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          {problem.summary && (
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{problem.summary}</p>
            </CardContent>
          )}
        </Card>

        {(problem.red_flags?.length || problem.safety_flags?.length) ? (
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" /> Alertas</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {problem.red_flags?.length ? (
                <div className="flex flex-wrap gap-2">
                  {problem.red_flags.map((f, i) => <Badge key={`r${i}`} variant="destructive">⚑ {f}</Badge>)}
                </div>
              ) : null}
              {problem.safety_flags?.length ? (
                <div className="flex flex-wrap gap-2">
                  {problem.safety_flags.map((f, i) => <Badge key={`s${i}`} variant="secondary">⚠ {f}</Badge>)}
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        <ProblemGoalsPanel problemId={problem.id} patientCardId={problem.patient_card_id} />
        <ProblemFollowupsPanel problemId={problem.id} patientCardId={problem.patient_card_id} />
        <ProblemTimelinePanel patientId={problem.patient_card_id} problemId={problem.id} title="Eventos deste problema" />

        {linked.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Módulos vinculados</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {linked.map((m, i) => <Badge key={i} variant="outline">{m}</Badge>)}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
