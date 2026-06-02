import { useContext } from 'react';
import { SpecialtyContext } from '@/contexts/specialtyContextValue';

export function useSpecialty() {
  const ctx = useContext(SpecialtyContext);
  if (!ctx) {
    throw new Error('useSpecialty must be used within <SpecialtyProvider>');
  }
  return ctx;
}
