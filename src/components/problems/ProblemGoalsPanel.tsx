import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import { useProblemGoals } from '@/hooks/useProblemGoals';

interface Props {
  problemId: string;
  patientCardId?: string | null;
}

export function ProblemGoalsPanel({ problemId, patientCardId }: Props) {
  const { goals, loading, addGoal } = useProblemGoals(problemId, patientCardId);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [target, setTarget] = useState('');

  const submit = async () => {
    if (!title.trim()) return;
    await addGoal({ title: title.trim(), description: description.trim() || undefined, target_date: target || null });
    setOpen(false); setTitle(''); setDescription(''); setTarget('');
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Metas</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setOpen(v => !v)}>
          <Plus className="h-4 w-4 mr-1" /> {open ? 'Cancelar' : 'Nova meta'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {open && (
          <div className="space-y-2 rounded-md border p-3">
            <Input placeholder="Título da meta" value={title} onChange={e => setTitle(e.target.value)} />
            <Textarea placeholder="Descrição (opcional)" value={description} onChange={e => setDescription(e.target.value)} />
            <div className="flex items-center gap-2">
              <Input type="date" value={target} onChange={e => setTarget(e.target.value)} className="w-44" />
              <Button size="sm" onClick={submit} disabled={!title}>Salvar</Button>
            </div>
          </div>
        )}
        {loading ? <p className="text-sm text-muted-foreground">Carregando...</p>
        : goals.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma meta registrada.</p>
        : (
          <ul className="divide-y rounded-md border">
            {goals.map(g => (
              <li key={g.id} className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{g.title}</span>
                  <div className="flex items-center gap-2">
                    {g.target_date && <Badge variant="outline">até {g.target_date}</Badge>}
                    <Badge variant={g.status === 'open' ? 'default' : 'secondary'}>{g.status}</Badge>
                  </div>
                </div>
                {g.description && <p className="text-sm text-muted-foreground mt-1">{g.description}</p>}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
