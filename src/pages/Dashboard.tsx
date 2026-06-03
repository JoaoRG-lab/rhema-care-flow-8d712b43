import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatCard } from '@/components/ui/StatCard';
import { DiagnosisTag } from '@/components/ui/DiagnosisTag';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useVerificationStatus } from '@/hooks/useVerificationStatus';
import { usePersona } from '@/hooks/usePersona';
import { VerifiedBadge } from '@/components/ui/VerifiedBadge';
import { WelcomeCard } from '@/components/dashboard/WelcomeCard';
import { VerificationPrompt } from '@/components/dashboard/VerificationPrompt';
import { QuickPatientSearch } from '@/components/clinical/QuickPatientSearch';
import { VoiceNoteButton } from '@/components/clinical/VoiceNoteButton';
import { ContributeKnowledge } from '@/components/dashboard/ContributeKnowledge';
import { PatientStatistics } from '@/components/dashboard/PatientStatistics';
import { SessionList } from '@/components/consultations/SessionList';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '@/components/ui/PullToRefreshIndicator';
import { useDailyCompliment } from '@/hooks/useDailyCompliment';
import { AISiteAgentWidget } from '@/components/ai/AISiteAgentWidget';
import { useToast } from '@/hooks/use-toast';
import {
  DIAGNOSIS_OPTIONS,
} from '@/config/clinical';
import type { PatientCard, MonitoringEvent } from '@/types/clinical';
import {
  Users,
  AlertTriangle,
  Calendar,
  Syringe,
  Plus,
  ChevronRight,
  CheckSquare,
  Clock,
  Zap,
  Video,
  Activity,
  Calculator,
  Pill,
  Weight,
} from 'lucide-react';
import { format, addDays, isAfter, isBefore } from 'date-fns';
import { useIsMobile } from '@/hooks/use-mobile';

// ─── Biologic dose calculator types ─────────────────────────────────────────
const BIOLOGICS = [
  { id: 'rtx', name: 'Rituximabe', dose: null, unit: 'mg', fixedDose: 1000, route: 'IV', cycleWeeks: 24, note: '1000 mg D0 e D14, ciclos de 6m' },
  { id: 'toci', name: 'Tocilizumabe', dose: 8, unit: 'mg/kg', fixedDose: null, route: 'IV', cycleWeeks: 4, note: '8 mg/kg IV q4sem (máx 800 mg)' },
  { id: 'abata', name: 'Abatacepte', dose: null, unit: 'mg', fixedDose: null, route: 'IV', cycleWeeks: 4, note: '<60 kg: 500 mg | 60-100 kg: 750 mg | >100 kg: 1000 mg' },
  { id: 'infli', name: 'Infliximabe', dose: 3, unit: 'mg/kg', fixedDose: null, route: 'IV', cycleWeeks: 8, note: '3 mg/kg D0, D14, D42, depois q8sem (AR)' },
  { id: 'beli', name: 'Belimumabe', dose: 10, unit: 'mg/kg', fixedDose: null, route: 'IV', cycleWeeks: 4, note: '10 mg/kg D0, D14, D28, depois q4sem (LES)' },
];

function calcAbataceptDose(weight: number): number {
  if (weight < 60) return 500;
  if (weight <= 100) return 750;
  return 1000;
}

function BiologicDoseCalculator() {
  const [biologic, setBiologic] = useState(BIOLOGICS[0].id);
  const [weight, setWeight] = useState('');
  const selected = BIOLOGICS.find(b => b.id === biologic)!;

  const calcDose = (): string => {
    const w = parseFloat(weight);
    if (!w || w <= 0) return '—';
    if (selected.id === 'rtx') return '1000 mg (fixo)';
    if (selected.id === 'abata') return `${calcAbataceptDose(w)} mg (baseado no peso)`;
    if (selected.dose) {
      const raw = selected.dose * w;
      const capped = selected.id === 'toci' ? Math.min(raw, 800) : raw;
      return `${capped.toFixed(0)} mg`;
    }
    return '—';
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Weight className="h-4 w-4 text-primary" />
          Calculadora de Dose — Biológicos IV
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Biológico</label>
            <select
              value={biologic}
              onChange={e => setBiologic(e.target.value)}
              className="w-full text-sm border border-border rounded-md px-2 py-1.5 bg-background"
            >
              {BIOLOGICS.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Peso (kg)</label>
            <input
              type="number"
              min="20"
              max="250"
              value={weight}
              onChange={e => setWeight(e.target.value)}
              placeholder="ex: 68"
              className="w-full text-sm border border-border rounded-md px-2 py-1.5 bg-background"
            />
          </div>
        </div>
        <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-3">
          <p className="text-xs text-muted-foreground">Dose calculada</p>
          <p className="text-xl font-bold text-primary mt-0.5">{calcDose()}</p>
          <p className="text-xs text-muted-foreground mt-1">{selected.note}</p>
        </div>
        <p className="text-[11px] text-muted-foreground">
          ⚠️ Conferir função renal/hepática e peso atual antes de cada infusão.
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Disease activity distribution ──────────────────────────────────────────
type ActivityLevel = 'remissão' | 'baixa' | 'moderada' | 'alta';
const ACTIVITY_COLORS: Record<ActivityLevel, string> = {
  remissão: 'bg-success/10 text-success border-success/30',
  baixa: 'bg-primary/10 text-primary border-primary/30',
  moderada: 'bg-warning/10 text-warning border-warning/30',
  alta: 'bg-destructive/10 text-destructive border-destructive/30',
};

// ─── Main Dashboard ──────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user } = useAuth();
  const { status, tier, contributorType, fullName } = useVerificationStatus();
  const { persona } = usePersona();
  const { toast } = useToast();
  const [patients, setPatients] = useState<PatientCard[]>([]);
  const [monitoringAlerts, setMonitoringAlerts] = useState<MonitoringEvent[]>([]);
  const [upcomingFollowups, setUpcomingFollowups] = useState<PatientCard[]>([]);
  const [infusionCount, setInfusionCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const isMobile = useIsMobile();

  // Checklist persisted by calendar day
  const todayKey = `checklist-${format(new Date(), 'yyyy-MM-dd')}`;
  const CHECKLIST_ITEMS = [
    'Sala preparada',
    'Ultrassom calibrado',
    'Requisições de laboratório prontas',
    'Blocos de prescrição disponíveis',
    'Agenda de infusões revisada',
  ];
  const [checklist, setChecklist] = useState<boolean[]>(() => {
    try {
      const saved = sessionStorage.getItem(todayKey);
      return saved ? JSON.parse(saved) : CHECKLIST_ITEMS.map(() => false);
    } catch {
      return CHECKLIST_ITEMS.map(() => false);
    }
  });

  const toggleCheck = (idx: number) => {
    const next = checklist.map((v, i) => (i === idx ? !v : v));
    setChecklist(next);
    try { sessionStorage.setItem(todayKey, JSON.stringify(next)); } catch {}
  };

  useDailyCompliment();

  const fetchData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setDashboardError(null);
    const today = new Date();
    const nextWeek = addDays(today, 7);
    const errors: string[] = [];

    try {
      const { data: patientData, error: patientError } = await supabase
        .from('patient_cards_secure')
        .select('*')
        .eq('user_id', user.id);

      if (patientError) {
        errors.push(`Pacientes: ${patientError.message}`);
        setPatients([]);
        setUpcomingFollowups([]);
      } else {
        const safePatientData = patientData ?? [];
        setPatients(safePatientData);
        const upcoming = safePatientData.filter(p => {
          if (!p.next_followup_date) return false;
          const followupDate = new Date(p.next_followup_date);
          return isAfter(followupDate, today) && isBefore(followupDate, nextWeek);
        });
        setUpcomingFollowups(upcoming.slice(0, 5));
      }

      const { data: monitoringData, error: monitoringError } = await supabase
        .from('monitoring_events_secure')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .lte('due_date', format(nextWeek, 'yyyy-MM-dd'))
        .order('due_date', { ascending: true })
        .limit(5);

      if (monitoringError) {
        errors.push(`Monitoramento: ${monitoringError.message}`);
        setMonitoringAlerts([]);
      } else {
        setMonitoringAlerts(monitoringData ?? []);
      }

      const { count: infCount, error: infusionError } = await supabase
        .from('monitoring_events_secure')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('event_type', 'infusion')
        .eq('status', 'pending');

      if (infusionError) {
        errors.push(`Infusões: ${infusionError.message}`);
        setInfusionCount(0);
      } else {
        setInfusionCount(infCount ?? 0);
      }

      if (errors.length > 0) {
        const message = errors.join(' | ');
        setDashboardError(message);
        toast({
          title: 'Dashboard carregado parcialmente',
          description: 'Algumas consultas clínicas não responderam. A tela continua disponível.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Dashboard fetch failed:', error);
      setDashboardError(error instanceof Error ? error.message : 'Falha inesperada ao carregar o dashboard.');
      setPatients([]);
      setUpcomingFollowups([]);
      setMonitoringAlerts([]);
      setInfusionCount(0);
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    fetchData();
  }, [user, fetchData]);

  const { ref: pullRef, pullDistance, isRefreshing, progress, shouldTrigger } = usePullToRefresh<HTMLDivElement>({
    onRefresh: async () => { await fetchData(); },
    enabled: isMobile,
  });

  const overdueCount = monitoringAlerts.filter(m =>
    isBefore(new Date(m.due_date), new Date())
  ).length;

  // Disease activity distribution (simplified heuristic based on diagnosis tags)
  const activityDistribution: Record<ActivityLevel, number> = { remissão: 0, baixa: 0, moderada: 0, alta: 0 };
  patients.forEach(p => {
    const level = (p as any).disease_activity_level as ActivityLevel | undefined;
    if (level && activityDistribution[level] !== undefined) {
      activityDistribution[level]++;
    } else {
      // fallback: distribute proportionally for display when field not yet present
      activityDistribution['moderada']++;
    }
  });

  const getGreeting = () => {
    const hour = new Date().getHours();
    const timeGreeting = hour < 12 ? 'Bom dia' : hour < 17 ? 'Boa tarde' : 'Boa noite';
    if (!tier) return `${timeGreeting}!`;
    const formatName = () => {
      if (!fullName) return '';
      if (contributorType === 'clinical') {
        const name = fullName.trim();
        if (name.toLowerCase().startsWith('dr.') || name.toLowerCase().startsWith('dr ')) return name;
        return `Dr. ${name}`;
      }
      return fullName;
    };
    const displayName = formatName();
    switch (tier) {
      case 'expert': return `${timeGreeting}, ${displayName}! Sua expertise guia nossa comunidade.`;
      case 'ultimate': return `${timeGreeting}, ${displayName || 'Joao'}! Coordenação ultimate ativa.`;
      case 'gold': return `${timeGreeting}, ${displayName}! Obrigado pelas contribuições verificadas.`;
      case 'developer': return `${timeGreeting}, ${displayName}! Construindo algo grandioso.`;
      case 'partner': return `${timeGreeting}, ${displayName}! Que bom ter você aqui.`;
      default: return `${timeGreeting}, ${displayName}!`;
    }
  };

  // Quick score links for clinicians
  const QUICK_SCORES = [
    { label: 'DAS28-VHS', href: '/scores?calc=das28-esr', color: 'text-primary' },
    { label: 'DAS28-PCR', href: '/scores?calc=das28-crp', color: 'text-primary' },
    { label: 'CDAI', href: '/scores?calc=cdai', color: 'text-success' },
    { label: 'SDAI', href: '/scores?calc=sdai', color: 'text-success' },
    { label: 'SLEDAI', href: '/scores?calc=sledai', color: 'text-warning' },
    { label: 'BASDAI', href: '/scores?calc=basdai', color: 'text-orange-500' },
    { label: 'DAPSA', href: '/scores?calc=dapsa', color: 'text-purple-500' },
  ];

  return (
    <AppLayout>
      <div
        ref={pullRef}
        className="p-4 md:p-6 lg:p-8 relative overflow-auto"
        style={{ minHeight: '100%' }}
      >
        {isMobile && (
          <PullToRefreshIndicator
            pullDistance={pullDistance}
            isRefreshing={isRefreshing}
            progress={progress}
            shouldTrigger={shouldTrigger}
          />
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-8">
          <div>
            <div className="flex items-center gap-2 md:gap-3 mb-1 flex-wrap">
              <h1 className="text-xl md:text-2xl font-bold text-foreground">{getGreeting()}</h1>
              {tier && <VerifiedBadge tier={tier} size="sm" />}
            </div>
            <p className="text-sm md:text-base text-muted-foreground">
              {isMobile ? format(new Date(), 'dd/MM/yyyy') : `Clínica do Dia • ${format(new Date(), 'EEEE, d \' de \' MMMM \' de \' yyyy')}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/patients">
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                {isMobile ? 'Novo' : 'Novo Paciente'}
              </Button>
            </Link>
          </div>
        </div>

        {/* Quick Patient Search + Actions - Clinical Mode */}
        {persona === 'clinical' && (
          <Card className="mb-6 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <Zap className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">Ações Rápidas</h3>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <QuickPatientSearch />
                <div className="flex items-center gap-2">
                  <VoiceNoteButton onTranscript={() => {}} />
                  <span className="text-xs text-muted-foreground hidden sm:inline">Nota de voz</span>
                </div>
                {/* FIX: using Link instead of <a> to avoid full page reload */}
                <Link to="/teleconsulta">
                  <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors">
                    <Video className="h-4 w-4" />
                    Teleconsulta
                  </button>
                </Link>
              </div>

              {/* Quick Scores Row */}
              <div className="border-t border-border/50 pt-3">
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                  <Activity className="h-3.5 w-3.5" />
                  Scores rápidos
                </p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_SCORES.map(s => (
                    <Link key={s.label} to={s.href}>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border bg-background hover:bg-muted transition-colors cursor-pointer ${s.color}`}>
                        {s.label}
                      </span>
                    </Link>
                  ))}
                  <Link to="/scores">
                    <span className="text-xs px-2.5 py-1 rounded-full border bg-background hover:bg-muted transition-colors cursor-pointer text-muted-foreground">
                      + todos os scores →
                    </span>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Verification Prompt */}
        {tier === null && (
          <div className="mb-4 md:mb-6">
            <VerificationPrompt status={status} />
          </div>
        )}

        {/* Welcome Card */}
        <div className="mb-6 md:mb-8">
          <WelcomeCard tier={tier} fullName={fullName} />
        </div>

        {dashboardError && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Dashboard carregado parcialmente</AlertTitle>
            <AlertDescription>
              {dashboardError}
            </AlertDescription>
          </Alert>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
          <StatCard
            title={isMobile ? 'Pacientes' : 'Pacientes Ativos'}
            value={patients.length}
            icon={<Users className="h-5 w-5" />}
          />
          <StatCard
            title={isMobile ? 'Alertas' : 'Alertas de Monitoramento'}
            value={overdueCount}
            icon={<AlertTriangle className="h-5 w-5" />}
            description={isMobile ? undefined : (overdueCount > 0 ? 'Ação necessária' : 'Tudo em ordem')}
            trend={overdueCount > 0 ? 'down' : 'up'}
          />
          <StatCard
            title={isMobile ? 'Retornos' : 'Retornos Esta Semana'}
            value={upcomingFollowups.length}
            icon={<Calendar className="h-5 w-5" />}
          />
          <StatCard
            title={isMobile ? 'Infusões' : 'Infusões Agendadas'}
            value={loading ? '…' : infusionCount}
            icon={<Syringe className="h-5 w-5" />}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-2 gap-4 md:gap-6">
          <PatientStatistics />

          {/* Monitoring Alerts */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base md:text-lg flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 md:h-5 md:w-5 text-warning" />
                Alertas de Monitoramento
              </CardTitle>
              <Link to="/monitoring">
                <Button variant="ghost" size="sm" className="gap-1">
                  {isMobile ? '' : 'Ver todos'} <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {monitoringAlerts.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4 text-center">
                  Nenhum alerta de monitoramento pendente
                </p>
              ) : (
                <div className="space-y-3">
                  {monitoringAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{alert.event_type}</p>
                          <p className="text-xs text-muted-foreground">
                            Vence: {format(new Date(alert.due_date), 'dd/MM')}
                          </p>
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        isBefore(new Date(alert.due_date), new Date())
                          ? 'status-overdue'
                          : 'status-pending'
                      }`}>
                        {isBefore(new Date(alert.due_date), new Date()) ? 'Atrasado' : 'Pendente'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Followups */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base md:text-lg flex items-center gap-2">
                <Calendar className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                {isMobile ? 'Retornos' : 'Próximos Retornos'}
              </CardTitle>
              <Link to="/patients">
                <Button variant="ghost" size="sm" className="gap-1">
                  {isMobile ? '' : 'Ver todos'} <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {upcomingFollowups.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4 text-center">
                  Nenhum retorno agendado esta semana
                </p>
              ) : (
                <div className="space-y-3">
                  {upcomingFollowups.map((patient) => {
                    // FIX: safe date access — no forced non-null assertion
                    const followupDate = patient.next_followup_date
                      ? new Date(patient.next_followup_date)
                      : null;
                    return (
                      <div
                        key={patient.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <div>
                          <p className="text-sm font-medium">{patient.patient_code}</p>
                          <div className="flex gap-1 mt-1">
                            {patient.diagnosis_tags.slice(0, 2).map((tag) => (
                              <DiagnosisTag key={tag} tag={tag} size="sm" />
                            ))}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {followupDate ? format(followupDate, 'dd/MM') : '—'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Clinic Day Checklist — persists per day via sessionStorage */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base md:text-lg flex items-center gap-2">
                <CheckSquare className="h-4 w-4 md:h-5 md:w-5 text-success" />
                Checklist do Dia
                <span className="ml-auto text-xs font-normal text-muted-foreground">
                  {checklist.filter(Boolean).length}/{CHECKLIST_ITEMS.length}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {CHECKLIST_ITEMS.map((item, idx) => (
                  <label
                    key={idx}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={checklist[idx]}
                      onChange={() => toggleCheck(idx)}
                      className="h-4 w-4 rounded border-border"
                    />
                    <span className={`text-sm ${checklist[idx] ? 'line-through text-muted-foreground' : ''}`}>
                      {item}
                    </span>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Disease Activity Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base md:text-lg flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Atividade de Doença
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 mb-4">
                {(Object.keys(activityDistribution) as ActivityLevel[]).map(level => {
                  const count = activityDistribution[level];
                  const pct = patients.length > 0 ? Math.round((count / patients.length) * 100) : 0;
                  return (
                    <div key={level} className="flex items-center gap-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border capitalize min-w-[80px] text-center ${ACTIVITY_COLORS[level]}`}>
                        {level}
                      </span>
                      <div className="flex-1 bg-muted rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-primary transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-8 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
              <div className="border-t pt-3">
                <p className="text-xs text-muted-foreground mb-2">Por diagnóstico</p>
                <div className="flex flex-wrap gap-2">
                  {[...DIAGNOSIS_OPTIONS].map((dx) => {
                    const count = patients.filter(p => p.diagnosis_tags.includes(dx)).length;
                    return (
                      <div key={dx} className="flex items-center gap-2">
                        <DiagnosisTag tag={dx} size="md" />
                        <span className="text-sm text-muted-foreground">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Biologic Dose Calculator */}
          <BiologicDoseCalculator />

          <ContributeKnowledge />
          <AISiteAgentWidget />
          <SessionList compact />
        </div>
      </div>
    </AppLayout>
  );
}
