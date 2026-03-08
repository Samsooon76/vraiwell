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

        // List Users from Notion API
        // Docs: https://developers.notion.com/reference/get-users
        const response = await fetch("https://api.notion.com/v1/users", {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${provider_token}`,
                "Notion-Version": "2022-06-28",
            },
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Notion API Error:", data);
            return new Response(
                JSON.stringify({ error: data.message || "Failed to fetch Notion users" }),
                { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Transform users to our standard format
        // Notion User Object: { object, id, type, name, avatar_url, person: { email } }
        const users = data.results.map((u: any) => ({
            id: u.id,
            name: u.name || "Unknown",
            email: u.person?.email || null, // Bots don't have emails usually
            avatar: u.avatar_url,
            type: u.type, // 'person' or 'bot'
            isAdmin: false, // Notion API doesn't easily expose role in this endpoint
            isActive: true, // If they are in the list, they have access
        }));

        // Filter out bots if needed, or keep them marked as bots
        // For now we return everything but maybe flag them

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
