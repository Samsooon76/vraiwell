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

async function fetchOnOffNumbers({
  apiKey,
  status,
  memberId,
  countryCode,
  offset,
  limit,
}: {
  apiKey: string;
  status: string;
  memberId?: string;
  countryCode?: string;
  offset?: string | number;
  limit?: string | number;
}) {
  const attemptedQueries: Array<{
    countryCode: string | null;
    status: string;
    includeLimit: boolean;
    includeOffset: boolean;
    offset: string | null;
  }> = [];

  if (status === "available" && countryCode && !memberId) {
    const normalizedCountryCode = String(countryCode).trim().toUpperCase();
    attemptedQueries.push({
      countryCode: normalizedCountryCode,
      status,
      includeLimit: false,
      includeOffset: false,
      offset: null,
    });

    const url = new URL(`${ONOFF_API_BASE_URL}/numbers`);
    url.searchParams.set("status", "available");
    url.searchParams.set("countryCode", normalizedCountryCode);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-API-Key": apiKey,
      },
    });

    const payload = await parseResponse(response);

    return {
      response,
      payload,
      attemptedQueries,
      fallbackUsed: false,
    };
  }

  const countryCodeCandidates = countryCode
    ? [String(countryCode).trim().toUpperCase()].filter(Boolean)
    : [undefined];
  const queryCandidates = Array.from(
    new Map(
      [
        ...countryCodeCandidates.flatMap((currentCountryCode) => ([
          { countryCode: currentCountryCode, includeLimit: true, includeOffset: true },
          { countryCode: currentCountryCode, includeLimit: false, includeOffset: false },
        ])),
        ...(status === "available" && countryCode
          ? [
            { countryCode: undefined, includeLimit: true, includeOffset: false },
            { countryCode: undefined, includeLimit: false, includeOffset: false },
          ]
          : []),
      ].map((candidate) => [
        `${candidate.countryCode ?? "none"}:${candidate.includeLimit}:${candidate.includeOffset}`,
        candidate,
      ]),
    ).values(),
  );

  let lastResponse: Response | null = null;
  let lastPayload: unknown = null;
  let fallbackUsed = false;

  for (const candidate of queryCandidates) {
    const currentCountryCode = candidate.countryCode;
    let currentOffset = candidate.includeOffset && offset
      ? String(offset)
      : null;

    for (let page = 0; page < 10; page += 1) {
      attemptedQueries.push({
        countryCode: currentCountryCode ?? null,
        status,
        includeLimit: candidate.includeLimit,
        includeOffset: candidate.includeOffset,
        offset: currentOffset,
      });

      const url = new URL(`${ONOFF_API_BASE_URL}/numbers`);
      url.searchParams.set("status", status);

      if (memberId) {
        url.searchParams.set("memberId", String(memberId));
      }
      if (currentCountryCode) {
        url.searchParams.set("countryCode", currentCountryCode);
      }
      if (currentOffset) {
        url.searchParams.set("offset", currentOffset);
      }
      if (candidate.includeLimit && limit) {
        url.searchParams.set("limit", String(limit));
      }

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          "X-API-Key": apiKey,
        },
      });

      const payload = await parseResponse(response);
      lastResponse = response;
      lastPayload = payload;

      if (response.ok) {
        const payloadRecord = payload && typeof payload === "object"
          ? payload as Record<string, unknown>
          : null;
        const numbers = Array.isArray(payloadRecord?.numbers)
          ? payloadRecord.numbers as Record<string, unknown>[]
          : [];
        const nextOffset = typeof payloadRecord?.nextOffset === "string" && payloadRecord.nextOffset.trim()
          ? payloadRecord.nextOffset.trim()
          : null;

        if (numbers.length === 0 && nextOffset && nextOffset !== currentOffset) {
          currentOffset = nextOffset;
          fallbackUsed = true;
          continue;
        }

        fallbackUsed = fallbackUsed || !currentCountryCode || !candidate.includeLimit || !candidate.includeOffset;
        return { response, payload, attemptedQueries, fallbackUsed };
      }

      if (response.status !== 400) {
        break;
      }

      if (currentOffset) {
        break;
      }
    }
  }

  return { response: lastResponse, payload: lastPayload, attemptedQueries, fallbackUsed };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      action,
      api_key,
      memberId,
      memberIdRef,
      status,
      offset,
      limit,
      countryCode,
      firstName,
      lastName,
      email,
      role,
      departmentIdRefs,
      phoneNumber,
      assignNumber,
    } = await req.json();

    if (!api_key) {
      return jsonResponse({ error: "Missing api_key" }, 400);
    }

    if (action === "list_numbers") {
      const { response, payload, attemptedQueries, fallbackUsed } = await fetchOnOffNumbers({
        apiKey: api_key,
        status: status || "used",
        memberId: memberId ? String(memberId) : undefined,
        countryCode: countryCode ? String(countryCode) : undefined,
        offset,
        limit,
      });

      if (!response || !response.ok) {
        console.error("OnOff numbers API error:", payload);
        return jsonResponse(
          {
            error: getErrorMessage(payload, "Failed to fetch Onoff numbers"),
            details: payload,
            meta: {
              attemptedQueries,
              fallbackUsed,
            },
          },
          response?.status ?? 500,
        );
      }

      // Debug: log the actual API response structure
      const payloadType = payload === null ? "null" : Array.isArray(payload) ? "array" : typeof payload;
      const payloadKeys = payload && typeof payload === "object" && !Array.isArray(payload)
        ? Object.keys(payload as Record<string, unknown>)
        : [];
      const isTopLevelArray = Array.isArray(payload);

      const rawNumbers = isTopLevelArray
        ? payload as unknown[]
        : Array.isArray((payload as Record<string, unknown> | null)?.numbers)
          ? (payload as Record<string, unknown>).numbers as unknown[]
          : [];
      const numbers = rawNumbers.flatMap((number) => {
        if (typeof number === "string" && number.trim()) {
          return [{
            id: number.trim(),
            phoneNumber: number.trim(),
            countryCode: countryCode ? String(countryCode).trim().toLowerCase() : null,
            memberIdRef: null,
            expirationDate: null,
            createdAt: null,
            isLandline: null,
          }];
        }

        if (!number || typeof number !== "object") {
          return [];
        }

        const record = number as Record<string, unknown>;
        const identifier = String(
          record.id
            || record.phoneNumber
            || record.phonenumber
            || record.msisdn
            || record.number
            || record.value
            || "",
        ).trim();

        if (!identifier) {
          return [];
        }

        return [{
          id: identifier,
          phoneNumber: String(
            record.phoneNumber
              || record.phonenumber
              || record.msisdn
              || record.number
              || record.value
              || identifier,
          ),
          countryCode: typeof record.countryCode === "string"
            ? record.countryCode
            : countryCode
              ? String(countryCode).trim().toLowerCase()
              : null,
          memberIdRef: typeof record.memberIdRef === "string"
            ? record.memberIdRef
            : typeof record.userIdRef === "string"
              ? record.userIdRef
              : null,
          expirationDate: typeof record.expirationDate === "string" ? record.expirationDate : null,
          createdAt: typeof record.createdAt === "string" ? record.createdAt : null,
          isLandline: typeof record.isLandline === "boolean" ? record.isLandline : null,
        }];
      });

      return jsonResponse({
        success: true,
        numbers,
        meta: {
          total: numbers.length,
          rawTotal: rawNumbers.length,
          nextOffset: (payload as Record<string, unknown> | null)?.nextOffset ?? null,
          attemptedQueries,
          fallbackUsed,
          sampleNumber: rawNumbers[0] ?? null,
          debug: {
            payloadType,
            payloadKeys,
            isTopLevelArray,
            sampleRaw: rawNumbers[0] ?? null,
            sampleRawType: rawNumbers[0] === null ? "null" : typeof rawNumbers[0],
            sampleRawKeys: rawNumbers[0] && typeof rawNumbers[0] === "object" && !Array.isArray(rawNumbers[0])
              ? Object.keys(rawNumbers[0] as Record<string, unknown>)
              : [],
          },
        },
      });
    }

    if (action === "create_member") {
      if (!firstName || !lastName || !email) {
        return jsonResponse({ error: "Missing firstName, lastName or email" }, 400);
      }

      const response = await fetch(`${ONOFF_API_BASE_URL}/members`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-API-Key": api_key,
        },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          role: role === "ROLE_ADMIN" ? "ROLE_ADMIN" : "ROLE_USER",
          departmentIdRefs: Array.isArray(departmentIdRefs)
            ? departmentIdRefs.filter((value) => typeof value === "string" && value.trim())
            : [],
        }),
      });

      const payload = await parseResponse(response);

      if (!response.ok) {
        console.error("OnOff member create API error:", payload);
        return jsonResponse(
          { error: getErrorMessage(payload, "Failed to create Onoff member") },
          response.status,
        );
      }

      const member = payload && typeof payload === "object"
        ? payload as Record<string, unknown>
        : {};

      const createdMemberId = String(member.id ?? "");
      let assignedNumber: Record<string, unknown> | null = null;
      let assignmentWarning: string | null = null;

      if (assignNumber === true) {
        let targetPhoneNumber = typeof phoneNumber === "string" && phoneNumber.trim()
          ? phoneNumber.trim()
          : null;

        if (!targetPhoneNumber) {
          if (!countryCode || typeof countryCode !== "string" || !countryCode.trim()) {
            return jsonResponse({
              error: "Missing countryCode to assign a number automatically",
              member: {
                id: createdMemberId,
              },
            }, 400);
          }

          const { response: availableNumbersResponse, payload: availableNumbersPayload } = await fetchOnOffNumbers({
            apiKey: api_key,
            status: "available",
            countryCode: countryCode.trim().toUpperCase(),
            limit: 1,
          });

          if (!availableNumbersResponse || !availableNumbersResponse.ok) {
            return jsonResponse(
              {
                error: getErrorMessage(availableNumbersPayload, "Failed to fetch available Onoff numbers"),
                details: availableNumbersPayload,
              },
              availableNumbersResponse?.status ?? 500,
            );
          }

          const availableNumbers = Array.isArray((availableNumbersPayload as Record<string, unknown> | null)?.numbers)
            ? (availableNumbersPayload as Record<string, unknown>).numbers as Record<string, unknown>[]
            : [];

          if (availableNumbers.length === 0) {
            assignmentWarning = `Member created, but no available Onoff number was found for ${countryCode.trim().toLowerCase()}.`;
          } else {
            targetPhoneNumber = String(availableNumbers[0].id ?? availableNumbers[0].phoneNumber ?? "");
            assignedNumber = {
              id: String(
                availableNumbers[0].id ?? availableNumbers[0].phoneNumber ?? availableNumbers[0].phonenumber ?? "",
              ),
              phoneNumber: String(
                availableNumbers[0].phoneNumber ?? availableNumbers[0].phonenumber ?? availableNumbers[0].id ?? "",
              ),
              countryCode: typeof availableNumbers[0].countryCode === "string" ? availableNumbers[0].countryCode : null,
            };
          }
        }

        if (targetPhoneNumber) {
          const assignResponse = await fetch(
            `${ONOFF_API_BASE_URL}/numbers/${encodeURIComponent(targetPhoneNumber)}/assign`,
            {
              method: "POST",
              headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                "X-API-Key": api_key,
              },
              body: JSON.stringify({ memberIdRef: createdMemberId }),
            },
          );

          const assignPayload = await parseResponse(assignResponse);

          if (!assignResponse.ok) {
            return jsonResponse(
              { error: getErrorMessage(assignPayload, "Member created but failed to assign Onoff number") },
              assignResponse.status,
            );
          }
        }
      }

      return jsonResponse({
        success: true,
        member: {
          id: createdMemberId,
          firstName: String(member.firstName ?? firstName),
          lastName: String(member.lastName ?? lastName),
          name: `${String(member.firstName ?? firstName)} ${String(member.lastName ?? lastName)}`.trim(),
          email: typeof member.email === "string" ? member.email : String(email),
          role: typeof member.role === "string" ? member.role : "ROLE_USER",
          departmentIdRefs: Array.isArray(member.departmentIdRefs)
            ? member.departmentIdRefs.filter((value): value is string => typeof value === "string")
            : [],
          numberIdRefs: Array.isArray(member.numberIdRefs)
            ? member.numberIdRefs.filter((value): value is string => typeof value === "string")
            : [],
          isActive: true,
        },
        assignedNumber,
        warning: assignmentWarning,
      });
    }

    if (action === "assign_number") {
      if (!phoneNumber || !memberIdRef) {
        return jsonResponse({ error: "Missing phoneNumber or memberIdRef" }, 400);
      }

      const response = await fetch(
        `${ONOFF_API_BASE_URL}/numbers/${encodeURIComponent(String(phoneNumber))}/assign`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-API-Key": api_key,
          },
          body: JSON.stringify({ memberIdRef }),
        },
      );

      const payload = await parseResponse(response);

      if (!response.ok) {
        console.error("OnOff assign number API error:", payload);
        return jsonResponse(
          { error: getErrorMessage(payload, "Failed to assign Onoff number") },
          response.status,
        );
      }

      return jsonResponse({
        success: true,
        message: "Number assigned successfully",
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
