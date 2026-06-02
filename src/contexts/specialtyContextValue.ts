import { createContext } from 'react';

export interface SpecialtyContextType {
  /** Currently active specialty id, e.g. 'pediatrics' */
  specialtyId: string;
  /** Switch specialty - persists to profile when logged in */
  setSpecialty: (id: string) => Promise<void>;
  /** Whether an initial load from the DB is still in-flight */
  loadingSpecialty: boolean;
}

export const SpecialtyContext = createContext<SpecialtyContextType | undefined>(undefined);
