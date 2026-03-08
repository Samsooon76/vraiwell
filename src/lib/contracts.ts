import { differenceInCalendarDays, format, parseISO, startOfDay, subDays } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Contract,
  ContractOcrStatus,
  ContractRenewalType,
  ContractStatus,
  ContractTermsStatus,
} from "@/types/contracts";

export const DEFAULT_OCR_MODEL = "mistral-ocr-2512";

export const CONTRACT_STATUS_OPTIONS: Array<{ value: ContractStatus; label: string }> = [
  { value: "draft", label: "Brouillon" },
  { value: "active", label: "Actif" },
  { value: "terminated", label: "Resilie" },
  { value: "expired", label: "Expire" },
];

export const CONTRACT_RENEWAL_OPTIONS: Array<{ value: ContractRenewalType; label: string }> = [
  { value: "none", label: "Pas de reconduction" },
  { value: "manual", label: "Renouvellement manuel" },
  { value: "tacit", label: "Reconduction tacite" },
];

export const OCR_STATUS_OPTIONS: Array<{ value: ContractOcrStatus; label: string }> = [
  { value: "pending_model", label: "En attente" },
  { value: "queued", label: "En file d'attente" },
  { value: "processing", label: "Analyse en cours" },
  { value: "completed", label: "Analyse terminee" },
  { value: "failed", label: "Analyse en erreur" },
  { value: "manual_review", label: "Relecture manuelle" },
];

export const TERMS_STATUS_OPTIONS: Array<{ value: ContractTermsStatus; label: string }> = [
  { value: "not_started", label: "Pas de recherche" },
  { value: "queued", label: "Recherche planifiee" },
  { value: "reviewing", label: "Recherche en cours" },
  { value: "completed", label: "Recherche terminee" },
  { value: "failed", label: "Recherche en erreur" },
];

const contractStatusLabels: Record<ContractStatus, string> = Object.fromEntries(
  CONTRACT_STATUS_OPTIONS.map((option) => [option.value, option.label]),
) as Record<ContractStatus, string>;

const renewalLabels: Record<ContractRenewalType, string> = Object.fromEntries(
  CONTRACT_RENEWAL_OPTIONS.map((option) => [option.value, option.label]),
) as Record<ContractRenewalType, string>;

const ocrStatusLabels: Record<ContractOcrStatus, string> = Object.fromEntries(
  OCR_STATUS_OPTIONS.map((option) => [option.value, option.label]),
) as Record<ContractOcrStatus, string>;

const termsStatusLabels: Record<ContractTermsStatus, string> = Object.fromEntries(
  TERMS_STATUS_OPTIONS.map((option) => [option.value, option.label]),
) as Record<ContractTermsStatus, string>;

export function normalizeOptionalText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function normalizeOptionalUrl(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function parseOptionalInteger(value?: string | number | null) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export function calculateNoticeDeadline(endDate?: string | null, noticeDays?: number | null) {
  if (!endDate || !noticeDays || noticeDays <= 0) {
    return null;
  }

  return format(subDays(parseISO(endDate), noticeDays), "yyyy-MM-dd");
}

export function toDateInputValue(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}

export function formatContractDate(value?: string | null) {
  if (!value) {
    return "A renseigner";
  }

  return format(parseISO(value), "d MMM yyyy", { locale: fr });
}

export function getDaysUntil(value?: string | null) {
  if (!value) {
    return null;
  }

  return differenceInCalendarDays(parseISO(value), startOfDay(new Date()));
}

export function getContractStatusLabel(value: ContractStatus) {
  return contractStatusLabels[value];
}

export function getRenewalLabel(value: ContractRenewalType) {
  return renewalLabels[value];
}

export function getOcrStatusLabel(value: ContractOcrStatus) {
  return ocrStatusLabels[value];
}

export function getTermsStatusLabel(value: ContractTermsStatus) {
  return termsStatusLabels[value];
}

export function getHumanFileSize(size?: number | null) {
  if (!size) {
    return null;
  }

  const units = ["B", "KB", "MB", "GB"];
  let current = size;
  let unitIndex = 0;

  while (current >= 1024 && unitIndex < units.length - 1) {
    current /= 1024;
    unitIndex += 1;
  }

  return `${current >= 10 ? current.toFixed(0) : current.toFixed(1)} ${units[unitIndex]}`;
}

export function isOcrPending(status: ContractOcrStatus) {
  return ["pending_model", "queued", "processing", "manual_review"].includes(status);
}

export function isTermsPending(status: ContractTermsStatus) {
  return ["queued", "reviewing"].includes(status);
}

export function getContractTimelineDate(contract: Contract) {
  return contract.notice_deadline ?? contract.end_date ?? contract.created_at;
}

export function getRenewalSummary(contract: Contract) {
  if (contract.renewal_type === "none") {
    return renewalLabels.none;
  }

  const parts = [renewalLabels[contract.renewal_type]];

  if (contract.renewal_period_months) {
    parts.push(`${contract.renewal_period_months} mois`);
  }

  if (contract.renewal_notice_days) {
    parts.push(`preavis ${contract.renewal_notice_days} j`);
  }

  return parts.join(" - ");
}

export function getContractStatusBadgeClass(status: ContractStatus) {
  switch (status) {
    case "active":
      return "border-0 bg-success/10 text-success";
    case "draft":
      return "border-0 bg-secondary/15 text-secondary";
    case "terminated":
      return "border-0 bg-warning/15 text-warning";
    case "expired":
      return "border-0 bg-destructive/10 text-destructive";
    default:
      return "border-border";
  }
}

export function getOcrStatusBadgeClass(status: ContractOcrStatus) {
  switch (status) {
    case "completed":
      return "border-0 bg-success/10 text-success";
    case "failed":
      return "border-0 bg-destructive/10 text-destructive";
    case "processing":
      return "border-0 bg-primary/10 text-primary";
    default:
      return "border-0 bg-warning/15 text-warning";
  }
}

export function getTermsStatusBadgeClass(status: ContractTermsStatus) {
  switch (status) {
    case "completed":
      return "border-0 bg-success/10 text-success";
    case "failed":
      return "border-0 bg-destructive/10 text-destructive";
    case "reviewing":
      return "border-0 bg-primary/10 text-primary";
    case "queued":
      return "border-0 bg-warning/15 text-warning";
    default:
      return "border-border text-muted-foreground";
  }
}
