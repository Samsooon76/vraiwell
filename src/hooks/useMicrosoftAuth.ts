import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  emitIntegrationConnectionChanged,
  subscribeIntegrationConnectionChanges,
} from "@/lib/integration-events";

export interface MicrosoftUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  isCurrentUser?: boolean;
  jobTitle?: string;
  department?: string;
  hasLicense?: boolean;
}

export interface MicrosoftLicenseInfo {
  totalUsers: number;
  usedLicenses: number;
}

export interface CreateMicrosoftUserResult {
  success: boolean;
  user?: {
    id: string;
    email: string;
    name: string;
  };
  invitationSentTo?: string;
  error?: string;
}

const PROVIDER_TOKEN_KEY = "microsoft_provider_token";
const MICROSOFT_DISABLED_KEY = "microsoft_365_disabled";

export function useMicrosoftAuth() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [microsoftUsers, setMicrosoftUsers] = useState<MicrosoftUser[]>([]);
  const [licenseInfo, setLicenseInfo] = useState<MicrosoftLicenseInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const refreshMicrosoftConnection = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setIsConnected(false);
      return false;
    }

    const disabledForUser = localStorage.getItem(MICROSOFT_DISABLED_KEY);
    if (disabledForUser === user.id) {
      setIsConnected(false);
      return false;
    }

    const microsoftIdentity = user.identities?.find(
      (identity) => identity.provider === "azure"
    );

    const { data: { session } } = await supabase.auth.getSession();
    const providerToken = session?.provider_token || sessionStorage.getItem(PROVIDER_TOKEN_KEY);
    const nextIsConnected = !!microsoftIdentity || !!providerToken;

    setIsConnected(nextIsConnected);
    return nextIsConnected;
  }, []);

  // Listen for auth changes and save provider_token when available
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.provider_token) {
        // Check if this is a Microsoft login
        const provider = session.user?.app_metadata?.provider;
        if (provider === 'azure') {
          sessionStorage.setItem(PROVIDER_TOKEN_KEY, session.provider_token);
        }
      }

      if (event === "SIGNED_OUT") {
        sessionStorage.removeItem(PROVIDER_TOKEN_KEY);
      }

      void refreshMicrosoftConnection();
    });

    void refreshMicrosoftConnection();

    const unsubscribeConnectionChanges = subscribeIntegrationConnectionChanges("microsoft", () => {
      void refreshMicrosoftConnection();
    });

    return () => {
      subscription.unsubscribe();
      unsubscribeConnectionChanges();
    };
  }, [refreshMicrosoftConnection]);

  const connectMicrosoft = async (redirectPath?: string) => {
    setIsConnecting(true);
    setError(null);

    try {
      // Clear any previous disabled state when reconnecting
      localStorage.removeItem(MICROSOFT_DISABLED_KEY);

      const finalRedirect = redirectPath || window.location.pathname;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "azure",
        options: {
          redirectTo: `${window.location.origin}${finalRedirect}`,
          scopes: "email profile openid User.Read User.Read.All User.ReadWrite.All Directory.Read.All",
        },
      });

      if (error) throw error;
    } catch (err: any) {
      setError(err.message);
      setIsConnecting(false);
    }
  };

  const disconnectMicrosoft = async () => {
    setIsDisconnecting(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("No active session");
      }

      // Mark as disabled in localStorage for this user
      localStorage.setItem(MICROSOFT_DISABLED_KEY, user.id);

      // Clear the provider token
      sessionStorage.removeItem(PROVIDER_TOKEN_KEY);

      // Clear state
      setIsConnected(false);
      setMicrosoftUsers([]);
      setLicenseInfo(null);
      emitIntegrationConnectionChanged("microsoft");

      return { success: true };
    } catch (err: any) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setIsDisconnecting(false);
    }
  };

  const fetchMicrosoftUsers = async () => {
    setIsLoadingUsers(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("No active session");
      }

      // Get provider token from session or storage
      let providerToken = session.provider_token;
      if (!providerToken) {
        providerToken = sessionStorage.getItem(PROVIDER_TOKEN_KEY);
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/list-microsoft-users`,
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

      setMicrosoftUsers(data.users || []);
      setLicenseInfo(data.licenseInfo || null);

      return data;
    } catch (err: any) {
      console.error("Error fetching Microsoft users:", err);
      setError(err.message);
      return { error: err.message };
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const checkMicrosoftConnection = useCallback(async () => refreshMicrosoftConnection(), [refreshMicrosoftConnection]);

  const createMicrosoftUser = async (
    firstName: string,
    lastName: string,
    personalEmail?: string
  ): Promise<CreateMicrosoftUserResult> => {
    setIsCreatingUser(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("No active session");
      }

      const providerToken = session.provider_token || sessionStorage.getItem(PROVIDER_TOKEN_KEY);

      if (!providerToken) {
        return {
          success: false,
          error: "Token Microsoft expiré. Veuillez vous reconnecter à Microsoft 365."
        };
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-microsoft-user`,
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
            displayName: `${firstName} ${lastName}`,
          }),
        }
      );

      const data = await response.json();

      if (data.error) {
        return { success: false, error: data.error };
      }

      // Refresh users list
      await fetchMicrosoftUsers();

      return {
        success: true,
        user: data.user,
        invitationSentTo: data.invitationSentTo,
      };
    } catch (err: any) {
      console.error("Error creating Microsoft user:", err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setIsCreatingUser(false);
    }
  };

  const deleteMicrosoftUser = async (userId: string): Promise<{ success: boolean; error?: string }> => {
    setIsDeletingUser(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("No active session");
      }

      const providerToken = session.provider_token || sessionStorage.getItem(PROVIDER_TOKEN_KEY);

      if (!providerToken) {
        return {
          success: false,
          error: "Token Microsoft expiré. Veuillez vous reconnecter à Microsoft 365."
        };
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-microsoft-user`,
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
        return { success: false, error: data.error };
      }

      // Refresh users list
      await fetchMicrosoftUsers();

      return { success: true };
    } catch (err: any) {
      console.error("Error deleting Microsoft user:", err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setIsDeletingUser(false);
    }
  };

  return {
    isConnecting,
    isLoadingUsers,
    isDisconnecting,
    isCreatingUser,
    isDeletingUser,
    microsoftUsers,
    licenseInfo,
    error,
    isConnected,
    connectMicrosoft,
    disconnectMicrosoft,
    fetchMicrosoftUsers,
    checkMicrosoftConnection,
    createMicrosoftUser,
    deleteMicrosoftUser,
  };
}
