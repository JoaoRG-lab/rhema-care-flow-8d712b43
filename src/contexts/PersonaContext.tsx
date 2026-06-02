 import { useState, useEffect, ReactNode } from 'react';
 import { PersonaContext, type Persona } from '@/contexts/personaContextValue';
 
 export function PersonaProvider({ children }: { children: ReactNode }) {
   const [persona, setPersona] = useState<Persona>(() => {
     const stored = localStorage.getItem('rheumaflow-persona');
     return (stored as Persona) || 'clinical';
   });
 
   useEffect(() => {
     localStorage.setItem('rheumaflow-persona', persona);
   }, [persona]);
 
   return (
     <PersonaContext.Provider
       value={{
         persona,
         setPersona,
         isPatientView: persona === 'patient',
         isAcademicView: persona === 'academic',
         isClinicalView: persona === 'clinical',
       }}
     >
       {children}
     </PersonaContext.Provider>
   );
 }
