import { ReactNode, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { onboardingApi } from '@/lib/api';
import { Sidebar } from './sidebar';

const ONBOARDING_KEY = 'kivo.onboarding_complete';

function isOnboardingComplete(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === 'true';
  } catch {
    return false;
  }
}

function markOnboardingComplete() {
  try {
    localStorage.setItem(ONBOARDING_KEY, 'true');
  } catch {
    // ignore
  }
}

/**
 * After completing onboarding, call this so subsequent visits
 * skip the API check entirely and render instantly.
 */
export { markOnboardingComplete };

interface AppLayoutProps {
  children: ReactNode;
}

/**
 * Onboarding guard – redirects only if the business hasn't set up yet.
 *
 * For returning users the check is instant (localStorage).
 * For fresh browsers we hit the API in the background but NEVER block
 * rendering – children are shown immediately while we figure out if we
 * need to redirect.
 */
function OnboardingCheck({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const alreadyDone = isOnboardingComplete();

  const { data } = useQuery({
    queryKey: ['onboarding-status'],
    queryFn: onboardingApi.getStatus,
    // Skip the network call if we already know they're done
    enabled: !alreadyDone,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });

  useEffect(() => {
    if (data && !data.business_setup) {
      navigate({ to: '/onboarding' });
    }
  }, [data, navigate]);

  return children;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:pl-64">
        <div className="p-6 lg:p-8">
          <OnboardingCheck>{children}</OnboardingCheck>
        </div>
      </main>
    </div>
  );
}
