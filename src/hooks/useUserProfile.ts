import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface UserProfile {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
  onboarding_completed: boolean;
  company_name?: string;
  company_size?: string;
  slack_token?: string | null;
  notion_token?: string | null;
  hubspot_token?: string | null;
  microsoft_token?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  role: 'admin' | 'manager' | 'user';
}

interface UserProfileContextValue {
  profile: UserProfile | null;
  roles: UserRole[];
  loading: boolean;
  error: string | null;
  fetchProfile: () => Promise<void>;
  completeOnboarding: (companyName?: string, companySize?: string) => Promise<{ error: string | null }>;
  hasRole: (role: 'admin' | 'manager' | 'user') => boolean;
  isAdmin: boolean;
  isManager: boolean;
  canInvite: boolean;
}

const UserProfileContext = createContext<UserProfileContextValue | undefined>(undefined);

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "An unexpected error occurred";
}

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latestFetchIdRef = useRef(0);

  const fetchProfile = useCallback(async () => {
    const fetchId = ++latestFetchIdRef.current;

    if (!userId) {
      setProfile(null);
      setRoles([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        throw profileError;
      }

      if (fetchId !== latestFetchIdRef.current) {
        return;
      }

      setProfile(profileData as UserProfile | null);

      // Fetch roles
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (fetchId !== latestFetchIdRef.current) {
        return;
      }

      if (rolesError) {
        console.error("Error fetching roles:", rolesError);
      } else {
        setRoles((rolesData || []) as UserRole[]);
      }
    } catch (err: unknown) {
      if (fetchId === latestFetchIdRef.current) {
        setError(getErrorMessage(err));
      }
    } finally {
      if (fetchId === latestFetchIdRef.current) {
        setLoading(false);
      }
    }
  }, [userId]);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  const completeOnboarding = async (companyName?: string, companySize?: string) => {
    if (!userId) return { error: "No user authenticated" };

    try {
      const updates: Pick<UserProfile, "onboarding_completed"> & Partial<Pick<UserProfile, "company_name" | "company_size">> = {
        onboarding_completed: true,
      };
      if (companyName) updates.company_name = companyName;
      if (companySize) updates.company_size = companySize;

      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("user_id", userId);

      if (error) {
        console.error("Error updating onboarding status:", error);
        return { error: error.message };
      }

      // If profile state exists, update it locally too
      if (profile) {
        setProfile({
          ...profile,
          onboarding_completed: true,
          company_name: companyName || profile.company_name,
          company_size: companySize || profile.company_size
        });
      }

      // Always refresh from the source of truth to keep routes in sync.
      await fetchProfile();

      return { error: null };
    } catch (err: unknown) {
      console.error("Unexpected error in completeOnboarding:", err);
      return { error: getErrorMessage(err) };
    }
  };

  const hasRole = (role: 'admin' | 'manager' | 'user'): boolean => {
    return roles.some(r => r.role === role);
  };

  const isAdmin = hasRole('admin');
  const isManager = hasRole('manager');
  const canInvite = isAdmin || isManager;

  const value = {
    profile,
    roles,
    loading,
    error,
    fetchProfile,
    completeOnboarding,
    hasRole,
    isAdmin,
    isManager,
    canInvite,
  };

  return createElement(UserProfileContext.Provider, { value }, children);
}

export function useUserProfile() {
  const context = useContext(UserProfileContext);

  if (context === undefined) {
    throw new Error("useUserProfile must be used within a UserProfileProvider");
  }

  return context;
}
