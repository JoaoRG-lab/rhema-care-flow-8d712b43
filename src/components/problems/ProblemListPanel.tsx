import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, ChevronRight } from 'lucide-react';
import { useProblems } from '@/hooks/useProblems';
import { getProblemsForSpecialty, findProblemByCode, PROBLEM_REGISTRY } from '@/config/problemRegistry';
import { useSpecialty } from '@/contexts/SpecialtyContext';

interface Props {
  patientId?: string | null;
}

export function ProblemListPanel({ patientId }: Props) {
  const specialty = (() => { try { return useSpecialty()?.currentSpecialty?.id; } catch { return undefined; } })();
  const { problems, loading, createProblem } = useProblems(patientId);
  const [adding, setAdding] = useState(false);
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [severity, setSeverity] = useState<string>('moderate');

  const catalog = getProblemsForSpecialty(specialty);

  const handleSelectCode = (c: string) => {
    setCode(c);
    const def = findProblemByCode(c) ?? PROBLEM_REGISTRY.find(p => p.code === c);
    if (def) {
      setTitle(def.title);
      if (def.defaultSeverity) setSeverity(def.defaultSeverity);
    }
  };

  const handleCreate = async () => {
    if (!title.trim() || !code.trim()) return;
    const def = findProblemByCode(code);
    await createProblem({
      patient_card_id: patientId ?? null,
      specialty: def?.specialty ?? specialty ?? 'general',
      problem_code: code.trim(),
      title: title.trim(),
      summary: summary.trim() || null,
      severity,
      linked_modules: def?.linkedModules ?? [],
    });
    setAdding(false);
    setCode(''); setTitle(''); setSummary(''); setSeverity('moderate');
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Problemas</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setAdding(v => !v)}>
          <Plus className="h-4 w-4 mr-1" /> {adding ? 'Cancelar' : 'Novo'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {adding && (
          <div className="space-y-2 rounded-md border p-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Select value={code} onValueChange={handleSelectCode}>
                <SelectTrigger><SelectValue placeholder="Código do problema" /></SelectTrigger>
                <SelectContent>
                  {catalog.map(p => (
                    <SelectItem key={p.code} value={p.code}>{p.code} — {p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input placeholder="Título" value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <Textarea placeholder="Resumo clínico (opcional)" value={summary} onChange={e => setSummary(e.target.value)} />
            <div className="flex items-center gap-2">
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="moderate">Moderada</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" onClick={handleCreate} disabled={!title || !code}>Salvar</Button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : problems.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum problema registrado.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {problems.map(p => {
              const to = patientId
                ? `/patients/${patientId}/problems/${p.id}`
                : `#`;
              return (
                <li key={p.id} className="flex items-center justify-between p-3 hover:bg-muted/30">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{p.title}</span>
                      <Badge variant="outline">{p.problem_code}</Badge>
                      {p.severity && <Badge variant="secondary">{p.severity}</Badge>}
                      <Badge variant={p.status === 'active' ? 'default' : 'outline'}>{p.status}</Badge>
                    </div>
                    {p.summary && <p className="text-xs text-muted-foreground truncate">{p.summary}</p>}
                  </div>
                  {patientId && (
                    <Button asChild size="sm" variant="ghost">
                      <Link to={to}>Abrir <ChevronRight className="h-4 w-4 ml-1" /></Link>
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
