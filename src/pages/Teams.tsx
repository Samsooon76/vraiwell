import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users,
  Plus,
  Search,
  MoreHorizontal,
  Mail,
  UserPlus,
  Loader2,
  Crown,
  Copy,
  Link2,
  X
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AddTeamModal } from "@/components/modals/AddTeamModal";
import { TeamDetailsModal } from "@/components/modals/TeamDetailsModal";
import { useTeams, Team } from "@/hooks/useTeams";
import { useInvitations } from "@/hooks/useInvitations";
import { useUserProfile } from "@/hooks/useUserProfile";
import { toast } from "sonner";

export default function Teams() {
  const [searchQuery, setSearchQuery] = useState("");
  const [addTeamOpen, setAddTeamOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [inviteEmails, setInviteEmails] = useState("");
  const [emailRole, setEmailRole] = useState<'admin' | 'manager' | 'user'>("user");
  const [isInviting, setIsInviting] = useState(false);
  const [copiedInvitationId, setCopiedInvitationId] = useState<string | null>(null);
  const [cancellingInvitationId, setCancellingInvitationId] = useState<string | null>(null);

  const { teams, isLoading, fetchTeams, createTeam } = useTeams();
  const { canInvite } = useUserProfile();
  const {
    invitations,
    loading: invitationsLoading,
    error: invitationsError,
    fetchInvitations,
    createBulkInvitations,
    cancelInvitation,
    getInvitationLink,
  } = useInvitations();

  const filteredTeams = teams.filter((team) =>
    team.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalMembers = teams.reduce((sum, team) => sum + (team.memberCount || 0), 0);
  const pendingInvitations = useMemo(
    () => invitations.filter((invitation) => invitation.status === "pending"),
    [invitations]
  );

  useEffect(() => {
    void fetchInvitations();
  }, [fetchInvitations]);

  const handleTeamClick = (team: Team) => {
    setSelectedTeam(team);
    setDetailsOpen(true);
  };

  const handleTeamDeleted = () => {
    setSelectedTeam(null);
    fetchTeams();
  };

  const handleInviteFromEmails = async () => {
    const emails = inviteEmails
      .split(/[,\n]/)
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value.length > 0 && value.includes("@"));

    if (emails.length === 0) {
      toast.error("Veuillez entrer au moins une adresse email valide.");
      return;
    }

    setIsInviting(true);

    const result = await createBulkInvitations(
      emails.map((email) => ({
        email,
        role: emailRole,
      }))
    );

    if (result.success > 0) {
      toast.success(`${result.success} invitation(s) créée(s)`);
      setInviteEmails("");
    }

    if (result.errors.length > 0) {
      result.errors.forEach((error) => toast.error(error));
    }

    setIsInviting(false);
  };

  const handleCopyInvitationLink = async (invitationId: string, token: string) => {
    await navigator.clipboard.writeText(getInvitationLink(token));
    setCopiedInvitationId(invitationId);
    toast.success("Lien d'invitation copié.");
    window.setTimeout(() => setCopiedInvitationId(null), 2000);
  };

  const handleCancelInvitation = async (invitationId: string) => {
    setCancellingInvitationId(invitationId);

    const { error } = await cancelInvitation(invitationId);

    if (error) {
      toast.error(error);
    } else {
      toast.success("Invitation annulée.");
    }

    setCancellingInvitationId(null);
  };

  return (
    <DashboardLayout>
      <div className="p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div>
            <h1 className="font-display text-display-md text-foreground">Équipes</h1>
            <p className="mt-1 text-body-md text-muted-foreground">
              Gérez vos équipes et leurs accès aux outils
            </p>
          </div>
          <Button variant="hero" size="lg" onClick={() => setAddTeamOpen(true)}>
            <Plus className="h-4 w-4" />
            Nouvelle équipe
          </Button>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8 grid gap-4 sm:grid-cols-3"
        >
          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{teams.length}</p>
                <p className="text-sm text-muted-foreground">Équipes</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 text-success">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{totalMembers}</p>
                <p className="text-sm text-muted-foreground">Membres total</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10 text-warning">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{pendingInvitations.length}</p>
                <p className="text-sm text-muted-foreground">Invitations en attente</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-6"
        >
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher une équipe..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mb-8 rounded-xl border border-border bg-card p-6 shadow-card"
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            <div className="flex-1 space-y-4">
              <div>
                <h2 className="font-display text-lg text-foreground">Inviter des collaborateurs</h2>
                {invitationsError && (
                  <p className="mt-2 text-xs text-destructive">
                    Impossible de charger les invitations existantes : {invitationsError}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="invite-emails">Adresses email</Label>
                <Textarea
                  id="invite-emails"
                  placeholder="alice@entreprise.com, bob@entreprise.com"
                  value={inviteEmails}
                  onChange={(event) => setInviteEmails(event.target.value)}
                  className="min-h-[120px]"
                />
                <p className="text-xs text-muted-foreground">
                  Séparez les adresses par des virgules ou des retours à la ligne.
                </p>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <div className="w-full sm:max-w-[220px]">
                  <Label htmlFor="invite-role">Rôle par défaut</Label>
                  <Select value={emailRole} onValueChange={(value) => setEmailRole(value as typeof emailRole)}>
                    <SelectTrigger id="invite-role" className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">Utilisateur</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={handleInviteFromEmails}
                  disabled={isInviting || !inviteEmails.trim()}
                  className="sm:min-w-[180px]"
                >
                  {isInviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  Créer les invitations
                </Button>
              </div>
            </div>

            <div className="w-full lg:max-w-md">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-foreground">Invitations en attente</h3>
                {invitationsLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>

              <div className="mt-4 space-y-3">
                {pendingInvitations.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                    Aucune invitation en attente.
                  </div>
                ) : (
                  pendingInvitations.map((invitation) => (
                    <div
                      key={invitation.id}
                      className="rounded-lg border border-border bg-background px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{invitation.email}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Expire le {new Date(invitation.expires_at).toLocaleDateString("fr-FR")}
                          </p>
                        </div>
                        <Badge variant="outline" className="shrink-0 capitalize">
                          {invitation.role}
                        </Badge>
                      </div>

                      <div className="mt-3 flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleCopyInvitationLink(invitation.id, invitation.token)}
                        >
                          {copiedInvitationId === invitation.id ? (
                            <Copy className="h-4 w-4" />
                          ) : (
                            <Link2 className="h-4 w-4" />
                          )}
                          Copier le lien
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCancelInvitation(invitation.id)}
                          disabled={cancellingInvitationId === invitation.id}
                        >
                          {cancellingInvitationId === invitation.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <X className="h-4 w-4" />
                          )}
                          Annuler
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Loading state */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredTeams.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16 text-center"
          >
            <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              {teams.length === 0 ? "Aucune équipe" : "Aucun résultat"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {teams.length === 0
                ? "Créez votre première équipe pour commencer"
                : "Essayez une autre recherche"}
            </p>
            {teams.length === 0 && (
              <Button onClick={() => setAddTeamOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Créer une équipe
              </Button>
            )}
          </motion.div>
        ) : (
          /* Teams grid */
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {filteredTeams.map((team, index) => (
              <motion.div
                key={team.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
                className="group rounded-xl border border-border bg-card p-5 shadow-card transition-all duration-200 hover:shadow-card-hover hover:border-primary/20"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-white font-semibold"
                      style={{ backgroundColor: team.color }}
                    >
                      {team.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-display font-semibold text-foreground">{team.name}</h3>
                      <p className="text-xs text-muted-foreground">{team.memberCount || 0} membres</p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleTeamClick(team)}>
                        Voir les détails
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleTeamClick(team)}>
                        Gérer les membres
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  {team.description || "Aucune description"}
                </p>

                {team.lead && (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      <Crown className="h-3 w-3 mr-1 text-amber-500" />
                      {team.lead}
                    </Badge>
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-border flex gap-2">
                  <Button
                    variant="soft"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleTeamClick(team)}
                  >
                    <Users className="h-4 w-4" />
                    Voir membres
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTeamClick(team)}
                  >
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      <AddTeamModal
        open={addTeamOpen}
        onOpenChange={setAddTeamOpen}
        onCreateTeam={createTeam}
      />

      <TeamDetailsModal
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        team={selectedTeam}
        onTeamDeleted={handleTeamDeleted}
      />
    </DashboardLayout>
  );
}
