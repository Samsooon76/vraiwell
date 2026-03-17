import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOnOffAuth, type OnOffNumber } from "@/hooks/useOnOffAuth";
import { ConfirmModal } from "./ConfirmModal";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  AlertCircle,
  ExternalLink,
  UserPlus,
  KeyRound,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  Unlink,
  Users,
  Smartphone,
  X,
} from "lucide-react";
import { toast } from "sonner";

interface OnOffWorkspaceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDisconnect?: () => void;
}

export function OnOffWorkspaceModal({
  open,
  onOpenChange,
  onDisconnect,
}: OnOffWorkspaceModalProps) {
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [search, setSearch] = useState("");
  const [showApiKeyForm, setShowApiKeyForm] = useState(false);
  const [showAddMemberForm, setShowAddMemberForm] = useState(false);
  const [newMemberFirstName, setNewMemberFirstName] = useState("");
  const [newMemberLastName, setNewMemberLastName] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<"ROLE_USER" | "ROLE_ADMIN">("ROLE_USER");
  const [assignNumberOnCreate, setAssignNumberOnCreate] = useState(false);
  const [newMemberCountryCode, setNewMemberCountryCode] = useState("fr");
  const [availableNumbers, setAvailableNumbers] = useState<OnOffNumber[]>([]);
  const [selectedAvailableNumberId, setSelectedAvailableNumberId] = useState("");
  const [isLoadingAvailableNumbers, setIsLoadingAvailableNumbers] = useState(false);
  const [confirmDisconnectOpen, setConfirmDisconnectOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<{ id: string; name: string } | null>(null);
  const [openMemberId, setOpenMemberId] = useState("");

  const {
    setApiKey,
    fetchOnOffMembers,
    fetchOnOffNumbers,
    fetchAvailableOnOffNumbers,
    createOnOffMember,
    assignOnOffNumber,
    deleteOnOffMember,
    disconnectOnOff,
    members,
    numbersByMember,
    workspaceInfo,
    isConnecting,
    isLoadingMembers,
    isCreatingMember,
    isAssigningNumber,
    isDisconnecting,
    hasToken,
    error,
    loadingMemberIds,
    deletingMemberId,
  } = useOnOffAuth();

  const resetAddMemberForm = () => {
    setShowAddMemberForm(false);
    setNewMemberFirstName("");
    setNewMemberLastName("");
    setNewMemberEmail("");
    setNewMemberRole("ROLE_USER");
    setAssignNumberOnCreate(false);
    setNewMemberCountryCode("fr");
    setAvailableNumbers([]);
    setSelectedAvailableNumberId("");
    setIsLoadingAvailableNumbers(false);
  };

  useEffect(() => {
    if (!open) {
      setApiKeyInput("");
      setSearch("");
      setShowApiKeyForm(false);
      resetAddMemberForm();
      setOpenMemberId("");
      return;
    }

    if (hasToken) {
      void fetchOnOffMembers();
    }
  }, [open, hasToken, fetchOnOffMembers]);

  const handleConnect = async () => {
    if (!apiKeyInput.trim()) {
      toast.error("Veuillez renseigner une clé API OnOff");
      return;
    }

    const result = await setApiKey(apiKeyInput.trim());
    if (result.success) {
      toast.success("OnOff Business connecté avec succès");
      setApiKeyInput("");
      setShowApiKeyForm(false);
    } else {
      toast.error(result.error || "Impossible de connecter OnOff");
    }
  };

  const handleDisconnect = async () => {
    const result = await disconnectOnOff();
    setConfirmDisconnectOpen(false);

    if (result.success) {
      onDisconnect?.();
      toast.success("OnOff Business déconnecté");
    } else {
      toast.error(result.error || "Impossible de déconnecter OnOff");
    }
  };

  const handleOpenMember = async (memberId: string) => {
    setOpenMemberId(memberId);

    if (!memberId) {
      return;
    }

    const result = await fetchOnOffNumbers(memberId);
    if (!result.success) {
      toast.error(result.error || "Impossible de récupérer les numéros OnOff");
    }
  };

  const handleDeleteMember = async () => {
    if (!memberToDelete) return;

    const result = await deleteOnOffMember(memberToDelete.id);

    if (result.success) {
      toast.success(`Membre ${memberToDelete.name} supprimé`);
      if (openMemberId === memberToDelete.id) {
        setOpenMemberId("");
      }
      setMemberToDelete(null);
      return;
    }

    toast.error(result.error || "Impossible de supprimer le membre OnOff");
  };

  const handleLoadAvailableNumbers = async () => {
    const normalizedCountryCode = newMemberCountryCode.trim().toLowerCase();

    if (!normalizedCountryCode) {
      toast.error("Veuillez renseigner un code pays OnOff");
      return;
    }

    setIsLoadingAvailableNumbers(true);

    try {
      const result = await fetchAvailableOnOffNumbers(normalizedCountryCode);

      if (!result.success) {
        toast.error(result.error || "Impossible de récupérer les numéros disponibles");
        return;
      }

      const fetchedNumbers = result.numbers || [];
      setAvailableNumbers(fetchedNumbers);
      setSelectedAvailableNumberId((current) => {
        if (current && fetchedNumbers.some((number) => number.id === current)) {
          return current;
        }

        return fetchedNumbers[0]?.id ?? "";
      });

      if (fetchedNumbers.length === 0) {
        const attemptedQueries = Array.isArray(result.meta?.attemptedQueries)
          ? result.meta.attemptedQueries
            .map((entry: { countryCode?: string | null }) => entry.countryCode ?? "sans countryCode")
            .join(", ")
          : normalizedCountryCode;

        toast.error(`Aucun numéro disponible pour ${attemptedQueries}`);
      }
    } finally {
      setIsLoadingAvailableNumbers(false);
    }
  };

  const handleCreateMember = async () => {
    if (!newMemberFirstName.trim() || !newMemberLastName.trim() || !newMemberEmail.trim()) {
      toast.error("Veuillez renseigner le prénom, le nom et l'email");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newMemberEmail.trim())) {
      toast.error("Veuillez entrer une adresse email valide");
      return;
    }

    if (assignNumberOnCreate && !selectedAvailableNumberId) {
      toast.error("Sélectionnez un numéro disponible ou désactivez l'attribution de numéro");
      return;
    }

    const createResult = await createOnOffMember({
      firstName: newMemberFirstName.trim(),
      lastName: newMemberLastName.trim(),
      email: newMemberEmail.trim(),
      role: newMemberRole,
    });

    if (!createResult.success || !createResult.member) {
      toast.error(createResult.error || "Impossible de créer le membre OnOff");
      return;
    }

    const createdMember = createResult.member;
    let assignedPhoneNumber: string | null = null;

    if (assignNumberOnCreate) {
      const selectedNumber = availableNumbers.find((number) => number.id === selectedAvailableNumberId);

      if (!selectedNumber) {
        toast.error("Membre créé, mais le numéro sélectionné n'est plus disponible");
      } else {
        const assignResult = await assignOnOffNumber({
          phoneNumber: selectedNumber.phoneNumber,
          memberIdRef: createdMember.id,
          numberId: selectedNumber.id,
          number: {
            ...selectedNumber,
            memberIdRef: createdMember.id,
          },
        });

        if (!assignResult.success) {
          toast.error(assignResult.error || "Membre créé, mais l'attribution du numéro a échoué");
        } else {
          assignedPhoneNumber = selectedNumber.phoneNumber;
        }
      }
    }

    setOpenMemberId(createdMember.id);
    resetAddMemberForm();

    toast.success(
      assignedPhoneNumber
        ? `Membre créé et numéro ${assignedPhoneNumber} attribué`
        : `Membre ${createdMember.name} créé avec succès`,
    );
  };

  const filteredMembers = members.filter((member) => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return true;

    return member.name.toLowerCase().includes(normalizedSearch)
      || (member.email || "").toLowerCase().includes(normalizedSearch);
  });

  const formatDate = (value?: string | null) => {
    if (!value) {
      return "Pas d'expiration connue";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-[#ff6b35] text-white text-[10px] font-bold">
              O
            </div>
            OnOff Business
          </DialogTitle>
          <DialogDescription>
            {workspaceInfo
              ? (
                <span className="flex flex-col gap-1">
                  <span className="font-medium text-foreground">{workspaceInfo.name}</span>
                  <span>{workspaceInfo.totalMembers} membre(s) récupéré(s) via l'API</span>
                </span>
              )
              : "Connectez OnOff Business via une clé API, sans OAuth."}
          </DialogDescription>
        </DialogHeader>

        {!hasToken ? (
          <div className="space-y-6 py-6">
            <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <KeyRound className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Authentification par clé API</p>
                  <p className="text-sm text-muted-foreground">
                    La doc OnOff Business expose une API REST sur
                    {" "}
                    <span className="font-mono text-foreground">https://public-apigateway.onoffapp.net</span>
                    {" "}
                    avec le header
                    {" "}
                    <span className="font-mono text-foreground">X-API-Key</span>.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="onoff-api-key">
                Clé API OnOff
              </label>
              <Input
                id="onoff-api-key"
                type="password"
                placeholder="Collez votre clé API OnOff"
                value={apiKeyInput}
                onChange={(event) => setApiKeyInput(event.target.value)}
              />
            </div>

            {error && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive flex gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleConnect} disabled={isConnecting || !apiKeyInput.trim()}>
                {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                {isConnecting ? "Vérification..." : "Connecter"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => window.open("https://docs.onoffbusiness.com/api/introduction", "_blank")}
              >
                <ExternalLink className="h-4 w-4" />
                Doc API
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-4 mt-4 pr-2">
            <div className="rounded-xl border border-border bg-muted/40 p-4 flex items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                    API key active
                  </Badge>
                  <Badge variant="outline">
                    <Users className="h-3 w-3 mr-1" />
                    {workspaceInfo?.totalMembers ?? members.length} membres
                  </Badge>
                </div>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setShowApiKeyForm((value) => !value)}>
                <KeyRound className="h-4 w-4" />
                {showApiKeyForm ? "Masquer" : "Mettre à jour la clé"}
              </Button>
            </div>

            {showApiKeyForm && (
              <div className="rounded-xl border border-border p-4 space-y-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground" htmlFor="onoff-api-key-update">
                    Nouvelle clé API
                  </label>
                  <Input
                    id="onoff-api-key-update"
                    type="password"
                    placeholder="Collez une nouvelle clé API"
                    value={apiKeyInput}
                    onChange={(event) => setApiKeyInput(event.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleConnect} disabled={isConnecting || !apiKeyInput.trim()}>
                    {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    {isConnecting ? "Vérification..." : "Remplacer la clé"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowApiKeyForm(false)}>
                    Annuler
                  </Button>
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive flex gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {showAddMemberForm ? (
              <div className="rounded-xl border border-border p-4 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Nouveau membre OnOff</p>
                    <p className="text-xs text-muted-foreground">
                      Création via `POST /api/v1/members`, avec attribution optionnelle d&apos;un numéro disponible.
                    </p>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={resetAddMemberForm}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="onoff-first-name">Prénom</Label>
                    <Input
                      id="onoff-first-name"
                      placeholder="Jean"
                      value={newMemberFirstName}
                      onChange={(event) => setNewMemberFirstName(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="onoff-last-name">Nom</Label>
                    <Input
                      id="onoff-last-name"
                      placeholder="Dupont"
                      value={newMemberLastName}
                      onChange={(event) => setNewMemberLastName(event.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="onoff-email">Email</Label>
                  <Input
                    id="onoff-email"
                    type="email"
                    placeholder="jean.dupont@entreprise.fr"
                    value={newMemberEmail}
                    onChange={(event) => setNewMemberEmail(event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Rôle OnOff</Label>
                  <Select value={newMemberRole} onValueChange={(value) => setNewMemberRole(value as typeof newMemberRole)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ROLE_USER">Utilisateur</SelectItem>
                      <SelectItem value="ROLE_ADMIN">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-start space-x-2">
                  <Checkbox
                    id="onoff-assign-number"
                    checked={assignNumberOnCreate}
                    onCheckedChange={(checked) => {
                      const nextChecked = checked === true;
                      setAssignNumberOnCreate(nextChecked);
                      if (!nextChecked) {
                        setAvailableNumbers([]);
                        setSelectedAvailableNumberId("");
                      }
                    }}
                  />
                  <div className="space-y-1">
                    <Label htmlFor="onoff-assign-number" className="text-sm">
                      Attribuer un numéro à la création
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      La doc OnOff expose une attribution de numéro disponible, pas un endpoint séparé de création de numéro.
                    </p>
                  </div>
                </div>

                {assignNumberOnCreate && (
                  <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
                    <div className="grid grid-cols-[120px_1fr] gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="onoff-country-code">Code pays</Label>
                            <Input
                              id="onoff-country-code"
                              placeholder="fr"
                              maxLength={2}
                              value={newMemberCountryCode}
                              onChange={(event) => {
                                setNewMemberCountryCode(event.target.value.toLowerCase());
                                setAvailableNumbers([]);
                                setSelectedAvailableNumberId("");
                              }}
                            />
                      </div>
                      <div className="space-y-2">
                        <Label>Numéro disponible</Label>
                        <div className="flex gap-2">
                          <Select
                            value={selectedAvailableNumberId || undefined}
                            onValueChange={setSelectedAvailableNumberId}
                            disabled={isLoadingAvailableNumbers || availableNumbers.length === 0}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Chargez les numéros disponibles" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableNumbers.map((number) => (
                                <SelectItem key={number.id} value={number.id}>
                                  {number.phoneNumber} {number.countryCode ? `(${number.countryCode})` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => void handleLoadAvailableNumbers()}
                            disabled={isLoadingAvailableNumbers || !newMemberCountryCode.trim()}
                          >
                            {isLoadingAvailableNumbers ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                            Charger
                          </Button>
                        </div>
                      </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {availableNumbers.length > 0
                            ? `${availableNumbers.length} numéro(s) disponible(s) pour ${newMemberCountryCode.trim().toLowerCase() || "ce pays"}`
                            : "Chargez les numéros disponibles avant de valider."}
                        </p>
                      </div>
                )}

                <Button
                  type="button"
                  className="w-full"
                  onClick={() => void handleCreateMember()}
                  disabled={
                    isCreatingMember
                    || isAssigningNumber
                    || !newMemberFirstName.trim()
                    || !newMemberLastName.trim()
                    || !newMemberEmail.trim()
                    || (assignNumberOnCreate && !selectedAvailableNumberId)
                  }
                >
                  {isCreatingMember || isAssigningNumber ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <UserPlus className="h-4 w-4 mr-2" />
                  )}
                  {assignNumberOnCreate ? "Créer le membre et attribuer le numéro" : "Créer le membre"}
                </Button>
              </div>
            ) : (
              <Button type="button" variant="outline" className="w-full" onClick={() => setShowAddMemberForm(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Ajouter un membre OnOff
              </Button>
            )}

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher un membre..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-10"
              />
            </div>

            <div className="space-y-2">
              {isLoadingMembers ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-[#ff6b35] mb-3" />
                  <p className="text-sm text-muted-foreground">Chargement des membres OnOff...</p>
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Users className="h-8 w-8 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {members.length === 0 ? "Aucun membre retourné par l'API" : "Aucun membre ne correspond à la recherche"}
                  </p>
                </div>
              ) : (
                <Accordion type="single" collapsible value={openMemberId} onValueChange={(value) => void handleOpenMember(value)}>
                  {filteredMembers.map((member) => {
                    const memberNumbers = numbersByMember[member.id] || [];
                    const isLoadingNumbers = loadingMemberIds.includes(member.id);
                    const displayedNumberCount = memberNumbers.length || member.numberIdRefs.length;
                    const hasAssignedNumbers = displayedNumberCount > 0;

                    return (
                      <AccordionItem
                        key={member.id}
                        value={member.id}
                        className="rounded-lg border border-border px-3 mb-2 last:mb-0"
                      >
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex items-center gap-3 text-left">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ff6b35]/10 text-[#ff6b35]">
                              <Smartphone className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-sm text-foreground truncate">{member.name}</p>
                                {member.role && (
                                  <Badge variant="outline" className="text-[10px] uppercase">
                                    {member.role.replace("ROLE_", "")}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate">
                                {member.email || "Pas d'email renseigné"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {displayedNumberCount} numéro(s), {member.departmentIdRefs.length} département(s)
                              </p>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-3">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => void handleOpenMember(member.id)}
                              disabled={isLoadingNumbers}
                            >
                              <RefreshCw className={`h-4 w-4 ${isLoadingNumbers ? "animate-spin" : ""}`} />
                              Actualiser les numéros
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => setMemberToDelete({ id: member.id, name: member.name })}
                              disabled={deletingMemberId === member.id || hasAssignedNumbers}
                              title={hasAssignedNumbers
                                ? "Supprimez ou réassignez d'abord les numéros dans OnOff Business."
                                : undefined}
                            >
                              {deletingMemberId === member.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                              Supprimer le membre
                            </Button>
                          </div>

                          {hasAssignedNumbers && (
                            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
                              Ce membre ne peut pas être supprimé tant qu&apos;un ou plusieurs numéros lui sont encore rattachés.
                            </div>
                          )}

                          {isLoadingNumbers && memberNumbers.length === 0 ? (
                            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Chargement des numéros...
                            </div>
                          ) : memberNumbers.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                              Aucun numéro utilisé pour ce membre.
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {memberNumbers.map((number) => (
                                <div key={number.id} className="rounded-lg border border-border bg-muted/20 p-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="font-medium text-sm text-foreground truncate">{number.phoneNumber}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {number.countryCode || "Pays inconnu"}
                                        {" • "}
                                        Expiration : {formatDate(number.expirationDate)}
                                      </p>
                                    </div>
                                    <Badge variant="outline">{number.id}</Badge>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                            <p className="flex items-start gap-2">
                              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                              <span>
                                L’API OnOff documentée permet de lister et d’assigner des numéros, mais n’expose pas
                                de suppression ou de désassignation individuelle d’un numéro. Utilisez l’interface
                                OnOff Business pour ce cas.
                              </span>
                            </p>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              )}
            </div>

            <div className="pt-4 flex justify-center">
              <Button variant="outline" className="w-full" onClick={() => window.open("https://business.onoff.app/", "_blank")}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Ouvrir Onoff Business
              </Button>
            </div>
          </div>
        )}

        {hasToken && (
          <div className="shrink-0 flex justify-between gap-2 mt-4 pt-4 border-t">
            <Button variant="destructive" onClick={() => setConfirmDisconnectOpen(true)} disabled={isDisconnecting}>
              {isDisconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
              Déconnecter
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
              <Button onClick={() => fetchOnOffMembers()} disabled={isLoadingMembers}>
                <RefreshCw className={`h-4 w-4 ${isLoadingMembers ? "animate-spin" : ""}`} />
                Actualiser
              </Button>
            </div>
          </div>
        )}
      </DialogContent>

      <ConfirmModal
        open={confirmDisconnectOpen}
        onOpenChange={setConfirmDisconnectOpen}
        title="Déconnecter OnOff Business"
        description="Êtes-vous sûr de vouloir supprimer la clé API OnOff enregistrée ?"
        confirmText="Déconnecter"
        variant="destructive"
        onConfirm={handleDisconnect}
        isLoading={isDisconnecting}
      />

      <ConfirmModal
        open={!!memberToDelete}
        onOpenChange={(isOpen) => !isOpen && setMemberToDelete(null)}
        title="Supprimer le membre"
        description={`Êtes-vous sûr de vouloir supprimer ${memberToDelete?.name || "ce membre"} dans OnOff Business ?`}
        confirmText="Supprimer"
        variant="destructive"
        onConfirm={handleDeleteMember}
        isLoading={!!deletingMemberId}
      />
    </Dialog>
  );
}
