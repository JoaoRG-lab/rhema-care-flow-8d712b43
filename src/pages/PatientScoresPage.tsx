import { useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ScoreTrends } from '@/components/patients/ScoreTrends';
import type { PatientCard } from '@/types/clinical';

export default function PatientScoresPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [patient, setPatient] = useState<PatientCard | null>(null);

  useEffect(() => {
    (async () => {
      if (!user || !patientId) return;
      const { data } = await supabase
        .from('patient_cards_secure')
        .select('*')
        .eq('id', patientId)
        .eq('user_id', user.id)
        .maybeSingle();
      setPatient((data as PatientCard) ?? null);
    })();
  }, [user, patientId]);

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 space-y-4 max-w-5xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/patients/${patientId}`)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        {patient && (
          <ScoreTrends
            patientId={patient.id}
            refreshKey={0}
            patientCode={patient.patient_code}
            diagnosisTags={patient.diagnosis_tags}
          />
        )}
      </div>
    </AppLayout>
  );
}
