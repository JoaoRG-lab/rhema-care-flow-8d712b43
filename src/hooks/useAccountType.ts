import { useContext } from 'react';
import { AccountTypeContext } from '@/contexts/accountTypeContextValue';

export function useAccountType() {
  const ctx = useContext(AccountTypeContext);
  if (!ctx) throw new Error('useAccountType must be used within AccountTypeProvider');
  return ctx;
}
