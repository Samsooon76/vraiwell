import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const OPENAI_MODEL = "gpt-5-nano-2025-08-07";

type ContractRow = {
  id: string;
  user_id: string;
  contract_label: string;
  tool_name: string;
  vendor_name: string | null;
  source_url: string | null;
  start_date: string | null;
  end_date: string | null;
  renewal_type: "none" | "manual" | "tacit";
  renewal_period_months: number | null;
  renewal_notice_days: number | null;
  notice_deadline: string | null;
  terms_summary: string | null;
  ocr_extracted_fields: Record<string, unknown> | null;
  notes: string | null;
};

type OpenAIResponsesOutputItem = {
  type?: string;
  content?: Array<{ type?: string; text?: string }>;
};

type OpenAIResponsesPayload = {
  output?: OpenAIResponsesOutputItem[];
  output_text?: string;
};

type EmailDraft = {
  subject: string;
  body: string;
};

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function stringSchema(description: string) {
  return {
    type: "string",
    description,
  };
}

async function callOpenAIResponses(apiKey: string, body: Record<string, unknown>) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI Responses error (${response.status}): ${errorText}`);
  }

  return await response.json() as OpenAIResponsesPayload;
}

function extractResponseText(payload: OpenAIResponsesPayload) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && typeof content.text === "string" && content.text.trim()) {
        return content.text.trim();
      }
    }
  }

  return null;
}

function buildFallbackDraft(contract: ContractRow) {
  const vendor = contract.vendor_name ?? contract.tool_name;
  const identifier = [contract.contract_label, contract.tool_name]
    .filter((value, index, array) => Boolean(value) && array.indexOf(value) === index)
    .join(" / ");
  const subject = `Non reconduction tacite du contrat ${contract.contract_label}`;
  const endDateClause = contract.end_date
    ? `Nous vous confirmons notre souhait de mettre fin a ce contrat a son echeance du ${contract.end_date}, sans reconduction tacite.`
    : "Nous vous confirmons notre souhait de mettre fin a ce contrat a son echeance, sans reconduction tacite.";
  const noticeClause = contract.notice_deadline
    ? `Cette notification vous est adressee avant la date de preavis du ${contract.notice_deadline}.`
    : "Cette notification vous est adressee dans le respect du preavis contractuellement applicable.";

  return {
    subject,
    body: [
      "Bonjour,",
      "",
      `Par le present email, nous vous informons de notre decision de ne pas reconduire tacitement le contrat ${identifier} conclu avec ${vendor}.`,
      endDateClause,
      noticeClause,
      "Merci de nous confirmer par retour d'email la bonne prise en compte de cette demande et la date effective de fin de contrat.",
      "",
      "Cordialement,",
    ].join("\n"),
  } satisfies EmailDraft;
}

function getCachedDraft(contract: ContractRow) {
  const fields = contract.ocr_extracted_fields;
  if (!fields || typeof fields !== "object") {
    return null;
  }

  const generatedArtifacts =
    "generatedArtifacts" in fields && fields.generatedArtifacts && typeof fields.generatedArtifacts === "object"
      ? fields.generatedArtifacts as Record<string, unknown>
      : null;

  const nonRenewalEmail =
    generatedArtifacts &&
      "nonRenewalEmail" in generatedArtifacts &&
      generatedArtifacts.nonRenewalEmail &&
      typeof generatedArtifacts.nonRenewalEmail === "object"
      ? generatedArtifacts.nonRenewalEmail as Record<string, unknown>
      : null;

  const subject = normalizeOptionalString(nonRenewalEmail?.subject);
  const body = normalizeOptionalString(nonRenewalEmail?.body);
  const generatedAt = normalizeOptionalString(nonRenewalEmail?.generatedAt);

  if (!subject || !body) {
    return null;
  }

  return {
    subject,
    body,
    generatedAt,
  };
}

function withCachedDraft(
  existingFields: Record<string, unknown> | null,
  draft: EmailDraft,
  generatedAt: string,
) {
  const nextFields = existingFields && typeof existingFields === "object" ? { ...existingFields } : {};
  const generatedArtifacts =
    "generatedArtifacts" in nextFields && nextFields.generatedArtifacts && typeof nextFields.generatedArtifacts === "object"
      ? { ...(nextFields.generatedArtifacts as Record<string, unknown>) }
      : {};

  generatedArtifacts.nonRenewalEmail = {
    subject: draft.subject,
    body: draft.body,
    generatedAt,
  };

  nextFields.generatedArtifacts = generatedArtifacts;

  return nextFields;
}

function safeJsonParse(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function normalizeOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseEmailDraft(value: unknown): EmailDraft | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const subject = normalizeOptionalString(candidate.subject);
  const body = normalizeOptionalString(candidate.body);

  if (!subject || !body) {
    return null;
  }

  return { subject, body };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const openAiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openAiApiKey) {
      return jsonResponse({ error: "Missing OPENAI_API_KEY secret" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing authorization header" }, 401);
    }

    const { contractId } = await req.json();
    if (!contractId || typeof contractId !== "string") {
      return jsonResponse({ error: "Missing contractId" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return jsonResponse({ error: "Invalid token" }, 401);
    }

    const { data: contract, error: contractError } = await supabase
      .from("contracts")
      .select("id, user_id, contract_label, tool_name, vendor_name, source_url, start_date, end_date, renewal_type, renewal_period_months, renewal_notice_days, notice_deadline, terms_summary, ocr_extracted_fields, notes")
      .eq("id", contractId)
      .eq("user_id", user.id)
      .single();

    if (contractError || !contract) {
      return jsonResponse({ error: "Contract not found" }, 404);
    }

    const currentContract = contract as ContractRow;
    const cachedDraft = getCachedDraft(currentContract);
    if (cachedDraft) {
      return jsonResponse({
        subject: cachedDraft.subject,
        body: cachedDraft.body,
        generatedAt: cachedDraft.generatedAt,
        cached: true,
      });
    }

    const response = await callOpenAIResponses(openAiApiKey, {
      model: OPENAI_MODEL,
      max_output_tokens: 1200,
      text: {
        format: {
          type: "json_schema",
          name: "non_renewal_email",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              subject: stringSchema("French subject line for the email."),
              body: stringSchema("French email body, ready to send."),
            },
            required: ["subject", "body"],
          },
        },
      },
      input: [
        {
          role: "system",
          content:
            "You draft a French business email to refuse tacit renewal of a software or service contract. " +
            "Return JSON only. The tone must be professional, firm, and concise. " +
            "Do not invent legal facts, dates, or clauses. Use only the contract data provided. " +
            "If the notice deadline is unknown, mention that the notice is sent within the applicable contractual notice period without giving an invented date. " +
            "The email body must include: a clear statement that the sender does not wish to renew, the contract identification, the intended end date when known, a request for written confirmation, and a polite closing. " +
            "Do not use markdown, bullet points, placeholders in brackets, or explanatory notes.",
        },
        {
          role: "user",
          content:
            `Draft the email.\n` +
            `Contract label: ${currentContract.contract_label}\n` +
            `Tool name: ${currentContract.tool_name}\n` +
            `Vendor name: ${currentContract.vendor_name ?? "unknown"}\n` +
            `Renewal type: ${currentContract.renewal_type}\n` +
            `Contract start date: ${currentContract.start_date ?? "unknown"}\n` +
            `Contract end date: ${currentContract.end_date ?? "unknown"}\n` +
            `Notice deadline: ${currentContract.notice_deadline ?? "unknown"}\n` +
            `Renewal period in months: ${currentContract.renewal_period_months ?? "unknown"}\n` +
            `Notice period in days: ${currentContract.renewal_notice_days ?? "unknown"}\n` +
            `Terms summary: ${currentContract.terms_summary ?? "none"}\n` +
            `Internal notes: ${currentContract.notes ?? "none"}\n` +
            `Existing source URL: ${currentContract.source_url ?? "none"}\n` +
            "Write the email as if sent by the customer to the vendor. Keep it directly usable.",
        },
      ],
    });

    const responseText = extractResponseText(response);
    const parsedDraft = parseEmailDraft(safeJsonParse(responseText)) ?? buildFallbackDraft(currentContract);
    const generatedAt = new Date().toISOString();

    await supabase
      .from("contracts")
      .update({
        ocr_extracted_fields: withCachedDraft(currentContract.ocr_extracted_fields, parsedDraft, generatedAt),
      })
      .eq("id", currentContract.id)
      .eq("user_id", user.id);

    return jsonResponse({
      ...parsedDraft,
      generatedAt,
      cached: false,
    });
  } catch (error: unknown) {
    console.error("generate-non-renewal-email error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
