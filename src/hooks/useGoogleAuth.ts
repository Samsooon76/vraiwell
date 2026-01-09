import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface GoogleUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  isCurrentUser?: boolean;
}

const GOOGLE_DISABLED_KEY = "google_workspace_disabled";

export function useGoogleAuth() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [googleUsers, setGoogleUsers] = useState<GoogleUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

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
          scopes: "email profile",
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

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/list-google-users`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const data = await response.json();

      if (data.error && !data.users) {
        throw new Error(data.error);
      }

      setGoogleUsers(data.users || []);
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

  return {
    isConnecting,
    isDisconnecting,
    isLoadingUsers,
    googleUsers,
    error,
    connectGoogle,
    disconnectGoogle,
    fetchGoogleUsers,
    checkGoogleConnection,
  };
}
