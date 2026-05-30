import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useClinicalTimeline } from '@/hooks/useClinicalTimeline';
import { format } from 'date-fns';

interface Props {
  patientId?: string | null;
  problemId?: string | null;
  title?: string;
}

export function ProblemTimelinePanel({ patientId, problemId, title = 'Linha do tempo' }: Props) {
  const { events, loading } = useClinicalTimeline({ patientId, problemId });
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        {loading ? <p className="text-sm text-muted-foreground">Carregando...</p>
        : events.length === 0 ? <p className="text-sm text-muted-foreground">Sem eventos.</p>
        : (
          <ul className="space-y-2">
            {events.map(e => (
              <li key={e.id} className="rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{e.title}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{e.event_type}</Badge>
                    <span className="text-xs text-muted-foreground">{format(new Date(e.event_at), 'dd/MM/yyyy HH:mm')}</span>
                  </div>
                </div>
                {e.description && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{e.description}</p>}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
