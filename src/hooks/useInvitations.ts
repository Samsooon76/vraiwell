import { useState } from "react";
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

export function useInvitations() {
  const { user } = useAuth();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInvitations = async () => {
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
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createInvitation = async (payload: InvitePayload): Promise<{ invitation?: Invitation; error?: string }> => {
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
    } catch (err: any) {
      return { error: err.message };
    }
  };

  const createBulkInvitations = async (payloads: InvitePayload[]): Promise<{ success: number; errors: string[] }> => {
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
  };

  const cancelInvitation = async (id: string): Promise<{ error?: string }> => {
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
    } catch (err: any) {
      return { error: err.message };
    }
  };

  const getInvitationLink = (token: string): string => {
    return `${window.location.origin}/signup?invite=${token}`;
  };

  const checkInvitationByToken = async (token: string): Promise<Invitation | null> => {
    try {
      const { data, error } = await supabase
        .from("invitations")
        .select("*")
        .eq("token", token)
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString())
        .single();

      if (error) return null;
      return data as Invitation;
    } catch {
      return null;
    }
  };

  const acceptInvitation = async (token: string): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: "Not authenticated" };

    try {
      const { data, error } = await supabase.rpc('accept_invitation', {
        _token: token,
        _user_id: user.id
      });

      if (error) throw error;
      
      return { success: data as boolean };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

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
