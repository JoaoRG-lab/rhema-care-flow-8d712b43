import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus } from 'lucide-react';
import { useProblemFollowups } from '@/hooks/useProblemGoals';

interface Props {
  problemId: string;
  patientCardId?: string | null;
}

export function ProblemFollowupsPanel({ problemId, patientCardId }: Props) {
  const { followups, loading, addFollowup } = useProblemFollowups(problemId, patientCardId);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [nextSteps, setNextSteps] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  const submit = async () => {
    if (!note.trim()) return;
    await addFollowup({ note: note.trim(), next_steps: nextSteps.trim() || undefined, followup_date: date });
    setOpen(false); setNote(''); setNextSteps('');
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Acompanhamentos</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setOpen(v => !v)}>
          <Plus className="h-4 w-4 mr-1" /> {open ? 'Cancelar' : 'Novo'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {open && (
          <div className="space-y-2 rounded-md border p-3">
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-44" />
            <Textarea placeholder="Nota clínica" value={note} onChange={e => setNote(e.target.value)} />
            <Textarea placeholder="Próximos passos (opcional)" value={nextSteps} onChange={e => setNextSteps(e.target.value)} />
            <Button size="sm" onClick={submit} disabled={!note}>Salvar</Button>
          </div>
        )}
        {loading ? <p className="text-sm text-muted-foreground">Carregando...</p>
        : followups.length === 0 ? <p className="text-sm text-muted-foreground">Sem acompanhamentos.</p>
        : (
          <ul className="space-y-2">
            {followups.map(f => (
              <li key={f.id} className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">{f.followup_date}</div>
                <p className="text-sm whitespace-pre-wrap">{f.note}</p>
                {f.next_steps && <p className="text-xs mt-1"><strong>Próximos passos:</strong> {f.next_steps}</p>}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
