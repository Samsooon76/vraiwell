import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CONTRACT_RENEWAL_OPTIONS,
  CONTRACT_STATUS_OPTIONS,
  DEFAULT_OCR_MODEL,
  TERMS_STATUS_OPTIONS,
  getHumanFileSize,
  toDateInputValue,
} from "@/lib/contracts";
import {
  Contract,
  ContractOcrPreview,
  ContractRenewalType,
  ContractStatus,
  ContractTermsStatus,
  ContractUpsertInput,
  PreparedContractFileResult,
  UploadedContractFile,
} from "@/types/contracts";
import { AlertTriangle, FileUp, Loader2, Sparkles } from "lucide-react";

interface ContractModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  contract?: Contract | null;
  onSubmit: (input: ContractUpsertInput) => Promise<boolean>;
  onPrepareFile: (file: File) => Promise<PreparedContractFileResult | null>;
  onRemoveUploadedFile: (path: string) => Promise<void>;
  onRunTermsScan?: (contractId: string) => Promise<boolean>;
  autoStartTermsScan?: boolean;
  onAutoStartTermsConsumed?: () => void;
}

interface ContractFormState {
  contractLabel: string;
  toolName: string;
  vendorName: string;
  status: ContractStatus;
  sourceUrl: string;
  startDate: string;
  endDate: string;
  renewalType: ContractRenewalType;
  renewalPeriodMonths: string;
  renewalNoticeDays: string;
  termsStatus: ContractTermsStatus;
  termsUrl: string;
  termsSummary: string;
  notes: string;
}

function getInitialFormState(contract?: Contract | null): ContractFormState {
  return {
    contractLabel: contract?.contract_label ?? "",
    toolName: contract?.tool_name ?? "",
    vendorName: contract?.vendor_name ?? "",
    status: contract?.status ?? "active",
    sourceUrl: contract?.source_url ?? "",
    startDate: toDateInputValue(contract?.start_date),
    endDate: toDateInputValue(contract?.end_date),
    renewalType: contract?.renewal_type ?? "none",
    renewalPeriodMonths: contract?.renewal_period_months?.toString() ?? "",
    renewalNoticeDays: contract?.renewal_notice_days?.toString() ?? "",
    termsStatus: contract?.terms_status ?? "not_started",
    termsUrl: contract?.terms_url ?? "",
    termsSummary: contract?.terms_summary ?? "",
    notes: contract?.notes ?? "",
  };
}

function parseOptionalInteger(value: string) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function deriveContractLabel(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
}

export function ContractModal({
  open,
  onOpenChange,
  mode,
  contract,
  onSubmit,
  onPrepareFile,
  onRemoveUploadedFile,
  onRunTermsScan,
  autoStartTermsScan = false,
  onAutoStartTermsConsumed,
}: ContractModalProps) {
  const [form, setForm] = useState<ContractFormState>(getInitialFormState(contract));
  const [uploadedFile, setUploadedFile] = useState<UploadedContractFile | null>(null);
  const [ocrPreview, setOcrPreview] = useState<ContractOcrPreview | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isScanningTerms, setIsScanningTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);
  const preserveUploadedFileRef = useRef(false);

  const currentFileLabel = useMemo(() => {
    if (uploadedFile) {
      const size = getHumanFileSize(uploadedFile.size);
      return size ? `${uploadedFile.name} (${size})` : uploadedFile.name;
    }

    if (!contract?.file_name) {
      return null;
    }

    const size = getHumanFileSize(contract.file_size);
    return size ? `${contract.file_name} (${size})` : contract.file_name;
  }, [contract?.file_name, contract?.file_size, uploadedFile]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setForm(getInitialFormState(contract));
    setUploadedFile(null);
    setOcrPreview(null);
    setOcrError(null);
    setIsPreparing(false);
    setIsScanningTerms(false);
    setIsSubmitting(false);
    setFileInputKey((current) => current + 1);
    preserveUploadedFileRef.current = false;
  }, [contract, open]);

  const setValue = <K extends keyof ContractFormState>(key: K, value: ContractFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const applyDetectedFields = (preview: ContractOcrPreview | null, fileMeta: UploadedContractFile) => {
    setForm((current) => ({
      ...current,
      contractLabel:
        preview?.extractedSignals.contractLabel ||
        current.contractLabel ||
        deriveContractLabel(fileMeta.name),
      toolName: preview?.extractedSignals.toolName ?? current.toolName,
      vendorName: preview?.extractedSignals.vendorName ?? current.vendorName,
      startDate: preview?.extractedSignals.startDate ?? current.startDate,
      endDate: preview?.extractedSignals.endDate ?? current.endDate,
      renewalType:
        preview?.extractedSignals.renewalType && preview.extractedSignals.renewalType !== "none"
          ? preview.extractedSignals.renewalType
          : current.renewalType,
      renewalPeriodMonths:
        mode === "edit" &&
        preview?.extractedSignals.renewalPeriodMonths !== null &&
        preview?.extractedSignals.renewalPeriodMonths !== undefined
          ? String(preview.extractedSignals.renewalPeriodMonths)
          : current.renewalPeriodMonths,
      renewalNoticeDays:
        mode === "edit" &&
        preview?.extractedSignals.renewalNoticeDays !== null &&
        preview?.extractedSignals.renewalNoticeDays !== undefined
          ? String(preview.extractedSignals.renewalNoticeDays)
          : current.renewalNoticeDays,
    }));
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      const filePathToCleanup =
        uploadedFile && !preserveUploadedFileRef.current ? uploadedFile.path : null;

      setForm(getInitialFormState(contract));
      setUploadedFile(null);
      setOcrPreview(null);
      setOcrError(null);
      setIsPreparing(false);
      setIsScanningTerms(false);
      setIsSubmitting(false);
      setFileInputKey((current) => current + 1);
      preserveUploadedFileRef.current = false;
      onOpenChange(false);

      if (filePathToCleanup) {
        void onRemoveUploadedFile(filePathToCleanup);
      }

      return;
    }

    onOpenChange(nextOpen);
  };

  const handleFileSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) {
      return;
    }

    const previousUploadedPath = uploadedFile?.path;

    if (previousUploadedPath) {
      void onRemoveUploadedFile(previousUploadedPath);
    }

    setIsPreparing(true);
    setOcrError(null);
    setOcrPreview(null);
    setUploadedFile(null);

    const result = await onPrepareFile(selectedFile);

    if (!result) {
      setIsPreparing(false);
      return;
    }

    setUploadedFile(result.uploadedFile);
    setOcrPreview(result.ocrPreview);
    setOcrError(result.error);
    applyDetectedFields(result.ocrPreview, result.uploadedFile);
    setIsPreparing(false);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    const success = await onSubmit({
      contract_label: form.contractLabel,
      tool_name: form.toolName,
      vendor_name: form.vendorName,
      status: form.status,
      source_url: form.sourceUrl,
      start_date: form.startDate || null,
      end_date: form.endDate || null,
      renewal_type: form.renewalType,
      renewal_period_months: mode === "edit" ? parseOptionalInteger(form.renewalPeriodMonths) : null,
      renewal_notice_days: mode === "edit" ? parseOptionalInteger(form.renewalNoticeDays) : null,
      ocr_model: DEFAULT_OCR_MODEL,
      ocr_status: uploadedFile ? (ocrPreview ? "completed" : "failed") : contract?.ocr_status ?? "queued",
      ocr_extracted_text: ocrPreview?.markdownText ?? null,
      ocr_extracted_fields: ocrPreview?.extractedFields ?? null,
      terms_status: form.termsStatus,
      terms_url: form.termsUrl,
      terms_summary: form.termsSummary,
      notes: form.notes,
      uploadedFile,
    });

    setIsSubmitting(false);

    if (success) {
      preserveUploadedFileRef.current = true;
      handleClose(false);
    }
  };

  const handleTermsScan = useCallback(async () => {
    if (mode !== "edit" || !contract?.id || !onRunTermsScan || isScanningTerms) {
      return;
    }

    setIsScanningTerms(true);
    setForm((current) => ({ ...current, termsStatus: "reviewing" }));

    const success = await onRunTermsScan(contract.id);

    if (!success) {
      setForm((current) => ({
        ...current,
        termsStatus: contract.terms_status ?? current.termsStatus,
      }));
    }

    setIsScanningTerms(false);
  }, [contract?.id, contract?.terms_status, isScanningTerms, mode, onRunTermsScan]);

  useEffect(() => {
    if (
      mode !== "edit" ||
      !open ||
      !contract?.id ||
      !onRunTermsScan ||
      !autoStartTermsScan ||
      isScanningTerms
    ) {
      return;
    }

    onAutoStartTermsConsumed?.();
    void handleTermsScan();
  }, [autoStartTermsScan, contract?.id, handleTermsScan, isScanningTerms, mode, onAutoStartTermsConsumed, onRunTermsScan, open]);

  const renderUploadStep = () => (
    <div className="space-y-6">
      <Alert className="border-primary/20 bg-primary/5">
        <Sparkles className="h-4 w-4 text-primary" />
        <AlertTitle>Upload d'abord, detection ensuite</AlertTitle>
        <AlertDescription>
          Ajoute le fichier du contrat. L'OCR Mistral analyse le document puis pre-remplit les champs detectes.
        </AlertDescription>
      </Alert>

      <div className="rounded-2xl border border-dashed border-primary/25 bg-primary/5 p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          {isPreparing ? <Loader2 className="h-7 w-7 animate-spin" /> : <FileUp className="h-7 w-7" />}
        </div>
        <h3 className="font-display text-xl font-semibold text-foreground">
          {isPreparing ? "Analyse du contrat en cours" : "Uploader un contrat"}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          PDF, DOC, DOCX, image ou texte. Une fois le fichier choisi, les dates detectees apparaissent automatiquement.
        </p>

        <div className="mt-6">
          <Input
            key={fileInputKey}
            type="file"
            accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
            onChange={handleFileSelection}
            disabled={isPreparing}
          />
        </div>

        {ocrError && (
          <Alert className="mt-6 border-warning/30 bg-warning/5 text-left">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <AlertTitle>Analyse partielle</AlertTitle>
            <AlertDescription>
              {ocrError}. Tu peux continuer en saisie manuelle si besoin.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );

  const shouldShowForm = mode === "edit" || !!uploadedFile;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[820px] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {mode === "create" ? "Ajouter un contrat" : "Mettre a jour le contrat"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Etape 1 sur 2. Scanne le document et valide les informations du contrat. L'etape 2 CGV / CGU s'ouvrira juste apres l'enregistrement."
              : "Etape 2. Mets a jour le contrat, ou lance l'extraction CGV / CGU pour trouver les sources web."}
          </DialogDescription>
        </DialogHeader>

        {!shouldShowForm ? (
          <>
            {renderUploadStep()}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleClose(false)}>
                Annuler
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Document courant</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {currentFileLabel || "Aucun document"}
                  </p>
                </div>
                <div className="w-full lg:w-[320px]">
                  <Input
                    key={fileInputKey}
                    type="file"
                    accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
                    onChange={handleFileSelection}
                    disabled={isPreparing}
                  />
                </div>
              </div>
            </div>

            {isPreparing && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-foreground">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Analyse OCR en cours, les champs vont se remplir automatiquement.
                </div>
              </div>
            )}

            {ocrError && (
              <Alert className="border-warning/30 bg-warning/5">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <AlertTitle>OCR a verifier</AlertTitle>
                <AlertDescription>{ocrError}</AlertDescription>
              </Alert>
            )}

            {mode === "edit" && contract?.id && onRunTermsScan && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">Etape 2: extraction CGV / CGU</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Lance la recherche web pour trouver le site officiel, la bonne page juridique et remplir
                      automatiquement les URL et le resume.
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleTermsScan}
                    disabled={isScanningTerms || form.termsStatus === "reviewing"}
                  >
                    {(isScanningTerms || form.termsStatus === "reviewing") && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    {isScanningTerms || form.termsStatus === "reviewing"
                      ? "Recherche CGV en cours"
                      : "Extraire CGV / CGU"}
                  </Button>
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contractLabel">Nom du contrat</Label>
                <Input
                  id="contractLabel"
                  placeholder="Ex: Contrat HubSpot 2026"
                  value={form.contractLabel}
                  onChange={(event) => setValue("contractLabel", event.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="toolName">Outil concerne</Label>
                <Input
                  id="toolName"
                  placeholder="Ex: HubSpot"
                  value={form.toolName}
                  onChange={(event) => setValue("toolName", event.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vendorName">Fournisseur</Label>
                <Input
                  id="vendorName"
                  placeholder="Ex: HubSpot Inc."
                  value={form.vendorName}
                  onChange={(event) => setValue("vendorName", event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Statut du contrat</Label>
                <Select value={form.status} onValueChange={(value: ContractStatus) => setValue("status", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un statut" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTRACT_STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {mode === "edit" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sourceUrl">URL du site ou de la fiche outil</Label>
                  <Input
                    id="sourceUrl"
                    placeholder="https://www.example.com"
                    value={form.sourceUrl}
                    onChange={(event) => setValue("sourceUrl", event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="termsUrl">URL des CGV / CGU</Label>
                  <Input
                    id="termsUrl"
                    placeholder="https://www.example.com/terms"
                    value={form.termsUrl}
                    onChange={(event) => setValue("termsUrl", event.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="startDate">Date de debut</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={form.startDate}
                  onChange={(event) => setValue("startDate", event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">Date de fin</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={form.endDate}
                  onChange={(event) => setValue("endDate", event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Type de reconduction</Label>
                <Select value={form.renewalType} onValueChange={(value: ContractRenewalType) => setValue("renewalType", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTRACT_RENEWAL_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {mode === "edit" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Statut recherche CGV / CGU</Label>
                  <Select value={form.termsStatus} onValueChange={(value: ContractTermsStatus) => setValue("termsStatus", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir" />
                    </SelectTrigger>
                    <SelectContent>
                      {TERMS_STATUS_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="termsSummary">Resume CGV / CGU</Label>
                  <Textarea
                    id="termsSummary"
                    rows={3}
                    placeholder="Ex: reconduction tacite annuelle, resiliation 60 jours avant echeance..."
                    value={form.termsSummary}
                    onChange={(event) => setValue("termsSummary", event.target.value)}
                  />
                </div>
              </div>
            )}

            {mode === "edit" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="renewalPeriodMonths">Periode de reconduction (mois)</Label>
                  <Input
                    id="renewalPeriodMonths"
                    inputMode="numeric"
                    placeholder="12"
                    value={form.renewalPeriodMonths}
                    onChange={(event) => setValue("renewalPeriodMonths", event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="renewalNoticeDays">Preavis avant reconduction (jours)</Label>
                  <Input
                    id="renewalNoticeDays"
                    inputMode="numeric"
                    placeholder="30"
                    value={form.renewalNoticeDays}
                    onChange={(event) => setValue("renewalNoticeDays", event.target.value)}
                  />
                </div>
              </div>
            )}

            {mode === "create" && (
              <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                Etape 2 se lancera juste apres la sauvegarde dans cette meme sequence, avec recherche du site officiel, de la bonne page juridique et remplissage des URL.
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">Notes internes</Label>
              <Textarea
                id="notes"
                rows={4}
                placeholder="Points d'attention, clauses sensibles, prochaines actions..."
                value={form.notes}
                onChange={(event) => setValue("notes", event.target.value)}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleClose(false)}>
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={
                  isSubmitting ||
                  isPreparing ||
                  (mode === "create" && !uploadedFile) ||
                  !form.contractLabel.trim() ||
                  !form.toolName.trim()
                }
              >
                {isSubmitting
                  ? "Enregistrement..."
                  : mode === "create"
                    ? "Enregistrer et continuer"
                    : "Mettre a jour"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
