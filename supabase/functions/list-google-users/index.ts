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

    // Get the user's Google OAuth provider token
    const { data: sessionData } = await supabase.auth.admin.getUserById(user.id);
    
    if (!sessionData?.user?.identities) {
      return new Response(
        JSON.stringify({ error: "No Google identity found", users: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const googleIdentity = sessionData.user.identities.find(
      (identity: any) => identity.provider === "google"
    );

    if (!googleIdentity) {
      return new Response(
        JSON.stringify({ error: "No Google identity found", users: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For now, return the user's Google profile info
    // Note: To list workspace users, you'd need Google Workspace Admin SDK access
    // which requires additional OAuth scopes and admin consent
    const googleUserData = googleIdentity.identity_data;
    
    const users = [
      {
        id: user.id,
        email: googleUserData?.email || user.email,
        name: googleUserData?.full_name || googleUserData?.name || "Unknown",
        avatar: googleUserData?.avatar_url || googleUserData?.picture,
        isCurrentUser: true,
      }
    ];

    return new Response(
      JSON.stringify({ 
        success: true, 
        users,
        message: "Pour lister tous les utilisateurs de votre workspace, une configuration Google Workspace Admin est nécessaire."
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
