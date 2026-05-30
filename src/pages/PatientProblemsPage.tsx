import { useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { ProblemListPanel } from '@/components/problems/ProblemListPanel';
import { ProblemTimelinePanel } from '@/components/problems/ProblemTimelinePanel';

export default function PatientProblemsPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  return (
    <AppLayout>
      <div className="p-4 sm:p-6 space-y-4 max-w-5xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/patients/${patientId}`)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar ao paciente
        </Button>
        <ProblemListPanel patientId={patientId} />
        <ProblemTimelinePanel patientId={patientId} />
      </div>
    </AppLayout>
  );
}
