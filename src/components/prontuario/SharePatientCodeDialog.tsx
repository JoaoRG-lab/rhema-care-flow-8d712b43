import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Share2, Copy, Check, ShieldCheck, ExternalLink, QrCode, Eye, UserRoundCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useProntuarioAccessLog } from '@/hooks/useSharedRecord';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { copyText } from '@/lib/clipboard';

interface SharePatientCodeDialogProps {
  patientCode: string;
  mrnLast4?: string | null;
  children?: React.ReactNode;
}

// QR Code simples via API pública (sem lib extra)
function QRCodeImage({ value }: { value: string }) {
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(value)}`;
  return (
    <img
      src={url}
      alt={`QR Code para ${value}`}
      className="w-44 h-44 rounded-xl border mx-auto"
    />
  );
}

export function SharePatientCodeDialog({ patientCode, mrnLast4, children }: SharePatientCodeDialogProps) {
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<'codigo' | 'portal' | 'log'>('codigo');
  const { logs, loading: logsLoading, fetchLogs } = useProntuarioAccessLog(patientCode);

  const prontuarioUrl = `${window.location.origin}/prontuario?codigo=${encodeURIComponent(patientCode)}`;
  const patientPortalUrl = `${window.location.origin}/patient-portal?codigo=${encodeURIComponent(patientCode)}`;

  const copiarCodigo = async () => {
    const ok = await copyText(patientCode);
    if (!ok) {
      toast.error('Nao foi possivel copiar o codigo');
      return;
    }
    setCopied(true);
    toast.success('Código copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const copiarLink = async () => {
    const ok = await copyText(prontuarioUrl);
    if (ok) toast.success('Link copiado!');
    else toast.error('Nao foi possivel copiar o link');
  };

  const copiarPortal = async () => {
    const instruction = [
      'Acesse o Portal do Paciente:',
      patientPortalUrl,
      '',
      `Codigo do paciente: ${patientCode}`,
      mrnLast4 ? `Final do prontuario: ${mrnLast4}` : null,
      '',
      'Use esse acesso apenas se voce for o paciente ou cuidador autorizado.',
    ].filter(Boolean).join('\n');
    const ok = await copyText(instruction);
    if (ok) toast.success('Convite do portal copiado!');
    else toast.error('Nao foi possivel copiar o convite do portal');
  };

  const onOpenChange = (open: boolean) => {
    if (open && tab === 'log') fetchLogs();
  };

  return (
    <Dialog onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {children ?? (
          <Button size="sm" variant="outline" className="gap-2">
            <Share2 className="h-4 w-4" />
            Compartilhar Prontuário
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Prontuário Integrado
          </DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex border-b border-border -mx-1">
          {(['codigo', 'portal', 'log'] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); if (t === 'log') fetchLogs(); }}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                tab === t
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t === 'codigo' ? 'Código & QR' : t === 'portal' ? 'Portal do paciente' : 'Log de Acessos'}
            </button>
          ))}
        </div>

        {tab === 'codigo' && (
          <div className="space-y-5 pt-1">
            <p className="text-sm text-muted-foreground text-center">
              Compartilhe o código abaixo com outro profissional de saúde. 
              Ele poderá ver as evoluções <strong>sem acesso a dados de identificação</strong>.
            </p>

            {/* Código grande */}
            <div className="text-center">
              <div className="inline-flex items-center gap-3 px-6 py-4 bg-muted rounded-xl">
                <span className="font-mono text-3xl font-bold tracking-[0.2em] text-foreground">
                  {patientCode}
                </span>
                <Button size="sm" variant="ghost" onClick={copiarCodigo} className="h-8 w-8 p-0">
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* QR Code */}
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <QrCode className="h-3.5 w-3.5" />
                Ou escaneie o QR Code para acessar diretamente
              </div>
              <QRCodeImage value={prontuarioUrl} />
            </div>

            <Separator />

            {/* Link direto */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Link direto para o prontuário:</p>
              <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                <span className="text-xs font-mono truncate flex-1 text-muted-foreground">
                  {prontuarioUrl}
                </span>
                <Button size="sm" variant="ghost" onClick={copiarLink} className="h-7 w-7 p-0 shrink-0">
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => window.open(prontuarioUrl, '_blank')} className="h-7 w-7 p-0 shrink-0">
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Aviso segurança */}
            <div className="flex items-start gap-2 p-3 bg-primary/5 rounded-lg text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>
                Apenas evoluções clínicas são visíveis. Nome, CPF e outros dados 
                de identificação permanecem protegidos. Todos os acessos são auditados.
              </span>
            </div>
          </div>
        )}

        {tab === 'portal' && (
          <div className="space-y-5 pt-1">
            <p className="text-sm text-muted-foreground text-center">
              Entregue este acesso ao paciente ou cuidador autorizado. O portal vincula o login a este paciente existente uma unica vez.
            </p>

            <div className="rounded-lg border bg-muted/40 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                <UserRoundCheck className="h-4 w-4 text-primary" />
                Convite de ativacao
              </div>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Link do portal</p>
                  <div className="mt-1 flex items-center gap-2 rounded-md bg-background p-2">
                    <span className="min-w-0 flex-1 truncate font-mono text-xs">{patientPortalUrl}</span>
                    <Button size="sm" variant="ghost" onClick={copiarPortal} className="h-7 w-7 p-0 shrink-0">
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => window.open(patientPortalUrl, '_blank')} className="h-7 w-7 p-0 shrink-0">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-md bg-background p-3">
                    <p className="text-xs text-muted-foreground">Codigo</p>
                    <p className="font-mono text-lg font-semibold tracking-wide">{patientCode}</p>
                  </div>
                  <div className="rounded-md bg-background p-3">
                    <p className="text-xs text-muted-foreground">Final</p>
                    <p className="font-mono text-lg font-semibold tracking-wide">{mrnLast4 || 'Nao usado'}</p>
                  </div>
                </div>
              </div>
            </div>

            <Button onClick={copiarPortal} className="w-full gap-2">
              <Copy className="h-4 w-4" />
              Copiar convite para o paciente
            </Button>

            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                O paciente nao cria outro cadastro clinico. Ele apenas reivindica este cartao existente. Se o paciente ja tiver sido vinculado, novas tentativas serao bloqueadas.
              </span>
            </div>
          </div>
        )}

        {tab === 'log' && (
          <div className="space-y-3 pt-1 min-h-[200px]">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Eye className="h-3.5 w-3.5" />
              Profissionais que consultaram este prontuário
            </div>

            {logsLoading && (
              <div className="text-center text-sm text-muted-foreground py-8">Carregando…</div>
            )}

            {!logsLoading && logs.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-8">
                Nenhum acesso externo registrado ainda
              </div>
            )}

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {logs.map(log => (
                <div key={log.id} className="flex items-start justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium">
                      {log.accessor_name ?? 'Profissional anônimo'}
                      {log.accessor_crm && (
                        <Badge variant="outline" className="ml-2 text-[10px] px-1.5">
                          {log.accessor_crm}
                        </Badge>
                      )}
                    </p>
                    {log.accessor_specialty && (
                      <p className="text-xs text-muted-foreground">{log.accessor_specialty}</p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(parseISO(log.accessed_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
