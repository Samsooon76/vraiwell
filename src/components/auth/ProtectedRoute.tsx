import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import {
  clearPendingOnboardingRedirect,
  hasPendingOnboardingRedirect,
} from "@/lib/onboarding-state";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireOnboarding?: boolean;
}

export function ProtectedRoute({ children, requireOnboarding = false }: ProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useUserProfile();
  const hasPendingRedirect = user ? hasPendingOnboardingRedirect(user.id) : false;

  useEffect(() => {
    if (user && profile?.onboarding_completed && hasPendingRedirect) {
      clearPendingOnboardingRedirect(user.id);
    }
  }, [hasPendingRedirect, profile?.onboarding_completed, user]);

  // Still loading auth or profile
  if (authLoading || (user && profileLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check onboarding status for non-onboarding routes
  if (!requireOnboarding && profile && !profile.onboarding_completed && !hasPendingRedirect) {
    // User hasn't completed onboarding, redirect to onboarding
    return <Navigate to="/onboarding" replace />;
  }

  // On onboarding page but already completed
  if (requireOnboarding && (profile?.onboarding_completed || hasPendingRedirect)) {
    // User already completed onboarding, redirect to dashboard
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
