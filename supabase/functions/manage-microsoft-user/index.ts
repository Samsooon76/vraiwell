import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

        const body = await req.json();
        const { action, provider_token, firstName, lastName, personalEmail, userId, displayName } = body;

        if (!provider_token) {
            return new Response(
                JSON.stringify({ error: "Provider token required. Please reconnect to Microsoft." }),
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

        // Check if user is admin or manager
        const { data: roleData } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id)
            .in("role", ["admin", "manager"]);

        if (!roleData || roleData.length === 0) {
            const { data: anyRoles } = await supabase
                .from("user_roles")
                .select("id")
                .limit(1);

            if (anyRoles && anyRoles.length > 0) {
                return new Response(
                    JSON.stringify({ error: "Admin or manager access required." }),
                    { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }
        }

        // Get user's Microsoft identity to extract domain
        const { data: sessionData } = await supabase.auth.admin.getUserById(user.id);
        const microsoftIdentity = sessionData?.user?.identities?.find(
            (identity: any) => identity.provider === "azure"
        );

        if (!microsoftIdentity) {
            return new Response(
                JSON.stringify({ error: "No Microsoft identity found" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const userEmail = microsoftIdentity.identity_data?.email;
        const domain = userEmail?.split("@")[1];

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

            // Normalize names for email
            const normalizeForEmail = (str: string) =>
                str
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .toLowerCase()
                    .replace(/\s+/g, ".")
                    .replace(/[^a-z0-9.]/g, "");

            const emailUsername = `${normalizeForEmail(firstName)}.${normalizeForEmail(lastName)}`;
            const email = `${emailUsername}@${domain}`;
            const tempPassword = crypto.randomUUID() + "Aa1!";

            console.log(`Creating Microsoft user: ${email}`);

            const createResponse = await fetch(
                `${GRAPH_API}/users`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${provider_token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        accountEnabled: true,
                        displayName: displayName || `${firstName} ${lastName}`,
                        mailNickname: emailUsername,
                        userPrincipalName: email,
                        passwordProfile: {
                            forceChangePasswordNextSignIn: true,
                            password: tempPassword,
                        },
                        givenName: firstName,
                        surname: lastName,
                        otherMails: personalEmail ? [personalEmail] : [],
                    }),
                }
            );

            if (!createResponse.ok) {
                const errorData = await createResponse.json();
                console.error("Microsoft Graph API error:", errorData);

                let errorMessage = "Failed to create user";
                if (errorData.error?.message) {
                    if (errorData.error.message.includes("already exists")) {
                        errorMessage = "Un utilisateur avec cette adresse email existe déjà.";
                    } else if (errorData.error.message.includes("Authorization")) {
                        errorMessage = "Non autorisé. Vérifiez vos permissions d'administrateur Microsoft.";
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
            console.log("Microsoft user created successfully:", createdUser.userPrincipalName);

            return new Response(
                JSON.stringify({
                    success: true,
                    user: {
                        id: createdUser.id,
                        email: createdUser.userPrincipalName,
                        name: createdUser.displayName,
                    },
                    invitationSentTo: personalEmail,
                    message: `Utilisateur créé avec succès. Mot de passe temporaire envoyé.`,
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

            console.log(`Deleting Microsoft user: ${userId}`);

            const deleteResponse = await fetch(
                `${GRAPH_API}/users/${userId}`,
                {
                    method: "DELETE",
                    headers: {
                        Authorization: `Bearer ${provider_token}`,
                    },
                }
            );

            if (!deleteResponse.ok) {
                const errorText = await deleteResponse.text();
                console.error("Microsoft Graph API delete error:", errorText);

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

            console.log("Microsoft user deleted successfully");

            return new Response(
                JSON.stringify({
                    success: true,
                    message: "Utilisateur supprimé avec succès de Microsoft 365.",
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
