import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface MicrosoftUser {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  isCurrentUser?: boolean;
}

export function useMicrosoftAuth() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [microsoftUsers, setMicrosoftUsers] = useState<MicrosoftUser[]>([]);
  const [error, setError] = useState<string | null>(null);

  const connectMicrosoft = async () => {
    setIsConnecting(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "azure",
        options: {
          redirectTo: `${window.location.origin}/integrations`,
          scopes: "email profile openid",
        },
      });

      if (error) throw error;
    } catch (err: any) {
      setError(err.message);
      setIsConnecting(false);
    }
  };

  const fetchMicrosoftUsers = async () => {
    setIsLoadingUsers(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("No active session");
      }

      // Get Microsoft identity from user
      const microsoftIdentity = user.identities?.find(
        (identity) => identity.provider === "azure"
      );

      if (microsoftIdentity) {
        const identityData = microsoftIdentity.identity_data;
        const currentUser: MicrosoftUser = {
          id: user.id,
          email: identityData?.email || user.email || "",
          name: identityData?.full_name || identityData?.name || user.email?.split("@")[0] || "Utilisateur",
          avatar: identityData?.avatar_url || identityData?.picture,
          isCurrentUser: true,
        };
        setMicrosoftUsers([currentUser]);
      } else {
        setMicrosoftUsers([]);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const checkMicrosoftConnection = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return false;

    const microsoftIdentity = user.identities?.find(
      (identity) => identity.provider === "azure"
    );

    return !!microsoftIdentity;
  };

  return {
    isConnecting,
    isLoadingUsers,
    microsoftUsers,
    error,
    connectMicrosoft,
    fetchMicrosoftUsers,
    checkMicrosoftConnection,
  };
}
