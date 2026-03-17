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
    const { api_key, offset, limit } = await req.json();

    if (!api_key) {
      return new Response(
        JSON.stringify({ error: "Missing api_key" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const url = new URL("https://public-apigateway.onoffapp.net/api/v1/members");
    if (offset) {
      url.searchParams.set("offset", String(offset));
    }
    if (limit) {
      url.searchParams.set("limit", String(limit));
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "X-API-Key": api_key,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("OnOff API Error:", data);
      return new Response(
        JSON.stringify({
          error: data?.error?.message || data?.message || "Failed to fetch Onoff members",
          code: data?.error?.code ?? null,
        }),
        {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const members = Array.isArray(data.members)
      ? data.members.map((member: Record<string, unknown>) => ({
        id: member.id,
        firstName: member.firstName ?? "",
        lastName: member.lastName ?? "",
        name: `${member.firstName ?? ""} ${member.lastName ?? ""}`.trim() || member.email || "Unknown",
        email: member.email ?? null,
        role: member.role ?? null,
        departmentIdRefs: Array.isArray(member.departmentIdRefs) ? member.departmentIdRefs : [],
        numberIdRefs: Array.isArray(member.numberIdRefs) ? member.numberIdRefs : [],
        isActive: true,
      }))
      : [];

    return new Response(
      JSON.stringify({
        success: true,
        members,
        meta: {
          total: members.length,
          nextOffset: data.nextOffset ?? null,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
