export type ContractStatus = "draft" | "active" | "terminated" | "expired";

export type ContractRenewalType = "none" | "manual" | "tacit";

export type ContractOcrStatus =
  | "pending_model"
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "manual_review";

export type ContractTermsStatus =
  | "not_started"
  | "queued"
  | "reviewing"
  | "completed"
  | "failed";

export interface UploadedContractFile {
  path: string;
  name: string;
  size: number;
  mimeType: string | null;
}

export interface ContractOcrExtractedSignals {
  documentType: "contract" | "invoice" | "receipt" | "quote" | "other";
  contractLabel: string | null;
  toolName: string | null;
  vendorName: string | null;
  startDate: string | null;
  endDate: string | null;
  renewalType: ContractRenewalType;
  renewalNoticeDays: number | null;
  renewalPeriodMonths: number | null;
  candidateDates: string[];
  matchedSnippets: string[];
}

export interface ContractOcrPreview {
  model: string;
  markdownText: string | null;
  extractedSignals: ContractOcrExtractedSignals;
  extractedFields: Record<string, unknown> | null;
}

export interface PreparedContractFileResult {
  uploadedFile: UploadedContractFile;
  ocrPreview: ContractOcrPreview | null;
  error: string | null;
}

export interface Contract {
  id: string;
  user_id: string;
  contract_label: string;
  tool_name: string;
  vendor_name: string | null;
  status: ContractStatus;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  source_url: string | null;
  start_date: string | null;
  end_date: string | null;
  renewal_type: ContractRenewalType;
  renewal_period_months: number | null;
  renewal_notice_days: number | null;
  notice_deadline: string | null;
  ocr_status: ContractOcrStatus;
  ocr_model: string | null;
  ocr_extracted_text: string | null;
  ocr_extracted_fields: Record<string, unknown> | null;
  terms_status: ContractTermsStatus;
  terms_url: string | null;
  terms_summary: string | null;
  terms_checked_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContractUpsertInput {
  contract_label: string;
  tool_name: string;
  vendor_name?: string | null;
  status: ContractStatus;
  source_url?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  renewal_type: ContractRenewalType;
  renewal_period_months?: number | null;
  renewal_notice_days?: number | null;
  ocr_status: ContractOcrStatus;
  ocr_model?: string | null;
  terms_status: ContractTermsStatus;
  terms_url?: string | null;
  terms_summary?: string | null;
  notes?: string | null;
  file?: File | null;
  uploadedFile?: UploadedContractFile | null;
  ocr_extracted_text?: string | null;
  ocr_extracted_fields?: Record<string, unknown> | null;
}
