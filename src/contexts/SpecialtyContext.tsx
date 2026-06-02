import {
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { SPECIALTIES } from '@/config/specialties';
import { SpecialtyContext } from '@/contexts/specialtyContextValue';

// ─── Constants ───────────────────────────────────────────────────────────────
const LS_KEY = 'uhs:lastSpecialtyId';

const DEFAULT_SPECIALTY = 'rheumatology';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function readLS(): string | null {
  try {
    return typeof window !== 'undefined'
      ? window.localStorage.getItem(LS_KEY)
      : null;
  } catch {
    return null;
  }
}

function writeLS(id: string) {
  try {
    window.localStorage.setItem(LS_KEY, id);
  } catch { /* private-mode or storage full — no-op */ }
}

// ─── Provider ────────────────────────────────────────────────────────────────
export function SpecialtyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;

  // Initialise from localStorage so there's no flicker on load
  const [specialtyId, setSpecialtyId] = useState<string>(
    () => readLS() ?? DEFAULT_SPECIALTY,
  );
  const [loadingSpecialty, setLoadingSpecialty] = useState(false);

  // ── On login: fetch the saved specialty from the user's profile ─────────────
  useEffect(() => {
    if (!userId) return; // anonymous — keep localStorage value

    let cancelled = false;
    setLoadingSpecialty(true);

    supabase
      .from('profiles')
      .select('specialty')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        setLoadingSpecialty(false);

        if (error) {
          console.error('[SpecialtyContext] profile fetch error:', error.message);
          return;
        }

        const saved = data?.specialty;
        if (
          saved &&
          SPECIALTIES.some((s) => s.id === saved) // guard against stale ids
        ) {
          setSpecialtyId(saved);
          writeLS(saved);
        }
      });

    return () => { cancelled = true; };
  }, [userId]); // re-run only when the logged-in user changes

  // ── setSpecialty: update state + localStorage + DB ─────────────────────────
  const setSpecialty = useCallback(
    async (id: string) => {
      if (!SPECIALTIES.some((s) => s.id === id)) {
        console.warn('[SpecialtyContext] unknown specialty id:', id);
        return;
      }

      // Optimistic local update
      setSpecialtyId(id);
      writeLS(id);

      // Persist to DB only when authenticated
      if (!userId) return;

      const { error } = await supabase
        .from('profiles')
        .update({ specialty: id, updated_at: new Date().toISOString() })
        .eq('user_id', userId);

      if (error) {
        console.error('[SpecialtyContext] profile update error:', error.message);
        // Non-fatal — the local state is already updated
      }
    },
    [userId],
  );

  return (
    <SpecialtyContext.Provider
      value={{ specialtyId, setSpecialty, loadingSpecialty }}
    >
      {children}
    </SpecialtyContext.Provider>
  );
}
