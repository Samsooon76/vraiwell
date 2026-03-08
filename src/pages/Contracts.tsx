import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Clock,
  ExternalLink,
  FileCheck,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Repeat,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { ContractModal } from "@/components/modals/ContractModal";
import { ConfirmModal } from "@/components/modals/ConfirmModal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useContracts } from "@/hooks/useContracts";
import {
  formatContractDate,
  getContractStatusBadgeClass,
  getContractStatusLabel,
  getDaysUntil,
  getOcrStatusBadgeClass,
  getOcrStatusLabel,
  getRenewalSummary,
  getTermsStatusBadgeClass,
  getTermsStatusLabel,
  isOcrPending,
  isTermsPending,
} from "@/lib/contracts";
import { Contract } from "@/types/contracts";

type ContractsFilter = "all" | "expiring" | "ocr" | "terms";

export default function Contracts() {
  const {
    contracts,
    isLoading,
    error,
    refetch,
    prepareContractFile,
    cleanupUploadedContractFile,
    createContract,
    updateContract,
    deleteContract,
    runContractOcr,
    runContractTermsScan,
    openContractFile,
  } = useContracts();

  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<ContractsFilter>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [createdContractForFollowup, setCreatedContractForFollowup] = useState<Contract | null>(null);
  const [autoStartTermsContractId, setAutoStartTermsContractId] = useState<string | null>(null);
  const [contractToDelete, setContractToDelete] = useState<Contract | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!editingContract) {
      return;
    }

    const freshContract = contracts.find((contract) => contract.id === editingContract.id);

    if (!freshContract) {
      setEditingContract(null);
      return;
    }

    if (freshContract !== editingContract) {
      setEditingContract(freshContract);
    }
  }, [contracts, editingContract]);

  useEffect(() => {
    if (createOpen || !createdContractForFollowup) {
      return;
    }

    setEditingContract(createdContractForFollowup);
    setAutoStartTermsContractId(createdContractForFollowup.id);
    setCreatedContractForFollowup(null);
  }, [createOpen, createdContractForFollowup]);

  const filteredContracts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return contracts.filter((contract) => {
      const matchesSearch =
        query.length === 0 ||
        [
          contract.contract_label,
          contract.tool_name,
          contract.vendor_name,
          contract.notes,
          contract.terms_summary,
        ]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(query));

      if (!matchesSearch) {
        return false;
      }

      if (filter === "ocr") {
        return isOcrPending(contract.ocr_status);
      }

      if (filter === "terms") {
        return isTermsPending(contract.terms_status);
      }

      if (filter === "expiring") {
        const remainingDays = getDaysUntil(contract.notice_deadline ?? contract.end_date);
        return remainingDays !== null && remainingDays >= 0 && remainingDays <= 60;
      }

      return true;
    });
  }, [contracts, filter, searchQuery]);

  const expiringSoonCount = useMemo(() => {
    return contracts.filter((contract) => {
      const remainingDays = getDaysUntil(contract.notice_deadline ?? contract.end_date);
      return remainingDays !== null && remainingDays >= 0 && remainingDays <= 60;
    }).length;
  }, [contracts]);

  const tacitRenewalCount = contracts.filter((contract) => contract.renewal_type === "tacit").length;
  const pendingOcrCount = contracts.filter((contract) => isOcrPending(contract.ocr_status)).length;

  const handleDelete = async () => {
    if (!contractToDelete) {
      return;
    }

    setIsDeleting(true);
    const success = await deleteContract(contractToDelete);
    setIsDeleting(false);

    if (success) {
      setContractToDelete(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
        >
          <div>
            <h1 className="font-display text-display-md text-foreground">Contrats</h1>
            <p className="mt-1 text-body-md text-muted-foreground">
              Centralise les contrats, les echeances et la reconduction tacite de tes outils.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
              Actualiser
            </Button>
            <Button variant="hero" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Ajouter un contrat
            </Button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          <StatsCard
            title="Contrats suivis"
            value={contracts.length}
            subtitle="documents et metadonnees"
            icon={FileCheck}
            variant="primary"
          />
          <StatsCard
            title="Echeances < 60 j"
            value={expiringSoonCount}
            subtitle="preavis ou fin de contrat"
            icon={Clock}
            variant="warning"
          />
          <StatsCard
            title="Reconductions tacites"
            value={tacitRenewalCount}
            subtitle="contrats a surveiller"
            icon={Repeat}
            variant="success"
          />
          <StatsCard
            title="OCR en attente"
            value={pendingOcrCount}
            subtitle="analyse ou verification"
            icon={Sparkles}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-6"
        >
            <Alert className="border-primary/20 bg-primary/5">
              <Sparkles className="h-4 w-4 text-primary" />
              <AlertTitle>Workflow en 2 etapes</AlertTitle>
              <AlertDescription>
              Etape 1: ajoute le contrat et laisse l'OCR remplir les informations du document. Etape 2:
              juste apres l'enregistrement, la modale enchaine sur l'extraction CGV / CGU pour trouver le
              site officiel, la bonne page juridique et renseigner les URL.
              </AlertDescription>
            </Alert>
          </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-6 flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-card lg:flex-row lg:items-center lg:justify-between"
        >
          <div className="relative flex-1 lg:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher un contrat, un outil ou une note..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { value: "all" as const, label: "Tous", count: contracts.length },
              { value: "expiring" as const, label: "Echeances", count: expiringSoonCount },
              { value: "ocr" as const, label: "OCR", count: pendingOcrCount },
              {
                value: "terms" as const,
                label: "CGV / CGU",
                count: contracts.filter((contract) => isTermsPending(contract.terms_status)).length,
              },
            ].map((item) => (
              <button
                key={item.value}
                onClick={() => setFilter(item.value)}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  filter === item.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {item.label}
                <span className="rounded-full bg-background/20 px-2 py-0.5 text-xs">{item.count}</span>
              </button>
            ))}
          </div>
        </motion.div>

        {error && (
          <div className="mb-4 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && filteredContracts.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-xl border border-dashed border-border bg-card p-12 text-center shadow-card"
          >
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <FileCheck className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="font-display text-lg font-semibold text-foreground">Aucun contrat pour ce filtre</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Ajoute un premier contrat pour suivre les dates de fin, les preavis et la reconduction tacite.
            </p>
            <Button className="mt-6" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Ajouter un contrat
            </Button>
          </motion.div>
        )}

        {!isLoading && filteredContracts.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="grid gap-4"
          >
            {filteredContracts.map((contract, index) => {
              const timelineDays = getDaysUntil(contract.notice_deadline ?? contract.end_date);
              const isLate = timelineDays !== null && timelineDays < 0;
              const isSoon = timelineDays !== null && timelineDays >= 0 && timelineDays <= 60;

              return (
                <motion.div
                  key={contract.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.04 * index }}
                  className={`rounded-xl border bg-card p-6 shadow-card transition-all duration-200 hover:shadow-card-hover ${
                    isLate
                      ? "border-destructive/30"
                      : isSoon
                        ? "border-warning/30"
                        : "border-border"
                  }`}
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate font-display text-xl font-semibold text-foreground">
                              {contract.contract_label}
                            </h3>
                            <Badge className={getContractStatusBadgeClass(contract.status)}>
                              {getContractStatusLabel(contract.status)}
                            </Badge>
                            <Badge className={getOcrStatusBadgeClass(contract.ocr_status)}>
                              OCR: {getOcrStatusLabel(contract.ocr_status)}
                            </Badge>
                            <Badge className={getTermsStatusBadgeClass(contract.terms_status)}>
                              CGV: {getTermsStatusLabel(contract.terms_status)}
                            </Badge>
                          </div>

                          <p className="mt-2 text-sm text-muted-foreground">
                            {contract.tool_name}
                            {contract.vendor_name ? ` - ${contract.vendor_name}` : ""}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openContractFile(contract)}
                            disabled={!contract.file_path}
                          >
                            <ExternalLink className="h-4 w-4" />
                            Ouvrir
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => runContractOcr(contract.id)}
                            disabled={!contract.file_path}
                          >
                            <Sparkles className="h-4 w-4" />
                            Lancer OCR
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => runContractTermsScan(contract.id)}
                            disabled={contract.terms_status === "reviewing"}
                          >
                            <Search className="h-4 w-4" />
                            {contract.terms_status === "reviewing" ? "Recherche CGV en cours" : "Extraire CGV / CGU"}
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setEditingContract(contract)}>
                            <Pencil className="h-4 w-4" />
                            Modifier
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setContractToDelete(contract)}
                          >
                            <Trash2 className="h-4 w-4" />
                            Supprimer
                          </Button>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-lg bg-muted/40 p-4">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Fin de contrat
                          </p>
                          <p className="mt-2 text-base font-semibold text-foreground">
                            {formatContractDate(contract.end_date)}
                          </p>
                        </div>

                        <div className="rounded-lg bg-muted/40 p-4">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Date de preavis
                          </p>
                          <p className="mt-2 text-base font-semibold text-foreground">
                            {formatContractDate(contract.notice_deadline)}
                          </p>
                        </div>

                        <div className="rounded-lg bg-muted/40 p-4">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Reconduction
                          </p>
                          <p className="mt-2 text-base font-semibold text-foreground">
                            {getRenewalSummary(contract)}
                          </p>
                        </div>

                        <div className="rounded-lg bg-muted/40 p-4">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Action a venir
                          </p>
                          <p className="mt-2 text-base font-semibold text-foreground">
                            {timelineDays === null
                              ? "Aucune date"
                              : isLate
                                ? `Depasse de ${Math.abs(timelineDays)} j`
                                : `Dans ${timelineDays} j`}
                          </p>
                        </div>
                      </div>

                      {(contract.terms_summary || contract.notes || contract.terms_url || contract.source_url) && (
                        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
                          <div className="rounded-lg border border-border bg-background p-4">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Synthese
                            </p>
                            <p className="mt-2 text-sm leading-6 text-foreground">
                              {contract.terms_summary || contract.notes || "Aucune note pour ce contrat."}
                            </p>
                          </div>

                          <div className="rounded-lg border border-border bg-background p-4 text-sm">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Sources
                            </p>
                            <div className="mt-3 space-y-2">
                              {contract.terms_url && (
                                <a
                                  href={contract.terms_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-2 text-primary hover:underline"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                  Ouvrir les CGV / CGU
                                </a>
                              )}
                              {contract.source_url && (
                                <a
                                  href={contract.source_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-2 text-primary hover:underline"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                  Ouvrir la fiche outil
                                </a>
                              )}
                              {!contract.terms_url && !contract.source_url && (
                                <p className="text-muted-foreground">Aucune source rattachee.</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        <ContractModal
          open={createOpen}
          onOpenChange={setCreateOpen}
          mode="create"
          onSubmit={async (input) => {
            const createdContract = await createContract(input);

            if (!createdContract) {
              return false;
            }

            setCreatedContractForFollowup(createdContract);
            return true;
          }}
          onPrepareFile={prepareContractFile}
          onRemoveUploadedFile={cleanupUploadedContractFile}
        />

        <ContractModal
          open={!!editingContract}
          onOpenChange={(open) => {
            if (!open) {
              setEditingContract(null);
            }
          }}
          mode="edit"
          contract={editingContract}
          onPrepareFile={prepareContractFile}
          onRemoveUploadedFile={cleanupUploadedContractFile}
          onRunTermsScan={runContractTermsScan}
          autoStartTermsScan={editingContract?.id === autoStartTermsContractId}
          onAutoStartTermsConsumed={() => setAutoStartTermsContractId(null)}
          onSubmit={(input) => {
            if (!editingContract) {
              return Promise.resolve(false);
            }

            return updateContract(editingContract.id, input, editingContract.file_path);
          }}
        />

        <ConfirmModal
          open={!!contractToDelete}
          onOpenChange={(open) => {
            if (!open) {
              setContractToDelete(null);
            }
          }}
          title="Supprimer ce contrat ?"
          description="Le fichier associe et toutes les metadonnees seront supprimes."
          confirmText="Supprimer"
          variant="destructive"
          onConfirm={handleDelete}
          isLoading={isDeleting}
        />
      </div>
    </DashboardLayout>
  );
}
