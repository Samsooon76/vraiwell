import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // Create Supabase client with user's token
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

    // Get user identity data for fallback
    const { data: sessionData } = await supabase.auth.admin.getUserById(user.id);
    
    const googleIdentity = sessionData?.user?.identities?.find(
      (identity: any) => identity.provider === "google"
    );

    if (!googleIdentity) {
      return new Response(
        JSON.stringify({ error: "No Google identity found", users: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const googleUserData = googleIdentity.identity_data;
    const currentUser = {
      id: user.id,
      email: googleUserData?.email || user.email,
      name: googleUserData?.full_name || googleUserData?.name || "Unknown",
      avatar: googleUserData?.avatar_url || googleUserData?.picture,
      isCurrentUser: true,
    };

    // If we have a provider token, try to fetch workspace users via Google Directory API
    if (providerToken) {
      try {
        // Get the user's domain from their email
        const domain = googleUserData?.email?.split("@")[1];
        
        if (!domain) {
          throw new Error("Cannot determine domain");
        }

        console.log("Fetching users for domain:", domain);

        // Call Google Directory API to list users
        const directoryResponse = await fetch(
          `https://admin.googleapis.com/admin/directory/v1/users?domain=${domain}&maxResults=100`,
          {
            headers: {
              Authorization: `Bearer ${providerToken}`,
              "Content-Type": "application/json",
            },
          }
        );

        console.log("Directory API response status:", directoryResponse.status);

        if (directoryResponse.ok) {
          const directoryData = await directoryResponse.json();
          console.log("Directory API returned", directoryData.users?.length || 0, "users");

          const workspaceUsers = (directoryData.users || []).map((gUser: any) => ({
            id: gUser.id,
            email: gUser.primaryEmail,
            name: gUser.name?.fullName || gUser.primaryEmail,
            avatar: gUser.thumbnailPhotoUrl,
            isCurrentUser: gUser.primaryEmail === googleUserData?.email,
          }));

          return new Response(
            JSON.stringify({ 
              success: true, 
              users: workspaceUsers,
              domain: domain,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          const errorText = await directoryResponse.text();
          console.error("Directory API error:", directoryResponse.status, errorText);
          
          // If 403 Forbidden, user may not have admin rights or scope not granted
          if (directoryResponse.status === 403) {
            return new Response(
              JSON.stringify({ 
                success: false, 
                users: [currentUser],
                error: "Accès refusé à l'API Directory. Assurez-vous d'avoir les droits admin et d'avoir accordé les permissions lors de la connexion.",
                needsReconnect: true,
              }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      } catch (directoryError: any) {
        console.error("Error calling Directory API:", directoryError.message);
      }
    }

    // Fallback: return only current user if no provider token or API call failed
    return new Response(
      JSON.stringify({ 
        success: true, 
        users: [currentUser],
        message: providerToken 
          ? "Impossible de récupérer les utilisateurs du workspace."
          : "Reconnectez-vous à Google pour accéder aux utilisateurs du workspace.",
        needsReconnect: !providerToken,
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
