import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface GoogleUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  isCurrentUser?: boolean;
}

export function useGoogleAuth() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [googleUsers, setGoogleUsers] = useState<GoogleUser[]>([]);
  const [error, setError] = useState<string | null>(null);

  const connectGoogle = async (redirectPath?: string) => {
    setIsConnecting(true);
    setError(null);

    try {
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

    const googleIdentity = user.identities?.find(
      (identity) => identity.provider === "google"
    );

    return !!googleIdentity;
  };

  return {
    isConnecting,
    isLoadingUsers,
    googleUsers,
    error,
    connectGoogle,
    fetchGoogleUsers,
    checkGoogleConnection,
  };
}
