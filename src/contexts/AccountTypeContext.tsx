import { useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AccountTypeContext, type AccountType } from '@/contexts/accountTypeContextValue';

const LS_KEY = 'uhs:account_type';

export function AccountTypeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  const [accountType, setAccountTypeState] = useState<AccountType | null>(() => {
    try { return localStorage.getItem(LS_KEY) as AccountType | null; } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setAccountTypeState(null);
      setLoading(false);
      return;
    }

    const remote = user.user_metadata?.account_type as AccountType | undefined;
    if (remote === 'clinician' || remote === 'patient') {
      setAccountTypeState(remote);
      try { localStorage.setItem(LS_KEY, remote); } catch { /* no-op */ }
    }
    setLoading(false);
  }, [user]);

  const setAccountType = useCallback(async (type: AccountType) => {
    setAccountTypeState(type);
    try { localStorage.setItem(LS_KEY, type); } catch { /* no-op */ }
    if (user) {
      await supabase.auth.updateUser({ data: { account_type: type } });
    }
  }, [user]);

  return (
    <AccountTypeContext.Provider value={{
      accountType, setAccountType, loading,
      isClinician: accountType === 'clinician',
      isPatient: accountType === 'patient',
      isOnboarded: accountType !== null,
    }}>
      {children}
    </AccountTypeContext.Provider>
  );
}
