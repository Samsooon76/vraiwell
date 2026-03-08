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
        const url = new URL(req.url);
        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");

        // Default fallback if no state provided
        const defaultFrontendUrl = Deno.env.get("FRONTEND_URL") || "http://localhost:5173";

        if (error) {
            console.error("Notion OAuth Error:", error);
            return Response.redirect(`${defaultFrontendUrl}?notion_error=${error}`, 302);
        }

        const clientId = Deno.env.get("NOTION_CLIENT_ID");
        const clientSecret = Deno.env.get("NOTION_CLIENT_SECRET");
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const redirectUri = `${supabaseUrl}/functions/v1/notion-oauth`;

        if (!clientId || !clientSecret) {
            console.error("Missing Notion configuration");
            return Response.redirect(`${defaultFrontendUrl}?notion_error=missing_config`, 302);
        }

        // MODE 1: INITIATION (Frontend sent us here to start OAuth)
        if (!code) {
            // Get return URL from query params, default to env var or localhost
            const returnUrl = url.searchParams.get("return_url") || defaultFrontendUrl;

            const notionAuthUrl = new URL("https://api.notion.com/v1/oauth/authorize");
            notionAuthUrl.searchParams.set("client_id", clientId);
            notionAuthUrl.searchParams.set("response_type", "code");
            notionAuthUrl.searchParams.set("owner", "user");
            notionAuthUrl.searchParams.set("redirect_uri", redirectUri);
            // Pass the return URL as state so we get it back
            notionAuthUrl.searchParams.set("state", returnUrl);

            console.log("Redirecting to Notion Auth:", notionAuthUrl.toString(), "with state:", returnUrl);
            return Response.redirect(notionAuthUrl.toString(), 302);
        }

        // MODE 2: CALLBACK (Notion sent us back with a code)
        // Exchange code for token
        const encoded = btoa(`${clientId}:${clientSecret}`);
        const state = url.searchParams.get("state");
        // Use state as frontend URL if present, otherwise fallback
        const finalFrontendUrl = state || defaultFrontendUrl;

        console.log("Exchanging code for token with redirect_uri:", redirectUri);

        const tokenResponse = await fetch("https://api.notion.com/v1/oauth/token", {
            method: "POST",
            headers: {
                "Authorization": `Basic ${encoded}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                grant_type: "authorization_code",
                code: code,
                redirect_uri: redirectUri,
            }),
        });

        const tokenData = await tokenResponse.json();

        if (!tokenResponse.ok) {
            console.error("Notion Token Error:", tokenData);
            return Response.redirect(`${finalFrontendUrl}?notion_error=${encodeURIComponent(tokenData.error_description || tokenData.error || "token_exchange_failed")}`, 302);
        }

        console.log("Token exchange successful");

        const accessToken = tokenData.access_token;
        const workspaceName = tokenData.workspace_name;
        const workspaceIcon = tokenData.workspace_icon;

        // Redirect back to frontend
        const redirectUrl = new URL(finalFrontendUrl);
        redirectUrl.searchParams.set("notion_token", accessToken);
        if (workspaceName) redirectUrl.searchParams.set("notion_workspace_name", workspaceName);
        if (workspaceIcon) redirectUrl.searchParams.set("notion_workspace_icon", workspaceIcon);

        return Response.redirect(redirectUrl.toString(), 302);

    } catch (error) {
        console.error("Unexpected error:", error);
        const frontendUrl = Deno.env.get("FRONTEND_URL") || "http://localhost:5173";
        return Response.redirect(`${frontendUrl}?notion_error=server_error`, 302);
    }
});
