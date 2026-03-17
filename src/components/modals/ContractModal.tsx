import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
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
import type { Team } from "@/hooks/useTeams";
import {
  CONTRACT_RENEWAL_OPTIONS,
  CONTRACT_STATUS_OPTIONS,
  DEFAULT_OCR_MODEL,
  deriveContractEndDate,
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
import { AlertTriangle, Check, FileSearch, FileUp, Globe, Loader2, Sparkles } from "lucide-react";

const TERMS_SCAN_STEP_DURATION_MS = 10000;
const NO_TEAM_VALUE = "__no_team__";

interface ContractModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  contract?: Contract | null;
  teams: Team[];
  isTeamsLoading?: boolean;
  onSubmit: (input: ContractUpsertInput) => Promise<boolean>;
  onPrepareFile: (file: File) => Promise<PreparedContractFileResult | null>;
  onRemoveUploadedFile: (path: string) => Promise<void>;
  isTermsScanInProgress?: boolean;
}

interface ContractFormState {
  contractLabel: string;
  toolName: string;
  vendorName: string;
  teamId: string;
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
    teamId: contract?.team_id ?? "",
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

function resolveDetectedEndDate(
  detectedEndDate: string | null | undefined,
  detectedStartDate: string | null | undefined,
  detectedRenewalPeriodMonths: number | null | undefined,
  currentEndDate: string,
) {
  if (detectedEndDate) {
    return detectedEndDate;
  }

  if (currentEndDate) {
    return currentEndDate;
  }

  return deriveContractEndDate(detectedStartDate, detectedRenewalPeriodMonths) ?? currentEndDate;
}

export function ContractModal({
  open,
  onOpenChange,
  mode,
  contract,
  teams,
  isTeamsLoading = false,
  onSubmit,
  onPrepareFile,
  onRemoveUploadedFile,
  isTermsScanInProgress = false,
}: ContractModalProps) {
  const [form, setForm] = useState<ContractFormState>(getInitialFormState(contract));
  const [uploadedFile, setUploadedFile] = useState<UploadedContractFile | null>(null);
  const [ocrPreview, setOcrPreview] = useState<ContractOcrPreview | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [termsScanStepIndex, setTermsScanStepIndex] = useState(0);
  const [fileInputKey, setFileInputKey] = useState(0);
  const preserveUploadedFileRef = useRef(false);
  const isTermsScanActive = isTermsScanInProgress;
  const showTermsResult = mode === "edit" && !isTermsScanActive && form.termsStatus === "completed";
  const showTermsFailure = mode === "edit" && !isTermsScanActive && form.termsStatus === "failed";

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

  const termsDebugLines = useMemo(() => {
    if (form.termsStatus !== "failed") {
      return [];
    }

    return (form.termsSummary ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }, [form.termsStatus, form.termsSummary]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setForm(getInitialFormState(contract));
    setUploadedFile(null);
    setOcrPreview(null);
    setOcrError(null);
    setIsPreparing(false);
    setIsSubmitting(false);
    setTermsScanStepIndex(0);
    setFileInputKey((current) => current + 1);
    preserveUploadedFileRef.current = false;
  }, [contract, open]);

  useEffect(() => {
    if (!open || mode !== "edit" || !contract) {
      return;
    }

    setForm((current) => ({
      ...current,
      teamId: contract?.team_id ?? current.teamId,
      termsStatus: contract.terms_status ?? current.termsStatus,
      sourceUrl: contract.source_url ?? current.sourceUrl,
      termsUrl: contract.terms_url ?? current.termsUrl,
      termsSummary: contract.terms_summary ?? current.termsSummary,
      renewalType: contract.renewal_type ?? current.renewalType,
      renewalPeriodMonths: contract.renewal_period_months?.toString() ?? current.renewalPeriodMonths,
      renewalNoticeDays: contract.renewal_notice_days?.toString() ?? current.renewalNoticeDays,
    }));
  }, [
    contract?.renewal_notice_days,
    contract?.renewal_period_months,
    contract?.renewal_type,
    contract?.source_url,
    contract?.team_id,
    contract?.terms_status,
    contract?.terms_summary,
    contract?.terms_url,
    contract,
    mode,
    open,
  ]);

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
      endDate: resolveDetectedEndDate(
        preview?.extractedSignals.endDate,
        preview?.extractedSignals.startDate ?? current.startDate,
        preview?.extractedSignals.renewalPeriodMonths,
        current.endDate,
      ),
      renewalType:
        preview?.extractedSignals.renewalType && preview.extractedSignals.renewalType !== "none"
          ? preview.extractedSignals.renewalType
          : current.renewalType,
      renewalPeriodMonths:
        preview?.extractedSignals.renewalPeriodMonths !== null &&
        preview?.extractedSignals.renewalPeriodMonths !== undefined
          ? String(preview.extractedSignals.renewalPeriodMonths)
          : current.renewalPeriodMonths,
      renewalNoticeDays:
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
      setIsSubmitting(false);
      setTermsScanStepIndex(0);
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
      team_id: form.teamId || null,
      status: form.status,
      source_url: form.sourceUrl,
      start_date: form.startDate || null,
      end_date: form.endDate || deriveContractEndDate(form.startDate, parseOptionalInteger(form.renewalPeriodMonths)),
      renewal_type: form.renewalType,
      renewal_period_months: parseOptionalInteger(form.renewalPeriodMonths),
      renewal_notice_days: parseOptionalInteger(form.renewalNoticeDays),
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

  useEffect(() => {
    if (!open || mode !== "edit") {
      return;
    }

    if (isTermsScanInProgress) {
      setTermsScanStepIndex(0);
      setForm((current) => ({ ...current, termsStatus: "reviewing" }));
    }
  }, [isTermsScanInProgress, mode, open]);

  useEffect(() => {
    if (!isTermsScanActive) {
      return;
    }

    const interval = window.setInterval(() => {
      setTermsScanStepIndex((current) => Math.min(current + 1, 2));
    }, TERMS_SCAN_STEP_DURATION_MS);

    return () => window.clearInterval(interval);
  }, [isTermsScanActive]);

  const renderUploadStep = () => (
    <div className="space-y-6">
      <Alert className="border-primary/20 bg-primary/5">
        <Sparkles className="h-4 w-4 text-primary" />
        <AlertTitle>Analyse automatique du document</AlertTitle>
        <AlertDescription>
          Ajoute le fichier du contrat pour detecter automatiquement les dates et informations utiles.
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
  const termsScanSteps = [
    { label: "Recherche des sites officiels", icon: Globe },
    { label: "Extraction des donnees juridiques", icon: FileSearch },
    { label: "Mise en forme des informations", icon: Sparkles },
  ];
  const termsResultItems = [
    form.sourceUrl ? { label: "Site officiel", value: form.sourceUrl } : null,
    form.termsUrl ? { label: "Page CGV / CGU", value: form.termsUrl } : null,
    form.renewalPeriodMonths ? { label: "Reconduction", value: `${form.renewalPeriodMonths} mois` } : null,
    form.renewalNoticeDays ? { label: "Preavis", value: `${form.renewalNoticeDays} jours` } : null,
  ].filter((item): item is { label: string; value: string } => Boolean(item));

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[820px] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {mode === "create" ? "Ajouter un contrat" : "Mettre a jour le contrat"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Ajoute un document pour pre-remplir automatiquement les informations detectees."
              : "Mets a jour le contrat et verifie les informations detectees."}
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

            {mode === "edit" && isTermsScanActive && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-start gap-3">
                  <Loader2 className="mt-0.5 h-4 w-4 animate-spin text-primary" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Extraction CGV / CGU en cours</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      La recherche se lance automatiquement apres la sauvegarde du contrat.
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {termsScanSteps.map((step, index) => {
                    const Icon = step.icon;
                    const isCompleted = index < termsScanStepIndex;
                    const isCurrent = index === termsScanStepIndex;

                    return (
                      <div
                        key={step.label}
                        className={`rounded-lg border px-3 py-3 text-sm transition-colors ${
                          isCurrent
                            ? "border-primary/40 bg-background text-foreground"
                            : isCompleted
                              ? "border-primary/20 bg-background/80 text-foreground"
                              : "border-border/60 bg-background/40 text-muted-foreground"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {isCompleted ? (
                            <Check className="h-4 w-4 text-primary" />
                          ) : isCurrent ? (
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          ) : (
                            <Icon className="h-4 w-4" />
                          )}
                          <span className={isCurrent ? "animate-pulse" : ""}>{step.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {showTermsResult && (
              <div className="rounded-xl border border-success/20 bg-success/5 p-4">
                <div className="flex items-start gap-3">
                  <Check className="mt-0.5 h-4 w-4 text-success" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Extraction CGV / CGU terminee</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Les informations juridiques detectees ont ete ajoutees au contrat.
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {termsScanSteps.map((step) => (
                    <div
                      key={step.label}
                      className="rounded-lg border border-success/20 bg-background/90 px-3 py-3 text-sm text-foreground"
                    >
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-success" />
                        <span>{step.label}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {termsResultItems.length > 0 && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {termsResultItems.map((item) => (
                      <div key={item.label} className="rounded-lg border border-border/70 bg-background/80 p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.label}</p>
                        <p className="mt-1 break-all text-sm text-foreground">{item.value}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {showTermsFailure && (
              <Alert className="border-warning/30 bg-warning/5">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <AlertTitle>Extraction CGV / CGU incomplete</AlertTitle>
                <AlertDescription>
                  Aucune page juridique suffisamment fiable n'a ete confirmee automatiquement. Verifie les URL et les
                  donnees detectees avant validation.
                  {termsDebugLines.length > 0 && (
                    <div className="mt-4 rounded-lg border border-warning/20 bg-background/80 p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Debug</p>
                      <div className="mt-2 space-y-1 text-sm text-foreground">
                        {termsDebugLines.map((line) => (
                          <p key={line}>{line}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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

              <div className="space-y-2">
                <Label>Equipe rattachee</Label>
                <Select
                  value={form.teamId || NO_TEAM_VALUE}
                  onValueChange={(value) => setValue("teamId", value === NO_TEAM_VALUE ? "" : value)}
                  disabled={isTeamsLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir une equipe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_TEAM_VALUE}>Sans equipe</SelectItem>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
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
              <div className="space-y-2">
                <Label htmlFor="termsSummary">Synthese CGV / CGU et points de vigilance</Label>
                <Textarea
                  id="termsSummary"
                  rows={4}
                  placeholder="Ex: reconduction tacite annuelle, resiliation 30 jours avant echeance, attention a l'absence de remboursement..."
                  value={form.termsSummary}
                  onChange={(event) => setValue("termsSummary", event.target.value)}
                />
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
