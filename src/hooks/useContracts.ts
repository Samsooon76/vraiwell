import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  calculateNoticeDeadline,
  DEFAULT_OCR_MODEL,
  deriveContractEndDate,
  getContractTimelineDate,
  normalizeOptionalText,
  normalizeOptionalUrl,
} from "@/lib/contracts";
import {
  Contract,
  ContractOcrPreview,
  ContractUpsertInput,
  PreparedContractFileResult,
  UploadedContractFile,
} from "@/types/contracts";

interface UseContractsReturn {
  contracts: Contract[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  prepareContractFile: (file: File) => Promise<PreparedContractFileResult | null>;
  cleanupUploadedContractFile: (path: string) => Promise<void>;
  createContract: (input: ContractUpsertInput) => Promise<Contract | null>;
  updateContract: (id: string, input: ContractUpsertInput, existingFilePath?: string | null) => Promise<boolean>;
  deleteContract: (contract: Contract) => Promise<boolean>;
  runContractOcr: (contractId: string, options?: { silent?: boolean }) => Promise<boolean>;
  runContractTermsScan: (contractId: string, options?: { silent?: boolean }) => Promise<boolean>;
  generateNonRenewalEmail: (contractId: string) => Promise<{ subject: string; body: string } | null>;
  openContractFile: (contract: Contract) => Promise<void>;
}

const CONTRACTS_BUCKET = "contracts";

function sortContracts(items: Contract[]) {
  return [...items].sort((left, right) => {
    const leftDate = new Date(getContractTimelineDate(left)).getTime();
    const rightDate = new Date(getContractTimelineDate(right)).getTime();

    if (Number.isNaN(leftDate) || Number.isNaN(rightDate)) {
      return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
    }

    return leftDate - rightDate;
  });
}

async function uploadContractFile(userId: string, file: File) {
  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const path = `${userId}/${crypto.randomUUID()}-${safeFileName}`;

  const { error } = await supabase.storage
    .from(CONTRACTS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) {
    throw error;
  }

  return {
    path,
    name: file.name,
    size: file.size,
    mimeType: file.type || null,
  };
}

async function removeContractFile(path?: string | null) {
  if (!path) {
    return;
  }

  const { error } = await supabase.storage.from(CONTRACTS_BUCKET).remove([path]);
  if (error) {
    throw error;
  }
}

async function getFunctionAuthHeaders() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session?.access_token) {
    throw error || new Error("Session invalide");
  }

  return {
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  };
}

async function invokeContractOcr(body: { contractId?: string; filePath?: string; mimeType?: string | null }) {
  return invokeContractFunction("process-contract-ocr", body);
}

async function invokeContractFunction(functionName: string, body: Record<string, unknown>) {
  const headers = await getFunctionAuthHeaders();
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      (payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : null) ?? `Edge Function error (${response.status})`,
    );
  }

  return payload;
}

async function invokeContractTermsScan(body: { contractId: string }) {
  return invokeContractFunction("scan-contract-terms", body);
}

async function invokeNonRenewalEmailGeneration(body: { contractId: string }) {
  return invokeContractFunction("generate-non-renewal-email", body);
}

function isSchemaCacheMissingColumnError(error: unknown, columnName: string) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = "code" in error && typeof error.code === "string" ? error.code : null;
  const message = "message" in error && typeof error.message === "string" ? error.message : null;

  return code === "PGRST204" && message?.includes(`'${columnName}'`) === true;
}

function omitTeamId<T extends { team_id?: unknown }>(payload: T): Omit<T, "team_id"> {
  const { team_id: _teamId, ...rest } = payload;
  return rest;
}

export function useContracts(): UseContractsReturn {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContracts = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("contracts")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      setContracts(sortContracts((data || []) as Contract[]));
    } catch (err) {
      console.error("Error fetching contracts:", err);
      setError(err instanceof Error ? err.message : "Impossible de charger les contrats");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  const prepareContractFile = useCallback(async (file: File) => {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw userError || new Error("Session invalide");
      }

      const uploadedFile = await uploadContractFile(user.id, file);

      try {
        const data = await invokeContractOcr({
          filePath: uploadedFile.path,
          mimeType: uploadedFile.mimeType,
        });

        if (data?.error || !data?.extractedSignals) {
          throw new Error(data?.error || "Impossible d'analyser le fichier");
        }

        const ocrPreview: ContractOcrPreview = {
          model: data.model ?? DEFAULT_OCR_MODEL,
          markdownText: data.markdownText ?? null,
          extractedSignals: data.extractedSignals,
          extractedFields: data.ocrExtractedFields ?? null,
        };

        return {
          uploadedFile,
          ocrPreview,
          error: null,
        } satisfies PreparedContractFileResult;
      } catch (ocrError) {
        console.error("Error previewing OCR:", ocrError);

        return {
          uploadedFile,
          ocrPreview: null,
          error: ocrError instanceof Error ? ocrError.message : "Impossible d'analyser le fichier",
        } satisfies PreparedContractFileResult;
      }
    } catch (err) {
      console.error("Error preparing contract file:", err);
      toast.error("Impossible d'uploader le fichier");
      return null;
    }
  }, []);

  const cleanupUploadedContractFile = useCallback(async (path: string) => {
    try {
      await removeContractFile(path);
    } catch (err) {
      console.error("Error cleaning uploaded contract file:", err);
    }
  }, []);

  const runContractOcr = useCallback(async (
    contractId: string,
    options?: { silent?: boolean },
  ) => {
    try {
      const data = await invokeContractOcr({ contractId });

      if (data?.error) {
        throw new Error(data.error);
      }

      if (!options?.silent) {
        toast.success("OCR lance");
      }

      await fetchContracts();
      return true;
    } catch (err) {
      console.error("Error processing OCR:", err);
      if (!options?.silent) {
        toast.error("Impossible de lancer l'OCR");
      }
      await fetchContracts();
      return false;
    }
  }, [fetchContracts]);

  const runContractTermsScan = useCallback(async (
    contractId: string,
    options?: { silent?: boolean },
  ) => {
    setContracts((current) =>
      sortContracts(
        current.map((contract) =>
          contract.id === contractId
            ? {
                ...contract,
                terms_status: "reviewing",
              }
            : contract
        ),
      )
    );

    try {
      const data = await invokeContractTermsScan({ contractId });

      if (data?.error) {
        throw new Error(data.error);
      }

      const success = data?.success !== false;

      if (!options?.silent && success) {
        toast.success("Extraction CGV / CGU lancee");
      }

      if (!options?.silent && !success) {
        toast.error("Aucune page CGV / CGU fiable n'a ete confirmee");
      }

      await fetchContracts();
      return success;
    } catch (err) {
      console.error("Error scanning terms:", err);
      if (!options?.silent) {
        toast.error("Impossible de lancer l'extraction CGV / CGU");
      }
      await fetchContracts();
      return false;
    }
  }, [fetchContracts]);

  const generateNonRenewalEmail = useCallback(async (contractId: string) => {
    try {
      const data = await invokeNonRenewalEmailGeneration({ contractId });

      if (data?.error) {
        throw new Error(data.error);
      }

      const subject = typeof data?.subject === "string" ? data.subject.trim() : "";
      const body = typeof data?.body === "string" ? data.body.trim() : "";

      if (!subject || !body) {
        throw new Error("Le brouillon genere est incomplet");
      }

      toast.success("Brouillon d'email genere");
      return { subject, body };
    } catch (err) {
      console.error("Error generating non-renewal email:", err);
      toast.error("Impossible de generer le mail");
      return null;
    }
  }, []);

  const createContract = useCallback(async (input: ContractUpsertInput) => {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw userError || new Error("Session invalide");
      }

      let uploadedFile:
        | UploadedContractFile
        | undefined;

      if (input.uploadedFile) {
        uploadedFile = input.uploadedFile;
      } else if (input.file) {
        uploadedFile = await uploadContractFile(user.id, input.file);
      }

      const nextEndDate = input.end_date || deriveContractEndDate(input.start_date, input.renewal_period_months);
      const noticeDeadline = calculateNoticeDeadline(nextEndDate, input.renewal_notice_days);

      const payload = {
        contract_label: input.contract_label.trim(),
        tool_name: input.tool_name.trim(),
        vendor_name: normalizeOptionalText(input.vendor_name),
        team_id: input.team_id || null,
        status: input.status,
        source_url: normalizeOptionalUrl(input.source_url),
        start_date: input.start_date || null,
        end_date: nextEndDate || null,
        renewal_type: input.renewal_type,
        renewal_period_months: input.renewal_period_months ?? null,
        renewal_notice_days: input.renewal_notice_days ?? null,
        notice_deadline: noticeDeadline,
        ocr_status: input.ocr_extracted_fields ? "completed" : uploadedFile?.path ? input.ocr_status : input.ocr_status,
        ocr_model: normalizeOptionalText(input.ocr_model) ?? DEFAULT_OCR_MODEL,
        terms_status: input.terms_status,
        terms_url: normalizeOptionalUrl(input.terms_url),
        terms_summary: normalizeOptionalText(input.terms_summary),
        notes: normalizeOptionalText(input.notes),
        file_path: uploadedFile?.path ?? null,
        file_name: uploadedFile?.name ?? null,
        file_size: uploadedFile?.size ?? null,
        mime_type: uploadedFile?.mimeType ?? null,
        ...(input.ocr_extracted_text
          ? {
              ocr_extracted_text: input.ocr_extracted_text,
            }
          : {}),
        ...(input.ocr_extracted_fields
          ? {
              ocr_extracted_fields: input.ocr_extracted_fields,
            }
          : {}),
      };

      const { data: createdContract, error: insertError } = await supabase
        .from("contracts")
        .insert(payload)
        .select("*")
        .single();

      let persistedContract = createdContract as Contract | null;
      let savedWithoutTeamAssignment = false;

      if (insertError) {
        if (isSchemaCacheMissingColumnError(insertError, "team_id")) {
          const { data: fallbackContract, error: fallbackError } = await supabase
            .from("contracts")
            .insert(omitTeamId(payload))
            .select("*")
            .single();

          if (fallbackError) {
            if (uploadedFile?.path) {
              await removeContractFile(uploadedFile.path).catch(() => undefined);
            }
            throw fallbackError;
          }

          persistedContract = fallbackContract as Contract;
          savedWithoutTeamAssignment = true;
        } else {
          if (uploadedFile?.path) {
            await removeContractFile(uploadedFile.path).catch(() => undefined);
          }
          throw insertError;
        }
      }

      toast.success("Contrat ajoute");
      if (savedWithoutTeamAssignment) {
        toast.info("Contrat enregistre sans equipe. Applique la migration Supabase pour activer cette affectation.");
      }
      await fetchContracts();

      if (input.file && !input.uploadedFile && uploadedFile?.path && persistedContract?.id) {
        void runContractOcr(persistedContract.id, { silent: true });
      }

      return persistedContract;
    } catch (err) {
      console.error("Error creating contract:", err);
      toast.error("Impossible d'ajouter le contrat");
      return null;
    }
  }, [fetchContracts, runContractOcr]);

  const updateContract = useCallback(async (
    id: string,
    input: ContractUpsertInput,
    existingFilePath?: string | null,
  ) => {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw userError || new Error("Session invalide");
      }

      let uploadedFile:
        | UploadedContractFile
        | undefined;

      if (input.uploadedFile) {
        uploadedFile = input.uploadedFile;
      } else if (input.file) {
        uploadedFile = await uploadContractFile(user.id, input.file);
      }

      const nextEndDate = input.end_date || deriveContractEndDate(input.start_date, input.renewal_period_months);
      const noticeDeadline = calculateNoticeDeadline(nextEndDate, input.renewal_notice_days);

      const payload = {
        contract_label: input.contract_label.trim(),
        tool_name: input.tool_name.trim(),
        vendor_name: normalizeOptionalText(input.vendor_name),
        team_id: input.team_id || null,
        status: input.status,
        source_url: normalizeOptionalUrl(input.source_url),
        start_date: input.start_date || null,
        end_date: nextEndDate || null,
        renewal_type: input.renewal_type,
        renewal_period_months: input.renewal_period_months ?? null,
        renewal_notice_days: input.renewal_notice_days ?? null,
        notice_deadline: noticeDeadline,
        ocr_status: input.ocr_extracted_fields ? "completed" : uploadedFile?.path ? input.ocr_status : input.ocr_status,
        ocr_model: normalizeOptionalText(input.ocr_model) ?? DEFAULT_OCR_MODEL,
        terms_status: input.terms_status,
        terms_url: normalizeOptionalUrl(input.terms_url),
        terms_summary: normalizeOptionalText(input.terms_summary),
        notes: normalizeOptionalText(input.notes),
        ...(input.ocr_extracted_text
          ? {
              ocr_extracted_text: input.ocr_extracted_text,
            }
          : {}),
        ...(input.ocr_extracted_fields
          ? {
              ocr_extracted_fields: input.ocr_extracted_fields,
            }
          : {}),
        ...(uploadedFile
          ? {
              file_path: uploadedFile.path,
              file_name: uploadedFile.name,
              file_size: uploadedFile.size,
              mime_type: uploadedFile.mimeType,
            }
          : {}),
      };

      const { error: updateError } = await supabase
        .from("contracts")
        .update(payload)
        .eq("id", id);

      let finalUpdateError = updateError;
      let savedWithoutTeamAssignment = false;

      if (updateError && isSchemaCacheMissingColumnError(updateError, "team_id")) {
        const { error: fallbackError } = await supabase
          .from("contracts")
          .update(omitTeamId(payload))
          .eq("id", id);

        finalUpdateError = fallbackError;
        savedWithoutTeamAssignment = !fallbackError;
      }

      if (finalUpdateError) {
        if (uploadedFile?.path) {
          await removeContractFile(uploadedFile.path).catch(() => undefined);
        }
        throw finalUpdateError;
      }

      if (uploadedFile?.path && existingFilePath && existingFilePath !== uploadedFile.path) {
        await removeContractFile(existingFilePath).catch(() => undefined);
      }

      toast.success("Contrat mis a jour");
      if (savedWithoutTeamAssignment) {
        toast.info("Contrat mis a jour sans equipe. Applique la migration Supabase pour activer cette affectation.");
      }
      await fetchContracts();

      if (input.file && !input.uploadedFile && uploadedFile?.path) {
        void runContractOcr(id, { silent: true });
      }

      return true;
    } catch (err) {
      console.error("Error updating contract:", err);
      toast.error("Impossible de mettre a jour le contrat");
      return false;
    }
  }, [fetchContracts, runContractOcr]);

  const deleteContract = useCallback(async (contract: Contract) => {
    try {
      if (contract.file_path) {
        await removeContractFile(contract.file_path).catch(() => undefined);
      }

      const { error: deleteError } = await supabase
        .from("contracts")
        .delete()
        .eq("id", contract.id);

      if (deleteError) {
        throw deleteError;
      }

      toast.success("Contrat supprime");
      setContracts((current) => current.filter((item) => item.id !== contract.id));
      return true;
    } catch (err) {
      console.error("Error deleting contract:", err);
      toast.error("Impossible de supprimer le contrat");
      return false;
    }
  }, []);

  const openContractFile = useCallback(async (contract: Contract) => {
    if (!contract.file_path) {
      toast.error("Aucun fichier disponible");
      return;
    }

    try {
      const { data, error: urlError } = await supabase.storage
        .from(CONTRACTS_BUCKET)
        .createSignedUrl(contract.file_path, 60);

      if (urlError || !data?.signedUrl) {
        throw urlError || new Error("Impossible de generer le lien");
      }

      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error("Error opening contract file:", err);
      toast.error("Impossible d'ouvrir le fichier");
    }
  }, []);

  return {
    contracts,
    isLoading,
    error,
    refetch: fetchContracts,
    prepareContractFile,
    cleanupUploadedContractFile,
    createContract,
    updateContract,
    deleteContract,
    runContractOcr,
    runContractTermsScan,
    generateNonRenewalEmail,
    openContractFile,
  };
}
