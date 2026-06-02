import { useContext } from 'react';
import { PersonaContext } from '@/contexts/personaContextValue';

export function usePersona() {
  const context = useContext(PersonaContext);
  if (!context) {
    throw new Error('usePersona must be used within PersonaProvider');
  }
  return context;
}
