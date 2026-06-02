import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { recordTimelineEvent } from '@/lib/timeline';
import { toast } from 'sonner';

interface SafetyChecklist {
  id: string;
  therapy: string;
  status: string;
  flags: string[];
  notes: string | null;
  created_at: string;
}

export default function PatientTherapeuticSafetyPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState<SafetyChecklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [therapy, setTherapy] = useState('');
  const [flagsText, setFlagsText] = useState('');
  const [notes, setNotes] = useState('');

  const refresh = async () => {
    if (!user || !patientId) return;
    setLoading(true);
    const { data } = await supabase
      .from('therapy_safety_checklists')
      .select('*')
      .eq('user_id', user.id)
      .eq('patient_card_id', patientId)
      .order('created_at', { ascending: false });
    setItems((data ?? []) as unknown as SafetyChecklist[]);
    setLoading(false);
  };

  useEffect(() => { void refresh(); }, [user, patientId]);

  const submit = async () => {
    if (!user || !patientId || !therapy.trim()) return;
    const flags = flagsText.split(',').map(f => f.trim()).filter(Boolean);
    const { data, error } = await supabase
      .from('therapy_safety_checklists')
      .insert({
        user_id: user.id,
        patient_card_id: patientId,
        therapy: therapy.trim(),
        flags: flags as never,
        notes: notes.trim() || null,
      })
      .select()
      .single();
    if (error || !data) { toast.error('Falha ao salvar'); return; }
    await recordTimelineEvent({
      userId: user.id,
      patientCardId: patientId,
      eventType: 'safety_checklist',
      title: `Checklist de segurança: ${therapy}`,
      description: notes || null,
      referenceTable: 'therapy_safety_checklists',
      referenceId: data.id,
      metadata: { flags },
    });
    toast.success('Checklist registrado');
    setOpen(false); setTherapy(''); setFlagsText(''); setNotes('');
    void refresh();
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 space-y-4 max-w-5xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/patients/${patientId}`)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4" /> Segurança terapêutica</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setOpen(v => !v)}>
              <Plus className="h-4 w-4 mr-1" /> {open ? 'Cancelar' : 'Novo checklist'}
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {open && (
              <div className="space-y-2 rounded-md border p-3">
                <Input placeholder="Terapia (ex: MTX, Biologics)" value={therapy} onChange={e => setTherapy(e.target.value)} />
                <Input placeholder="Flags separadas por vírgula" value={flagsText} onChange={e => setFlagsText(e.target.value)} />
                <Textarea placeholder="Notas" value={notes} onChange={e => setNotes(e.target.value)} />
                <Button size="sm" onClick={submit} disabled={!therapy}>Salvar</Button>
              </div>
            )}
            {loading ? <p className="text-sm text-muted-foreground">Carregando...</p>
            : items.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum checklist.</p>
            : (
              <ul className="space-y-2">
                {items.map(it => (
                  <li key={it.id} className="rounded-md border p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{it.therapy}</span>
                      <Badge variant={it.status === 'open' ? 'default' : 'secondary'}>{it.status}</Badge>
                    </div>
                    {it.flags?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {it.flags.map((f, i) => <Badge key={i} variant="destructive">{f}</Badge>)}
                      </div>
                    )}
                    {it.notes && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{it.notes}</p>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
