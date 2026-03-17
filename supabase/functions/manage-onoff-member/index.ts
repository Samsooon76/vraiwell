import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ONOFF_API_BASE_URL = "https://public-apigateway.onoffapp.net/api/v1";

function jsonResponse(body: unknown, status = 200) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

async function parseResponse(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function getErrorMessage(payload: unknown, fallback: string) {
  if (typeof payload === "string" && payload.trim()) {
    return payload;
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const error = record.error;

    if (error && typeof error === "object") {
      const errorRecord = error as Record<string, unknown>;
      if (typeof errorRecord.message === "string" && errorRecord.message.trim()) {
        return errorRecord.message;
      }
    }

    if (typeof record.message === "string" && record.message.trim()) {
      return record.message;
    }
  }

  return fallback;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { action, api_key, memberId, status, offset, limit } = await req.json();

    if (!api_key) {
      return jsonResponse({ error: "Missing api_key" }, 400);
    }

    if (action === "list_numbers") {
      const url = new URL(`${ONOFF_API_BASE_URL}/numbers`);
      url.searchParams.set("status", status || "used");

      if (memberId) {
        url.searchParams.set("memberId", String(memberId));
      }
      if (offset) {
        url.searchParams.set("offset", String(offset));
      }
      if (limit) {
        url.searchParams.set("limit", String(limit));
      }

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          "X-API-Key": api_key,
        },
      });

      const payload = await parseResponse(response);

      if (!response.ok) {
        console.error("OnOff numbers API error:", payload);
        return jsonResponse(
          { error: getErrorMessage(payload, "Failed to fetch Onoff numbers") },
          response.status,
        );
      }

      const numbers = Array.isArray((payload as Record<string, unknown> | null)?.numbers)
        ? ((payload as Record<string, unknown>).numbers as Record<string, unknown>[])
          .map((number) => ({
            id: String(number.id ?? ""),
            phoneNumber: String(number.phoneNumber ?? number.phonenumber ?? number.id ?? ""),
            countryCode: typeof number.countryCode === "string" ? number.countryCode : null,
            memberIdRef: typeof number.memberIdRef === "string"
              ? number.memberIdRef
              : typeof number.userIdRef === "string"
                ? number.userIdRef
                : null,
            expirationDate: typeof number.expirationDate === "string" ? number.expirationDate : null,
            createdAt: typeof number.createdAt === "string" ? number.createdAt : null,
            isLandline: typeof number.isLandline === "boolean" ? number.isLandline : null,
          }))
        : [];

      return jsonResponse({
        success: true,
        numbers,
        meta: {
          total: numbers.length,
          nextOffset: (payload as Record<string, unknown> | null)?.nextOffset ?? null,
        },
      });
    }

    if (action === "delete_member") {
      if (!memberId) {
        return jsonResponse({ error: "Missing memberId" }, 400);
      }

      const response = await fetch(`${ONOFF_API_BASE_URL}/members/${memberId}`, {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          "X-API-Key": api_key,
        },
      });

      const payload = await parseResponse(response);

      if (!response.ok) {
        console.error("OnOff member delete API error:", payload);
        return jsonResponse(
          {
            error: getErrorMessage(
              payload,
              response.status === 409
                ? "OnOff refuses to delete this member while a number is still assigned to it"
                : "Failed to delete Onoff member",
            ),
          },
          response.status,
        );
      }

      return jsonResponse({
        success: true,
        message: "Member deleted successfully",
      });
    }

    return jsonResponse({ error: "Invalid action" }, 400);
  } catch (error) {
    console.error("Error:", error);
    return jsonResponse({
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500);
  }
});
