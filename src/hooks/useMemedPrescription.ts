import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFn } from '@/lib/invokeEdgeFn';

/**
 * Integração oficial Memed — Sinapse Prescrição (módulo público).
 * Docs: https://memed.com.br/parceiros (Sinapse Prescrição)
 *
 * Contrato oficial:
 *  - Script: integrations.memed.com.br/modulos/plataforma.sinapse-prescricao/...
 *  - Container DOM: <div id="memed-container"></div>
 *  - Evento de boot: MdSinapsePrescricao.event.add('core:moduleInit', cb)
 *  - Auth:           MdHub.command.send('plataforma.autenticacao', 'setToken', token)
 *  - Paciente:       MdHub.command.send('plataforma.prescricao', 'setPaciente', { ... }) — chaves em PT-BR
 *  - Abrir:          MdHub.module.show('plataforma.prescricao')
 *  - Fechar:         MdHub.module.hide('plataforma.prescricao')
 *  - Prescrição:     MdHub.event.add('prescricaoSalva', cb)
 */

export interface MemedPaciente {
  /** Identificador externo do paciente (ex: patient_card_id) — recomendado pela Memed */
  idExterno?: string;
  /** Nome do paciente (obrigatório por contrato Memed) */
  nome: string;
  /** Apenas dígitos */
  cpf?: string;
  /** ISO yyyy-mm-dd */
  data_nascimento?: string;
  endereco?: string;
  cidade?: string;
  /** E.164 ou apenas dígitos */
  telefone?: string;
  /** Altura em cm */
  altura?: number;
  /** Peso em kg */
  peso?: number;
}

export interface MemedPrescricaoSalva {
  prescricao?: { id?: string | number };
  paciente?: { idExterno?: string };
  url?: string;
  // ... payload completo do Memed
  [k: string]: unknown;
}

export interface MemedHookReturn {
  ready: boolean;
  loading: boolean;
  error: string | null;
  /** true = token obtido automaticamente pelo backend */
  tokenAuto: boolean;
  setPaciente: (p: MemedPaciente) => void;
  showPrescription: () => void;
  hidePrescription: () => void;
  /** Fallback manual: usuário cola o token do Memed */
  setDoctorTokenManual: (token: string) => void;
  /** Listener para quando o médico salvar uma prescrição */
  onPrescricaoSalva: (cb: (p: MemedPrescricaoSalva) => void) => () => void;
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    MdHub?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    MdSinapsePrescricao?: any;
  }
}

const MEMED_SCRIPT_ID = 'memed-sdk-script';
const MEMED_CONTAINER_ID = 'memed-container';

const MEMED_SCRIPT_DEFAULT =
  'https://integrations.memed.com.br/modulos/plataforma.sinapse-prescricao/build/sinapse-prescricao.min.js';

function ensureContainer() {
  if (typeof document === 'undefined') return;
  if (!document.getElementById(MEMED_CONTAINER_ID)) {
    const div = document.createElement('div');
    div.id = MEMED_CONTAINER_ID;
    document.body.appendChild(div);
  }
}

function loadMemedScript(src: string, token?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ensureContainer();
    const existing = document.getElementById(MEMED_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing && existing.src === src) {
      resolve();
      return;
    }
    if (existing) existing.remove();

    const script = document.createElement('script');
    script.id = MEMED_SCRIPT_ID;
    script.src = src;
    script.async = true;
    script.dataset.color = '#0ea5e9';
    script.dataset.container = MEMED_CONTAINER_ID;
    if (token) script.dataset.token = token;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Falha ao carregar SDK Memed'));
    document.head.appendChild(script);
  });
}

/** Aguarda MdSinapsePrescricao disparar core:moduleInit (timeout 15s) */
function waitForModuleInit(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.MdHub) { resolve(); return; }
    const start = Date.now();
    const tryAttach = () => {
      if (window.MdSinapsePrescricao?.event?.add) {
        window.MdSinapsePrescricao.event.add('core:moduleInit', (modulo: { name?: string }) => {
          if (!modulo?.name || modulo.name === 'plataforma.prescricao') {
            resolve();
          }
        });
        return;
      }
      if (Date.now() - start > 15_000) {
        reject(new Error('Timeout aguardando MdSinapsePrescricao'));
        return;
      }
      setTimeout(tryAttach, 100);
    };
    tryAttach();
  });
}

export function useMemedPrescription(): MemedHookReturn {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenAuto, setTokenAuto] = useState(false);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        // 1) Tentar token automático via Edge Function (perfil precisa ter CRM)
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;

        let token: string | undefined;
        let scriptUrl = MEMED_SCRIPT_DEFAULT;

        if (accessToken) {
          const res = await invokeEdgeFn<{
            token?: string;
            scriptUrl?: string;
            reason?: string;
          }>('memed-token');
          if (!res.error && res.data) {
            if (res.data.token) token = res.data.token;
            if (res.data.scriptUrl) scriptUrl = res.data.scriptUrl;
            if (!token && res.data.reason) {
              console.info('[Memed] Token automático indisponível:', res.data.reason);
            }
          } else if (res.error) {
            console.warn('[Memed] memed-token falhou:', res.error);
          }
        }

        await loadMemedScript(scriptUrl, token);
        await waitForModuleInit();

        // Garante que o token foi entregue (caso script-data-token não tenha pego)
        if (token && window.MdHub?.command?.send) {
          window.MdHub.command.send('plataforma.autenticacao', 'setToken', token);
          setTokenAuto(true);
        }

        setReady(true);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[Memed] init error:', msg);
        setError(msg);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const setDoctorTokenManual = useCallback((token: string) => {
    if (!window.MdHub?.command?.send) {
      console.warn('[Memed] MdHub não inicializado');
      return;
    }
    window.MdHub.command.send('plataforma.autenticacao', 'setToken', token);
    setTokenAuto(true);
  }, []);

  const setPaciente = useCallback((p: MemedPaciente) => {
    if (!window.MdHub?.command?.send) {
      console.warn('[Memed] MdHub não inicializado');
      return;
    }
    // Contrato oficial Memed — chaves em PT-BR
    window.MdHub.command.send('plataforma.prescricao', 'setPaciente', {
      idExterno: p.idExterno,
      nome: p.nome,
      cpf: p.cpf?.replace(/\D/g, ''),
      data_nascimento: p.data_nascimento,
      endereco: p.endereco,
      cidade: p.cidade,
      telefone: p.telefone?.replace(/\D/g, ''),
      altura: p.altura,
      peso: p.peso,
    });
  }, []);

  const showPrescription = useCallback(() => {
    if (!window.MdHub?.module?.show) {
      console.warn('[Memed] MdHub não inicializado');
      return;
    }
    window.MdHub.module.show('plataforma.prescricao');
  }, []);

  const hidePrescription = useCallback(() => {
    if (!window.MdHub?.module?.hide) return;
    window.MdHub.module.hide('plataforma.prescricao');
  }, []);

  const onPrescricaoSalva = useCallback(
    (cb: (p: MemedPrescricaoSalva) => void) => {
      if (!window.MdHub?.event?.add) {
        console.warn('[Memed] MdHub.event indisponível');
        return () => {};
      }
      window.MdHub.event.add('prescricaoSalva', cb);
      // Memed SDK não expõe remove confiável; devolvemos noop
      return () => {};
    },
    [],
  );

  return {
    ready,
    loading,
    error,
    tokenAuto,
    setPaciente,
    showPrescription,
    hidePrescription,
    setDoctorTokenManual,
    onPrescricaoSalva,
  };
}
