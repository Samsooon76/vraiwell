import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Microsoft Graph API endpoint
const GRAPH_API = "https://graph.microsoft.com/v1.0";

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: "Missing authorization header" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Parse request body to get provider_token from frontend
        let providerToken: string | null = null;
        try {
            const body = await req.json();
            providerToken = body.provider_token;
        } catch {
            // No body or invalid JSON
        }

        // Create Supabase client
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Get user from token
        const token = authHeader.replace("Bearer ", "");
        const { data: { user }, error: userError } = await supabase.auth.getUser(token);

        if (userError || !user) {
            return new Response(
                JSON.stringify({ error: "Invalid token" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Get user identity data
        const { data: sessionData } = await supabase.auth.admin.getUserById(user.id);

        const microsoftIdentity = sessionData?.user?.identities?.find(
            (identity: any) => identity.provider === "azure"
        );

        if (!microsoftIdentity) {
            return new Response(
                JSON.stringify({ error: "No Microsoft identity found", users: [] }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const microsoftUserData = microsoftIdentity.identity_data;
        const currentUser = {
            id: user.id,
            email: microsoftUserData?.email || user.email,
            name: microsoftUserData?.full_name || microsoftUserData?.name || "Unknown",
            avatar: microsoftUserData?.avatar_url || microsoftUserData?.picture,
            isCurrentUser: true,
        };

        // If we have a provider token, fetch users via Microsoft Graph API
        if (providerToken) {
            console.log("Fetching Microsoft users with Graph API");

            // Fetch users from Microsoft Graph
            const usersResponse = await fetch(
                `${GRAPH_API}/users?$select=id,displayName,mail,userPrincipalName,jobTitle,department,assignedLicenses&$top=100`,
                {
                    headers: {
                        Authorization: `Bearer ${providerToken}`,
                        "Content-Type": "application/json",
                    },
                }
            );

            console.log("Graph API response status:", usersResponse.status);

            if (usersResponse.ok) {
                const usersData = await usersResponse.json();
                console.log("Graph API returned", usersData.value?.length || 0, "users");

                const microsoftUsers = (usersData.value || []).map((msUser: any) => ({
                    id: msUser.id,
                    email: msUser.mail || msUser.userPrincipalName,
                    name: msUser.displayName || msUser.userPrincipalName,
                    avatar: null, // Would need separate call for photos
                    isCurrentUser: (msUser.mail || msUser.userPrincipalName) === microsoftUserData?.email,
                    jobTitle: msUser.jobTitle,
                    department: msUser.department,
                    hasLicense: msUser.assignedLicenses && msUser.assignedLicenses.length > 0,
                }));

                // Count users with licenses
                const usersWithLicenses = microsoftUsers.filter((u: any) => u.hasLicense).length;

                return new Response(
                    JSON.stringify({
                        success: true,
                        users: microsoftUsers,
                        licenseInfo: {
                            totalUsers: microsoftUsers.length,
                            usedLicenses: usersWithLicenses,
                        }
                    }),
                    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            } else {
                const errorText = await usersResponse.text();
                console.error("Graph API error:", usersResponse.status, errorText);

                return new Response(
                    JSON.stringify({
                        success: false,
                        users: [currentUser],
                        error: usersResponse.status === 403
                            ? "Accès refusé. Reconnectez-vous pour autoriser l'accès aux utilisateurs."
                            : "Erreur lors de la récupération des utilisateurs.",
                        needsReconnect: true,
                    }),
                    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }
        }

        // Fallback: return only current user
        return new Response(
            JSON.stringify({
                success: true,
                users: [currentUser],
                needsReconnect: true,
                message: "Reconnectez-vous pour accéder aux utilisateurs Microsoft 365.",
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error: unknown) {
        console.error("Error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        return new Response(
            JSON.stringify({ error: message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
