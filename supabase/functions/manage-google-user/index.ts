import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate a random password that meets Google's requirements
function generatePassword(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
  let password = "";
  // Ensure at least one of each required character type
  password += "A"; // uppercase
  password += "a"; // lowercase
  password += "1"; // digit
  password += "!"; // special
  // Fill the rest randomly
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  // Shuffle the password
  return password.split("").sort(() => Math.random() - 0.5).join("");
}

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

    const body = await req.json();
    const { action, provider_token, firstName, lastName, userId } = body;

    if (!provider_token) {
      return new Response(
        JSON.stringify({ error: "Provider token required. Please reconnect to Google." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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

    // Check if user is admin
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user identity to extract domain
    const { data: sessionData } = await supabase.auth.admin.getUserById(user.id);
    const googleIdentity = sessionData?.user?.identities?.find(
      (identity: any) => identity.provider === "google"
    );

    if (!googleIdentity) {
      return new Response(
        JSON.stringify({ error: "No Google identity found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const domain = googleIdentity.identity_data?.email?.split("@")[1];

    if (!domain) {
      return new Response(
        JSON.stringify({ error: "Could not determine domain" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "create") {
      if (!firstName || !lastName) {
        return new Response(
          JSON.stringify({ error: "First name and last name are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Normalize names for email (remove accents, lowercase, replace spaces with dots)
      const normalizeForEmail = (str: string) =>
        str
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/\s+/g, ".")
          .replace(/[^a-z0-9.]/g, "");

      const emailUsername = `${normalizeForEmail(firstName)}.${normalizeForEmail(lastName)}`;
      const email = `${emailUsername}@${domain}`;
      const password = generatePassword();

      console.log(`Creating user: ${email}`);

      const createResponse = await fetch(
        "https://admin.googleapis.com/admin/directory/v1/users",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${provider_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            primaryEmail: email,
            name: {
              givenName: firstName,
              familyName: lastName,
            },
            password: password,
            changePasswordAtNextLogin: true,
          }),
        }
      );

      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        console.error("Google API error:", errorData);
        
        let errorMessage = "Failed to create user";
        if (errorData.error?.message) {
          if (errorData.error.message.includes("Entity already exists")) {
            errorMessage = "Un utilisateur avec cette adresse email existe déjà.";
          } else if (errorData.error.message.includes("Not Authorized")) {
            errorMessage = "Non autorisé. Vérifiez vos permissions d'administrateur Google.";
          } else {
            errorMessage = errorData.error.message;
          }
        }

        return new Response(
          JSON.stringify({ error: errorMessage }),
          { status: createResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const createdUser = await createResponse.json();
      console.log("User created successfully:", createdUser.primaryEmail);

      return new Response(
        JSON.stringify({
          success: true,
          user: {
            id: createdUser.id,
            email: createdUser.primaryEmail,
            name: `${createdUser.name.givenName} ${createdUser.name.familyName}`,
          },
          temporaryPassword: password,
          message: "Utilisateur créé avec succès. Le mot de passe devra être changé à la première connexion.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "delete") {
      if (!userId) {
        return new Response(
          JSON.stringify({ error: "User ID is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Deleting user: ${userId}`);

      const deleteResponse = await fetch(
        `https://admin.googleapis.com/admin/directory/v1/users/${userId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${provider_token}`,
          },
        }
      );

      if (!deleteResponse.ok) {
        const errorText = await deleteResponse.text();
        console.error("Google API delete error:", errorText);
        
        let errorMessage = "Failed to delete user";
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.error?.message) {
            errorMessage = errorData.error.message;
          }
        } catch {
          // Not JSON
        }

        return new Response(
          JSON.stringify({ error: errorMessage }),
          { status: deleteResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("User deleted successfully");

      return new Response(
        JSON.stringify({
          success: true,
          message: "Utilisateur supprimé avec succès de Google Workspace.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
