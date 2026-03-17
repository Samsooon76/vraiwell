import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Clock,
  Copy,
  ExternalLink,
  FileCheck,
  Loader2,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Repeat,
  Search,
  Trash2,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { ContractModal } from "@/components/modals/ContractModal";
import { ConfirmModal } from "@/components/modals/ConfirmModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useContracts } from "@/hooks/useContracts";
import { useTeams } from "@/hooks/useTeams";
import {
  formatContractDate,
  getContractStatusBadgeClass,
  getContractStatusLabel,
  getDaysUntil,
  getRenewalSummary,
  getTermsStatusBadgeClass,
  getTermsStatusLabel,
} from "@/lib/contracts";
import { Contract } from "@/types/contracts";
import { toast } from "sonner";

type ContractsFilter = "all" | "expiring90" | "tacit" | "nonTacit";

const ALL_TEAMS_FILTER_VALUE = "__all_teams__";

function isContractWithinDays(contract: Contract, maxDays: number) {
  const remainingDays = getDaysUntil(contract.notice_deadline ?? contract.end_date);
  return remainingDays !== null && remainingDays >= 0 && remainingDays <= maxDays;
}

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
    runContractTermsScan,
    generateNonRenewalEmail,
    openContractFile,
  } = useContracts();
  const { teams, isLoading: isTeamsLoading } = useTeams();

  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<ContractsFilter>("all");
  const [teamFilter, setTeamFilter] = useState(ALL_TEAMS_FILTER_VALUE);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [createdContractForFollowup, setCreatedContractForFollowup] = useState<Contract | null>(null);
  const [autoStartTermsContractId, setAutoStartTermsContractId] = useState<string | null>(null);
  const [activeTermsScanContractId, setActiveTermsScanContractId] = useState<string | null>(null);
  const [contractToDelete, setContractToDelete] = useState<Contract | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeEmailGenerationContractId, setActiveEmailGenerationContractId] = useState<string | null>(null);
  const [emailDraftContract, setEmailDraftContract] = useState<Contract | null>(null);
  const [emailDraft, setEmailDraft] = useState<{ subject: string; body: string } | null>(null);

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

  const launchTermsScan = useCallback((contract: Contract, options?: { openModal?: boolean; silent?: boolean }) => {
    if (options?.openModal) {
      setEditingContract(contract);
    }

    setActiveTermsScanContractId(contract.id);
    void runContractTermsScan(contract.id, { silent: options?.silent }).finally(() => {
      setActiveTermsScanContractId((current) => (current === contract.id ? null : current));
    });
  }, [runContractTermsScan]);

  useEffect(() => {
    if (!editingContract || autoStartTermsContractId !== editingContract.id) {
      return;
    }

    setAutoStartTermsContractId(null);
    launchTermsScan(editingContract, { silent: true });
  }, [autoStartTermsContractId, editingContract, launchTermsScan]);

  useEffect(() => {
    if (!activeTermsScanContractId) {
      return;
    }

    const currentContract = contracts.find((contract) => contract.id === activeTermsScanContractId);
    if (!currentContract) {
      setActiveTermsScanContractId(null);
      return;
    }

    if (currentContract.terms_status !== "reviewing") {
      setActiveTermsScanContractId(null);
    }
  }, [activeTermsScanContractId, contracts]);

  const teamsById = useMemo(
    () => new Map(teams.map((team) => [team.id, team])),
    [teams],
  );

  const filteredContracts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const selectedTeamId = teamFilter === ALL_TEAMS_FILTER_VALUE ? null : teamFilter;

    return contracts.filter((contract) => {
      const teamName = contract.team_id ? teamsById.get(contract.team_id)?.name ?? "" : "";
      const matchesSearch =
        query.length === 0 ||
        [
          contract.contract_label,
          contract.tool_name,
          contract.vendor_name,
          teamName,
          contract.notes,
          contract.terms_summary,
        ]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(query));

      if (!matchesSearch) {
        return false;
      }

      if (selectedTeamId && contract.team_id !== selectedTeamId) {
        return false;
      }

      if (filter === "tacit") {
        return contract.renewal_type === "tacit";
      }

      if (filter === "nonTacit") {
        return contract.renewal_type !== "tacit";
      }

      if (filter === "expiring90") {
        return isContractWithinDays(contract, 90);
      }

      return true;
    });
  }, [contracts, filter, searchQuery, teamFilter, teamsById]);

  const expiringSoonCount = useMemo(() => {
    return contracts.filter((contract) => isContractWithinDays(contract, 90)).length;
  }, [contracts]);

  const upcomingActionsCount = useMemo(() => {
    return contracts.filter((contract) => isContractWithinDays(contract, 30)).length;
  }, [contracts]);

  const tacitRenewalCount = contracts.filter((contract) => contract.renewal_type === "tacit").length;
  const nonTacitRenewalCount = contracts.filter((contract) => contract.renewal_type !== "tacit").length;

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

  const handleGenerateEmail = useCallback(async (contract: Contract) => {
    setActiveEmailGenerationContractId(contract.id);
    const draft = await generateNonRenewalEmail(contract.id);
    setActiveEmailGenerationContractId(null);

    if (!draft) {
      return;
    }

    setEmailDraftContract(contract);
    setEmailDraft(draft);
  }, [generateNonRenewalEmail]);

  const handleCopyDraft = useCallback(async () => {
    if (!emailDraft) {
      return;
    }

    try {
      await navigator.clipboard.writeText(`Objet : ${emailDraft.subject}\n\n${emailDraft.body}`);
      toast.success("Mail copie");
    } catch (error) {
      console.error("Error copying email draft:", error);
      toast.error("Impossible de copier le mail");
    }
  }, [emailDraft]);

  const mailtoHref = useMemo(() => {
    if (!emailDraft) {
      return null;
    }

    return `mailto:?subject=${encodeURIComponent(emailDraft.subject)}&body=${encodeURIComponent(emailDraft.body)}`;
  }, [emailDraft]);

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
            title="Echeances < 90 j"
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
            title="Actions < 30 j"
            value={upcomingActionsCount}
            subtitle="actions a preparer"
            icon={Clock}
            variant="default"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-6 flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-card lg:flex-row lg:items-center lg:justify-between"
        >
          <div className="flex flex-1 flex-col gap-4 xl:flex-row xl:items-center">
            <div className="relative flex-1 xl:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher un contrat, un outil ou une note..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="pl-10"
              />
            </div>

            <div className="w-full xl:w-[220px]">
              <Select value={teamFilter} onValueChange={setTeamFilter} disabled={isTeamsLoading}>
                <SelectTrigger>
                  <SelectValue placeholder="Toutes les equipes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_TEAMS_FILTER_VALUE}>Toutes les equipes</SelectItem>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { value: "all" as const, label: "Tous", count: contracts.length },
              { value: "expiring90" as const, label: "Echeance < 90 j", count: expiringSoonCount },
              { value: "tacit" as const, label: "Tacite", count: tacitRenewalCount },
              { value: "nonTacit" as const, label: "Non tacite", count: nonTacitRenewalCount },
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
              const isSoon = timelineDays !== null && timelineDays >= 0 && timelineDays <= 90;
              const team = contract.team_id ? teamsById.get(contract.team_id) : undefined;

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
                            <Badge className={getTermsStatusBadgeClass(contract.terms_status)}>
                              CGV: {getTermsStatusLabel(contract.terms_status)}
                            </Badge>
                            {team && (
                              <Badge className="border-0 bg-muted text-foreground">
                                Equipe: {team.name}
                              </Badge>
                            )}
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
                            onClick={() => launchTermsScan(contract, { openModal: true, silent: true })}
                            disabled={contract.terms_status === "reviewing"}
                          >
                            <Search className="h-4 w-4" />
                            {contract.terms_status === "reviewing" ? "Recherche CGV en cours" : "Extraire CGV / CGU"}
                          </Button>
                          {contract.renewal_type === "tacit" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void handleGenerateEmail(contract)}
                              disabled={activeEmailGenerationContractId === contract.id}
                            >
                              {activeEmailGenerationContractId === contract.id
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : <Mail className="h-4 w-4" />}
                              {activeEmailGenerationContractId === contract.id
                                ? "Generation du mail..."
                                : "Generer le mail"}
                            </Button>
                          )}
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
          teams={teams}
          isTeamsLoading={isTeamsLoading}
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
          teams={teams}
          isTeamsLoading={isTeamsLoading}
          onPrepareFile={prepareContractFile}
          onRemoveUploadedFile={cleanupUploadedContractFile}
          isTermsScanInProgress={
            !!editingContract &&
            (editingContract.id === activeTermsScanContractId || editingContract.terms_status === "reviewing")
          }
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

        <Dialog
          open={!!emailDraftContract && !!emailDraft}
          onOpenChange={(open) => {
            if (!open) {
              setEmailDraftContract(null);
              setEmailDraft(null);
            }
          }}
        >
          <DialogContent className="sm:max-w-[760px]">
            <DialogHeader>
              <DialogTitle className="font-display text-xl">
                Mail de non-reconduction
              </DialogTitle>
              <DialogDescription>
                Brouillon genere pour {emailDraftContract?.contract_label ?? "ce contrat"}.
              </DialogDescription>
            </DialogHeader>

            {emailDraft && (
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Objet</p>
                  <p className="mt-2 text-sm font-medium text-foreground">{emailDraft.subject}</p>
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Corps du mail</p>
                  <Textarea
                    value={emailDraft.body}
                    readOnly
                    className="min-h-[320px] resize-none text-sm leading-6"
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => void handleCopyDraft()} disabled={!emailDraft}>
                <Copy className="h-4 w-4" />
                Copier
              </Button>
              <Button asChild disabled={!mailtoHref}>
                <a href={mailtoHref ?? "#"}>
                  <Mail className="h-4 w-4" />
                  Ouvrir dans le client mail
                </a>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
