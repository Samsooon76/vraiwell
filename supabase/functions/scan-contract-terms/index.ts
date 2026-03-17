import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENAI_MODEL = "gpt-5-nano-2025-08-07";
const TRUSTED_PROVIDER_DOMAIN_SCORE = 8;

type ContractRow = {
  id: string;
  user_id: string;
  contract_label: string;
  tool_name: string;
  vendor_name: string | null;
  source_url: string | null;
  terms_url: string | null;
  ocr_extracted_text: string | null;
  ocr_extracted_fields: Record<string, unknown> | null;
  start_date: string | null;
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

const GENERIC_SUBDOMAINS = new Set([
  "www",
  "app",
  "business",
  "portal",
  "admin",
  "support",
  "help",
  "legal",
  "billing",
  "mail",
]);

function toLikelyOfficialDomain(value?: string | null) {
  const normalized = normalizeDomain(value);
  if (!normalized) {
    return null;
  }

  const labels = normalized.split(".").filter(Boolean);
  if (labels.length < 3) {
    return normalized;
  }

  const registrablePartLength =
    labels[labels.length - 1].length === 2 && labels[labels.length - 2].length <= 3 ? 3 : 2;
  const prefix = labels.slice(0, labels.length - registrablePartLength);

  if (prefix.length > 0 && GENERIC_SUBDOMAINS.has(prefix[prefix.length - 1])) {
    return labels.slice(-registrablePartLength).join(".");
  }

  return normalized;
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

function normalizeWebsiteHomeUrl(value?: string | null) {
  const normalized = normalizeUrl(value);
  if (!normalized) {
    return null;
  }

  try {
    const url = new URL(normalized);
    url.pathname = "/";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return normalized;
  }
}

function isSameDomainOrSubdomain(candidate?: string | null, expected?: string | null) {
  if (!candidate || !expected) {
    return false;
  }

  return (
    candidate === expected ||
    candidate.endsWith(`.${expected}`) ||
    expected.endsWith(`.${candidate}`)
  );
}

function dedupeSources(sources: SearchSource[]) {
  return Array.from(
    new Map(
      sources
        .map((source) => ({
          ...source,
          url: normalizeUrl(source.url),
        }))
        .filter((source): source is SearchSource => Boolean(source.url))
        .map((source) => [source.url, source]),
    ).values(),
  );
}

function pushDebugLine(debugLines: string[], value: string) {
  if (!value.trim()) {
    return;
  }

  if (debugLines.length >= 30) {
    return;
  }

  debugLines.push(value.trim());
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

const ROLE_BASED_EMAIL_LOCAL_PARTS = [
  "support",
  "help",
  "hello",
  "contact",
  "legal",
  "privacy",
  "billing",
  "invoice",
  "facturation",
  "sales",
  "team",
  "admin",
  "serviceclient",
  "customer",
  "success",
  "care",
  "info",
];

function tokenizeLabel(value?: string | null) {
  return normalizeLabel(value)
    .split(" ")
    .filter((token) => token.length >= 3);
}

function getProviderTokens(contract: ContractRow) {
  return Array.from(new Set([
    ...tokenizeLabel(contract.tool_name),
    ...tokenizeLabel(contract.vendor_name),
  ]));
}

function getCustomerReferenceTokens(contract: ContractRow) {
  const providerTokens = new Set(getProviderTokens(contract));

  return Array.from(
    new Set(
      tokenizeLabel(contract.contract_label).filter((token) => !providerTokens.has(token)),
    ),
  );
}

function getDomainHintEmails(contract: ContractRow) {
  const extractedSignals =
    contract.ocr_extracted_fields &&
      typeof contract.ocr_extracted_fields === "object" &&
      "extractedSignals" in contract.ocr_extracted_fields &&
      contract.ocr_extracted_fields.extractedSignals &&
      typeof contract.ocr_extracted_fields.extractedSignals === "object"
      ? contract.ocr_extracted_fields.extractedSignals as Record<string, unknown>
      : null;

  const fieldEmails = Array.isArray(extractedSignals?.contactEmails)
    ? extractedSignals.contactEmails.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : [];
  const textEmails = contract.ocr_extracted_text?.match(/\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g) ?? [];

  return Array.from(new Set([...fieldEmails, ...textEmails]));
}

function getEmailsForDomain(emails: string[], domain: string) {
  return emails.filter((email) => toLikelyOfficialDomain(email.split("@")[1]) === domain);
}

function normalizeEmailLocalPart(email: string) {
  return normalizeLabel(email.split("@")[0] ?? "").replace(/\s+/g, "");
}

function scoreOcrDomainHint(contract: ContractRow, domain: string, emails: string[], index: number) {
  const providerTokens = getProviderTokens(contract);
  const customerTokens = getCustomerReferenceTokens(contract);
  const domainText = normalizeLabel(domain.replace(/\./g, " "));
  const localParts = getEmailsForDomain(emails, domain).map(normalizeEmailLocalPart);
  const providerMatches = providerTokens.filter((token) => domainText.includes(token));
  const customerMatches = customerTokens.filter((token) => domainText.includes(token));
  const hasRoleBasedEmail = localParts.some((part) => ROLE_BASED_EMAIL_LOCAL_PARTS.some((keyword) => part.includes(keyword)));
  const hasProviderEmail = localParts.some((part) => providerTokens.some((token) => part.includes(token)));
  const hasCustomerEmail = localParts.some((part) => customerTokens.some((token) => part.includes(token)));

  let score = index === 0 ? 1 : 0;

  if (providerMatches.length > 0) {
    score += providerMatches.length * 10;
  }

  if (customerMatches.length > 0 && providerMatches.length === 0) {
    score -= customerMatches.length * 12;
  }

  if (hasRoleBasedEmail) {
    score += providerMatches.length > 0 ? 4 : 1;
  }

  if (hasProviderEmail) {
    score += 4;
  }

  if (hasCustomerEmail) {
    score -= 6;
  }

  return score;
}

function getRankedOcrDomainHints(contract: ContractRow) {
  const extractedSignals =
    contract.ocr_extracted_fields &&
      typeof contract.ocr_extracted_fields === "object" &&
      "extractedSignals" in contract.ocr_extracted_fields &&
      contract.ocr_extracted_fields.extractedSignals &&
      typeof contract.ocr_extracted_fields.extractedSignals === "object"
      ? contract.ocr_extracted_fields.extractedSignals as Record<string, unknown>
      : null;

  const candidateDomains = Array.isArray(extractedSignals?.candidateDomains)
    ? extractedSignals?.candidateDomains
      .map((value) => typeof value === "string" ? toLikelyOfficialDomain(value) : null)
      .filter((value): value is string => Boolean(value))
    : [];
  const contactEmails = getDomainHintEmails(contract);
  const emailDomains = contactEmails
    .map((email) => toLikelyOfficialDomain(email.split("@")[1]))
    .filter((value): value is string => Boolean(value));
  const textEmailDomains = Array.from(
    new Set(
      (contract.ocr_extracted_text?.match(/\b[a-zA-Z0-9._%+-]+@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g) ?? [])
        .map((email) => toLikelyOfficialDomain(email.split("@")[1]))
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const uniqueDomains = Array.from(new Set([...candidateDomains, ...emailDomains, ...textEmailDomains]));

  return uniqueDomains
    .map((domain, index) => ({
      domain,
      score: scoreOcrDomainHint(contract, domain, contactEmails, index),
      index,
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index);
}

function buildDomainHints(contract: ContractRow) {
  return Array.from(new Set([
    contract.tool_name,
    contract.vendor_name,
    contract.contract_label,
    ...getOcrDomainHints(contract),
  ]
    .map((value) => normalizeLabel(value))
    .filter(Boolean)
    .flatMap((value) => value.split(" "))
    .filter((value) => value.length >= 3)));
}

function getOcrDomainHints(contract: ContractRow) {
  return getRankedOcrDomainHints(contract).map(({ domain }) => domain);
}

function getPreferredOfficialDomain(contract: ContractRow) {
  const bestRankedDomain = getRankedOcrDomainHints(contract)[0];
  if (bestRankedDomain && bestRankedDomain.score >= TRUSTED_PROVIDER_DOMAIN_SCORE) {
    return bestRankedDomain.domain;
  }

  const sourceDomain = toLikelyOfficialDomain(parseUrlHostname(contract.source_url));
  if (!sourceDomain) {
    return null;
  }

  return scoreOcrDomainHint(contract, sourceDomain, getDomainHintEmails(contract), 0) >= TRUSTED_PROVIDER_DOMAIN_SCORE
    ? sourceDomain
    : null;
}

function canTrustProviderDomain(contract: ContractRow, domain?: string | null) {
  if (!domain) {
    return false;
  }

  return scoreOcrDomainHint(contract, domain, getDomainHintEmails(contract), 0) >= TRUSTED_PROVIDER_DOMAIN_SCORE;
}

function canTrustRelatedLegalDomain(
  contract: ContractRow,
  candidateDomain?: string | null,
  allowedDomains: string[] = [],
) {
  if (!candidateDomain) {
    return false;
  }

  if (allowedDomains.some((allowedDomain) => isSameDomainOrSubdomain(candidateDomain, allowedDomain))) {
    return true;
  }

  return canTrustProviderDomain(contract, candidateDomain);
}

function isAcceptableStoredTermsUrl(contract: ContractRow, url?: string | null) {
  const normalizedUrl = normalizeUrl(url);
  if (!normalizedUrl) {
    return false;
  }

  const domain = toLikelyOfficialDomain(parseUrlHostname(normalizedUrl));
  if (!canTrustProviderDomain(contract, domain)) {
    return false;
  }

  if (looksLikeGenericLegalHubUrl(normalizedUrl) || looksLikeNonCanonicalLegalAsset(normalizedUrl)) {
    return false;
  }

  return hasStrongTermsUrlSignal(normalizedUrl) || getLegalUrlSpecificityScore(normalizedUrl) >= 8;
}

function isAcceptableResolvedTermsUrl(
  url?: string | null,
  documentType?: TermsExtraction["documentType"],
) {
  const normalizedUrl = normalizeUrl(url);
  if (!normalizedUrl) {
    return false;
  }

  if (looksLikeGenericLegalHubUrl(normalizedUrl) || looksLikeNonCanonicalLegalAsset(normalizedUrl)) {
    return false;
  }

  if (documentType === "pricing" || documentType === "legal" || documentType === "other") {
    return hasStrongTermsUrlSignal(normalizedUrl);
  }

  return hasStrongTermsUrlSignal(normalizedUrl) || getLegalUrlSpecificityScore(normalizedUrl) >= 8;
}

function getOcrEmailHints(contract: ContractRow) {
  return getDomainHintEmails(contract).slice(0, 8);
}

function scoreSource(source: SearchSource, hints: string[], preferredDomain?: string | null) {
  const url = normalizeUrl(source.url);
  const domain = toLikelyOfficialDomain(parseUrlHostname(url));
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
    score += 3;
  }

  if (hasStrongTermsUrlSignal(url)) {
    score += 8;
  }

  if (hasLegalLabelSignal(source.title)) {
    score += 6;
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
    return /(terms|legal|cgv|cgu|conditions|tos|subscription|agreement|pricing)/i.test(haystack) ||
      hasLegalLabelSignal(source.title);
  });

  return pickBestSource(legalSources.length > 0 ? legalSources : sources, contract, preferredDomain);
}

function getLegalUrlSpecificityScore(url?: string | null) {
  if (!url) {
    return -10;
  }

  const normalizedUrl = normalizeUrl(url) ?? url;
  const normalized = normalizeLabel(normalizedUrl.replace(/[/.?=#:_-]+/g, " "));
  const pathname = (() => {
    try {
      return new URL(normalizedUrl).pathname.toLowerCase();
    } catch {
      return normalizedUrl.toLowerCase();
    }
  })();

  let score = 0;

  if (
    /\/(fr|en)\/(conditions-generales-de-vente(?:-[a-z0-9-]+)?|general-terms-and-conditions|terms-and-conditions|terms-conditions|tos)\/?$/i.test(
      pathname,
    ) ||
    /\/(conditions-generales-de-vente(?:-[a-z0-9-]+)?|general-terms-and-conditions|terms-and-conditions|terms-conditions|tos)\/?$/i.test(
      pathname,
    )
  ) {
    score += 14;
  }

  if (/(conditions generales de vente|general terms and conditions|terms and conditions|conditions d utilisation|terms of service|subscription agreement|msa|cgv|cgu)/.test(normalized)) {
    score += 8;
  }

  if (/(pricing terms|tariff terms|conditions tarifaires|conditions tarifaire|tarifs|pricing|price list|fees)/.test(normalized)) {
    score -= 12;
  }

  if (/(service agreement|subscription terms|terms conditions)/.test(normalized)) {
    score += 4;
  }

  if (/(support|help center|knowledge base|hc articles|hc fr articles|hc en us articles)/.test(normalized)) {
    score -= 10;
  }

  if (/\/wp-content\/uploads\/|\/uploads\/|\/download\/|\/downloads\/|\.pdf(?:[?#]|$)/i.test(normalizedUrl)) {
    score -= 20;
  }

  if (/(legal compliance|compliance|privacy|cookies|gdpr|data protection|mentions legales|imprint)/.test(normalized)) {
    score -= 8;
  }

  if (/\/(legal|legal-compliance)(\/|$)/i.test(normalizedUrl) && !/(terms|conditions|cgv|cgu)/i.test(normalizedUrl)) {
    score -= 4;
  }

  return score;
}

function looksLikeSupportArticleUrl(url?: string | null) {
  if (!url) {
    return false;
  }

  return /support|help|knowledge-base|knowledge base|\/hc\/|\/articles\//i.test(url);
}

function looksLikeGenericLegalHubUrl(url?: string | null) {
  if (!url) {
    return false;
  }

  return /\/legal-compliance\/?|\/legal\/?$|\/fr\/legal\/?$|\/en\/legal\/?$/i.test(url);
}

function hasLegalUrlSignal(url?: string | null) {
  return Boolean(url && /\/(terms|legal|cgv|cgu|conditions|tos|subscription|agreement|msa)/i.test(url));
}

function hasStrongTermsUrlSignal(url?: string | null) {
  if (!url) {
    return false;
  }

  return /\/(fr|en)\/(conditions-generales-de-vente(?:-[a-z0-9-]+)?|general-terms-and-conditions|terms-and-conditions|terms-conditions|tos)\/?$/i.test(
    url,
  ) ||
    /\/(conditions-generales-de-vente(?:-[a-z0-9-]+)?|general-terms-and-conditions|terms-and-conditions|terms-conditions|tos)\/?$/i.test(
      url,
    );
}

function looksLikeNonCanonicalLegalAsset(url?: string | null) {
  return Boolean(url && /\/wp-content\/uploads\/|\/uploads\/|\/download\/|\/downloads\/|\.pdf(?:[?#]|$)/i.test(url));
}

function hasLegalLabelSignal(value?: string | null) {
  const normalized = normalizeLabel(value);
  return Boolean(
    normalized &&
      /(conditions generales de vente|conditions generales d utilisation|general terms and conditions|terms and conditions|terms of service|cgv|cgu|subscription agreement|master service agreement|msa)/.test(
        normalized,
      ),
  );
}

function analyzeTermsStructure(pageText: string) {
  const normalizedText = normalizeText(pageText);
  const articleMatches = normalizedText.match(/\b(article|section|chapitre)\s{0,2}\d{1,2}\b/g) ?? [];
  const articleCount = Array.from(new Set(articleMatches)).length;
  const hasDefinitions =
    /\bdefinitions?\b/.test(normalizedText) ||
    /\barticle\s{0,2}1\b[^.\n\r]{0,120}\bdefinitions?\b/.test(normalizedText);
  const structuralClauses = [
    /\bobjet\b/,
    /\bduree\b|\bduration\b|\bterm\b/,
    /\bresiliation\b|\btermination\b|\bcancellation\b/,
    /\bresponsabilite\b|\bliability\b/,
    /\bpaiement\b|\bpayment\b/,
    /\bprix\b|\bpricing\b|\btarif\b|\bfees\b/,
    /\bpropriete intellectuelle\b|\bintellectual property\b/,
    /\bdonnees personnelles\b|\bpersonal data\b|\bdata processing\b/,
  ];
  const matchedClauses = structuralClauses.filter((pattern) => pattern.test(normalizedText)).length;
  const hasPricingSignal =
    /(conditions tarifaires|grille tarifaire|pricing sheet|price list|billing rates|tarifs|pricing|fees|frais)/.test(
      normalizedText,
    );
  const isStructuredTermsDocument =
    articleCount >= 5 ||
    (articleCount >= 3 && hasDefinitions) ||
    (articleCount >= 4 && matchedClauses >= 3);
  const looksLikePricingSheet =
    hasPricingSignal &&
    !isStructuredTermsDocument &&
    articleCount < 4 &&
    matchedClauses < 4 &&
    !hasDefinitions;

  return {
    articleCount,
    hasDefinitions,
    matchedClauses,
    hasPricingSignal,
    looksLikePricingSheet,
    isStructuredTermsDocument,
  };
}

function buildProviderHints(contract: ContractRow) {
  return [
    contract.tool_name,
    contract.vendor_name,
    contract.contract_label,
  ]
    .filter(Boolean)
    .flatMap((value) => normalizeLabel(value).split(" "))
    .filter((value) => value.length >= 4);
}

function evaluateTermsPageRelevance(contract: ContractRow, termsUrl: string, pageText: string) {
  const normalizedText = normalizeText(pageText);
  const structure = analyzeTermsStructure(pageText);
  const providerHints = buildProviderHints(contract);
  const hasStrongUrlSignal = hasStrongTermsUrlSignal(termsUrl);
  const isGenericLegalHub = looksLikeGenericLegalHubUrl(termsUrl);
  const hasLegalTextSignal =
    /(terms of service|terms and conditions|general terms|subscription agreement|master service agreement|conditions generales|conditions d[' ]utilisation|conditions de vente|cgv|cgu)/.test(
      normalizedText,
    );
  const hasSpecificTermsSignal =
    /(conditions generales de vente|general terms and conditions|terms and conditions|conditions d[' ]utilisation|conditions of use|terms of service|subscription agreement|master service agreement|cgv|cgu)/.test(
      normalizedText,
    );
  const hasRenewalSignal =
    /(renewal|automatic renewal|reconduction|termination|cancel|resiliation|notice|preavis|expiry|expiration)/.test(
      normalizedText,
    );
  const hasPricingOnlySignal =
    /(conditions tarifaires|conditions tarifaire|tarifs|pricing|price list|pricing plan|billing rates|fees|frais|grille tarifaire)/.test(
      normalizedText,
    );
  const hasProviderSignal = providerHints.some((hint) => normalizedText.includes(hint));
  const hasNegativeSignal =
    /(blog|release notes|help center|knowledge base|faq|documentation|support article|careers|press|privacy|cookies|gdpr|legal compliance|conformite)/.test(normalizedText);
  const isPdf = /\.pdf(?:[?#]|$)/i.test(termsUrl);
  const isNonCanonicalAsset = looksLikeNonCanonicalLegalAsset(termsUrl);

  let score = 0;
  const urlSpecificityScore = getLegalUrlSpecificityScore(termsUrl);

  if (hasLegalUrlSignal(termsUrl)) {
    score += 3;
  }

  if (hasStrongUrlSignal) {
    score += 8;
  }

  score += urlSpecificityScore;

  if (hasLegalTextSignal) {
    score += 4;
  }

  if (hasSpecificTermsSignal) {
    score += 4;
  }

  if (hasRenewalSignal) {
    score += 3;
  }

  if (hasProviderSignal) {
    score += 2;
  }

  if (structure.articleCount >= 5) {
    score += 5;
  } else if (structure.articleCount >= 3) {
    score += 2;
  }

  if (structure.hasDefinitions) {
    score += 4;
  }

  if (structure.matchedClauses >= 4) {
    score += 4;
  } else if (structure.matchedClauses >= 2) {
    score += 2;
  }

  if (hasNegativeSignal && !hasLegalTextSignal) {
    score -= 4;
  }

  if (hasPricingOnlySignal && !hasSpecificTermsSignal && !structure.isStructuredTermsDocument && !hasStrongUrlSignal) {
    score -= 8;
  } else if (hasPricingOnlySignal && !structure.isStructuredTermsDocument && !hasStrongUrlSignal) {
    score -= 3;
  }

  if (structure.looksLikePricingSheet && !structure.isStructuredTermsDocument) {
    score -= 12;
  }

  if (isPdf && !structure.isStructuredTermsDocument) {
    score -= 6;
  }

  if (isNonCanonicalAsset) {
    score -= 14;
  }

  if (isGenericLegalHub) {
    score -= 18;
  }

  return {
    score,
    isLegalPage:
      score >= 7 &&
      hasLegalTextSignal &&
      (hasProviderSignal || hasLegalUrlSignal(termsUrl)) &&
      (!isNonCanonicalAsset || structure.isStructuredTermsDocument) &&
      !isGenericLegalHub &&
      !structure.looksLikePricingSheet,
    isRelevant:
      score >= 12 &&
      hasSpecificTermsSignal &&
      (hasRenewalSignal || hasProviderSignal || structure.isStructuredTermsDocument || hasStrongUrlSignal) &&
      (!hasPricingOnlySignal || structure.isStructuredTermsDocument || hasStrongUrlSignal) &&
      !isNonCanonicalAsset &&
      !isGenericLegalHub &&
      structure.isStructuredTermsDocument,
    structure,
  };
}

function collectCandidateTermsUrls(
  preferredUrl: string | null,
  contract: ContractRow,
  sources: SearchSource[],
  preferredDomain?: string | null,
) {
  const rankedSources = [...sources].sort(
    (left, right) =>
      (scoreSource(right, buildDomainHints(contract), preferredDomain) + getLegalUrlSpecificityScore(right.url)) -
      (scoreSource(left, buildDomainHints(contract), preferredDomain) + getLegalUrlSpecificityScore(left.url)),
  );

  return Array.from(
    new Set(
      [
        normalizeUrl(preferredUrl),
        normalizeUrl(contract.terms_url),
        ...rankedSources
          .filter((source) => hasLegalUrlSignal(source.url) || hasLegalLabelSignal(source.title))
          .map((source) => normalizeUrl(source.url)),
      ].filter((value): value is string => Boolean(value)),
    ),
  ).slice(0, 5);
}

function calculateNoticeDeadline(endDate?: string | null, noticeDays?: number | null) {
  if (!endDate || !noticeDays || noticeDays <= 0) {
    return null;
  }

  const target = new Date(`${endDate}T00:00:00.000Z`);
  target.setUTCDate(target.getUTCDate() - noticeDays);
  return target.toISOString().slice(0, 10);
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

function diffInWholeMonths(startDate?: string | null, endDate?: string | null) {
  if (!startDate || !endDate) {
    return null;
  }

  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return null;
  }

  let months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth());
  if (end.getUTCDate() < start.getUTCDate()) {
    months -= 1;
  }

  return months > 0 ? months : null;
}

function getApplicableTermMonths(contract: ContractRow) {
  return contract.renewal_period_months ?? diffInWholeMonths(contract.start_date, contract.end_date);
}

function convertLeadTimeToDays(amount: number, unit: string) {
  const normalizedUnit = normalizeText(unit);

  if (/^(jour|jours|day|days)$/.test(normalizedUnit)) {
    return amount;
  }

  if (/^(mois|month|months)$/.test(normalizedUnit)) {
    return amount * 30;
  }

  if (/^(an|ans|annee|annees|year|years)$/.test(normalizedUnit)) {
    return amount * 365;
  }

  return null;
}

function getConditionTermMonths(conditionText: string) {
  const normalized = normalizeText(conditionText);

  if (/(one year or more|1 year or more|12 months or more|an ou plus|un an ou plus|12 mois ou plus)/.test(normalized)) {
    return { minMonths: 12, maxMonths: null };
  }

  if (/(one month|1 month|un mois|1 mois)/.test(normalized)) {
    return { minMonths: 1, maxMonths: 1 };
  }

  const exactMatch = normalized.match(/(\d{1,2})\s*(mois|month|months|an|ans|annee|annees|year|years)/);
  if (exactMatch) {
    const amount = Number.parseInt(exactMatch[1], 10);
    const unit = exactMatch[2];
    const months = /^(an|ans|annee|annees|year|years)$/.test(unit) ? amount * 12 : amount;
    return { minMonths: months, maxMonths: months };
  }

  return null;
}

function isNoticeConditionApplicable(
  condition: { minMonths: number; maxMonths: number | null } | null,
  applicableTermMonths: number | null,
) {
  if (!condition) {
    return true;
  }

  if (applicableTermMonths === null) {
    return false;
  }

  if (applicableTermMonths < condition.minMonths) {
    return false;
  }

  if (condition.maxMonths !== null && applicableTermMonths > condition.maxMonths) {
    return false;
  }

  return true;
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function sanitizeSummaryText(value?: string | null) {
  if (!value) {
    return null;
  }

  const cleaned = value
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\bindices?\s*:\s*/gi, "")
    .replace(/\bpreuves?\s*:\s*/gi, "")
    .replace(/\bcitations?\s*:\s*/gi, "")
    .replace(/\s+\|\s+/g, ", ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[,;:\-–|]+/, "")
    .trim();

  return cleaned || null;
}

function htmlToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

async function fetchPageResource(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "wellcom-contract-bot/1.0",
        Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Unable to fetch page (${response.status})`);
    }

    const html = await response.text();
    const text = htmlToText(html);
    return {
      url: response.url || url,
      html,
      text: text ? text.slice(0, 30000) : null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchPageText(url: string) {
  const resource = await fetchPageResource(url);
  return resource.text;
}

const COMMON_TERMS_PATHS = [
  "/terms",
  "/terms/",
  "/terms-and-conditions",
  "/terms-conditions",
  "/general-terms-and-conditions",
  "/subscription-agreement",
  "/msa",
  "/legal",
  "/legal/terms",
  "/legal/terms-and-conditions",
  "/legal/subscription-agreement",
  "/cgv",
  "/cgu",
  "/conditions-generales-de-vente",
  "/conditions-generales-d-utilisation",
  "/fr/cgv",
  "/fr/cgu",
  "/fr/terms-conditions",
  "/fr/conditions-generales-de-vente",
  "/fr/conditions-generales-d-utilisation",
  "/en/terms",
  "/en/terms-conditions",
  "/en/terms-and-conditions",
  "/en/general-terms-and-conditions",
];

function extractInternalLegalLinks(baseUrl: string, html: string, contract: ContractRow, allowedDomains: string[]) {
  const matches = Array.from(html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi));
  const links = matches
    .map((match) => ({
      href: match[1]?.trim() ?? "",
      label: htmlToText(match[2] ?? "").slice(0, 160),
    }))
    .filter((match) => Boolean(match.href))
    .filter((match) => !/^(mailto:|tel:|javascript:)/i.test(match.href))
    .map(({ href, label }) => {
      try {
        return {
          url: new URL(href, baseUrl).toString(),
          label,
        };
      } catch {
        return null;
      }
    })
    .filter((value): value is { url: string; label: string } => Boolean(value))
    .filter((value) => {
      const domain = toLikelyOfficialDomain(parseUrlHostname(value.url));
      return canTrustRelatedLegalDomain(contract, domain, allowedDomains) &&
        (hasLegalUrlSignal(value.url) || hasLegalLabelSignal(value.label));
    })
    .map(({ url, label }) => ({
      url,
      title: label || "Lien juridique detecte sur le site officiel",
    }));

  return dedupeSources(links).slice(0, 12);
}

function extractLegalLinksFromPage(baseUrl: string, html: string) {
  const matches = Array.from(html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi));
  const links = matches
    .map((match) => ({
      href: match[1]?.trim() ?? "",
      label: htmlToText(match[2] ?? "").slice(0, 160),
    }))
    .filter((match) => Boolean(match.href))
    .filter((match) => !/^(mailto:|tel:|javascript:)/i.test(match.href))
    .map(({ href, label }) => {
      try {
        return {
          url: new URL(href, baseUrl).toString(),
          label,
        };
      } catch {
        return null;
      }
    })
    .filter((value): value is { url: string; label: string } => Boolean(value))
    .filter((value) =>
      (hasLegalUrlSignal(value.url) || hasLegalLabelSignal(value.label)) && getLegalUrlSpecificityScore(value.url) > 0
    )
    .map(({ url, label }) => ({
      url,
      title: label || "Lien juridique detecte dans la page",
    }));

  return dedupeSources(links).slice(0, 12);
}

function buildDirectTermsSources(officialDomain: string, websiteUrl?: string | null, existingTermsUrl?: string | null) {
  const baseUrl = normalizeWebsiteHomeUrl(websiteUrl) ?? `https://${officialDomain}/`;
  const existingTermsDomain = toLikelyOfficialDomain(parseUrlHostname(existingTermsUrl));
  const seededSources: SearchSource[] = [];

  if (existingTermsUrl && isSameDomainOrSubdomain(existingTermsDomain, officialDomain)) {
    seededSources.push({ title: "URL CGV / CGU deja renseignee", url: existingTermsUrl });
  }

  seededSources.push(
    ...COMMON_TERMS_PATHS.map((path) => ({
      title: "Chemin juridique courant",
      url: new URL(path, baseUrl).toString(),
    })),
  );

  return dedupeSources(seededSources);
}

function buildSeedWebsiteUrls(officialDomain: string, websiteUrl?: string | null) {
  const candidates = [
    normalizeWebsiteHomeUrl(websiteUrl),
    normalizeWebsiteHomeUrl(`https://${officialDomain}`),
    officialDomain.startsWith("www.") ? null : normalizeWebsiteHomeUrl(`https://www.${officialDomain}`),
  ].filter((value): value is string => Boolean(value));

  return Array.from(new Set(candidates));
}

async function discoverTermsSourcesOnOfficialDomain(
  contract: ContractRow,
  discovery: OfficialSiteDiscovery,
  debugLines: string[],
) {
  const officialDomain = discovery.officialDomain ?? toLikelyOfficialDomain(parseUrlHostname(discovery.websiteUrl));
  if (!officialDomain) {
    pushDebugLine(debugLines, "Aucun domaine officiel exploitable pour scanner le site directement.");
    return [];
  }

  const seedBaseUrls = buildSeedWebsiteUrls(officialDomain, discovery.websiteUrl);
  const directSources = dedupeSources(
    seedBaseUrls.flatMap((seedBaseUrl) => buildDirectTermsSources(officialDomain, seedBaseUrl, contract.terms_url)),
  );

  pushDebugLine(
    debugLines,
    `Domaine officiel retenu: ${officialDomain}${discovery.websiteUrl ? ` (${normalizeWebsiteHomeUrl(discovery.websiteUrl)})` : ""}`,
  );
  pushDebugLine(debugLines, `Bases testees pour le site officiel: ${seedBaseUrls.join(" | ")}`);
  pushDebugLine(debugLines, `URLs juridiques directes preparees: ${directSources.slice(0, 8).map((source) => source.url).join(" | ")}`);

  const homepageLinks: SearchSource[] = [];
  const allowedDomains = new Set<string>([officialDomain]);

  for (const seedBaseUrl of seedBaseUrls) {
    try {
      const homepage = await fetchPageResource(seedBaseUrl);
      const redirectedDomain = toLikelyOfficialDomain(parseUrlHostname(homepage.url));

      if (redirectedDomain && !allowedDomains.has(redirectedDomain)) {
        allowedDomains.add(redirectedDomain);
        pushDebugLine(debugLines, `Redirection detectee vers le domaine ${redirectedDomain} depuis ${seedBaseUrl}`);
      }

      homepageLinks.push(
        ...extractInternalLegalLinks(homepage.url, homepage.html, contract, Array.from(allowedDomains)),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      pushDebugLine(debugLines, `Impossible d'inspecter la page d'accueil ${seedBaseUrl}: ${message}`);
    }
  }

  const redirectedDirectSources = Array.from(allowedDomains)
    .filter((domain) => domain !== officialDomain)
    .flatMap((domain) => buildDirectTermsSources(domain, `https://${domain}/`, contract.terms_url));
  const mergedSources = dedupeSources([...homepageLinks, ...directSources, ...redirectedDirectSources]);

  if (homepageLinks.length > 0) {
    pushDebugLine(
      debugLines,
      `Liens juridiques detectes sur les pages d'accueil: ${dedupeSources(homepageLinks).slice(0, 8).map((source) => source.url).join(" | ")}`,
    );
  } else {
    pushDebugLine(debugLines, "Aucun lien juridique detecte sur les pages d'accueil testees.");
  }

  return mergedSources;
}

function extractHeuristicTermsSignals(text: string, applicableTermMonths: number | null = null) {
  const normalizedText = normalizeText(text);
  const evidence: string[] = [];

  let renewalType: TermsExtraction["renewalType"] = "none";
  if (
    /(reconduction tacite|renouvellement automatique|automatic renewal|automatically renew|auto[\s-]?renew|auto[\s-]?renewal)/.test(normalizedText)
  ) {
    renewalType = "tacit";
  } else if (/(reconduction|renouvellement|renewal)/.test(normalizedText)) {
    renewalType = "manual";
  }

  let renewalPeriodMonths: number | null = null;
  const periodMatch =
    normalizedText.match(/reconduction[^.\n\r]{0,80}?(\d{1,2})\s*(mois|month|months|an|ans|annee|annees|year|years)/) ||
    normalizedText.match(/renewal[^.\n\r]{0,80}?(\d{1,2})\s*(mois|month|months|an|ans|annee|annees|year|years)/) ||
    normalizedText.match(/(\d{1,2})\s*(mois|month|months|an|ans|annee|annees|year|years)[^.\n\r]{0,80}?(reconduction|renewal|renouvellement)/);

  if (periodMatch) {
    const amount = Number.parseInt(periodMatch[1], 10);
    const unit = periodMatch[2];
    renewalPeriodMonths = /^(an|ans|annee|annees|year|years)$/.test(unit) ? amount * 12 : amount;
    evidence.push(periodMatch[0]);
  } else if (
    /(periodes? successives? d[' ]?un\s*\(?1\)?\s*an|successive periods? of one\s*\(?1\)?\s*year)/.test(normalizedText)
  ) {
    renewalPeriodMonths = 12;
    evidence.push("periodes successives d'un (1) an");
  } else if (
    /(pour la meme duree|for the same period)/.test(normalizedText) &&
    applicableTermMonths &&
    applicableTermMonths > 0
  ) {
    renewalPeriodMonths = applicableTermMonths;
    evidence.push("renouvellement pour la meme duree");
  } else if (
    renewalType === "tacit" &&
    /(annuel|annuelle|annual|annually|yearly|every year|chaque an|chaque annee|par an)/.test(normalizedText)
  ) {
    renewalPeriodMonths = 12;
  } else if (renewalType === "tacit" && /(mensuel|monthly|every month|chaque mois)/.test(normalizedText)) {
    renewalPeriodMonths = 1;
  }

  let noticeDays: number | null = null;
  const conditionalNoticeMatches = Array.from(
    normalizedText.matchAll(
      /(?:at least|minimum|au moins)\s*(\d{1,3})\s*(jour|jours|day|days|mois|month|months|an|ans|annee|annees|year|years)[^.\n\r]{0,180}?(?:for|pour)\s+([^.\n\r]{0,120}?(?:commitment periods?|periode[s]? d[' ]engagement|periode[s]? contractuelle[s]?|duree[s]? d[' ]engagement))/g,
    ),
  );

  const applicableConditionalNotice = conditionalNoticeMatches.find((match) => {
    const condition = getConditionTermMonths(match[3]);
    return isNoticeConditionApplicable(condition, applicableTermMonths);
  });

  if (applicableConditionalNotice) {
    noticeDays = convertLeadTimeToDays(Number.parseInt(applicableConditionalNotice[1], 10), applicableConditionalNotice[2]);
    evidence.push(applicableConditionalNotice[0]);
  }

  if (noticeDays === null) {
    const expiryConditionalMatches = Array.from(
      normalizedText.matchAll(
        /(?:au moins|at least)\s*(\d{1,3})\s*(jour|jours|day|days|mois|month|months|an|ans|annee|annees|year|years)[^.\n\r]{0,120}?(?:avant l[' ]expiration|before the expiry|before expiry|avant l[' ]echeance|before expiration)[^.\n\r]{0,120}?(?:pour|for)\s+([^.\n\r]{0,120}?(?:duree[s]? d[' ]engagement|commitment periods?))/g,
      ),
    );

    const applicableExpiryConditional = expiryConditionalMatches.find((match) => {
      const condition = getConditionTermMonths(match[3]);
      return isNoticeConditionApplicable(condition, applicableTermMonths);
    });

    if (applicableExpiryConditional) {
      noticeDays = convertLeadTimeToDays(
        Number.parseInt(applicableExpiryConditional[1], 10),
        applicableExpiryConditional[2],
      );
      evidence.push(applicableExpiryConditional[0]);
    }
  }

  if (noticeDays === null) {
    const noticeMatch =
      normalizedText.match(/preavis[^.\n\r]{0,80}?(\d{1,3})\s*(jour|jours|mois|month|months|an|ans|annee|annees|year|years)/) ||
      normalizedText.match(/(\d{1,3})\s*(jour|jours|mois|month|months|an|ans|annee|annees|year|years)[^.\n\r]{0,100}?(preavis|avant l[' ]echeance|avant reconduction|avant renouvellement|resiliation)/) ||
      normalizedText.match(/(\d{1,3})\s*(jour|jours|mois|month|months|an|ans|annee|annees|year|years)[^.\n\r]{0,140}?(avant l[' ]expiration|before the expiry|before expiry|before expiration|notice|prior to renewal|before renewal|termination|cancel)/);

    if (noticeMatch) {
      noticeDays = convertLeadTimeToDays(Number.parseInt(noticeMatch[1], 10), noticeMatch[2]);
      evidence.push(noticeMatch[0]);
    }
  }

  return {
    renewalType,
    renewalPeriodMonths,
    noticeDays,
    evidence: evidence.slice(0, 3),
  };
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
    officialDomain: toLikelyOfficialDomain(normalizeOptionalString(candidate.officialDomain)),
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
    officialDomain: toLikelyOfficialDomain(normalizeOptionalString(candidate.officialDomain)),
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
  const sourceDomain = toLikelyOfficialDomain(parseUrlHostname(contract.source_url));
  const hintEmails = getDomainHintEmails(contract);
  const rankedOcrDomains = getRankedOcrDomainHints(contract);
  const ocrDomainHints = rankedOcrDomains.map(({ domain }) => domain);
  const bestOcrDomain = rankedOcrDomains[0];
  const sourceDomainScore = sourceDomain ? scoreOcrDomainHint(contract, sourceDomain, hintEmails, 0) : -Infinity;
  const preferredDomain = bestOcrDomain && bestOcrDomain.score >= TRUSTED_PROVIDER_DOMAIN_SCORE
    ? bestOcrDomain.domain
    : sourceDomainScore >= TRUSTED_PROVIDER_DOMAIN_SCORE
      ? sourceDomain
      : null;

  if (bestOcrDomain && bestOcrDomain.score >= TRUSTED_PROVIDER_DOMAIN_SCORE && preferredDomain) {
    return {
      discovery: {
        officialDomain: preferredDomain,
        websiteUrl: normalizeWebsiteHomeUrl(`https://${preferredDomain}`),
        providerLabel: contract.vendor_name ?? contract.tool_name ?? contract.contract_label,
        evidence: [
          `Domaine detecte dans le document: ${preferredDomain} (score ${bestOcrDomain.score})`,
          ...(ocrDomainHints.length > 1 ? [`Autres domaines OCR: ${ocrDomainHints.slice(1, 4).join(", ")}`] : []),
        ],
        confidence: "high" as const,
      },
      sources: [{ title: "Domaine detecte via OCR", url: `https://${preferredDomain}` }],
    };
  }

  if (sourceDomain && sourceDomainScore >= TRUSTED_PROVIDER_DOMAIN_SCORE) {
    return {
      discovery: {
        officialDomain: sourceDomain,
        websiteUrl: normalizeWebsiteHomeUrl(contract.source_url) ?? normalizeWebsiteHomeUrl(`https://${sourceDomain}`),
        providerLabel: contract.vendor_name ?? contract.tool_name ?? contract.contract_label,
        evidence: [`Domaine issu de l'URL deja presente: ${sourceDomain} (score ${sourceDomainScore})`],
        confidence: "medium" as const,
      },
      sources: [
        {
          title: "URL deja presente sur le contrat",
          url: normalizeWebsiteHomeUrl(contract.source_url) ?? `https://${sourceDomain}`,
        },
      ],
    };
  }

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
          `OCR email/domain hints: ${ocrDomainHints.length > 0 ? ocrDomainHints.join(", ") : "none"}\n` +
          `Existing source URL hint: ${contract.source_url ?? "none"}\n` +
          `Existing source domain hint: ${sourceDomain ?? "none"}\n` +
          `Preferred official domain hint: ${preferredDomain ?? "none"}\n` +
          `If OCR email/domain hints exist, prioritize domains matching those hints.`,
      },
    ],
  });

  const discoveryText = extractResponseText(searchResponse);
  const sources = extractResponseSources(searchResponse);
  const bestSource = pickBestSource(sources, contract, preferredDomain);
  const parsedDiscovery = parseOfficialSiteDiscovery(safeJsonParse(discoveryText));
  const fallbackWebsiteUrl =
    normalizeWebsiteHomeUrl(contract.source_url) ??
    (preferredDomain ? normalizeWebsiteHomeUrl(`https://${preferredDomain}`) : null) ??
    normalizeWebsiteHomeUrl(bestSource?.url);
  const fallbackDomain = toLikelyOfficialDomain(parseUrlHostname(fallbackWebsiteUrl));
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
  const websiteUrl = normalizeWebsiteHomeUrl(discovery.websiteUrl ?? fallbackWebsiteUrl);

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
  const applicableTermMonths = getApplicableTermMonths(contract);
  const allowedDomains = Array.from(
    new Set(
      [
        discovery.officialDomain,
        toLikelyOfficialDomain(parseUrlHostname(discovery.websiteUrl)),
        toLikelyOfficialDomain(parseUrlHostname(contract.source_url)),
        toLikelyOfficialDomain(parseUrlHostname(contract.terms_url)),
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
          "Return JSON only. Search only the official domain when provided. Do not browse or trust pages outside the allowed domains unless no usable legal page exists on the official domain. " +
          "Prefer pages like CGV, CGU, Terms, Terms of Service, General Terms and Conditions, Subscription Agreement, or MSA. " +
          "When several legal pages exist on the same site, prefer CGV, General Terms and Conditions, Terms and Conditions, or TOS over CGU or generic legal hubs. " +
          "Do not choose pricing, tariff, fee schedule, or conditions tarifaires pages when a real CGV/CGU/Terms page exists. If a page is pricing-only, classify it as pricing rather than terms. " +
          "A real terms page usually has contract structure such as multiple articles or sections, often definitions near the beginning, and clauses like scope, duration, termination, liability, or payment. Do not confuse a tariff sheet with a terms document. " +
          "Do not choose generic legal hub pages such as legal-compliance, privacy, cookies, or compliance pages when a specific terms page exists. legal-compliance is not a final CGV/CGU URL. " +
          "If multiple pages exist, choose the page most applicable to customer subscription, billing, renewal, or termination. " +
          "The summary must be a short French operational summary with points of vigilance, without URLs, citations, or source lists. " +
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
          `Current contract start date: ${contract.start_date ?? "unknown"}\n` +
          `Current contract end date: ${contract.end_date ?? "unknown"}\n` +
          `Applicable contract period in months: ${applicableTermMonths ?? "unknown"}\n` +
          `${allowedDomains.length > 0 ? `Search queries must stay under site:${allowedDomains[0]} when possible, and the final termsUrl must belong to one of these domains.\n` : ""}` +
          `If multiple notice periods exist depending on commitment length, return the noticeDays that applies to this contract period. Focus on renewal, tacit renewal, notice period, cancellation, and key watchouts for the buyer.`,
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

  return {
    extraction: {
      ...extraction,
      officialDomain: extraction.officialDomain ?? discovery.officialDomain,
      websiteUrl: extraction.websiteUrl ?? discovery.websiteUrl,
    },
    sources,
  };
}

async function extractTermsDataFromPage(
  contract: ContractRow,
  discovery: OfficialSiteDiscovery,
  termsUrl: string,
  apiKey: string,
) {
  const applicableTermMonths = getApplicableTermMonths(contract);
  const pageText = await fetchPageText(termsUrl);
  if (!pageText) {
    return null;
  }

  const response = await callOpenAIResponses(apiKey, {
    model: OPENAI_MODEL,
    max_output_tokens: 1200,
    text: {
      format: {
        type: "json_schema",
        name: "terms_page_extraction",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            officialDomain: nullableStringSchema("Official root domain for the vendor."),
            websiteUrl: nullableStringSchema("Official public website URL."),
            termsUrl: nullableStringSchema("Terms page URL analyzed."),
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
            summary: nullableStringSchema("French operational summary with points of vigilance, no URLs or citations."),
            evidence: {
              type: "array",
              items: { type: "string" },
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
          "You analyze a legal or commercial terms page for a software subscription. Return JSON only. " +
          "Base your answer only on the provided page text. " +
          "If the page is a generic legal hub, privacy page, cookies page, or compliance page rather than actual terms, set documentType to other or legal, keep unsupported fields null, and do not pretend it is CGV/CGU. " +
          "If the URL is a generic legal hub such as legal-compliance, do not treat it as the final CGV/CGU page even if the page contains legal navigation links. " +
          "If the page is only a pricing, tariff, fee schedule, or conditions tarifaires page, set documentType to pricing, keep unsupported contractual fields null, and do not treat it as the contract terms page. " +
          "A real terms page should normally look like a contract with several articles or sections and clauses such as definitions, scope, duration, termination, liability, or payment. " +
          "The summary must be in French, concise, operational, and focused on points of vigilance. " +
          "Do not include URLs, citations, source lists, or index labels inside summary or terminationClause. " +
          "Use null when a field is not explicitly supported by the page text.",
      },
      {
        role: "user",
        content:
          `Analyze this terms page.\n` +
          `Contract label: ${contract.contract_label}\n` +
          `Tool name: ${contract.tool_name}\n` +
          `Vendor name: ${contract.vendor_name ?? "unknown"}\n` +
          `Official domain: ${discovery.officialDomain ?? "unknown"}\n` +
          `Official website: ${discovery.websiteUrl ?? "unknown"}\n` +
          `Current contract start date: ${contract.start_date ?? "unknown"}\n` +
          `Current contract end date: ${contract.end_date ?? "unknown"}\n` +
          `Applicable contract period in months: ${applicableTermMonths ?? "unknown"}\n` +
          `Terms URL: ${termsUrl}\n\n` +
          `If the page contains different notice periods depending on commitment length, choose the one that applies to this contract period.\n\n` +
          `Page text:\n${pageText}`,
      },
    ],
  });

  const extraction = parseTermsExtraction(safeJsonParse(extractResponseText(response)));
  if (!extraction) {
    return null;
  }

  return {
    ...extraction,
    officialDomain: extraction.officialDomain ?? discovery.officialDomain,
    websiteUrl: extraction.websiteUrl ?? discovery.websiteUrl,
    termsUrl: extraction.termsUrl ?? termsUrl,
    summary: sanitizeSummaryText(extraction.summary),
    terminationClause: sanitizeSummaryText(extraction.terminationClause),
    evidence: extraction.evidence.map((item) => sanitizeSummaryText(item)).filter((item): item is string => Boolean(item)),
  } satisfies TermsExtraction;
}

async function scanCandidateTermsPages(
  contract: ContractRow,
  discovery: OfficialSiteDiscovery,
  candidateTermsUrls: string[],
  apiKey: string,
  debugLines: string[],
) {
  const queue = [...candidateTermsUrls];
  const seenUrls = new Set<string>();
  let pageExtraction: TermsExtraction | null = null;
  let heuristicPageText: string | null = null;
  let bestLegalTermsUrl: string | null = null;
  let bestLegalScore = -Infinity;
  let bestPageExtractionScore = -Infinity;

  pushDebugLine(
    debugLines,
    queue.length > 0
      ? `Pages candidates analysees: ${queue.slice(0, 6).join(" | ")}`
      : "Aucune page candidate a analyser apres filtrage.",
  );

  while (queue.length > 0) {
    const candidateTermsUrl = queue.shift()!;
    const normalizedCandidateUrl = normalizeUrl(candidateTermsUrl);
    if (!normalizedCandidateUrl || seenUrls.has(normalizedCandidateUrl)) {
      continue;
    }
    seenUrls.add(normalizedCandidateUrl);

    let candidatePageText: string | null = null;
    let candidatePageHtml: string | null = null;
    let fetchedPageUrl = normalizedCandidateUrl;

    try {
      const resource = await fetchPageResource(normalizedCandidateUrl);
      candidatePageText = resource.text;
      candidatePageHtml = resource.html;
      fetchedPageUrl = resource.url || normalizedCandidateUrl;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      pushDebugLine(debugLines, `Lecture impossible pour ${normalizedCandidateUrl}: ${message}`);
      continue;
    }

    if (!candidatePageText) {
      pushDebugLine(debugLines, `Page vide ou inexploitable: ${normalizedCandidateUrl}`);
      continue;
    }

    if (candidatePageHtml && (looksLikeSupportArticleUrl(fetchedPageUrl) || looksLikeGenericLegalHubUrl(fetchedPageUrl) || !hasStrongTermsUrlSignal(fetchedPageUrl))) {
      const followedLinks = extractLegalLinksFromPage(fetchedPageUrl, candidatePageHtml)
        .filter((source) =>
          hasStrongTermsUrlSignal(source.url) ||
          getLegalUrlSpecificityScore(source.url) > getLegalUrlSpecificityScore(fetchedPageUrl)
        )
        .map((source) => source.url)
        .filter((url) => !seenUrls.has(url));

      if (followedLinks.length > 0) {
        pushDebugLine(
          debugLines,
          `${looksLikeSupportArticleUrl(fetchedPageUrl) ? "Article support" : looksLikeGenericLegalHubUrl(fetchedPageUrl) ? "Hub juridique" : "Page juridique faible"} detecte, suivi des liens juridiques plus forts: ${followedLinks.slice(0, 4).join(" | ")}`,
        );
        queue.unshift(...followedLinks);
      }
    }

    const relevance = evaluateTermsPageRelevance(contract, fetchedPageUrl, candidatePageText);
    pushDebugLine(
      debugLines,
      `Score ${relevance.score} pour ${fetchedPageUrl}${relevance.isLegalPage ? " (juridique)" : ""}${relevance.isRelevant ? " (pertinent)" : ""} - structure: ${relevance.structure.articleCount} article(s), definitions ${relevance.structure.hasDefinitions ? "oui" : "non"}, clauses ${relevance.structure.matchedClauses}, signal tarifaire ${relevance.structure.hasPricingSignal ? "oui" : "non"}, pricing only ${relevance.structure.looksLikePricingSheet ? "oui" : "non"}, slug T&C ${hasStrongTermsUrlSignal(fetchedPageUrl) ? "oui" : "non"}, asset ${looksLikeNonCanonicalLegalAsset(fetchedPageUrl) ? "oui" : "non"}`,
    );

    if (!relevance.isLegalPage) {
      continue;
    }

    if (relevance.score > bestLegalScore) {
      bestLegalScore = relevance.score;
      bestLegalTermsUrl = fetchedPageUrl;
      heuristicPageText = candidatePageText;
    }

    const extractedCandidate = await extractTermsDataFromPage(
      contract,
      discovery,
      fetchedPageUrl,
      apiKey,
    ).catch((error) => {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      pushDebugLine(debugLines, `Extraction impossible sur ${fetchedPageUrl}: ${message}`);
      return null;
    });

    if (!extractedCandidate) {
      pushDebugLine(debugLines, `Extraction structuree vide pour ${fetchedPageUrl}, fallback heuristique conserve.`);
      continue;
    }

    const candidateExtractionScore =
      relevance.score +
      getDocumentTypeSpecificityScore(extractedCandidate.documentType) +
      (extractedCandidate.confidence === "high" ? 3 : extractedCandidate.confidence === "medium" ? 1 : 0);

    pushDebugLine(
      debugLines,
      `Extraction ${extractedCandidate.documentType} sur ${fetchedPageUrl} (score ${candidateExtractionScore}, confiance ${extractedCandidate.confidence})`,
    );

    if (candidateExtractionScore > bestPageExtractionScore) {
      bestPageExtractionScore = candidateExtractionScore;
      pageExtraction = extractedCandidate;
      heuristicPageText = candidatePageText;
    }

    if (
      relevance.isRelevant &&
      getDocumentTypeSpecificityScore(extractedCandidate.documentType) >= 6 &&
      getLegalUrlSpecificityScore(fetchedPageUrl) >= 4
    ) {
      pushDebugLine(
        debugLines,
        `Page retenue prioritaire: ${fetchedPageUrl} (${extractedCandidate.documentType}, confiance ${extractedCandidate.confidence})`,
      );
      pageExtraction = extractedCandidate;
      bestLegalTermsUrl = fetchedPageUrl;
      break;
    }

    pushDebugLine(
      debugLines,
      `Page candidate conservee: ${fetchedPageUrl} (${extractedCandidate.documentType}, confiance ${extractedCandidate.confidence})`,
    );
  }

  return {
    pageExtraction,
    heuristicPageText,
    bestLegalTermsUrl,
  };
}

function buildFallbackTermsExtraction(
  discovery: OfficialSiteDiscovery,
  termsUrl?: string | null,
  evidence: string[] = [],
  confidence: TermsExtraction["confidence"] = "low",
) {
  return {
    officialDomain: discovery.officialDomain,
    websiteUrl: discovery.websiteUrl,
    termsUrl: normalizeUrl(termsUrl),
    documentType: "other" as const,
    renewalType: "none" as const,
    renewalPeriodMonths: null,
    noticeDays: null,
    terminationClause: null,
    summary: null,
    evidence,
    confidence,
  } satisfies TermsExtraction;
}

function buildTermsDebugMessage(debugLines: string[]) {
  return Array.from(new Set(debugLines.map((line) => line.trim()).filter(Boolean))).join("\n") || null;
}

function getDocumentTypeSpecificityScore(documentType: TermsExtraction["documentType"]) {
  switch (documentType) {
    case "cgv":
      return 12;
    case "terms":
      return 10;
    case "subscription_agreement":
    case "msa":
      return 8;
    case "cgu":
      return 3;
    case "legal":
      return -6;
    case "pricing":
      return -8;
    default:
      return -4;
  }
}

function mergeTermsExtractionResults(
  webExtraction: TermsExtraction,
  pageExtraction: TermsExtraction | null,
  heuristicSignals: ReturnType<typeof extractHeuristicTermsSignals>,
) {
  const preferredExtraction = pageExtraction ?? webExtraction;

  return {
    officialDomain: preferredExtraction.officialDomain ?? webExtraction.officialDomain,
    websiteUrl: preferredExtraction.websiteUrl ?? webExtraction.websiteUrl,
    termsUrl: preferredExtraction.termsUrl ?? webExtraction.termsUrl,
    documentType: preferredExtraction.documentType !== "other" ? preferredExtraction.documentType : webExtraction.documentType,
    renewalType:
      preferredExtraction.renewalType !== "none"
        ? preferredExtraction.renewalType
        : webExtraction.renewalType !== "none"
          ? webExtraction.renewalType
          : heuristicSignals.renewalType,
    renewalPeriodMonths:
      preferredExtraction.renewalPeriodMonths ?? webExtraction.renewalPeriodMonths ?? heuristicSignals.renewalPeriodMonths,
    noticeDays:
      preferredExtraction.noticeDays ?? webExtraction.noticeDays ?? heuristicSignals.noticeDays,
    terminationClause:
      sanitizeSummaryText(preferredExtraction.terminationClause) ??
      sanitizeSummaryText(webExtraction.terminationClause),
    summary:
      sanitizeSummaryText(preferredExtraction.summary) ??
      sanitizeSummaryText(webExtraction.summary),
    evidence: Array.from(
      new Set([
        ...preferredExtraction.evidence,
        ...webExtraction.evidence,
        ...heuristicSignals.evidence,
      ].map((item) => sanitizeSummaryText(item)).filter((item): item is string => Boolean(item))),
    ).slice(0, 6),
    confidence: pageExtraction?.confidence ?? webExtraction.confidence,
  } satisfies TermsExtraction;
}

function resolveNextRenewalType(
  currentRenewalType: ContractRow["renewal_type"],
  extractedRenewalType: TermsExtraction["renewalType"],
  heuristicRenewalType: TermsExtraction["renewalType"],
) {
  if (extractedRenewalType === "tacit" || heuristicRenewalType === "tacit" || currentRenewalType === "tacit") {
    return "tacit" as const;
  }

  if (currentRenewalType !== "none") {
    return currentRenewalType;
  }

  if (extractedRenewalType !== "none") {
    return extractedRenewalType;
  }

  return heuristicRenewalType;
}

function buildTermsSummary(
  result: TermsExtraction,
  resolvedValues?: {
    renewalType?: TermsExtraction["renewalType"];
    renewalPeriodMonths?: number | null;
    noticeDays?: number | null;
    noticeDeadline?: string | null;
  },
) {
  const parts: string[] = [];
  const renewalType = resolvedValues?.renewalType ?? result.renewalType;
  const renewalPeriodMonths = resolvedValues?.renewalPeriodMonths ?? result.renewalPeriodMonths;
  const noticeDays = resolvedValues?.noticeDays ?? result.noticeDays;
  const noticeDeadline = resolvedValues?.noticeDeadline ?? null;

  if (result.summary) {
    parts.push(result.summary);
  }

  if (renewalType !== "none") {
    const renewalParts = [
      renewalType === "tacit" ? "Reconduction tacite" : "Renouvellement manuel",
      renewalPeriodMonths ? `${renewalPeriodMonths} mois` : null,
      noticeDays ? `preavis ${noticeDays} jours` : null,
    ].filter(Boolean);

    parts.push(renewalParts.join(" - "));
  }

  if (result.terminationClause) {
    parts.push(result.terminationClause);
  }

  if (!result.summary && renewalType !== "none") {
    const vigilanceParts = [
      noticeDays ? `Penser a notifier la resiliation au moins ${noticeDays} jours avant echeance.` : null,
      noticeDeadline ? `Date limite de preavis estimee: ${noticeDeadline}.` : null,
    ].filter(Boolean);

    if (vigilanceParts.length > 0) {
      parts.push(vigilanceParts.join(" "));
    }
  }

  return Array.from(new Set(parts.map((part) => sanitizeSummaryText(part)).filter((part): part is string => Boolean(part))))
    .join(" ")
    .trim() || null;
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
    const debugLines: string[] = [];
    const ocrEmailHints = getOcrEmailHints(currentContract);
    const rankedOcrDomains = getRankedOcrDomainHints(currentContract);
    const ocrDomainHints = rankedOcrDomains.map(({ domain }) => domain);

    await supabase
      .from("contracts")
      .update({
        terms_status: "reviewing",
      })
      .eq("id", currentContract.id);

    pushDebugLine(debugLines, `Emails detectes dans le document: ${ocrEmailHints.length > 0 ? ocrEmailHints.join(", ") : "aucun"}`);
    pushDebugLine(debugLines, `Domaines detectes dans le document: ${ocrDomainHints.length > 0 ? ocrDomainHints.join(", ") : "aucun"}`);
    pushDebugLine(
      debugLines,
      `Domaines priorises pour le fournisseur: ${rankedOcrDomains.slice(0, 5).map(({ domain, score }) => `${domain} (${score})`).join(" | ") || "aucun"}`,
    );

    const { discovery, sources: discoverySources } = await discoverOfficialWebsite(currentContract, openAiApiKey);
    discovery.evidence.forEach((item) => pushDebugLine(debugLines, `Source site officiel: ${item}`));

    const directTermsSources = await discoverTermsSourcesOnOfficialDomain(currentContract, discovery, debugLines);
    let termsSources = directTermsSources;
    let webExtraction: TermsExtraction = buildFallbackTermsExtraction(
      discovery,
      directTermsSources[0]?.url ?? currentContract.terms_url,
      directTermsSources.length > 0
        ? [`Pages candidates construites sur le domaine ${discovery.officialDomain ?? "inconnu"}`]
        : [],
      directTermsSources.length > 0 ? "medium" : "low",
    );

    let pageScanResult = await scanCandidateTermsPages(
      currentContract,
      discovery,
      collectCandidateTermsUrls(
        webExtraction.termsUrl,
        currentContract,
        termsSources,
        discovery.officialDomain,
      ),
      openAiApiKey,
      debugLines,
    );

    if (!pageScanResult.pageExtraction && !pageScanResult.bestLegalTermsUrl) {
      pushDebugLine(debugLines, "Aucune page juridique fiable detectee sur le domaine en direct. Fallback vers recherche web ciblee.");
      try {
        const webSearchResult = await extractTermsData(currentContract, discovery, openAiApiKey);
        webExtraction = webSearchResult.extraction;
        termsSources = dedupeSources([...termsSources, ...webSearchResult.sources]);
        pushDebugLine(debugLines, `Recherche web retournee: ${webSearchResult.sources.length} source(s) exploitable(s).`);
        pushDebugLine(debugLines, `URL juridique proposee par la recherche web: ${webExtraction.termsUrl ?? "aucune"}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erreur inconnue";
        pushDebugLine(debugLines, `Recherche web ciblee en erreur: ${message}`);
        webExtraction = buildFallbackTermsExtraction(discovery, currentContract.terms_url, ["Recherche web ciblee en erreur"], "low");
      }
      pageScanResult = await scanCandidateTermsPages(
        currentContract,
        discovery,
        collectCandidateTermsUrls(
          webExtraction.termsUrl,
          currentContract,
          termsSources,
          discovery.officialDomain,
        ),
        openAiApiKey,
        debugLines,
      );
    }

    const { pageExtraction, heuristicPageText, bestLegalTermsUrl } = pageScanResult;

    const trustedWebExtraction = pageExtraction
      ? webExtraction
      : buildFallbackTermsExtraction(
        discovery,
        bestLegalTermsUrl ?? webExtraction.termsUrl,
        bestLegalTermsUrl ? [`Page juridique candidate retenue: ${bestLegalTermsUrl}`] : webExtraction.evidence,
        bestLegalTermsUrl ? "medium" : webExtraction.confidence,
      );
    const applicableTermMonths = getApplicableTermMonths(currentContract);
    const heuristicSignals = heuristicPageText
      ? extractHeuristicTermsSignals(heuristicPageText, applicableTermMonths)
      : { renewalType: "none" as const, renewalPeriodMonths: null, noticeDays: null, evidence: [] };
    const extraction = mergeTermsExtractionResults(trustedWebExtraction, pageExtraction, heuristicSignals);

    const mergedSources = dedupeSources([...discoverySources, ...termsSources]);

    const nextRenewalType = resolveNextRenewalType(
      currentContract.renewal_type,
      extraction.renewalType,
      heuristicSignals.renewalType,
    );
    const nextNoticeDays = currentContract.renewal_notice_days ?? extraction.noticeDays;
    const nextRenewalPeriodMonths = currentContract.renewal_period_months ?? extraction.renewalPeriodMonths;
    const nextEndDate =
      currentContract.end_date ?? addMonthsToIsoDate(currentContract.start_date, nextRenewalPeriodMonths);
    const nextNoticeDeadline =
      currentContract.notice_deadline ?? calculateNoticeDeadline(nextEndDate, nextNoticeDays);
    const nextTermsSummary = extraction.documentType === "pricing"
      ? null
      : buildTermsSummary(extraction, {
        renewalType: nextRenewalType,
        renewalPeriodMonths: nextRenewalPeriodMonths,
        noticeDays: nextNoticeDays,
        noticeDeadline: nextNoticeDeadline,
      });
    const safeExistingSourceUrl = canTrustProviderDomain(
      currentContract,
      toLikelyOfficialDomain(parseUrlHostname(currentContract.source_url)),
    )
      ? currentContract.source_url
      : null;
    const safeExistingTermsUrl = isAcceptableStoredTermsUrl(
      currentContract,
      currentContract.terms_url,
    )
      ? currentContract.terms_url
      : null;
    const nextSourceUrl = normalizeWebsiteHomeUrl(extraction.websiteUrl ?? discovery.websiteUrl ?? safeExistingSourceUrl);
    const nextTermsUrl = isAcceptableResolvedTermsUrl(extraction.termsUrl, extraction.documentType)
      ? extraction.termsUrl
      : safeExistingTermsUrl;
    const success = Boolean(nextTermsUrl || nextTermsSummary);

    if (extraction.documentType === "pricing") {
      pushDebugLine(debugLines, "Page tarifaire detectee puis rejetee comme source CGV / CGU.");
    }

    pushDebugLine(debugLines, `Resultat final: ${success ? "succes" : "echec"}`);
    pushDebugLine(debugLines, `URL du site retenue: ${nextSourceUrl ?? "aucune"}`);
    pushDebugLine(debugLines, `URL CGV / CGU retenue: ${nextTermsUrl ?? "aucune"}`);
    pushDebugLine(debugLines, `Resume genere: ${nextTermsSummary ? "oui" : "non"}`);
    const nextTermsDebug = buildTermsDebugMessage(debugLines);

    await supabase
      .from("contracts")
      .update({
        source_url: nextSourceUrl,
        terms_url: nextTermsUrl,
        terms_summary: success ? nextTermsSummary : nextTermsDebug,
        terms_status: success ? "completed" : "failed",
        terms_checked_at: new Date().toISOString(),
        end_date: nextEndDate,
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
      debug: nextTermsDebug,
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
            terms_summary: `Erreur backend pendant l'extraction: ${message}`,
            terms_checked_at: new Date().toISOString(),
          })
          .eq("id", processedContractId);
      }
    }

    return jsonResponse({ error: message }, 500);
  }
});
