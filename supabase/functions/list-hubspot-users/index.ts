import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { provider_token } = await req.json();

        if (!provider_token) {
            return new Response(
                JSON.stringify({ error: "Missing provider_token" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // List Users from HubSpot API
        // Docs: https://developers.hubspot.com/docs/api/settings/user-provisioning
        const response = await fetch("https://api.hubapi.com/settings/v3/users/", {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${provider_token}`,
                "Content-Type": "application/json",
            },
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("HubSpot API Error:", data);
            return new Response(
                JSON.stringify({ error: data.message || "Failed to fetch HubSpot users" }),
                { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Transform users to our standard format
        // HubSpot User Object: { id, email, roleId, primaryTeamId, firstName, lastName, archived }
        const users = data.results.map((u: any) => ({
            id: u.id,
            name: `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email,
            email: u.email,
            avatar: undefined, // HubSpot API doesn't provide avatar URLs in this endpoint
            roleId: u.roleId || "unknown",
            isActive: !u.archived, // archived = false means active
        }));

        return new Response(
            JSON.stringify({
                success: true,
                users: users,
                meta: {
                    total: users.length
                }
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("Error:", error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
