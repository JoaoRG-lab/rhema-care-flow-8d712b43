 import { useState, useEffect } from 'react';
 import { useAuth } from '@/hooks/useAuth';
 import { supabase } from '@/integrations/supabase/client';
 import { isUltimateUserEmail } from '@/lib/ultimateUser';
 import type { VerificationTier, ContributorType, VerificationStatusState } from '@/types/verification';
 
 // Re-export types for convenience
 export type { VerificationStatusState as VerificationStatus };
 
 export function useVerificationStatus() {
   const { user } = useAuth();
   const [verificationStatus, setVerificationStatus] = useState<VerificationStatusState>({
     status: null,
     tier: null,
    contributorType: null,
    fullName: null,
     loading: true,
   });
 
   useEffect(() => {
     const fetchStatus = async () => {
       if (!user) {
        setVerificationStatus({ status: null, tier: null, contributorType: null, fullName: null, loading: false });
         return;
       }

       if (isUltimateUserEmail(user.email)) {
         setVerificationStatus({
           status: 'approved',
           tier: 'ultimate',
           contributorType: 'developer',
           fullName: user.user_metadata?.full_name ?? user.email ?? 'Joao',
           loading: false,
         });
         return;
       }
 
       try {
         const [
           { data: requestData, error: requestError },
           { data: profileData, error: profileError },
         ] = await Promise.all([
           supabase
            .from('verification_requests_secure')
             .select('status, tier, full_name')
             .eq('user_id', user.id)
             .order('created_at', { ascending: false })
             .limit(1)
             .maybeSingle(),
           supabase
             .from('profiles')
             .select('verification_tier, full_name')
             .eq('user_id', user.id)
             .maybeSingle(),
         ]);
 
         if (requestError && profileError) throw requestError;

         if (requestError) {
           console.warn('Error fetching verification request:', requestError.message);
         }
         if (profileError) {
           console.warn('Error fetching profile verification tier:', profileError.message);
         }

         const profileTier = (profileData?.verification_tier as VerificationTier) ?? null;
         const requestTier = (requestData?.tier as VerificationTier) ?? null;
         const tier = profileTier ?? requestTier;
         const contributorType: ContributorType | null =
           tier === 'developer' || tier === 'ultimate'
             ? 'developer'
             : tier === 'partner'
               ? 'partner'
               : tier
                 ? 'clinical'
                 : null;
 
         setVerificationStatus({
            status: profileTier ? 'approved' : ((requestData?.status as VerificationStatusState['status']) ?? null),
            tier,
           contributorType,
           fullName: profileData?.full_name ?? requestData?.full_name ?? null,
           loading: false,
         });
       } catch (error) {
         console.error('Error fetching verification status:', error);
        setVerificationStatus({ status: null, tier: null, contributorType: null, fullName: null, loading: false });
       }
     };
 
     fetchStatus();
   }, [user]);
 
   return verificationStatus;
 }
