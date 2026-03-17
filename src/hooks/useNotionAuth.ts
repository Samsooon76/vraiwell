import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
    emitIntegrationConnectionChanged,
    subscribeIntegrationConnectionChanges,
} from "@/lib/integration-events";

export const NOTION_TOKEN_KEY = "notion_provider_token";

export interface NotionUser {
    id: string;
    email?: string;
    name: string;
    avatar?: string;
    type: string; // 'person' or 'bot'
    isActive: boolean;
}

export interface NotionWorkspaceInfo {
    name: string;
    icon?: string;
    totalMembers: number;
}

export function useNotionAuth() {
    const [isConnecting, setIsConnecting] = useState(false);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);
    const [notionUsers, setNotionUsers] = useState<NotionUser[]>([]);
    const [workspaceInfo, setWorkspaceInfo] = useState<NotionWorkspaceInfo | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isDisconnecting, setIsDisconnecting] = useState(false);

    // Simplified hasToken check for UI state
    const [hasToken, setHasToken] = useState(false);

    const refreshNotionConnection = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            setHasToken(false);
            return false;
        }

        const { data } = await supabase
            .from("profiles")
            .select("notion_token")
            .eq("user_id", user.id)
            .single();

        const nextHasToken = !!data?.notion_token;
        setHasToken(nextHasToken);
        return nextHasToken;
    }, []);

    useEffect(() => {
        void refreshNotionConnection();

        const unsubscribeConnectionChanges = subscribeIntegrationConnectionChanges("notion", () => {
            void refreshNotionConnection();
        });

        return () => {
            unsubscribeConnectionChanges();
        };
    }, [refreshNotionConnection]);

    const connectNotion = async () => {
        setIsConnecting(true);
        setError(null);

        // OAuth Flow via Edge Function (Backend-for-Frontend)
        // The Edge Function handles the Client ID and Redirect URI injection
        // We pass the current URL as return_url so the edge function can redirect back here (preserving port/path)
        const returnUrl = encodeURIComponent(window.location.href);
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notion-oauth?return_url=${returnUrl}`;

        // Redirect
        window.location.href = url;
    };

    // Handle Token from URL (Callback) on mount
    useEffect(() => {
        const handleCallback = async () => {
            const params = new URLSearchParams(window.location.search);
            const token = params.get("notion_token");
            const errorParam = params.get("notion_error");
            const workspaceName = params.get("notion_workspace_name");
            const workspaceIcon = params.get("notion_workspace_icon");

            if (token) {
                // Save token to database
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    await supabase
                        .from("profiles")
                        .update({ notion_token: token })
                        .eq("user_id", user.id);
                }

                setHasToken(true);
                emitIntegrationConnectionChanged("notion");
                toast.success("Notion connecté avec succès !");

                // Clean URL
                const url = new URL(window.location.href);
                url.searchParams.delete("notion_token");
                url.searchParams.delete("notion_workspace_name");
                url.searchParams.delete("notion_workspace_icon");
                window.history.replaceState({}, "", url.toString());

                // Fetch users immediately
                await fetchNotionUsers();
            } else if (errorParam) {
                toast.error(`Erreur Notion : ${errorParam}`);
                const url = new URL(window.location.href);
                url.searchParams.delete("notion_error");
                window.history.replaceState({}, "", url.toString());
            }
        };

        handleCallback();
    }, []);

    const fetchNotionUsers = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
            .from("profiles")
            .select("notion_token")
            .eq("user_id", user.id)
            .single();

        const token = profile?.notion_token;
        if (!token) return;

        setIsLoadingUsers(true);
        setError(null);

        try {
            const { data, error: fnError } = await supabase.functions.invoke("list-notion-users", {
                body: { provider_token: token },
            });

            if (fnError) throw fnError;
            if (data.error) throw new Error(data.error);

            setNotionUsers(data.users || []);

            return data;
        } catch (err: any) {
            console.error("Error fetching Notion users:", err);
            setError(err.message);
            return { error: err.message };
        } finally {
            setIsLoadingUsers(false);
        }
    };

    const disconnectNotion = async () => {
        setIsDisconnecting(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await supabase
                    .from("profiles")
                    .update({ notion_token: null })
                    .eq("user_id", user.id);
            }
            setHasToken(false);
            setNotionUsers([]);
            setWorkspaceInfo(null);
            emitIntegrationConnectionChanged("notion");
            return { success: true };
        } catch (err: any) {
            return { success: false, error: err.message };
        } finally {
            setIsDisconnecting(false);
        }
    };

    return {
        isConnecting,
        isLoadingUsers,
        isDisconnecting,
        notionUsers,
        workspaceInfo,
        error,
        hasToken,
        connectNotion,
        disconnectNotion,
        fetchNotionUsers
    };
}
