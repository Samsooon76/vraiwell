import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OCR_MODEL = "mistral-ocr-2512";
const EXTRACTION_MODEL = "mistral-small-latest";
const CONTRACTS_BUCKET = "contracts";

type ContractRow = {
  id: string;
  user_id: string;
  file_path: string | null;
  mime_type: string | null;
  start_date: string | null;
  end_date: string | null;
  renewal_type: "none" | "manual" | "tacit";
  renewal_notice_days: number | null;
  renewal_period_months: number | null;
  notice_deadline: string | null;
};

type OcrPage = {
  index: number;
  markdown: string;
  header?: string | null;
  footer?: string | null;
};

type OcrResponse = {
  model?: string;
  pages?: OcrPage[];
  document_annotation?: string | null;
};

type ExtractedSignals = {
  documentType: "contract" | "invoice" | "receipt" | "quote" | "other";
  contractLabel: string | null;
  toolName: string | null;
  vendorName: string | null;
  startDate: string | null;
  endDate: string | null;
  renewalType: "none" | "manual" | "tacit";
  renewalNoticeDays: number | null;
  renewalPeriodMonths: number | null;
  candidateDates: string[];
  contactEmails: string[];
  candidateDomains: string[];
  matchedSnippets: string[];
};

type StructuredExtraction = {
  documentType: "contract" | "invoice" | "receipt" | "quote" | "other";
  contractLabel: string | null;
  toolName: string | null;
  vendorName: string | null;
  startDate: string | null;
  endDate: string | null;
  renewalType: "none" | "manual" | "tacit";
  renewalNoticeDays: number | null;
  renewalPeriodMonths: number | null;
  matchedSnippets: string[];
  confidenceNotes: string | null;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
};

type OcrProcessingResult = {
  markdownText: string | null;
  extractedSignals: ExtractedSignals;
  ocrExtractedFields: Record<string, unknown>;
};

const monthMap: Record<string, number> = {
  jan: 1,
  janv: 1,
  january: 1,
  feb: 2,
  fev: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  avr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
  janvier: 1,
  fevrier: 2,
  février: 2,
  mars: 3,
  avril: 4,
  mai: 5,
  juin: 6,
  juillet: 7,
  aout: 8,
  août: 8,
  septembre: 9,
  octobre: 10,
  novembre: 11,
  decembre: 12,
  décembre: 12,
};

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizeDomain(value?: string | null) {
  if (!value) {
    return null;
  }

  return value
    .replace(/^mailto:/i, "")
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/.*$/, "")
    .trim()
    .toLowerCase() || null;
}

function isGenericPublicEmailDomain(domain: string) {
  return [
    "gmail.com",
    "googlemail.com",
    "outlook.com",
    "hotmail.com",
    "live.com",
    "yahoo.com",
    "icloud.com",
    "proton.me",
    "protonmail.com",
  ].includes(domain);
}

function extractContactSignals(text: string) {
  const emailMatches = Array.from(
    new Set(
      (text.match(/\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g) ?? [])
        .map((value) => value.trim().toLowerCase()),
    ),
  );

  const domainCounts = new Map<string, number>();

  for (const email of emailMatches) {
    const domain = normalizeDomain(email.split("@")[1]);
    if (!domain || isGenericPublicEmailDomain(domain)) {
      continue;
    }

    domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + 3);
  }

  for (const match of text.match(/\bhttps?:\/\/[^\s)>"']+/g) ?? []) {
    const domain = normalizeDomain(match);
    if (!domain) {
      continue;
    }

    domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + 1);
  }

  const candidateDomains = [...domainCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([domain]) => domain)
    .slice(0, 5);

  return {
    contactEmails: emailMatches.slice(0, 8),
    candidateDomains,
  };
}

const genericDomainFragments = new Set([
  "app",
  "business",
  "cloud",
  "portal",
  "support",
  "admin",
  "legal",
  "service",
  "services",
  "software",
  "saas",
  "online",
  "mail",
  "team",
  "teams",
  "www",
]);

function normalizeComparableLabel(value?: string | null) {
  if (!value) {
    return "";
  }

  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function collapseComparableLabel(value?: string | null) {
  return normalizeComparableLabel(value).replace(/\s+/g, "");
}

function getComparableTokens(value?: string | null) {
  return normalizeComparableLabel(value)
    .split(" ")
    .filter((token) => token.length >= 2);
}

function getTokenOverlapRatio(left?: string | null, right?: string | null) {
  const leftTokens = getComparableTokens(left);
  const rightTokens = new Set(getComparableTokens(right));

  if (!leftTokens.length || !rightTokens.size) {
    return 0;
  }

  const overlapCount = leftTokens.filter((token) => rightTokens.has(token)).length;
  return overlapCount / leftTokens.length;
}

function splitDomainLabel(label: string) {
  const normalizedLabel = normalizeText(label).replace(/[^a-z0-9-]+/g, "");
  if (!normalizedLabel) {
    return [];
  }

  const segments = normalizedLabel
    .split("-")
    .flatMap((segment) => {
      if (!segment) {
        return [];
      }

      for (const suffix of genericDomainFragments) {
        if (segment !== suffix && segment.endsWith(suffix) && segment.length > suffix.length + 2) {
          return [segment.slice(0, -suffix.length), suffix];
        }
      }

      return [segment];
    })
    .filter((segment) => segment.length >= 2);

  return Array.from(new Set(segments));
}

function extractBrandTokensFromDomain(domain: string) {
  const normalizedDomain = normalizeDomain(domain);
  if (!normalizedDomain) {
    return [];
  }

  const labels = normalizedDomain.split(".").filter(Boolean);
  if (!labels.length) {
    return [];
  }

  const topLevelLabelIndex = labels.length >= 2 ? labels.length - 2 : 0;
  const effectiveLabelIndex =
    labels.length >= 3 && labels[labels.length - 1].length === 2 && labels[labels.length - 2].length <= 3
      ? labels.length - 3
      : topLevelLabelIndex;

  const candidateLabels = [
    labels[effectiveLabelIndex],
    labels[effectiveLabelIndex - 1] ?? null,
  ].filter((value): value is string => Boolean(value));

  return Array.from(
    new Set(
      candidateLabels
        .flatMap((label) => splitDomainLabel(label))
        .filter((token) => token.length >= 3 && !genericDomainFragments.has(token)),
    ),
  );
}

function getPreferredBrandToken(domains: string[]) {
  const tokenScores = new Map<string, number>();

  for (const domain of domains) {
    const brandTokens = extractBrandTokensFromDomain(domain);
    brandTokens.forEach((token, index) => {
      tokenScores.set(token, (tokenScores.get(token) ?? 0) + (index === 0 ? 4 : 1));
    });
  }

  return [...tokenScores.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].length - right[0].length)
    .map(([token]) => token)[0] ?? null;
}

function formatBrandLabel(token?: string | null) {
  if (!token) {
    return null;
  }

  return token
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function nameMatchesBrandToken(name?: string | null, brandToken?: string | null) {
  if (!name || !brandToken) {
    return false;
  }

  const collapsedName = collapseComparableLabel(name);
  const collapsedToken = collapseComparableLabel(brandToken);

  return Boolean(collapsedName && collapsedToken && (
    collapsedName.includes(collapsedToken) ||
    collapsedToken.includes(collapsedName)
  ));
}

function looksLikeCustomerEntity(name?: string | null, contractLabel?: string | null, brandToken?: string | null) {
  const tokens = getComparableTokens(name);
  return (
    tokens.length >= 2 &&
    !nameMatchesBrandToken(name, brandToken) &&
    getTokenOverlapRatio(name, contractLabel) >= 0.8
  );
}

function reconcileEntitySignals(signals: ExtractedSignals) {
  const preferredBrandToken = getPreferredBrandToken(signals.candidateDomains);
  if (!preferredBrandToken) {
    return signals;
  }

  const derivedBrandLabel = formatBrandLabel(preferredBrandToken);
  const toolMatchesBrand = nameMatchesBrandToken(signals.toolName, preferredBrandToken);
  const vendorMatchesBrand = nameMatchesBrandToken(signals.vendorName, preferredBrandToken);

  let toolName = signals.toolName;
  let vendorName = signals.vendorName;

  if (looksLikeCustomerEntity(toolName, signals.contractLabel, preferredBrandToken)) {
    toolName = vendorMatchesBrand && vendorName ? vendorName : derivedBrandLabel;
  }

  if (looksLikeCustomerEntity(vendorName, signals.contractLabel, preferredBrandToken)) {
    vendorName = toolMatchesBrand && toolName ? toolName : derivedBrandLabel;
  }

  if (!vendorName) {
    vendorName = toolMatchesBrand && toolName ? toolName : derivedBrandLabel;
  }

  if (!toolName) {
    toolName = vendorName ?? toolName;
  }

  return {
    ...signals,
    toolName,
    vendorName,
  };
}

function toIsoDate(year: number, month: number, day: number) {
  const normalizedMonth = String(month).padStart(2, "0");
  const normalizedDay = String(day).padStart(2, "0");
  return `${year}-${normalizedMonth}-${normalizedDay}`;
}

function addMonthsToIsoDate(isoDate?: string | null, monthsToAdd?: number | null) {
  if (!isoDate || !monthsToAdd || monthsToAdd <= 0) {
    return null;
  }

  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);

  const target = new Date(Date.UTC(year, month - 1, day));
  const originalDay = target.getUTCDate();

  target.setUTCMonth(target.getUTCMonth() + monthsToAdd);
  if (target.getUTCDate() !== originalDay) {
    target.setUTCDate(0);
  }

  return target.toISOString().slice(0, 10);
}

function normalizeDurationToMonths(value: string, unit: string) {
  const amount = Number.parseInt(value, 10);
  if (Number.isNaN(amount) || amount <= 0) {
    return null;
  }

  const normalizedUnit = normalizeText(unit);
  if (/^(an|ans|annee|annees|year|years)$/.test(normalizedUnit)) {
    return amount * 12;
  }

  if (/^(mois|month|months)$/.test(normalizedUnit)) {
    return amount;
  }

  return null;
}

function extractCommitmentTerm(text: string) {
  const normalizedText = normalizeText(text);
  const patterns: Array<{
    pattern: RegExp;
    valueIndex: number;
    unitIndex: number;
  }> = [
    {
      pattern:
        /(duree d[' ]engagement|duree initiale|periode initiale|initial term|initial commitment|commitment period)[^.\n\r]{0,80}?(\d{1,2})\s*(mois|month|months|an|ans|annee|annees|year|years)/,
      valueIndex: 2,
      unitIndex: 3,
    },
    {
      pattern: /engagement[^.\n\r]{0,80}?(\d{1,2})\s*(mois|month|months|an|ans|annee|annees|year|years)/,
      valueIndex: 1,
      unitIndex: 2,
    },
    {
      pattern:
        /(\d{1,2})\s*(mois|month|months|an|ans|annee|annees|year|years)[^.\n\r]{0,80}?(d[' ]engagement|duree initiale|periode initiale|initial term|commitment)/,
      valueIndex: 1,
      unitIndex: 2,
    },
  ];

  for (const { pattern, valueIndex, unitIndex } of patterns) {
    const match = normalizedText.match(pattern);
    if (!match) {
      continue;
    }

    const value = match[valueIndex];
    const unit = match[unitIndex];
    const months = normalizeDurationToMonths(value, unit);

    if (months) {
      return {
        months,
        snippet: match[0],
      };
    }
  }

  return null;
}

function parseDateToken(rawValue: string) {
  const value = rawValue.trim().replace(/[,]/g, " ").replace(/\s+/g, " ");
  const normalizedValue = value.replace(/\.(?=\s|$)/g, "");

  let match = normalizedValue.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (match) {
    return toIsoDate(Number.parseInt(match[1], 10), Number.parseInt(match[2], 10), Number.parseInt(match[3], 10));
  }

  match = normalizedValue.match(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/);
  if (match) {
    const day = Number.parseInt(match[1], 10);
    const month = Number.parseInt(match[2], 10);
    const year = Number.parseInt(match[3].length === 2 ? `20${match[3]}` : match[3], 10);
    return toIsoDate(year, month, day);
  }

  match = normalizedValue.match(/\b(\d{1,2})\s+([a-zA-Zéûôîàèùç.]+)\s+(\d{4})\b/);
  if (match) {
    const day = Number.parseInt(match[1], 10);
    const month = monthMap[normalizeText(match[2])];
    const year = Number.parseInt(match[3], 10);
    if (month) {
      return toIsoDate(year, month, day);
    }
  }

  match = normalizedValue.match(/\b([a-zA-Zéûôîàèùç.]+)\s+(\d{1,2})\s+(\d{4})\b/);
  if (match) {
    const month = monthMap[normalizeText(match[1])];
    const day = Number.parseInt(match[2], 10);
    const year = Number.parseInt(match[3], 10);
    if (month) {
      return toIsoDate(year, month, day);
    }
  }

  return null;
}

function extractLineDate(line: string) {
  const datePatterns = [
    /\b\d{4}-\d{2}-\d{2}\b/g,
    /\b\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}\b/g,
    /\b\d{1,2}\s+[a-zA-Zéûôîàèùç.]+\s+\d{4}\b/g,
    /\b[a-zA-Zéûôîàèùç.]+\s+\d{1,2}\s+\d{4}\b/g,
  ];

  for (const pattern of datePatterns) {
    const matches = line.match(pattern);
    if (matches && matches.length > 0) {
      for (const match of matches) {
        const parsed = parseDateToken(match);
        if (parsed) {
          return parsed;
        }
      }
    }
  }

  return null;
}

function extractAllLineDates(line: string) {
  const matches = line.match(
    /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}|\d{1,2}\s+[a-zA-Zéûôîàèùç.]+\s+\d{4}|[a-zA-Zéûôîàèùç.]+\s+\d{1,2}\s+\d{4})\b/g,
  );

  if (!matches?.length) {
    return [];
  }

  return matches
    .map((match) => parseDateToken(match))
    .filter((value): value is string => Boolean(value));
}

function extractContractSignals(text: string): ExtractedSignals {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const candidateDates = new Set<string>();
  const matchedSnippets: string[] = [];
  let startDate: string | null = null;
  let endDate: string | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const nextLine = lines[index + 1] ?? "";
    const joined = `${line} ${nextLine}`.trim();
    const normalized = normalizeText(joined);
    const parsedDate = extractLineDate(joined);
    const lineDates = extractAllLineDates(joined);

    for (const candidateDate of lineDates) {
      candidateDates.add(candidateDate);
    }

    if (
      lineDates.length >= 2 &&
      /(periode de facturation|billing period|subscription period|service period|coverage period|period from)/.test(normalized)
    ) {
      if (!startDate) {
        startDate = lineDates[0];
      }
      if (!endDate) {
        endDate = lineDates[1];
      }
      matchedSnippets.push(joined);
    }

    if (!parsedDate) {
      continue;
    }

    if (
      !startDate &&
      /(date d'effet|date de debut|debut du contrat|date de commencement|date d'activation|date activation|effective date|start date|commencement date|activation date)/.test(normalized)
    ) {
      startDate = parsedDate;
      matchedSnippets.push(joined);
      continue;
    }

    if (
      !endDate &&
      /(date de fin|date d'expiration|expire le|echeance|termination date|expiry date|expiration date|end date)/.test(normalized)
    ) {
      endDate = parsedDate;
      matchedSnippets.push(joined);
    }
  }

  const normalizedText = normalizeText(text);
  const contactSignals = extractContactSignals(text);

  let renewalType: "none" | "manual" | "tacit" = "none";
  if (
    /(reconduction tacite|tacit renewal|automatic renewal|automatically renew|renouvellement automatique|auto.?renew)/.test(normalizedText)
  ) {
    renewalType = "tacit";
  } else if (/(renouvellement|renewal)/.test(normalizedText)) {
    renewalType = "manual";
  } else if (/(prochaine date de facturation|next billing date|next invoice date|renouvellement automatique de l'abonnement)/.test(normalizedText)) {
    renewalType = "tacit";
  }

  let renewalNoticeDays: number | null = null;
  const noticeMatch =
    normalizedText.match(/preavis[^.\n\r]{0,50}?(\d{1,3})\s*(jour|jours)/) ||
    normalizedText.match(/(\d{1,3})\s*(jour|jours)[^.\n\r]{0,50}?(preavis|avant l[' ]echeance|avant reconduction)/) ||
    normalizedText.match(/(\d{1,3})\s*days?[^.\n\r]{0,50}?(notice|prior to renewal|before expiration)/);

  if (noticeMatch) {
    renewalNoticeDays = Number.parseInt(noticeMatch[1], 10);
    matchedSnippets.push(noticeMatch[0]);
  }

  let renewalPeriodMonths: number | null = null;
  const periodMatch =
    normalizedText.match(/reconduction[^.\n\r]{0,60}?(\d{1,2})\s*(mois|month|months)/) ||
    normalizedText.match(/renewal[^.\n\r]{0,60}?(\d{1,2})\s*(mois|month|months)/) ||
    normalizedText.match(/(\d{1,2})\s*(mois|month|months)[^.\n\r]{0,60}?(reconduction|renewal)/);

  if (periodMatch) {
    renewalPeriodMonths = Number.parseInt(periodMatch[1], 10);
    matchedSnippets.push(periodMatch[0]);
  } else if (renewalType === "tacit" && /(annuel|annuelle|yearly|annual)/.test(normalizedText)) {
    renewalPeriodMonths = 12;
  }

  const commitmentTerm = extractCommitmentTerm(text);
  if (!endDate && startDate && commitmentTerm) {
    endDate = addMonthsToIsoDate(startDate, commitmentTerm.months);
    matchedSnippets.push(commitmentTerm.snippet);
  }

  return {
    documentType: "other",
    contractLabel: null,
    toolName: null,
    vendorName: null,
    startDate,
    endDate,
    renewalType,
    renewalNoticeDays,
    renewalPeriodMonths,
    candidateDates: Array.from(candidateDates).sort(),
    contactEmails: contactSignals.contactEmails,
    candidateDomains: contactSignals.candidateDomains,
    matchedSnippets: Array.from(new Set(matchedSnippets)).slice(0, 10),
  };
}

function normalizeOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeRenewalType(value: unknown): ExtractedSignals["renewalType"] {
  return value === "manual" || value === "tacit" || value === "none" ? value : "none";
}

function normalizeDocumentType(value: unknown): ExtractedSignals["documentType"] {
  return value === "contract" || value === "invoice" || value === "receipt" || value === "quote"
    ? value
    : "other";
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

function normalizeMatchedSnippets(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim())
    .slice(0, 10);
}

function parseStructuredExtraction(value: unknown): StructuredExtraction | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;

  return {
    documentType: normalizeDocumentType(candidate.documentType),
    contractLabel: normalizeOptionalString(candidate.contractLabel),
    toolName: normalizeOptionalString(candidate.toolName),
    vendorName: normalizeOptionalString(candidate.vendorName),
    startDate: normalizeOptionalString(candidate.startDate),
    endDate: normalizeOptionalString(candidate.endDate),
    renewalType: normalizeRenewalType(candidate.renewalType),
    renewalNoticeDays: normalizeOptionalNumber(candidate.renewalNoticeDays),
    renewalPeriodMonths: normalizeOptionalNumber(candidate.renewalPeriodMonths),
    matchedSnippets: normalizeMatchedSnippets(candidate.matchedSnippets),
    confidenceNotes: normalizeOptionalString(candidate.confidenceNotes),
  };
}

function extractChatMessageContent(response: ChatCompletionResponse) {
  const content = response.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => item?.text ?? "")
      .join("")
      .trim();
  }

  return null;
}

async function callMistralStructuredExtraction(
  markdownText: string,
  heuristicSignals: Pick<ExtractedSignals, "candidateDomains" | "contactEmails" | "matchedSnippets">,
  apiKey: string,
) {
  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EXTRACTION_MODEL,
      temperature: 0,
      response_format: {
        type: "json_object",
      },
      messages: [
        {
          role: "system",
          content:
            "You extract subscription and contract metadata from OCR text. Return JSON only. " +
            "Use invoice or receipt billing periods when explicit contract start/end dates are absent. " +
            "If a next billing or next invoice date clearly indicates an automatic recurring subscription, set renewalType to tacit. " +
            "If the OCR text explicitly states an initial commitment or contract duration in months or years tied to activation, effective date, or start date, you may compute endDate from startDate when no explicit end date is written. " +
            "Only set renewalNoticeDays or renewalPeriodMonths when they are explicitly supported by the OCR text. " +
            "Do not infer notice period from common SaaS practices, default legal assumptions, or contract duration. " +
            "Do not confuse initial commitment duration with renewalPeriodMonths unless the OCR text explicitly describes the renewal cadence. " +
            "Do not derive renewalPeriodMonths from the time span between startDate and endDate unless the OCR text explicitly states a renewal cadence such as monthly, annual, yearly, or X months. " +
            "Never use the buyer, customer, client, or contracting company name as toolName or vendorName when supplier emails, URLs, or domains point to a different provider. " +
            "Prefer supplier or product names that are consistent with supplier emails, websites, and domains found in the OCR text. " +
            "Dates must be YYYY-MM-DD. Use null when unknown. " +
            "Return exactly these keys: " +
            "documentType, contractLabel, toolName, vendorName, startDate, endDate, renewalType, renewalNoticeDays, renewalPeriodMonths, matchedSnippets, confidenceNotes.",
        },
        {
          role: "user",
          content:
            "Extract structured metadata from this OCR markdown.\n\n" +
            "Rules:\n" +
            "- documentType must be one of contract, invoice, receipt, quote, other.\n" +
            "- renewalType must be one of none, manual, tacit.\n" +
            "- If an explicit initial commitment duration is stated (example: 12 months from activation), compute endDate from startDate when possible even if the end date is not written explicitly.\n" +
            "- renewalNoticeDays must be null unless the OCR text explicitly mentions notice or preavis in days.\n" +
            "- Do not put an initial commitment duration into renewalPeriodMonths unless the OCR text explicitly says it is the renewal cadence.\n" +
            "- renewalPeriodMonths must be null unless the OCR text explicitly mentions a renewal cadence such as monthly, annual, yearly, or X months.\n" +
            "- matchedSnippets must contain short supporting excerpts from the OCR text.\n" +
            "- contractLabel should be a concise label for the agreement, invoice, or subscription when identifiable.\n" +
            "- toolName should be the product or software name when identifiable.\n" +
            "- vendorName should be the company issuing the document when identifiable.\n" +
            "- Do not confuse the customer or buyer name with the supplier, vendor, or tool.\n\n" +
            "Heuristic hints from emails and URLs:\n" +
            `- contactEmails: ${heuristicSignals.contactEmails.join(", ") || "none"}\n` +
            `- candidateDomains: ${heuristicSignals.candidateDomains.join(", ") || "none"}\n` +
            `- matchedSnippets: ${heuristicSignals.matchedSnippets.join(" | ") || "none"}\n\n` +
            markdownText,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mistral extraction error (${response.status}): ${errorText}`);
  }

  const payload = (await response.json()) as ChatCompletionResponse;
  const content = extractChatMessageContent(payload);

  if (!content) {
    throw new Error("Mistral extraction returned no content");
  }

  const parsed = JSON.parse(content) as unknown;
  const extraction = parseStructuredExtraction(parsed);

  if (!extraction) {
    throw new Error("Mistral extraction returned an invalid JSON payload");
  }

  return extraction;
}

function mergeExtractedSignals(
  heuristicSignals: ExtractedSignals,
  structuredExtraction: StructuredExtraction | null,
): ExtractedSignals {
  if (!structuredExtraction) {
    return reconcileEntitySignals(heuristicSignals);
  }

  return reconcileEntitySignals({
    documentType: structuredExtraction.documentType,
    contractLabel: structuredExtraction.contractLabel,
    toolName: structuredExtraction.toolName,
    vendorName: structuredExtraction.vendorName,
    startDate: structuredExtraction.startDate ?? heuristicSignals.startDate,
    endDate: structuredExtraction.endDate ?? heuristicSignals.endDate,
    renewalType:
      structuredExtraction.renewalType !== "none"
        ? structuredExtraction.renewalType
        : heuristicSignals.renewalType,
    renewalNoticeDays: structuredExtraction.renewalNoticeDays ?? heuristicSignals.renewalNoticeDays,
    renewalPeriodMonths: structuredExtraction.renewalPeriodMonths ?? heuristicSignals.renewalPeriodMonths,
    candidateDates: heuristicSignals.candidateDates,
    contactEmails: heuristicSignals.contactEmails,
    candidateDomains: heuristicSignals.candidateDomains,
    matchedSnippets: Array.from(
      new Set([
        ...structuredExtraction.matchedSnippets,
        ...heuristicSignals.matchedSnippets,
      ]),
    ).slice(0, 10),
  });
}

function calculateNoticeDeadline(endDate?: string | null, noticeDays?: number | null) {
  if (!endDate || !noticeDays || noticeDays <= 0) {
    return null;
  }

  const target = new Date(`${endDate}T00:00:00.000Z`);
  target.setUTCDate(target.getUTCDate() - noticeDays);
  return target.toISOString().slice(0, 10);
}

async function callMistralOcr(fileUrl: string, mimeType: string | null, apiKey: string) {
  const document =
    mimeType?.startsWith("image/")
      ? {
          type: "image_url",
          image_url: fileUrl,
        }
      : {
          type: "document_url",
          document_url: fileUrl,
        };

  const response = await fetch("https://api.mistral.ai/v1/ocr", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OCR_MODEL,
      document,
      include_image_base64: false,
      extract_header: true,
      extract_footer: true,
      table_format: "html",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mistral OCR error (${response.status}): ${errorText}`);
  }

  return (await response.json()) as OcrResponse;
}

async function processFileWithOcr(
  supabase: ReturnType<typeof createClient<any>>,
  filePath: string,
  mimeType: string | null,
  apiKey: string,
): Promise<OcrProcessingResult> {
  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from(CONTRACTS_BUCKET)
    .createSignedUrl(filePath, 60 * 10);

  if (signedUrlError || !signedUrlData?.signedUrl) {
    throw signedUrlError || new Error("Unable to create signed URL");
  }

  const ocrResponse = await callMistralOcr(
    signedUrlData.signedUrl,
    mimeType,
    apiKey,
  );

  const markdownText = (ocrResponse.pages || [])
    .map((page) => [page.header, page.markdown, page.footer].filter(Boolean).join("\n"))
    .join("\n\n");

  const heuristicSignals = extractContractSignals(markdownText);
  const structuredExtraction = markdownText
    ? await callMistralStructuredExtraction(markdownText, heuristicSignals, apiKey).catch((error) => {
      console.error("Structured extraction error:", error);
      return null;
    })
    : null;
  const extractedSignals = mergeExtractedSignals(heuristicSignals, structuredExtraction);

  return {
    markdownText: markdownText || null,
    extractedSignals,
    ocrExtractedFields: {
      provider: "mistral",
      model: OCR_MODEL,
      extraction_model: structuredExtraction ? EXTRACTION_MODEL : null,
      extractedSignals,
      structuredExtraction,
      raw: {
        model: ocrResponse.model ?? OCR_MODEL,
        pages: (ocrResponse.pages || []).map((page) => ({
          index: page.index,
          markdown: page.markdown,
        })),
        document_annotation: ocrResponse.document_annotation ?? null,
      },
    },
  };
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
    const mistralApiKey = Deno.env.get("MISTRAL_API_KEY");
    if (!mistralApiKey) {
      return jsonResponse({ error: "Missing MISTRAL_API_KEY secret" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing authorization header" }, 401);
    }

    const { contractId, filePath, mimeType } = await req.json();
    if (!contractId && !filePath) {
      return jsonResponse({ error: "Missing contractId or filePath" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient<any>(supabaseUrl, serviceRoleKey);

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return jsonResponse({ error: "Invalid token" }, 401);
    }

    let currentContract: ContractRow | null = null;
    let targetFilePath: string | null = null;
    let targetMimeType: string | null = mimeType ?? null;

    if (contractId) {
      const { data: contract, error: contractError } = await supabase
        .from("contracts")
        .select("*")
        .eq("id", contractId)
        .eq("user_id", user.id)
        .single();

      if (contractError || !contract) {
        return jsonResponse({ error: "Contract not found" }, 404);
      }

      currentContract = contract as ContractRow;
      processedContractId = currentContract.id;
      targetFilePath = currentContract.file_path;
      targetMimeType = currentContract.mime_type;
    } else if (typeof filePath === "string") {
      if (!filePath.startsWith(`${user.id}/`)) {
        return jsonResponse({ error: "Forbidden file path" }, 403);
      }

      targetFilePath = filePath;
    }

    if (!targetFilePath) {
      return jsonResponse({ error: "Contract has no file to analyze" }, 400);
    }

    if (currentContract) {
      await supabase
        .from("contracts")
        .update({
          ocr_status: "processing",
          ocr_model: OCR_MODEL,
        })
        .eq("id", currentContract.id);
    }

    const ocrResult = await processFileWithOcr(
      supabase,
      targetFilePath,
      targetMimeType,
      mistralApiKey,
    );

    if (!currentContract) {
      return jsonResponse({
        success: true,
        model: OCR_MODEL,
        markdownText: ocrResult.markdownText,
        extractedSignals: ocrResult.extractedSignals,
        ocrExtractedFields: ocrResult.ocrExtractedFields,
      });
    }

    const nextStartDate = currentContract.start_date ?? ocrResult.extractedSignals.startDate;
    const nextRenewalPeriodMonths =
      currentContract.renewal_period_months ?? ocrResult.extractedSignals.renewalPeriodMonths;
    const nextEndDate =
      currentContract.end_date ??
      ocrResult.extractedSignals.endDate ??
      addMonthsToIsoDate(nextStartDate ?? undefined, nextRenewalPeriodMonths ?? undefined);
    const nextNoticeDays = currentContract.renewal_notice_days ?? ocrResult.extractedSignals.renewalNoticeDays;
    const nextNoticeDeadline =
      currentContract.notice_deadline ?? calculateNoticeDeadline(nextEndDate, nextNoticeDays);

    const nextRenewalType =
      currentContract.renewal_type !== "none"
        ? currentContract.renewal_type
        : ocrResult.extractedSignals.renewalType;

    await supabase
      .from("contracts")
      .update({
        ocr_status: "completed",
        ocr_model: OCR_MODEL,
        ocr_extracted_text: ocrResult.markdownText,
        ocr_extracted_fields: ocrResult.ocrExtractedFields,
        start_date: nextStartDate,
        end_date: nextEndDate,
        renewal_type: nextRenewalType,
        renewal_notice_days: nextNoticeDays,
        renewal_period_months: nextRenewalPeriodMonths,
        notice_deadline: nextNoticeDeadline,
      })
      .eq("id", currentContract.id);

    return jsonResponse({
      success: true,
      model: OCR_MODEL,
      markdownText: ocrResult.markdownText,
      extractedSignals: ocrResult.extractedSignals,
      ocrExtractedFields: ocrResult.ocrExtractedFields,
    });
  } catch (error: unknown) {
    console.error("process-contract-ocr error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";

    if (processedContractId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

      if (supabaseUrl && serviceRoleKey) {
        const supabase = createClient<any>(supabaseUrl, serviceRoleKey);

        await supabase
        .from("contracts")
        .update({
          ocr_status: "failed",
          ocr_model: OCR_MODEL,
          ocr_extracted_fields: {
            provider: "mistral",
            model: OCR_MODEL,
            error: message,
          },
        })
        .eq("id", processedContractId);
      }
    }

    return jsonResponse({ error: message }, 500);
  }
});
