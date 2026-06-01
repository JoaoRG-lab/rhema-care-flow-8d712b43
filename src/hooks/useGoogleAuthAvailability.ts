import { useEffect, useState } from 'react';
import { supabasePublishableKey, supabaseUrl } from '@/integrations/supabase/client';

type GoogleAuthAvailability = {
  enabled: boolean;
  loading: boolean;
};

export function useGoogleAuthAvailability(): GoogleAuthAvailability {
  const [state, setState] = useState<GoogleAuthAvailability>({
    enabled: false,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const publishableKey = supabasePublishableKey;

      if (!supabaseUrl || !publishableKey) {
        if (!cancelled) setState({ enabled: false, loading: false });
        return;
      }

      try {
        const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
          headers: { apikey: publishableKey },
        });
        const settings = await response.json();
        if (!cancelled) {
          setState({
            enabled: settings?.external?.google === true,
            loading: false,
          });
        }
      } catch {
        if (!cancelled) setState({ enabled: false, loading: false });
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
