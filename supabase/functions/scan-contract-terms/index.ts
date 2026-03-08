import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENAI_MODEL = "gpt-5";

type ContractRow = {
  id: string;
  user_id: string;
  contract_label: string;
  tool_name: string;
  vendor_name: string | null;
  source_url: string | null;
  terms_url: string | null;
  end_date: string | null;
  renewal_type: "none" | "manual" | "tacit";
  renewal_notice_days: number | null;
  renewal_period_months: number | null;
  notice_deadline: string | null;
  terms_summary: string | null;
  terms_status: "not_started" | "queued" | "reviewing" | "completed" | "failed";
};

type SearchSource = {
  title: string | null;
  url: string;
};

type OpenAIResponsesOutputItem = {
  type?: string;
  content?: Array<{ type?: string; text?: string; annotations?: Array<{ type?: string; url_citation?: { url?: string; title?: string } }> }>;
  action?: {
    sources?: Array<{ url?: string; title?: string }>;
  };
};

type OpenAIResponsesPayload = {
  output?: OpenAIResponsesOutputItem[];
  output_text?: string;
};

type OfficialSiteDiscovery = {
  officialDomain: string | null;
  websiteUrl: string | null;
  providerLabel: string | null;
  evidence: string[];
  confidence: "high" | "medium" | "low";
};

type TermsExtraction = {
  officialDomain: string | null;
  websiteUrl: string | null;
  termsUrl: string | null;
  documentType: "cgv" | "cgu" | "terms" | "msa" | "subscription_agreement" | "legal" | "pricing" | "other";
  renewalType: "none" | "manual" | "tacit";
  renewalPeriodMonths: number | null;
  noticeDays: number | null;
  terminationClause: string | null;
  summary: string | null;
  evidence: string[];
  confidence: "high" | "medium" | "low";
};

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function nullableStringSchema(description: string) {
  return {
    anyOf: [{ type: "string" }, { type: "null" }],
    description,
  };
}

function nullableIntegerSchema(description: string) {
  return {
    anyOf: [{ type: "integer" }, { type: "null" }],
    description,
  };
}

function parseUrlHostname(value?: string | null) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function normalizeDomain(value?: string | null) {
  if (!value) {
    return null;
  }

  return value.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/.*$/, "").trim().toLowerCase() || null;
}

function normalizeUrl(value?: string | null) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function normalizeOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeOptionalNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim())
    .slice(0, 8);
}

function normalizeLabel(value?: string | null) {
  if (!value) {
    return "";
  }

  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function buildDomainHints(contract: ContractRow) {
  return [
    contract.tool_name,
    contract.vendor_name,
    contract.contract_label,
  ]
    .map((value) => normalizeLabel(value))
    .filter(Boolean)
    .flatMap((value) => value.split(" "))
    .filter((value) => value.length >= 3);
}

function scoreSource(source: SearchSource, hints: string[], preferredDomain?: string | null) {
  const url = normalizeUrl(source.url);
  const domain = normalizeDomain(parseUrlHostname(url));
  const haystack = `${domain ?? ""} ${normalizeLabel(source.title)}`.trim();

  let score = 0;

  if (preferredDomain && domain === preferredDomain) {
    score += 10;
  }

  if (domain) {
    score += 2;
  }

  for (const hint of hints) {
    if (domain?.includes(hint)) {
      score += 4;
    }

    if (haystack.includes(hint)) {
      score += 2;
    }
  }

  if (url && /\/(terms|legal|cgv|cgu|conditions|tos|subscription|agreement)/i.test(url)) {
    score -= 1;
  }

  return score;
}

function pickBestSource(
  sources: SearchSource[],
  contract: ContractRow,
  preferredDomain?: string | null,
) {
  const hints = buildDomainHints(contract);

  return [...sources]
    .sort((left, right) => scoreSource(right, hints, preferredDomain) - scoreSource(left, hints, preferredDomain))
    [0] ?? null;
}

function pickBestLegalSource(
  sources: SearchSource[],
  contract: ContractRow,
  preferredDomain?: string | null,
) {
  const legalSources = sources.filter((source) => {
    const url = normalizeUrl(source.url);
    const title = normalizeLabel(source.title);
    const haystack = `${url ?? ""} ${title}`;
    return /(terms|legal|cgv|cgu|conditions|tos|subscription|agreement|pricing)/i.test(haystack);
  });

  return pickBestSource(legalSources.length > 0 ? legalSources : sources, contract, preferredDomain);
}

function calculateNoticeDeadline(endDate?: string | null, noticeDays?: number | null) {
  if (!endDate || !noticeDays || noticeDays <= 0) {
    return null;
  }

  const target = new Date(`${endDate}T00:00:00.000Z`);
  target.setUTCDate(target.getUTCDate() - noticeDays);
  return target.toISOString().slice(0, 10);
}

function extractResponseText(payload: OpenAIResponsesPayload) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const text = (payload.output || [])
    .flatMap((item) => item.content || [])
    .map((part) => part.text ?? "")
    .join("\n")
    .trim();

  return text || null;
}

function extractResponseSources(payload: OpenAIResponsesPayload) {
  const deduped = new Map<string, SearchSource>();

  for (const item of payload.output || []) {
    for (const source of item.action?.sources || []) {
      const url = normalizeUrl(source.url);
      if (!url) {
        continue;
      }

      deduped.set(url, {
        url,
        title: normalizeOptionalString(source.title),
      });
    }

    for (const content of item.content || []) {
      for (const annotation of content.annotations || []) {
        const url = normalizeUrl(annotation.url_citation?.url);
        if (!url) {
          continue;
        }

        deduped.set(url, {
          url,
          title: normalizeOptionalString(annotation.url_citation?.title),
        });
      }
    }
  }

  return Array.from(deduped.values());
}

async function callOpenAIResponses(
  apiKey: string,
  body: Record<string, unknown>,
) {
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

function parseOfficialSiteDiscovery(value: unknown): OfficialSiteDiscovery | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const confidence = candidate.confidence === "high" || candidate.confidence === "medium" || candidate.confidence === "low"
    ? candidate.confidence
    : "low";

  return {
    officialDomain: normalizeDomain(normalizeOptionalString(candidate.officialDomain)),
    websiteUrl: normalizeUrl(normalizeOptionalString(candidate.websiteUrl)),
    providerLabel: normalizeOptionalString(candidate.providerLabel),
    evidence: normalizeStringArray(candidate.evidence),
    confidence,
  };
}

function parseTermsExtraction(value: unknown): TermsExtraction | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const confidence = candidate.confidence === "high" || candidate.confidence === "medium" || candidate.confidence === "low"
    ? candidate.confidence
    : "low";
  const documentType =
    candidate.documentType === "cgv" ||
      candidate.documentType === "cgu" ||
      candidate.documentType === "terms" ||
      candidate.documentType === "msa" ||
      candidate.documentType === "subscription_agreement" ||
      candidate.documentType === "legal" ||
      candidate.documentType === "pricing"
      ? candidate.documentType
      : "other";
  const renewalType =
    candidate.renewalType === "manual" || candidate.renewalType === "tacit" || candidate.renewalType === "none"
      ? candidate.renewalType
      : "none";

  return {
    officialDomain: normalizeDomain(normalizeOptionalString(candidate.officialDomain)),
    websiteUrl: normalizeUrl(normalizeOptionalString(candidate.websiteUrl)),
    termsUrl: normalizeUrl(normalizeOptionalString(candidate.termsUrl)),
    documentType,
    renewalType,
    renewalPeriodMonths: normalizeOptionalNumber(candidate.renewalPeriodMonths),
    noticeDays: normalizeOptionalNumber(candidate.noticeDays),
    terminationClause: normalizeOptionalString(candidate.terminationClause),
    summary: normalizeOptionalString(candidate.summary),
    evidence: normalizeStringArray(candidate.evidence),
    confidence,
  };
}

async function discoverOfficialWebsite(
  contract: ContractRow,
  apiKey: string,
) {
  const sourceDomain = normalizeDomain(parseUrlHostname(contract.source_url));
  const searchResponse = await callOpenAIResponses(apiKey, {
    model: OPENAI_MODEL,
    tools: [
      {
        type: "web_search",
        search_context_size: "medium",
        user_location: {
          type: "approximate",
          country: "FR",
          timezone: "Europe/Paris",
        },
      },
    ],
    include: ["web_search_call.action.sources"],
    tool_choice: "auto",
    max_output_tokens: 900,
    text: {
      format: {
        type: "json_schema",
        name: "official_site_discovery",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            officialDomain: nullableStringSchema("Official root domain, without protocol."),
            websiteUrl: nullableStringSchema("Official homepage URL for the provider or product."),
            providerLabel: nullableStringSchema("Short provider or product label."),
            evidence: {
              type: "array",
              items: { type: "string" },
              description: "Short supporting facts from search results.",
            },
            confidence: {
              type: "string",
              enum: ["high", "medium", "low"],
            },
          },
          required: ["officialDomain", "websiteUrl", "providerLabel", "evidence", "confidence"],
        },
      },
    },
    input: [
      {
        role: "system",
        content:
          "You identify the official public website for a software vendor or subscription provider. " +
          "Return JSON only. Prefer the vendor's primary website or the product's official marketing site. " +
          "Avoid review sites, social profiles, app stores, documentation-only hosts, and news articles unless they are the only official web presence.",
      },
      {
        role: "user",
        content:
          `Find the official website for this provider.\n` +
          `Contract label: ${contract.contract_label}\n` +
          `Tool name: ${contract.tool_name}\n` +
          `Vendor name: ${contract.vendor_name ?? "unknown"}\n` +
          `Existing source URL hint: ${contract.source_url ?? "none"}\n` +
          `Existing source domain hint: ${sourceDomain ?? "none"}`,
      },
    ],
  });

  const discoveryText = extractResponseText(searchResponse);
  const sources = extractResponseSources(searchResponse);
  const bestSource = pickBestSource(sources, contract, sourceDomain);
  const parsedDiscovery = parseOfficialSiteDiscovery(safeJsonParse(discoveryText));
  const fallbackWebsiteUrl = normalizeUrl(contract.source_url) ?? normalizeUrl(bestSource?.url);
  const fallbackDomain = normalizeDomain(parseUrlHostname(fallbackWebsiteUrl));
  const discovery = parsedDiscovery ?? {
    officialDomain: fallbackDomain,
    websiteUrl: fallbackWebsiteUrl,
    providerLabel: contract.vendor_name ?? contract.tool_name ?? contract.contract_label,
    evidence: sources
      .slice(0, 3)
      .map((source) => [source.title, source.url].filter(Boolean).join(" - "))
      .filter(Boolean),
    confidence: fallbackWebsiteUrl ? "medium" : "low",
  };
  const officialDomain = discovery.officialDomain ?? fallbackDomain;
  const websiteUrl = discovery.websiteUrl ?? fallbackWebsiteUrl;

  if (!officialDomain && !websiteUrl) {
    throw new Error("Unable to determine the official provider website");
  }

  return {
    discovery: {
      ...discovery,
      officialDomain,
      websiteUrl,
    },
    sources,
  };
}

async function extractTermsData(
  contract: ContractRow,
  discovery: OfficialSiteDiscovery,
  apiKey: string,
) {
  const allowedDomains = Array.from(
    new Set(
      [
        discovery.officialDomain,
        normalizeDomain(parseUrlHostname(discovery.websiteUrl)),
        normalizeDomain(parseUrlHostname(contract.source_url)),
        normalizeDomain(parseUrlHostname(contract.terms_url)),
      ].filter((value): value is string => Boolean(value)),
    ),
  );

  const response = await callOpenAIResponses(apiKey, {
    model: OPENAI_MODEL,
    tools: [
      {
        type: "web_search",
        search_context_size: "high",
        user_location: {
          type: "approximate",
          country: "FR",
          timezone: "Europe/Paris",
        },
      },
    ],
    include: ["web_search_call.action.sources"],
    tool_choice: "auto",
    max_output_tokens: 1400,
    text: {
      format: {
        type: "json_schema",
        name: "terms_extraction",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            officialDomain: nullableStringSchema("Official root domain for the vendor."),
            websiteUrl: nullableStringSchema("Official public website URL."),
            termsUrl: nullableStringSchema("Best legal or commercial terms page URL for the subscription."),
            documentType: {
              type: "string",
              enum: ["cgv", "cgu", "terms", "msa", "subscription_agreement", "legal", "pricing", "other"],
            },
            renewalType: {
              type: "string",
              enum: ["none", "manual", "tacit"],
            },
            renewalPeriodMonths: nullableIntegerSchema("Renewal duration in months."),
            noticeDays: nullableIntegerSchema("Notice period in days before renewal or termination."),
            terminationClause: nullableStringSchema("Short plain-language description of the termination or cancellation clause."),
            summary: nullableStringSchema("Concise operational summary of the renewal and cancellation terms."),
            evidence: {
              type: "array",
              items: { type: "string" },
              description: "Short supporting excerpts from the legal page or indexed web result.",
            },
            confidence: {
              type: "string",
              enum: ["high", "medium", "low"],
            },
          },
          required: [
            "officialDomain",
            "websiteUrl",
            "termsUrl",
            "documentType",
            "renewalType",
            "renewalPeriodMonths",
            "noticeDays",
            "terminationClause",
            "summary",
            "evidence",
            "confidence",
          ],
        },
      },
    },
    input: [
      {
        role: "system",
        content:
          "You identify the most relevant legal/commercial terms page for a software subscription and extract renewal and cancellation data. " +
          "Return JSON only. Search only the official domain when provided. " +
          "Prefer pages like CGV, CGU, Terms, Terms of Service, Subscription Agreement, MSA, Legal, or pricing terms. " +
          "If multiple pages exist, choose the page most applicable to customer subscription, billing, renewal, or termination. " +
          "Use null when a field is not clearly supported by the source.",
      },
      {
        role: "user",
        content:
          `Find and analyze the best terms page for this provider.\n` +
          `Contract label: ${contract.contract_label}\n` +
          `Tool name: ${contract.tool_name}\n` +
          `Vendor name: ${contract.vendor_name ?? "unknown"}\n` +
          `Official domain: ${discovery.officialDomain ?? "unknown"}\n` +
          `Official website: ${discovery.websiteUrl ?? "unknown"}\n` +
          `Preferred domains: ${allowedDomains.length > 0 ? allowedDomains.join(", ") : "unknown"}\n` +
          `Existing source URL hint: ${contract.source_url ?? "none"}\n` +
          `Existing terms URL hint: ${contract.terms_url ?? "none"}\n` +
          `${allowedDomains.length > 0 ? `Search queries must stay under site:${allowedDomains[0]} when possible.\n` : ""}` +
          `Focus on renewal, tacit renewal, notice period, and cancellation.`,
      },
    ],
  });

  const responseText = extractResponseText(response);
  const sources = extractResponseSources(response);
  const fallbackTermsSource = pickBestLegalSource(sources, contract, discovery.officialDomain);
  const parsedExtraction = parseTermsExtraction(safeJsonParse(responseText));
  const extraction = parsedExtraction ?? {
    officialDomain: discovery.officialDomain,
    websiteUrl: discovery.websiteUrl,
    termsUrl: normalizeUrl(contract.terms_url) ?? normalizeUrl(fallbackTermsSource?.url),
    documentType: "other" as const,
    renewalType: "none" as const,
    renewalPeriodMonths: null,
    noticeDays: null,
    terminationClause: null,
    summary: null,
    evidence: sources
      .slice(0, 4)
      .map((source) => [source.title, source.url].filter(Boolean).join(" - "))
      .filter(Boolean),
    confidence: fallbackTermsSource ? "medium" as const : "low" as const,
  };

  if (!extraction.termsUrl && sources.length === 0) {
    throw new Error("Unable to extract structured CGV/CGU data");
  }

  return {
    extraction: {
      ...extraction,
      officialDomain: extraction.officialDomain ?? discovery.officialDomain,
      websiteUrl: extraction.websiteUrl ?? discovery.websiteUrl,
    },
    sources,
  };
}

function buildTermsSummary(result: TermsExtraction) {
  const parts: string[] = [];

  if (result.summary) {
    parts.push(result.summary);
  }

  if (result.renewalType !== "none") {
    const renewalParts = [
      result.renewalType === "tacit" ? "Reconduction tacite" : "Renouvellement manuel",
      result.renewalPeriodMonths ? `${result.renewalPeriodMonths} mois` : null,
      result.noticeDays ? `preavis ${result.noticeDays} jours` : null,
    ].filter(Boolean);

    parts.push(renewalParts.join(" - "));
  }

  if (result.terminationClause) {
    parts.push(result.terminationClause);
  }

  if (result.evidence.length > 0) {
    parts.push(`Indices: ${result.evidence.slice(0, 3).join(" | ")}`);
  }

  return parts.join(" ").trim() || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let processedContractId: string | null = null;

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
      .select("*")
      .eq("id", contractId)
      .eq("user_id", user.id)
      .single();

    if (contractError || !contract) {
      return jsonResponse({ error: "Contract not found" }, 404);
    }

    processedContractId = contract.id;
    const currentContract = contract as ContractRow;

    await supabase
      .from("contracts")
      .update({
        terms_status: "reviewing",
      })
      .eq("id", currentContract.id);

    const { discovery, sources: discoverySources } = await discoverOfficialWebsite(currentContract, openAiApiKey);
    const { extraction, sources: termsSources } = await extractTermsData(currentContract, discovery, openAiApiKey);

    const mergedSources = Array.from(
      new Map(
        [...discoverySources, ...termsSources].map((source) => [source.url, source]),
      ).values(),
    );

    const nextRenewalType =
      currentContract.renewal_type !== "none"
        ? currentContract.renewal_type
        : extraction.renewalType;
    const nextNoticeDays = currentContract.renewal_notice_days ?? extraction.noticeDays;
    const nextNoticeDeadline =
      currentContract.notice_deadline ?? calculateNoticeDeadline(currentContract.end_date, nextNoticeDays);
    const nextRenewalPeriodMonths = currentContract.renewal_period_months ?? extraction.renewalPeriodMonths;
    const nextTermsSummary = buildTermsSummary(extraction);

    const success = Boolean(extraction.termsUrl || nextTermsSummary);

    await supabase
      .from("contracts")
      .update({
        source_url: currentContract.source_url ?? extraction.websiteUrl ?? discovery.websiteUrl,
        terms_url: extraction.termsUrl ?? currentContract.terms_url,
        terms_summary: nextTermsSummary ?? currentContract.terms_summary,
        terms_status: success ? "completed" : "failed",
        terms_checked_at: new Date().toISOString(),
        renewal_type: nextRenewalType,
        renewal_notice_days: nextNoticeDays,
        renewal_period_months: nextRenewalPeriodMonths,
        notice_deadline: nextNoticeDeadline,
      })
      .eq("id", currentContract.id);

    return jsonResponse({
      success,
      discovery,
      extraction,
      sources: mergedSources,
      termsSummary: nextTermsSummary,
    });
  } catch (error: unknown) {
    console.error("scan-contract-terms error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";

    if (processedContractId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

      if (supabaseUrl && serviceRoleKey) {
        const supabase = createClient(supabaseUrl, serviceRoleKey);
        await supabase
          .from("contracts")
          .update({
            terms_status: "failed",
            terms_checked_at: new Date().toISOString(),
          })
          .eq("id", processedContractId);
      }
    }

    return jsonResponse({ error: message }, 500);
  }
});
