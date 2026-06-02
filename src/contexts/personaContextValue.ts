import { createContext } from 'react';

export type Persona = 'clinical' | 'academic' | 'patient';

export interface PersonaContextType {
  persona: Persona;
  setPersona: (persona: Persona) => void;
  isPatientView: boolean;
  isAcademicView: boolean;
  isClinicalView: boolean;
}

export const PersonaContext = createContext<PersonaContextType | undefined>(undefined);
