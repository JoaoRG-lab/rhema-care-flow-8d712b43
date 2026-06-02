import { createContext } from 'react';

export type AccountType = 'clinician' | 'patient';

export interface AccountTypeContextType {
  accountType: AccountType | null;
  setAccountType: (type: AccountType) => Promise<void>;
  loading: boolean;
  isClinician: boolean;
  isPatient: boolean;
  isOnboarded: boolean;
}

export const AccountTypeContext = createContext<AccountTypeContextType | undefined>(undefined);
