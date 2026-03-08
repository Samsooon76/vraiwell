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
            console.error("HubSpot OAuth Error:", error);
            return Response.redirect(`${defaultFrontendUrl}?hubspot_error=${error}`, 302);
        }

        const clientId = Deno.env.get("HUBSPOT_CLIENT_ID");
        const clientSecret = Deno.env.get("HUBSPOT_CLIENT_SECRET");
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const redirectUri = `${supabaseUrl}/functions/v1/hubspot-oauth`;

        if (!clientId || !clientSecret) {
            console.error("Missing HubSpot configuration");
            return Response.redirect(`${defaultFrontendUrl}?hubspot_error=missing_config`, 302);
        }

        // MODE 1: INITIATION (Frontend sent us here to start OAuth)
        if (!code) {
            // Get return URL from query params, default to env var or localhost
            const returnUrl = url.searchParams.get("return_url") || defaultFrontendUrl;

            const hubspotAuthUrl = new URL("https://app.hubspot.com/oauth/authorize");
            hubspotAuthUrl.searchParams.set("client_id", clientId);
            hubspotAuthUrl.searchParams.set("redirect_uri", redirectUri);
            hubspotAuthUrl.searchParams.set("scope", "oauth crm.objects.users.read");
            // Pass the return URL as state so we get it back
            hubspotAuthUrl.searchParams.set("state", returnUrl);

            console.log("Redirecting to HubSpot Auth:", hubspotAuthUrl.toString(), "with state:", returnUrl);
            return Response.redirect(hubspotAuthUrl.toString(), 302);
        }

        // MODE 2: CALLBACK (HubSpot sent us back with a code)
        // Exchange code for token
        const state = url.searchParams.get("state");
        // Use state as frontend URL if present, otherwise fallback
        const finalFrontendUrl = state || defaultFrontendUrl;

        console.log("Exchanging code for token with redirect_uri:", redirectUri);

        const tokenResponse = await fetch("https://api.hubapi.com/oauth/v1/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                grant_type: "authorization_code",
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
                code: code,
            }).toString(),
        });

        const tokenData = await tokenResponse.json();

        if (!tokenResponse.ok) {
            console.error("HubSpot Token Error:", tokenData);
            return Response.redirect(`${finalFrontendUrl}?hubspot_error=${encodeURIComponent(tokenData.message || tokenData.error || "token_exchange_failed")}`, 302);
        }

        console.log("Token exchange successful");

        const accessToken = tokenData.access_token;
        const hubId = tokenData.hub_id;
        const hubDomain = tokenData.hub_domain;

        // Redirect back to frontend
        const redirectUrl = new URL(finalFrontendUrl);
        redirectUrl.searchParams.set("hubspot_token", accessToken);
        if (hubId) redirectUrl.searchParams.set("hubspot_hub_id", hubId.toString());
        if (hubDomain) redirectUrl.searchParams.set("hubspot_hub_domain", hubDomain);

        return Response.redirect(redirectUrl.toString(), 302);

    } catch (error) {
        console.error("Unexpected error:", error);
        const frontendUrl = Deno.env.get("FRONTEND_URL") || "http://localhost:5173";
        return Response.redirect(`${frontendUrl}?hubspot_error=server_error`, 302);
    }
});
