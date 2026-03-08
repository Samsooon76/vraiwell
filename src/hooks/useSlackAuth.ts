
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const SLACK_TOKEN_KEY = "slack_provider_token";

export interface SlackUser {
    id: string;
    email?: string;
    name: string;
    avatar?: string;
    jobTitle?: string;
    status?: string; // admin, owner, member
    isAdmin: boolean;
    isActive: boolean;
    tz?: string;
    phone?: string;
    isCurrentUser?: boolean; // Inferred
}

export interface SlackWorkspaceInfo {
    name: string;
    totalMembers: number;
    admins: number;
}

export function useSlackAuth() {
    const [isConnecting, setIsConnecting] = useState(false);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);
    const [slackUsers, setSlackUsers] = useState<SlackUser[]>([]);
    const [workspaceInfo, setWorkspaceInfo] = useState<SlackWorkspaceInfo | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isDisconnecting, setIsDisconnecting] = useState(false);
    const [isInvitingUser, setIsInvitingUser] = useState(false);
    const [isDeletingUser, setIsDeletingUser] = useState(false);

    // Simplified hasToken check for UI state
    const [hasToken, setHasToken] = useState(false);

    useEffect(() => {
        const checkToken = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase
                    .from("profiles")
                    .select("slack_token")
                    .eq("user_id", user.id)
                    .single();
                setHasToken(!!data?.slack_token);
            }
        };
        checkToken();
    }, []);

    const connectSlack = async (clientId: string) => {
        setIsConnecting(true);
        setError(null);

        // OAuth Flow: Redirect to Real OAuth
        // Redirect URI must match what is in Slack App Dashboard and our edge function
        // For development, we use the specific edge function URL
        const redirectUri = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/slack-oauth`;

        // Scopes needed
        const scopes = "users:read,users:read.email,team:read";

        // Construct URL
        // IMPORANT: using user_scope ensures we ask for a User Token, not a Bot token, which avoids the "app not configured with a bot" error
        const url = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&user_scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}`;

        // Redirect
        window.location.href = url;
    };

    // Handle Token from URL (Callback) on mount
    useEffect(() => {
        const handleCallback = async () => {
            const params = new URLSearchParams(window.location.search);
            const token = params.get("slack_token");
            const errorParam = params.get("error");

            if (token) {
                // Save token to database
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    await supabase
                        .from("profiles")
                        .update({ slack_token: token })
                        .eq("user_id", user.id);
                }

                setHasToken(true);
                setSlackUsers([]); // Force refresh state
                toast.success("Slack connecté avec succès !");

                // Clean URL without reloading
                const url = new URL(window.location.href);
                url.searchParams.delete("slack_token");
                window.history.replaceState({}, "", url.toString());
            } else if (errorParam) {
                toast.error(`Erreur Slack : ${errorParam}`);
                // Clean URL
                const url = new URL(window.location.href);
                url.searchParams.delete("error");
                window.history.replaceState({}, "", url.toString());
            }
        };

        handleCallback();
    }, []);

    // Alternative: Manual Token Input (for MVP/testing/internal apps)
    const setManualToken = async (token: string) => {
        try {
            setIsConnecting(true);
            // Verify token by trying to list users
            const { data, error } = await supabase.functions.invoke("list-slack-users", {
                body: { provider_token: token }
            });

            if (error || !data.success) {
                throw new Error("Token invalide ou permissions insuffisantes");
            }

            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await supabase
                    .from("profiles")
                    .update({ slack_token: token })
                    .eq("user_id", user.id);
            }

            setSlackUsers(data.users || []);
            if (data.workspaceName) {
                setWorkspaceInfo({
                    name: data.workspaceName,
                    totalMembers: data.meta?.total || 0,
                    admins: data.meta?.admins || 0
                });
            }
            return { success: true };
        } catch (err: any) {
            setError(err.message);
            return { success: false, error: err.message };
        } finally {
            setIsConnecting(false);
        }
    };

    const disconnectSlack = async () => {
        setIsDisconnecting(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await supabase
                    .from("profiles")
                    .update({ slack_token: null })
                    .eq("user_id", user.id);
            }
            setSlackUsers([]);
            setWorkspaceInfo(null);
            return { success: true };
        } catch (err: any) {
            return { success: false, error: err.message };
        } finally {
            setIsDisconnecting(false);
        }
    };

    const fetchSlackUsers = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
            .from("profiles")
            .select("slack_token")
            .eq("user_id", user.id)
            .single();

        const token = profile?.slack_token;
        if (!token) return;

        setIsLoadingUsers(true);
        setError(null);

        try {
            const { data, error: fnError } = await supabase.functions.invoke("list-slack-users", {
                body: { provider_token: token },
            });

            if (fnError) throw fnError;
            if (data.error) throw new Error(data.error);

            setSlackUsers(data.users || []);
            return data;
        } catch (err: any) {
            console.error("Error fetching Slack users:", err);
            setError(err.message);
            return { error: err.message };
        } finally {
            setIsLoadingUsers(false);
        }
    };

    const inviteSlackUser = async (email: string, channels?: string[]) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: "Non authentifié" };

        const { data: profile } = await supabase
            .from("profiles")
            .select("slack_token")
            .eq("user_id", user.id)
            .single();

        const token = profile?.slack_token;
        if (!token) return { success: false, error: "Non connecté" };

        setIsInvitingUser(true);
        setError(null);

        try {
            const { data, error: fnError } = await supabase.functions.invoke("manage-slack-user", {
                body: {
                    action: "invite",
                    provider_token: token,
                    email,
                    channels
                },
            });

            if (fnError) throw fnError;
            if (data.error) return { success: false, error: data.error };

            return { success: true, message: data.message };
        } catch (err: any) {
            return { success: false, error: err.message };
        } finally {
            setIsInvitingUser(false);
        }
    };

    const deleteSlackUser = async (userId: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: "Non authentifié" };

        const { data: profile } = await supabase
            .from("profiles")
            .select("slack_token")
            .eq("user_id", user.id)
            .single();

        const token = profile?.slack_token;
        if (!token) return { success: false, error: "Non connecté" };

        setIsDeletingUser(true); // Reusing state for delete
        setError(null);

        try {
            const { data, error: fnError } = await supabase.functions.invoke("manage-slack-user", {
                body: {
                    action: "delete",
                    provider_token: token,
                    userId,
                },
            });

            if (fnError) throw fnError;
            if (data.error) return { success: false, error: data.error };

            // Refresh list
            await fetchSlackUsers();

            return { success: true };
        } catch (err: any) {
            return { success: false, error: err.message };
        } finally {
            setIsDeletingUser(false);
        }
    };

    return {
        isConnecting,
        isLoadingUsers,
        isDisconnecting,
        isInvitingUser,
        isDeletingUser,
        slackUsers,
        workspaceInfo,
        error,
        hasToken,
        connectSlack,
        setManualToken,
        disconnectSlack,
        fetchSlackUsers,
        inviteSlackUser,
        deleteSlackUser
    };
}
