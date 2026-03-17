import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface Invitation {
  id: string;
  email: string;
  role: 'admin' | 'manager' | 'user';
  token: string;
  invited_by: string | null;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  expires_at: string;
  created_at: string;
  accepted_at: string | null;
}

export interface InvitePayload {
  email: string;
  role: 'admin' | 'manager' | 'user';
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "An unexpected error occurred";
}

export function useInvitations() {
  const { user } = useAuth();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInvitations = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("invitations")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;
      setInvitations((data || []) as Invitation[]);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [user]);

  const createInvitation = useCallback(async (payload: InvitePayload): Promise<{ invitation?: Invitation; error?: string }> => {
    if (!user) return { error: "Not authenticated" };

    try {
      const { data, error: insertError } = await supabase
        .from("invitations")
        .insert({
          email: payload.email.toLowerCase().trim(),
          role: payload.role,
          invited_by: user.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      
      const invitation = data as Invitation;
      setInvitations(prev => [invitation, ...prev]);
      
      return { invitation };
    } catch (err: unknown) {
      return { error: getErrorMessage(err) };
    }
  }, [user]);

  const createBulkInvitations = useCallback(async (payloads: InvitePayload[]): Promise<{ success: number; errors: string[] }> => {
    const results = { success: 0, errors: [] as string[] };

    for (const payload of payloads) {
      const { error } = await createInvitation(payload);
      if (error) {
        results.errors.push(`${payload.email}: ${error}`);
      } else {
        results.success++;
      }
    }

    return results;
  }, [createInvitation]);

  const cancelInvitation = useCallback(async (id: string): Promise<{ error?: string }> => {
    try {
      const { error: updateError } = await supabase
        .from("invitations")
        .update({ status: 'cancelled' })
        .eq("id", id);

      if (updateError) throw updateError;
      
      setInvitations(prev => 
        prev.map(inv => inv.id === id ? { ...inv, status: 'cancelled' as const } : inv)
      );
      
      return {};
    } catch (err: unknown) {
      return { error: getErrorMessage(err) };
    }
  }, []);

  const getInvitationLink = useCallback((token: string): string => {
    return `${window.location.origin}/signup?invite=${token}`;
  }, []);

  const checkInvitationByToken = useCallback(async (token: string): Promise<Partial<Invitation> | null> => {
    try {
      // Use secure RPC function to lookup invitation by token (doesn't expose all invitations)
      const { data, error } = await supabase.rpc('get_invitation_by_token', {
        _token: token
      });

      if (error || !data || data.length === 0) return null;
      
      const inv = data[0];
      return {
        id: inv.id,
        email: inv.email,
        role: inv.role,
        status: inv.status as 'pending',
        expires_at: inv.expires_at,
      };
    } catch {
      return null;
    }
  }, []);

  const acceptInvitation = useCallback(async (token: string, userId?: string): Promise<{ success: boolean; error?: string }> => {
    const targetUserId = userId || user?.id;

    if (!targetUserId) {
      return { success: false, error: "Not authenticated" };
    }

    try {
      const { data, error } = await supabase.rpc('accept_invitation', {
        _token: token,
        _user_id: targetUserId
      });

      if (error) throw error;
      
      return { success: data as boolean };
    } catch (err: unknown) {
      return { success: false, error: getErrorMessage(err) };
    }
  }, [user]);

  return {
    invitations,
    loading,
    error,
    fetchInvitations,
    createInvitation,
    createBulkInvitations,
    cancelInvitation,
    getInvitationLink,
    checkInvitationByToken,
    acceptInvitation,
  };
}
