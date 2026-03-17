import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  emitIntegrationConnectionChanged,
  subscribeIntegrationConnectionChanges,
} from "@/lib/integration-events";

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
const GOOGLE_WORKSPACE_CACHE_KEY = "wellcom_google_workspace_cache_v1";
const GOOGLE_WORKSPACE_CACHE_TTL_MS = 5 * 60 * 1000;

interface GoogleWorkspaceCache {
  fetchedAt: number;
  licenseInfo: LicenseInfo | null;
  userId: string;
  users: GoogleUser[];
}

let googleWorkspaceMemoryCache: GoogleWorkspaceCache | null = null;

function readGoogleWorkspaceCache(userId: string, maxAgeMs = GOOGLE_WORKSPACE_CACHE_TTL_MS) {
  const now = Date.now();
  const isFreshEnough = (cache: GoogleWorkspaceCache | null) => (
    !!cache
    && cache.userId === userId
    && now - cache.fetchedAt <= maxAgeMs
  );

  if (isFreshEnough(googleWorkspaceMemoryCache)) {
    return googleWorkspaceMemoryCache;
  }

  if (typeof window === "undefined") {
    return null;
  }

  const rawCache = window.sessionStorage.getItem(GOOGLE_WORKSPACE_CACHE_KEY);
  if (!rawCache) {
    return null;
  }

  try {
    const parsedCache = JSON.parse(rawCache) as GoogleWorkspaceCache;
    if (isFreshEnough(parsedCache)) {
      googleWorkspaceMemoryCache = parsedCache;
      return parsedCache;
    }
  } catch {
    window.sessionStorage.removeItem(GOOGLE_WORKSPACE_CACHE_KEY);
  }

  return null;
}

function writeGoogleWorkspaceCache(cache: GoogleWorkspaceCache) {
  googleWorkspaceMemoryCache = cache;

  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(GOOGLE_WORKSPACE_CACHE_KEY, JSON.stringify(cache));
}

function clearGoogleWorkspaceCache() {
  googleWorkspaceMemoryCache = null;

  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(GOOGLE_WORKSPACE_CACHE_KEY);
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export function useGoogleAuth() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [googleUsers, setGoogleUsers] = useState<GoogleUser[]>([]);
  const [licenseInfo, setLicenseInfo] = useState<LicenseInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const hydrateGoogleWorkspaceCache = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !isMounted) {
        return;
      }

      const cachedWorkspace = readGoogleWorkspaceCache(user.id);
      if (!cachedWorkspace) {
        return;
      }

      setGoogleUsers(cachedWorkspace.users);
      setLicenseInfo(cachedWorkspace.licenseInfo);
    };

    void hydrateGoogleWorkspaceCache();

    return () => {
      isMounted = false;
    };
  }, []);

  const refreshGoogleConnection = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setIsConnected(false);
      setGoogleUsers([]);
      setLicenseInfo(null);
      clearGoogleWorkspaceCache();
      return false;
    }

    const disabledForUser = localStorage.getItem(GOOGLE_DISABLED_KEY);
    if (disabledForUser === user.id) {
      setIsConnected(false);
      return false;
    }

    const googleIdentity = user.identities?.find(
      (identity) => identity.provider === "google"
    );

    const { data: { session } } = await supabase.auth.getSession();
    const providerToken = session?.provider_token || sessionStorage.getItem(PROVIDER_TOKEN_KEY);
    const nextIsConnected = !!googleIdentity || !!providerToken;

    setIsConnected(nextIsConnected);
    return nextIsConnected;
  }, []);

  // Listen for auth changes and save provider_token when available
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.provider_token) {
        // Save the provider_token for later use
        sessionStorage.setItem(PROVIDER_TOKEN_KEY, session.provider_token);
      }

      if (event === "SIGNED_OUT") {
        sessionStorage.removeItem(PROVIDER_TOKEN_KEY);
      }

      void refreshGoogleConnection();
    });

    void refreshGoogleConnection();

    const unsubscribeConnectionChanges = subscribeIntegrationConnectionChanges("google", () => {
      void refreshGoogleConnection();
    });

    return () => {
      subscription.unsubscribe();
      unsubscribeConnectionChanges();
    };
  }, [refreshGoogleConnection]);

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
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Erreur de connexion Google"));
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

      sessionStorage.removeItem(PROVIDER_TOKEN_KEY);
      setIsConnected(false);
      setGoogleUsers([]);
      setLicenseInfo(null);
      clearGoogleWorkspaceCache();
      emitIntegrationConnectionChanged("google");
      return { success: true };
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Erreur lors de la déconnexion Google");
      setError(message);
      return { error: message };
    } finally {
      setIsDisconnecting(false);
    }
  };

  const fetchGoogleUsers = useCallback(async (options?: { force?: boolean; maxAgeMs?: number }) => {
    const { force = false, maxAgeMs = GOOGLE_WORKSPACE_CACHE_TTL_MS } = options ?? {};
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("No active session");
      }

      const currentUserId = session.user.id;

      if (!force) {
        const freshCache = readGoogleWorkspaceCache(currentUserId, maxAgeMs);
        if (freshCache) {
          setGoogleUsers(freshCache.users);
          setLicenseInfo(freshCache.licenseInfo);
          return {
            users: freshCache.users,
            licenseInfo: freshCache.licenseInfo,
            cached: true,
          };
        }

        const staleCache = readGoogleWorkspaceCache(currentUserId, Number.POSITIVE_INFINITY);
        if (staleCache) {
          setGoogleUsers(staleCache.users);
          setLicenseInfo(staleCache.licenseInfo);
        }
      }

      setIsLoadingUsers(true);

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
      writeGoogleWorkspaceCache({
        fetchedAt: Date.now(),
        licenseInfo: data.licenseInfo || null,
        userId: currentUserId,
        users: data.users || [],
      });
      return data;
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Erreur lors du chargement des utilisateurs Google");
      setError(message);
      return { error: message };
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  const checkGoogleConnection = useCallback(async () => refreshGoogleConnection(), [refreshGoogleConnection]);

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
      await fetchGoogleUsers({ force: true });

      return {
        success: true,
        user: data.user,
        invitationSentTo: data.invitationSentTo,
      };
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Erreur lors de la creation de l'utilisateur Google");
      setError(message);
      return { success: false, error: message };
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

      await fetchGoogleUsers({ force: true });

      return { success: true };
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Erreur lors de la suppression de l'utilisateur Google");
      setError(message);
      return { success: false, error: message };
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
    isConnected,
    connectGoogle,
    disconnectGoogle,
    fetchGoogleUsers,
    checkGoogleConnection,
    createGoogleUser,
    deleteGoogleUser,
  };
}
