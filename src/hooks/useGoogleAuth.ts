import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface GoogleUserLicense {
  skuId: string;
  productId: string;
  skuName?: string;
}

export interface GoogleUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  isCurrentUser?: boolean;
  license?: GoogleUserLicense | null;
}

export interface LicenseInfo {
  totalUsers: number;
  usedLicenses: number;
}

export interface CreateGoogleUserResult {
  success: boolean;
  user?: {
    id: string;
    email: string;
    name: string;
  };
  invitationSentTo?: string;
  error?: string;
}

const PROVIDER_TOKEN_KEY = "google_provider_token";

const GOOGLE_DISABLED_KEY = "google_workspace_disabled";

export function useGoogleAuth() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [googleUsers, setGoogleUsers] = useState<GoogleUser[]>([]);
  const [licenseInfo, setLicenseInfo] = useState<LicenseInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  // Listen for auth changes and save provider_token when available
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.provider_token) {
        // Save the provider_token for later use
        sessionStorage.setItem(PROVIDER_TOKEN_KEY, session.provider_token);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const connectGoogle = async (redirectPath?: string) => {
    setIsConnecting(true);
    setError(null);

    try {
      // Clear any previous disabled state when reconnecting
      localStorage.removeItem(GOOGLE_DISABLED_KEY);

      // Default to current path, or use provided redirect path
      const finalRedirect = redirectPath || window.location.pathname;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}${finalRedirect}`,
          scopes: "email profile https://www.googleapis.com/auth/admin.directory.user.readonly https://www.googleapis.com/auth/admin.directory.user",
        },
      });

      if (error) throw error;
    } catch (err: any) {
      setError(err.message);
      setIsConnecting(false);
    }
  };

  const disconnectGoogle = async () => {
    setIsDisconnecting(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("No active session");
      }

      const googleIdentity = user.identities?.find(
        (identity) => identity.provider === "google"
      );

      if (googleIdentity) {
        // Try to unlink the identity if user has other auth methods
        const hasOtherIdentities = user.identities && user.identities.length > 1;

        if (hasOtherIdentities) {
          const { error } = await supabase.auth.unlinkIdentity(googleIdentity);
          if (error) throw error;
        } else {
          // If Google is the only identity, we can't unlink it
          // Instead, mark it as "disabled" in localStorage
          localStorage.setItem(GOOGLE_DISABLED_KEY, user.id);
        }
      }

      setGoogleUsers([]);
      return { success: true };
    } catch (err: any) {
      setError(err.message);
      return { error: err.message };
    } finally {
      setIsDisconnecting(false);
    }
  };

  const fetchGoogleUsers = async () => {
    setIsLoadingUsers(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("No active session");
      }

      // Get the provider_token from session or sessionStorage
      let providerToken = session.provider_token;
      if (!providerToken) {
        providerToken = sessionStorage.getItem(PROVIDER_TOKEN_KEY);
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/list-google-users`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ provider_token: providerToken }),
        }
      );

      const data = await response.json();

      if (data.error && !data.users) {
        throw new Error(data.error);
      }

      if (data.needsReconnect && data.users?.length <= 1) {
        setError(data.message || data.error || "Reconnexion nécessaire");
      }

      setGoogleUsers(data.users || []);
      setLicenseInfo(data.licenseInfo || null);
      return data;
    } catch (err: any) {
      setError(err.message);
      return { error: err.message };
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const checkGoogleConnection = async () => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return false;

    // Check if user manually disabled the integration
    const disabledForUser = localStorage.getItem(GOOGLE_DISABLED_KEY);
    if (disabledForUser === user.id) {
      return false;
    }

    const googleIdentity = user.identities?.find(
      (identity) => identity.provider === "google"
    );

    return !!googleIdentity;
  };

  const createGoogleUser = async (
    firstName: string,
    lastName: string,
    personalEmail: string
  ): Promise<CreateGoogleUserResult> => {
    setIsCreatingUser(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("No active session");
      }

      let providerToken = session.provider_token;
      if (!providerToken) {
        providerToken = sessionStorage.getItem(PROVIDER_TOKEN_KEY);
      }

      if (!providerToken) {
        throw new Error("Reconnexion nécessaire pour gérer les utilisateurs.");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-google-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            action: "create",
            provider_token: providerToken,
            firstName,
            lastName,
            personalEmail,
          }),
        }
      );

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Refresh user list
      await fetchGoogleUsers();

      return {
        success: true,
        user: data.user,
        invitationSentTo: data.invitationSentTo,
      };
    } catch (err: any) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setIsCreatingUser(false);
    }
  };

  const deleteGoogleUser = async (userId: string): Promise<{ success: boolean; error?: string }> => {
    setIsDeletingUser(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("No active session");
      }

      let providerToken = session.provider_token;
      if (!providerToken) {
        providerToken = sessionStorage.getItem(PROVIDER_TOKEN_KEY);
      }

      if (!providerToken) {
        throw new Error("Reconnexion nécessaire pour gérer les utilisateurs.");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-google-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            action: "delete",
            provider_token: providerToken,
            userId,
          }),
        }
      );

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Remove user from local state
      setGoogleUsers(prev => prev.filter(u => u.id !== userId));

      return { success: true };
    } catch (err: any) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setIsDeletingUser(false);
    }
  };

  return {
    isConnecting,
    isDisconnecting,
    isLoadingUsers,
    isCreatingUser,
    isDeletingUser,
    googleUsers,
    licenseInfo,
    error,
    connectGoogle,
    disconnectGoogle,
    fetchGoogleUsers,
    checkGoogleConnection,
    createGoogleUser,
    deleteGoogleUser,
  };
}
