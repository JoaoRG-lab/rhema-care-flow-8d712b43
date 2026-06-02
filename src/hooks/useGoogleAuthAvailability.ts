import { useEffect, useState } from 'react';
import { supabasePublishableKey, supabaseUrl } from '@/integrations/supabase/client';

type GoogleAuthAvailability = {
  enabled: boolean;
  loading: boolean;
  status: 'enabled' | 'disabled' | 'unknown';
  message: string | null;
};

export function useGoogleAuthAvailability(): GoogleAuthAvailability {
  const [state, setState] = useState<GoogleAuthAvailability>({
    enabled: false,
    loading: true,
    status: 'unknown',
    message: null,
  });

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const publishableKey = supabasePublishableKey;

      if (!supabaseUrl || !publishableKey) {
        if (!cancelled) {
          setState({
            enabled: false,
            loading: false,
            status: 'unknown',
            message: 'Configuração Supabase incompleta neste ambiente.',
          });
        }
        return;
      }

      try {
        const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
          headers: { apikey: publishableKey },
        });

        if (!response.ok) {
          if (!cancelled) {
            setState({
              enabled: true,
              loading: false,
              status: 'unknown',
              message: 'Não foi possível confirmar o status do Google Auth; tentando pelo Supabase.',
            });
          }
          return;
        }

        const settings = await response.json();
        const enabled = settings?.external?.google === true;
        if (!cancelled) {
          setState({
            enabled,
            loading: false,
            status: enabled ? 'enabled' : 'disabled',
            message: enabled ? null : 'Google Auth não está habilitado no Supabase Auth deste ambiente.',
          });
        }
      } catch {
        if (!cancelled) {
          setState({
            enabled: true,
            loading: false,
            status: 'unknown',
            message: 'Não foi possível confirmar o status do Google Auth; tentando pelo Supabase.',
          });
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
