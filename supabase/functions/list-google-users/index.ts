import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Common Google Workspace product/SKU mappings
const LICENSE_NAMES: Record<string, string> = {
  "Google-Apps": "Google Workspace",
  "101031": "Google Workspace Enterprise Standard",
  "101033": "Google Workspace Enterprise Plus",
  "1010020020": "Google Workspace Business Starter",
  "1010020025": "Google Workspace Business Standard",
  "1010020027": "Google Workspace Business Plus",
  "1010060001": "Google Workspace Enterprise Essentials",
  "Google-Vault": "Google Vault",
  "Google-Drive-storage": "Google Drive Storage",
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

    // If we have a provider token, fetch workspace users via Google Directory API
    if (providerToken) {
      const domain = googleUserData?.email?.split("@")[1];
      
      if (domain) {
        console.log("Fetching users for domain:", domain);

        // Fetch users
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

          // Try to fetch license information
          let licenseMap: Record<string, { skuId: string; productId: string; skuName?: string }> = {};
          let totalLicenses = 0;
          let usedLicenses = 0;

          try {
            // Fetch licenses for Google-Apps (main Workspace product)
            const licensesResponse = await fetch(
              `https://licensing.googleapis.com/apps/licensing/v1/product/Google-Apps/sku/1010020025/users?customerId=${domain}&maxResults=1000`,
              {
                headers: {
                  Authorization: `Bearer ${providerToken}`,
                  "Content-Type": "application/json",
                },
              }
            );

            if (licensesResponse.ok) {
              const licensesData = await licensesResponse.json();
              console.log("Licenses API returned", licensesData.items?.length || 0, "licenses");
              
              usedLicenses = licensesData.items?.length || 0;
              
              (licensesData.items || []).forEach((license: any) => {
                licenseMap[license.userId] = {
                  skuId: license.skuId,
                  productId: license.productId,
                  skuName: LICENSE_NAMES[license.skuId] || license.skuName || license.skuId,
                };
              });
            } else {
              console.log("Licenses API not available or no permissions");
            }
          } catch (licenseError) {
            console.log("Could not fetch licenses:", licenseError);
          }

          const workspaceUsers = (directoryData.users || []).map((gUser: any) => ({
            id: gUser.id,
            email: gUser.primaryEmail,
            name: gUser.name?.fullName || gUser.primaryEmail,
            avatar: gUser.thumbnailPhotoUrl,
            isCurrentUser: gUser.primaryEmail === googleUserData?.email,
            license: licenseMap[gUser.id] || licenseMap[gUser.primaryEmail] || null,
          }));

          return new Response(
            JSON.stringify({ 
              success: true, 
              users: workspaceUsers, 
              domain,
              licenseInfo: {
                totalUsers: workspaceUsers.length,
                usedLicenses,
                // Note: Total available licenses requires Reseller API (not available for direct customers)
              }
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          const errorText = await directoryResponse.text();
          console.error("Directory API error:", directoryResponse.status, errorText);
          
          return new Response(
            JSON.stringify({ 
              success: false, 
              users: [currentUser],
              error: directoryResponse.status === 403 
                ? "Accès refusé. Reconnectez-vous pour autoriser l'accès aux utilisateurs."
                : "Erreur lors de la récupération des utilisateurs.",
              needsReconnect: true,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // Fallback: return only current user
    return new Response(
      JSON.stringify({ 
        success: true, 
        users: [currentUser],
        needsReconnect: true,
        message: "Reconnectez-vous pour accéder aux utilisateurs du workspace.",
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
