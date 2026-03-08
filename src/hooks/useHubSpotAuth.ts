import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const HUBSPOT_TOKEN_KEY = "hubspot_provider_token";

export interface HubSpotUser {
    id: string;
    email: string;
    name: string;
    avatar?: string;
    roleId: string;
    isActive: boolean;
}

export interface HubSpotWorkspaceInfo {
    name: string;
    hubId: string;
    totalMembers: number;
}

export function useHubSpotAuth() {
    const [isConnecting, setIsConnecting] = useState(false);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);
    const [hubspotUsers, setHubSpotUsers] = useState<HubSpotUser[]>([]);
    const [workspaceInfo, setWorkspaceInfo] = useState<HubSpotWorkspaceInfo | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isDisconnecting, setIsDisconnecting] = useState(false);

    // Simplified hasToken check for UI state
    const [hasToken, setHasToken] = useState(false);

    useEffect(() => {
        const checkToken = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase
                    .from("profiles")
                    .select("hubspot_token")
                    .eq("user_id", user.id)
                    .single();
                setHasToken(!!data?.hubspot_token);
            }
        };
        checkToken();
    }, []);

    const connectHubSpot = async () => {
        setIsConnecting(true);
        setError(null);

        // OAuth Flow via Edge Function (Backend-for-Frontend)
        // The Edge Function handles the Client ID and Redirect URI injection
        // We pass the current URL as return_url so the edge function can redirect back here (preserving port/path)
        const returnUrl = encodeURIComponent(window.location.href);
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hubspot-oauth?return_url=${returnUrl}`;

        // Redirect
        window.location.href = url;
    };

    // Handle Token from URL (Callback) on mount
    useEffect(() => {
        const handleCallback = async () => {
            const params = new URLSearchParams(window.location.search);
            const token = params.get("hubspot_token");
            const errorParam = params.get("hubspot_error");
            const hubId = params.get("hubspot_hub_id");
            const hubDomain = params.get("hubspot_hub_domain");

            if (token) {
                // Save token to database
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    await supabase
                        .from("profiles")
                        .update({ hubspot_token: token })
                        .eq("user_id", user.id);
                }

                toast.success("HubSpot connecté avec succès !");

                // Clean URL
                const url = new URL(window.location.href);
                url.searchParams.delete("hubspot_token");
                url.searchParams.delete("hubspot_hub_id");
                url.searchParams.delete("hubspot_hub_domain");
                window.history.replaceState({}, "", url.toString());

                // Fetch users immediately
                await fetchHubSpotUsers();
            } else if (errorParam) {
                toast.error(`Erreur HubSpot : ${errorParam}`);
                const url = new URL(window.location.href);
                url.searchParams.delete("hubspot_error");
                window.history.replaceState({}, "", url.toString());
            }
        };

        handleCallback();
    }, []);

    const fetchHubSpotUsers = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
            .from("profiles")
            .select("hubspot_token")
            .eq("user_id", user.id)
            .single();

        const token = profile?.hubspot_token;
        if (!token) return;

        setIsLoadingUsers(true);
        setError(null);

        try {
            const { data, error: fnError } = await supabase.functions.invoke("list-hubspot-users", {
                body: { provider_token: token },
            });

            if (fnError) throw fnError;
            if (data.error) throw new Error(data.error);

            setHubSpotUsers(data.users || []);

            return data;
        } catch (err: any) {
            console.error("Error fetching HubSpot users:", err);
            setError(err.message);
            return { error: err.message };
        } finally {
            setIsLoadingUsers(false);
        }
    };

    const disconnectHubSpot = async () => {
        setIsDisconnecting(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await supabase
                    .from("profiles")
                    .update({ hubspot_token: null })
                    .eq("user_id", user.id);
            }
            setHubSpotUsers([]);
            setWorkspaceInfo(null);
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
        hubspotUsers,
        workspaceInfo,
        error,
        hasToken,
        connectHubSpot,
        disconnectHubSpot,
        fetchHubSpotUsers
    };
}
