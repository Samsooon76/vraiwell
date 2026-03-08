import { useState, useEffect } from "react";
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

export function useUserProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async () => {
    if (!user) {
      setProfile(null);
      setRoles([]);
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
        .eq("user_id", user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        throw profileError;
      }

      setProfile(profileData as UserProfile | null);

      // Fetch roles
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (rolesError) {
        console.error("Error fetching roles:", rolesError);
      } else {
        setRoles((rolesData || []) as UserRole[]);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [user?.id]);

  const completeOnboarding = async (companyName?: string, companySize?: string) => {
    if (!user) return { error: "No user authenticated" };

    try {
      const updates: any = { onboarding_completed: true };
      if (companyName) updates.company_name = companyName;
      if (companySize) updates.company_size = companySize;

      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("user_id", user.id);

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
      } else {
        // If profile wasn't loaded, try to fetch it now to ensure state is consistent
        await fetchProfile();
      }

      return { error: null };
    } catch (err: any) {
      console.error("Unexpected error in completeOnboarding:", err);
      return { error: err.message || "An unexpected error occurred" };
    }
  };

  const hasRole = (role: 'admin' | 'manager' | 'user'): boolean => {
    return roles.some(r => r.role === role);
  };

  const isAdmin = hasRole('admin');
  const isManager = hasRole('manager');
  const canInvite = isAdmin || isManager;

  return {
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
}
