import { useEffect, useState } from "react";
import { useAuth } from '@/hooks/useAuth';
import { supabase } from "@/integrations/supabase/client";
import { isUltimateUserEmail } from "@/lib/ultimateUser";

interface UltimateAccessState {
  allowed: boolean;
  loading: boolean;
  reason: "email" | "locked-ultimate" | "profile-ultimate" | null;
}

export function useUltimateAccess(): UltimateAccessState {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<UltimateAccessState>({
    allowed: false,
    loading: true,
    reason: null,
  });

  useEffect(() => {
    let cancelled = false;

    const checkAccess = async () => {
      if (authLoading) return;
      if (!user) {
        setState({ allowed: false, loading: false, reason: null });
        return;
      }

      const emailAllowed = isUltimateUserEmail(user.email);
      if (emailAllowed) {
        setState({ allowed: true, loading: false, reason: "email" });
        return;
      }

      const sb = supabase as unknown as {
        from: (t: string) => {
          select: (s: string) => {
            eq: (a: string, b: unknown) => {
              eq: (a: string, b: unknown) => {
                eq: (a: string, b: unknown) => {
                  maybeSingle: () => Promise<{ data: { id: string } | null; error: { message: string } | null }>;
                };
              };
            };
          };
        };
        rpc: (n: string, args: Record<string, unknown>) => Promise<{ data: boolean | null; error: { message: string } | null }>;
      };
      const custodyPromise = sb
        .from("ultimate_user_custody")
        .select("id")
        .eq("user_id", user.id)
        .eq("custody_status", "locked")
        .eq("installation_status", "active")
        .maybeSingle();
      const profilePromise = sb.rpc("is_ultimate_user", { _user_id: user.id });
      const [{ data: custody, error: custodyError }, { data: profileUltimate, error: profileError }] = await Promise.all([custodyPromise, profilePromise]);

      if (cancelled) return;

      if (custodyError || profileError) {
        console.warn("Failed to check ultimate access:", custodyError?.message ?? profileError?.message);
        setState({ allowed: false, loading: false, reason: null });
        return;
      }

      if (custody) {
        setState({ allowed: true, loading: false, reason: "locked-ultimate" });
        return;
      }

      setState({
        allowed: Boolean(profileUltimate),
        loading: false,
        reason: profileUltimate ? "profile-ultimate" : null,
      });
    };

    void checkAccess();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  return state;
}
