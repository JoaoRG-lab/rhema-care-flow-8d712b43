import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, addDays, isBefore, isToday, isTomorrow } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import {
  Activity,
  AlertCircle,
  Bell,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Heart,
  Loader2,
  MessageSquare,
  Pill,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Target,
  TrendingDown,
} from 'lucide-react';
import { toast } from 'sonner';

import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { SessionList } from '@/components/consultations/SessionList';

type CheckIn = {
  pain: number;
  fatigue: number;
  stiffness: number;
  note: string;
  updatedAt: string | null;
};

type PatientProfile = {
  preferredName: string;
  condition: string;
  careGoal: string;
  nextQuestion: string;
};

type PortalPatient = {
  id: string;
  patient_code: string;
  mrn_last4: string | null;
  diagnosis_tags: string[];
  therapy_tags: string[];
  risk_flags: string[];
  last_visit_date: string | null;
  next_followup_date: string | null;
};

type PortalScore = {
  score_type: string;
  calculated_score: number | string | null;
  created_at: string;
};

type PortalMonitoring = {
  id: string;
  event_type: string;
  due_date: string;
  status: string | null;
  completed_at: string | null;
  notes: string | null;
};

type PortalPrescription = {
  id: string;
  status: string;
  items: Array<{ drug?: string; dose?: string; frequency?: string; instructions?: string }> | unknown;
  notes: string;
  cid10: string;
  signed_at: string | null;
  created_at: string;
};

type PortalPayload = {
  ok: boolean;
  error?: string;
  patient?: PortalPatient;
  scores?: PortalScore[];
  monitoring?: PortalMonitoring[];
  prescriptions?: PortalPrescription[];
};

type CareTask = {
  id: string;
  title: string;
  detail: string;
  due: Date;
  type: 'medication' | 'exam' | 'visit' | 'selfcare';
};

type MedicationRow = {
  name: string;
  dose: string;
  nextDue: Date;
  instruction: string;
};

const EDUCATION_LIBRARY = [
  {
    title: 'Como reconhecer uma crise e quando procurar ajuda',
    category: 'Seguranca',
    match: ['dor', 'fadiga', 'crise'],
    level: 'Essencial',
    source: 'EULAR patient education principles',
  },
  {
    title: 'Metotrexato: rotina segura, sinais de alerta e exames',
    category: 'Tratamento',
    match: ['metotrexato', 'exames'],
    level: 'Essencial',
    source: 'ACR medication patient guidance',
  },
  {
    title: 'Movimento com articulacoes inflamadas: o que ajustar',
    category: 'Autocuidado',
    match: ['atividade', 'rigidez'],
    level: 'Pratico',
    source: 'EULAR physical activity recommendations',
  },
  {
    title: 'Como preparar sua consulta em 3 minutos',
    category: 'Consulta',
    match: ['consulta', 'pergunta'],
    level: 'Pratico',
    source: 'Treat-to-target shared decision making',
  },
  {
    title: 'Biologicos e infeccoes: combinados de seguranca',
    category: 'Tratamento',
    match: ['adalimumabe', 'infeccao'],
    level: 'Avancado',
    source: 'ACR biologic safety guidance',
  },
];

function getStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function getDueLabel(date: Date) {
  if (isToday(date)) return 'Hoje';
  if (isTomorrow(date)) return 'Amanha';
  return format(date, 'dd/MM');
}

function getInitialName(email?: string, fullName?: unknown) {
  if (typeof fullName === 'string' && fullName.trim()) return fullName.trim().split(' ')[0];
  if (email) return email.split('@')[0];
  return 'paciente';
}

export default function PatientPortal() {
  const { user } = useAuth();
  const storageKey = `rhema:patient-portal:${user?.id ?? 'guest'}`;
  const defaultProfile = useMemo<PatientProfile>(() => ({
    preferredName: getInitialName(user?.email, user?.user_metadata?.full_name),
    condition: 'Artrite reumatoide',
    careGoal: 'Reduzir rigidez matinal e manter adesao ao tratamento',
    nextQuestion: 'O que mudou desde a ultima consulta?',
  }), [user?.email, user?.user_metadata?.full_name]);

  const [tab, setTab] = useState('home');
  const [profile, setProfile] = useState<PatientProfile>(() => getStored(`${storageKey}:profile`, defaultProfile));
  const [checkIn, setCheckIn] = useState<CheckIn>(() => getStored(`${storageKey}:checkin`, {
    pain: 3,
    fatigue: 4,
    stiffness: 35,
    note: '',
    updatedAt: null,
  }));
  const [completedTasks, setCompletedTasks] = useState<string[]>(() => getStored(`${storageKey}:done`, []));
  const [portalData, setPortalData] = useState<PortalPayload | null>(null);
  const [portalLoading, setPortalLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [activationCode, setActivationCode] = useState('');
  const [activationMrn, setActivationMrn] = useState('');
  const [activationError, setActivationError] = useState<string | null>(null);

  const loadPortal = async () => {
    setPortalLoading(true);
    const { data, error } = await supabase.rpc('get_my_patient_portal' as never);
    if (error) {
      setPortalData({ ok: false, error: error.message });
    } else {
      setPortalData((data as unknown as PortalPayload) ?? { ok: false, error: 'empty_response' });
    }
    setPortalLoading(false);
  };

  useEffect(() => {
    void loadPortal();
  }, []);

  useEffect(() => {
    const patient = portalData?.patient;
    if (!patient) return;
    setProfile((current) => ({
      ...current,
      condition: patient.diagnosis_tags?.[0] ?? current.condition,
      careGoal: patient.risk_flags?.length
        ? `Acompanhar risco: ${patient.risk_flags.join(', ')}`
        : current.careGoal,
    }));
  }, [portalData?.patient]);

  useEffect(() => {
    setProfile((current) => {
      if (current.preferredName && current.preferredName !== 'paciente') return current;
      return { ...current, preferredName: defaultProfile.preferredName };
    });
  }, [defaultProfile.preferredName]);

  useEffect(() => {
    localStorage.setItem(`${storageKey}:profile`, JSON.stringify(profile));
  }, [profile, storageKey]);

  useEffect(() => {
    localStorage.setItem(`${storageKey}:checkin`, JSON.stringify(checkIn));
  }, [checkIn, storageKey]);

  useEffect(() => {
    localStorage.setItem(`${storageKey}:done`, JSON.stringify(completedTasks));
  }, [completedTasks, storageKey]);

  const scoreHistory = useMemo(() => {
    const scores = portalData?.scores ?? [];
    return scores
      .map((score) => ({
        date: format(new Date(score.created_at), 'dd/MM'),
        score: Number(score.calculated_score),
      }))
      .filter((score) => Number.isFinite(score.score))
      .slice(-6);
  }, [portalData?.scores]);

  const medicationRows = useMemo<MedicationRow[]>(() => {
    const prescriptions = portalData?.prescriptions ?? [];
    return prescriptions.flatMap((prescription) => {
      if (!Array.isArray(prescription.items)) return [];
      return prescription.items.map((item, index) => ({
        name: item.drug || `Medicamento ${index + 1}`,
        dose: [item.dose, item.frequency].filter(Boolean).join(' - ') || 'Conferir prescricao',
        nextDue: prescription.signed_at ? addDays(new Date(prescription.signed_at), 1) : new Date(prescription.created_at),
        instruction: item.instructions || prescription.notes || 'Siga a orientacao registrada pela equipe.',
      }));
    });
  }, [portalData?.prescriptions]);

  const currentScore = scoreHistory[scoreHistory.length - 1]?.score ?? 0;
  const previousScore = scoreHistory[scoreHistory.length - 2]?.score ?? currentScore;
  const scoreDelta = currentScore - previousScore;
  const hasScores = scoreHistory.length > 0;

  const careTasks = useMemo<CareTask[]>(() => [
    ...medicationRows.map((med) => ({
      id: `med-${med.name}`,
      title: med.name,
      detail: med.dose,
      due: med.nextDue,
      type: 'medication' as const,
    })),
    ...((portalData?.monitoring ?? []).map((event) => ({
      id: `monitoring-${event.id}`,
      title: event.event_type,
      detail: event.notes || 'Monitoramento definido pela equipe',
      due: new Date(event.due_date),
      type: 'exam' as const,
    }))),
    ...(portalData?.patient?.next_followup_date ? [{
      id: 'next-followup',
      title: 'Consulta de seguimento',
      detail: `Cartao ${portalData.patient.patient_code}`,
      due: new Date(portalData.patient.next_followup_date),
      type: 'visit' as const,
    }] : []),
    {
      id: 'self-checkin',
      title: 'Registrar sintomas',
      detail: 'Dor, fadiga, rigidez e pergunta para consulta',
      due: new Date(),
      type: 'selfcare',
    },
  ].sort((a, b) => a.due.getTime() - b.due.getTime()), [medicationRows, portalData?.monitoring, portalData?.patient]);

  const openTasks = careTasks.filter((task) => !completedTasks.includes(task.id));
  const overdueTasks = openTasks.filter((task) => isBefore(task.due, new Date()) && !isToday(task.due));
  const personalizedEducation = EDUCATION_LIBRARY.filter((item) => {
    const haystack = `${profile.condition} ${profile.careGoal} ${checkIn.note} ${medicationRows.map((m) => m.name).join(' ')} ${(portalData?.patient?.therapy_tags ?? []).join(' ')}`.toLowerCase();
    return item.match.some((tag) => haystack.includes(tag));
  }).slice(0, 4);
  const recommendedEducation = personalizedEducation.length > 0 ? personalizedEducation : EDUCATION_LIBRARY.slice(0, 4);

  const saveCheckIn = () => {
    setCheckIn((current) => ({ ...current, updatedAt: new Date().toISOString() }));
    toast.success('Check-in salvo para sua proxima revisao');
  };

  const completeTask = (taskId: string) => {
    setCompletedTasks((current) => current.includes(taskId) ? current : [...current, taskId]);
    toast.success('Tarefa marcada como concluida');
  };

  const resetTask = (taskId: string) => {
    setCompletedTasks((current) => current.filter((id) => id !== taskId));
  };

  const claimPortal = async () => {
    setActivationError(null);
    setClaiming(true);
    const { data, error } = await supabase.rpc('claim_my_patient_portal' as never, {
      p_patient_code: activationCode.trim(),
      p_mrn_last4: activationMrn.trim() || null,
    } as never);
    setClaiming(false);

    if (error) {
      setActivationError(error.message);
      return;
    }

    const result = data as unknown as { ok: boolean; error?: string };
    if (!result?.ok) {
      const message = {
        patient_not_found: 'Nao encontrei um paciente existente com esse codigo.',
        patient_match_not_unique: 'Esse codigo encontra mais de um paciente. Peça para a equipe gerar um identificador unico.',
        patient_already_linked: 'Esse paciente ja esta vinculado a outro acesso.',
        patient_code_required: 'Informe o codigo do paciente.',
      }[result?.error ?? ''] ?? 'Nao foi possivel ativar o portal.';
      setActivationError(message);
      return;
    }

    toast.success('Portal vinculado ao paciente existente');
    await loadPortal();
  };

  if (portalLoading) {
    return (
      <AppLayout>
        <div className="flex min-h-[60vh] items-center justify-center p-6">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Carregando vinculo unico do paciente...</span>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!portalData?.ok || !portalData.patient) {
    return (
      <AppLayout>
        <main className="min-h-screen bg-background px-4 py-8 md:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl space-y-4">
            <Card>
              <CardHeader>
                <Badge variant="secondary" className="w-fit">Ativacao unica</Badge>
                <CardTitle>Conectar este acesso a um paciente existente</CardTitle>
                <CardDescription>
                  O portal do paciente nao cria novo cadastro. Ele precisa ser vinculado a um unico cartao ja aberto pela equipe clinica.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                  Use o codigo de paciente recebido da equipe. Se houver final de prontuario, informe tambem para evitar ambiguidade.
                </div>
                <label className="block space-y-2">
                  <span className="text-sm font-medium">Codigo do paciente</span>
                  <Input value={activationCode} onChange={(event) => setActivationCode(event.target.value)} placeholder="Ex.: RHEMA-001" />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium">Final do prontuario, se fornecido</span>
                  <Input value={activationMrn} onChange={(event) => setActivationMrn(event.target.value)} placeholder="4 digitos" maxLength={4} />
                </label>
                {activationError && (
                  <div className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{activationError}</span>
                  </div>
                )}
                <Button className="w-full" onClick={claimPortal} disabled={claiming}>
                  {claiming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Ativar portal unico
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <main className="min-h-screen bg-background">
        <section className="border-b bg-muted/25">
          <div className="px-4 py-6 md:px-6 lg:px-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl space-y-3">
                <Badge variant="secondary" className="w-fit gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Portal pessoal de cuidado
                </Badge>
                <div>
                  <h1 className="text-2xl font-semibold tracking-normal md:text-3xl">
                    Ola, {profile.preferredName}. Seu cuidado em um so lugar.
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                    Acompanhe sintomas, medicamentos, tarefas e conteudos alinhados ao seu plano. Este portal apoia a consulta, mas nao substitui atendimento medico.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setTab('checkin')}>
                  <ClipboardList className="mr-2 h-4 w-4" />
                  Fazer check-in
                </Button>
                <Button asChild>
                  <Link to="/learn">
                    <BookOpen className="mr-2 h-4 w-4" />
                    Biblioteca
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <div className="px-4 py-6 md:px-6 lg:px-8">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={<Activity className="h-4 w-4" />} label="Atividade estimada" value={hasScores ? currentScore.toFixed(1) : 'Sem score'} detail="Registro vinculado ao prontuario" tone="primary" />
            <MetricCard icon={<TrendingDown className="h-4 w-4" />} label="Tendencia" value={hasScores ? (scoreDelta <= 0 ? 'Melhorando' : 'Observar') : 'Aguardando'} detail={hasScores ? `${Math.abs(scoreDelta).toFixed(1)} vs ultima medida` : 'Sem serie clinica registrada'} tone={scoreDelta <= 0 ? 'success' : 'warning'} />
            <MetricCard icon={<Bell className="h-4 w-4" />} label="Tarefas abertas" value={String(openTasks.length)} detail={overdueTasks.length ? `${overdueTasks.length} atrasada(s)` : 'Sem atrasos'} tone={overdueTasks.length ? 'warning' : 'success'} />
            <MetricCard icon={<Target className="h-4 w-4" />} label="Meta atual" value="Plano ativo" detail={profile.careGoal} tone="info" />
          </div>

          <Tabs value={tab} onValueChange={setTab} className="mt-6">
            <TabsList className="grid h-auto w-full grid-cols-2 gap-1 md:grid-cols-6">
              <TabsTrigger value="home">Hoje</TabsTrigger>
              <TabsTrigger value="checkin">Check-in</TabsTrigger>
              <TabsTrigger value="plan">Plano</TabsTrigger>
              <TabsTrigger value="sessions">Sessões</TabsTrigger>
              <TabsTrigger value="learn">Aprender</TabsTrigger>
              <TabsTrigger value="messages">Contato</TabsTrigger>
            </TabsList>

            <TabsContent value="home" className="mt-5 space-y-4">
              <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Calendar className="h-4 w-4 text-primary" />
                      Linha do tempo de hoje
                    </CardTitle>
                    <CardDescription>Proximas acoes ordenadas por data e prioridade.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {careTasks.map((task) => {
                      const done = completedTasks.includes(task.id);
                      return (
                        <div key={task.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={done ? 'secondary' : isToday(task.due) ? 'default' : 'outline'}>
                                {getDueLabel(task.due)}
                              </Badge>
                              <p className="font-medium">{task.title}</p>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">{task.detail}</p>
                          </div>
                          {done ? (
                            <Button size="sm" variant="ghost" onClick={() => resetTask(task.id)}>Reabrir</Button>
                          ) : (
                            <Button size="icon" variant="outline" onClick={() => completeTask(task.id)} aria-label={`Concluir ${task.title}`}>
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <TrendingDown className="h-4 w-4 text-primary" />
                      Tendencia clinica
                    </CardTitle>
                    <CardDescription>Referencia visual para conversar com a equipe.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {hasScores ? (
                      <>
                        <div className="h-[220px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={scoreHistory}>
                              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                              <YAxis domain={[0, 6]} tick={{ fontSize: 12 }} />
                              <Tooltip />
                              <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))' }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="mt-4 grid gap-2 text-xs sm:grid-cols-3">
                          <LegendDot className="bg-destructive" label="Alta atividade" />
                          <LegendDot className="bg-warning" label="Atividade moderada" />
                          <LegendDot className="bg-success" label="Baixa atividade" />
                        </div>
                      </>
                    ) : (
                      <EmptyClinicalState title="Sem scores clinicos" detail="Quando a equipe registrar medidas no prontuario, a tendencia aparece aqui." />
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="checkin" className="mt-5 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Heart className="h-4 w-4 text-destructive" />
                    Check-in personalizado
                  </CardTitle>
                  <CardDescription>Registre o que importa antes da consulta. Fica salvo neste dispositivo por enquanto.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <ScaleInput label="Dor" value={checkIn.pain} onChange={(pain) => setCheckIn((c) => ({ ...c, pain }))} />
                  <ScaleInput label="Fadiga" value={checkIn.fatigue} onChange={(fatigue) => setCheckIn((c) => ({ ...c, fatigue }))} />
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">Rigidez matinal</span>
                      <span className="text-muted-foreground">{checkIn.stiffness} min</span>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      max={240}
                      value={checkIn.stiffness}
                      onChange={(event) => setCheckIn((c) => ({ ...c, stiffness: Number(event.target.value) || 0 }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="patient-note">O que mudou?</label>
                    <Textarea
                      id="patient-note"
                      value={checkIn.note}
                      onChange={(event) => setCheckIn((c) => ({ ...c, note: event.target.value }))}
                      placeholder="Ex.: acordei com mais rigidez, esqueci uma dose, tive febre, consegui caminhar melhor..."
                      className="min-h-28"
                    />
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-muted-foreground">
                      {checkIn.updatedAt ? `Ultimo check-in: ${format(new Date(checkIn.updatedAt), 'dd/MM/yyyy HH:mm')}` : 'Nenhum check-in salvo ainda.'}
                    </p>
                    <Button onClick={saveCheckIn}>Salvar check-in</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="plan" className="mt-5 space-y-4">
              <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Stethoscope className="h-4 w-4 text-primary" />
                      Perfil de cuidado
                    </CardTitle>
                    <CardDescription>Base para personalizar linguagem, conteudo e proximas tarefas.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ProfileField label="Como devo chamar voce?" value={profile.preferredName} onChange={(preferredName) => setProfile((p) => ({ ...p, preferredName }))} />
                    <ProfileField label="Condicao acompanhada" value={profile.condition} onChange={(condition) => setProfile((p) => ({ ...p, condition }))} />
                    <ProfileField label="Meta principal" value={profile.careGoal} onChange={(careGoal) => setProfile((p) => ({ ...p, careGoal }))} />
                    <ProfileField label="Pergunta para a proxima consulta" value={profile.nextQuestion} onChange={(nextQuestion) => setProfile((p) => ({ ...p, nextQuestion }))} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Pill className="h-4 w-4 text-primary" />
                      Tratamento e seguranca
                    </CardTitle>
                    <CardDescription>Resumo legivel do plano atual.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {medicationRows.length > 0 ? (
                      medicationRows.map((med) => (
                        <div key={med.name} className="rounded-lg border p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="font-medium">{med.name}</p>
                              <p className="text-sm text-muted-foreground">{med.dose}</p>
                            </div>
                            <Badge variant={isToday(med.nextDue) ? 'default' : 'outline'}>{getDueLabel(med.nextDue)}</Badge>
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">{med.instruction}</p>
                          <div className="mt-3">
                            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                              <span>Adesao estimada no mes</span>
                              <span>85%</span>
                            </div>
                            <Progress value={85} className="h-2" />
                          </div>
                        </div>
                      ))
                    ) : (
                      <EmptyClinicalState title="Sem prescricao registrada" detail="Este portal nao inventa tratamento. A lista aparece quando houver prescricao vinculada ao paciente." />
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="sessions" className="mt-5 space-y-4">
              <SessionList />
            </TabsContent>

            <TabsContent value="learn" className="mt-5 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Aprender com contexto
                  </CardTitle>
                  <CardDescription>Conteudos selecionados por condicao, tratamento e ultimo check-in.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2">
                  {recommendedEducation.map((resource) => (
                    <Link key={resource.title} to="/learn" className="rounded-lg border p-4 transition-colors hover:bg-muted/50">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <Badge variant="outline">{resource.category}</Badge>
                        <span className="text-xs text-muted-foreground">{resource.level}</span>
                      </div>
                      <p className="font-medium">{resource.title}</p>
                      <p className="mt-2 text-xs text-muted-foreground">Fonte curada: {resource.source}</p>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="messages" className="mt-5 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    Ponte com a equipe
                  </CardTitle>
                  <CardDescription>Organize o que sera levado para consulta. Envio direto sera conectado ao prontuario quando o canal seguro estiver ativo.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <p className="text-sm font-medium">Resumo para consulta</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Dor {checkIn.pain}/10, fadiga {checkIn.fatigue}/10, rigidez {checkIn.stiffness} min. Pergunta principal: {profile.nextQuestion || 'definir pergunta'}.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => {
                      void navigator.clipboard.writeText(`Check-in Rhema: dor ${checkIn.pain}/10, fadiga ${checkIn.fatigue}/10, rigidez ${checkIn.stiffness} min. Nota: ${checkIn.note || 'sem nota'}`);
                      toast.success('Resumo copiado');
                    }}>
                      Copiar resumo
                    </Button>
                    <Button onClick={() => setTab('sessions')}>Ver sessoes</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </AppLayout>
  );
}

function MetricCard({ icon, label, value, detail, tone }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  tone: 'primary' | 'success' | 'warning' | 'info';
}) {
  const toneClass = {
    primary: 'border-l-primary',
    success: 'border-l-success',
    warning: 'border-l-warning',
    info: 'border-l-info',
  }[tone];

  return (
    <Card className={`border-l-4 ${toneClass}`}>
      <CardContent className="p-4">
        <div className="mb-2 flex items-center gap-2 text-muted-foreground">
          {icon}
          <span className="text-xs font-medium">{label}</span>
        </div>
        <p className="text-2xl font-semibold">{value}</p>
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-3 w-3 rounded-full ${className}`} />
      <span>{label}</span>
    </div>
  );
}

function EmptyClinicalState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-muted-foreground">{detail}</p>
    </div>
  );
}

function ScaleInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{value}/10</span>
      </div>
      <div className="grid grid-cols-11 gap-1">
        {Array.from({ length: 11 }, (_, score) => (
          <Button
            key={score}
            type="button"
            variant={value === score ? 'default' : 'outline'}
            size="sm"
            className="h-9 px-0"
            onClick={() => onChange(score)}
          >
            {score}
          </Button>
        ))}
      </div>
    </div>
  );
}

function ProfileField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium">{label}</span>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
