/**
 * Generic, multi-specialty problem catalogue for the POMR layer.
 * Specialties register their own canonical problems here. The list is
 * intentionally broad — UI should treat unknown problem codes as valid
 * free-text problems too.
 */

export interface ProblemDefinition {
  code: string;
  title: string;
  specialty: string; // matches specialtyRegistry id (or 'general')
  defaultSeverity?: 'low' | 'moderate' | 'high';
  defaultRedFlags?: string[];
  suggestedScores?: string[];
  suggestedSafety?: string[];
  linkedModules?: string[]; // e.g. ['scores', 'prescriptions', 'safety']
}

export const PROBLEM_REGISTRY: ProblemDefinition[] = [
  // Rheumatology (first mature specialty package)
  { code: 'RA',        title: 'Rheumatoid Arthritis',   specialty: 'rheumatology', defaultSeverity: 'moderate', suggestedScores: ['DAS28', 'CDAI'], suggestedSafety: ['MTX', 'Biologics'], linkedModules: ['scores','prescriptions','safety'] },
  { code: 'SLE',       title: 'Systemic Lupus Erythematosus', specialty: 'rheumatology', defaultSeverity: 'high', suggestedScores: ['SLEDAI'], suggestedSafety: ['HCQ','Biologics'], linkedModules: ['scores','prescriptions','safety'] },
  { code: 'SpA',       title: 'Spondyloarthritis',      specialty: 'rheumatology', suggestedScores: ['BASDAI','ASDAS'], linkedModules: ['scores','prescriptions'] },
  { code: 'PsA',       title: 'Psoriatic Arthritis',    specialty: 'rheumatology', suggestedScores: ['DAPSA'] },
  { code: 'Vasculitis',title: 'Vasculitis',             specialty: 'rheumatology', defaultSeverity: 'high', defaultRedFlags: ['organ involvement'] },
  { code: 'FM',        title: 'Fibromyalgia',           specialty: 'rheumatology', defaultSeverity: 'low', suggestedScores: ['FIQ'] },

  // Other specialties (seed entries — extensible)
  { code: 'HTN',       title: 'Hypertension',           specialty: 'cardiology' },
  { code: 'DM2',       title: 'Type 2 Diabetes',        specialty: 'endocrinology' },
  { code: 'ASTHMA',    title: 'Asthma',                 specialty: 'pulmonology' },
  { code: 'CKD',       title: 'Chronic Kidney Disease', specialty: 'nephrology' },
  { code: 'DEPR',      title: 'Depression',             specialty: 'psychiatry' },
];

export function getProblemsForSpecialty(specialtyId?: string | null): ProblemDefinition[] {
  if (!specialtyId) return PROBLEM_REGISTRY;
  return PROBLEM_REGISTRY.filter(p => p.specialty === specialtyId || p.specialty === 'general');
}

export function findProblemByCode(code: string): ProblemDefinition | undefined {
  return PROBLEM_REGISTRY.find(p => p.code === code);
}
