import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGoogleAuth, GoogleUser } from "@/hooks/useGoogleAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useInvitations } from "@/hooks/useInvitations";
import { 
  Users, 
  Search, 
  Loader2, 
  RefreshCw,
  Mail,
  Shield,
  AlertCircle,
  Unlink,
  UserPlus,
  Trash2,
  Check,
  X,
  CreditCard
} from "lucide-react";
import { ConfirmModal } from "./ConfirmModal";
import { toast } from "sonner";

interface GoogleWorkspaceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDisconnect?: () => void;
}

export function GoogleWorkspaceModal({ open, onOpenChange, onDisconnect }: GoogleWorkspaceModalProps) {
  const [search, setSearch] = useState("");
  const [confirmDisconnectOpen, setConfirmDisconnectOpen] = useState(false);
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [newUserFirstName, setNewUserFirstName] = useState("");
  const [newUserLastName, setNewUserLastName] = useState("");
  const [newUserPersonalEmail, setNewUserPersonalEmail] = useState("");
  const [autoInvite, setAutoInvite] = useState(false);
  const [inviteRole, setInviteRole] = useState<"admin" | "manager" | "user">("user");
  const [userToDelete, setUserToDelete] = useState<GoogleUser | null>(null);
  const [invitationSentTo, setInvitationSentTo] = useState<string | null>(null);

  const { 
    fetchGoogleUsers, 
    disconnectGoogle, 
    createGoogleUser,
    deleteGoogleUser,
    googleUsers, 
    licenseInfo,
    isLoadingUsers, 
    isDisconnecting, 
    isCreatingUser,
    isDeletingUser,
    error 
  } = useGoogleAuth();
  
  const { isAdmin } = useUserProfile();
  const { createInvitation } = useInvitations();

  useEffect(() => {
    if (open) {
      fetchGoogleUsers();
    }
  }, [open]);

  const handleDisconnect = async () => {
    const result = await disconnectGoogle();
    setConfirmDisconnectOpen(false);
    onOpenChange(false);
    if (result.success) {
      onDisconnect?.();
    }
  };

  const handleCreateUser = async () => {
    if (!newUserFirstName.trim() || !newUserLastName.trim()) {
      toast.error("Veuillez remplir le prénom et le nom");
      return;
    }

    if (!newUserPersonalEmail.trim()) {
      toast.error("Veuillez renseigner l'adresse email personnelle");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newUserPersonalEmail.trim())) {
      toast.error("Veuillez entrer une adresse email valide");
      return;
    }

    const result = await createGoogleUser(
      newUserFirstName.trim(), 
      newUserLastName.trim(),
      newUserPersonalEmail.trim()
    );

    if (result.success && result.user) {
      toast.success(`Utilisateur ${result.user.email} créé avec succès`);
      setInvitationSentTo(result.invitationSentTo || null);
      
      if (autoInvite && result.user.email) {
        const inviteResult = await createInvitation({ email: result.user.email, role: inviteRole });
        if (inviteResult.invitation) {
          toast.success(`Invitation à l'application envoyée à ${result.user.email}`);
        }
      }
    } else {
      toast.error(result.error || "Erreur lors de la création");
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    const result = await deleteGoogleUser(userToDelete.id);

    if (result.success) {
      toast.success(`Utilisateur ${userToDelete.email} supprimé de Google Workspace`);
    } else {
      toast.error(result.error || "Erreur lors de la suppression");
    }

    setUserToDelete(null);
  };

  const resetAddUserForm = () => {
    setShowAddUserForm(false);
    setNewUserFirstName("");
    setNewUserLastName("");
    setNewUserPersonalEmail("");
    setAutoInvite(false);
    setInviteRole("user");
    setInvitationSentTo(null);
  };

  const filteredUsers = googleUsers.filter(user =>
    user.name.toLowerCase().includes(search.toLowerCase()) ||
    user.email.toLowerCase().includes(search.toLowerCase())
  );

  // Extract domain from first user email
  const domain = googleUsers[0]?.email?.split("@")[1] || "domaine.fr";
  const previewEmail = newUserFirstName && newUserLastName 
    ? `${newUserFirstName.toLowerCase().replace(/\s+/g, ".")}.${newUserLastName.toLowerCase().replace(/\s+/g, ".")}@${domain}`
    : "";

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetAddUserForm();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Google Workspace
          </DialogTitle>
          <DialogDescription>
            Utilisateurs de votre organisation Google Workspace
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* License info banner */}
          {licenseInfo && (
            <div className="rounded-lg bg-muted/50 p-3 flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-primary shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">{licenseInfo.totalUsers} utilisateurs</p>
                {licenseInfo.usedLicenses > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {licenseInfo.usedLicenses} licences attribuées
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Success message after creation */}
          {invitationSentTo && (
            <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-700 dark:text-green-400 flex items-center gap-2">
                    <Check className="h-4 w-4" />
                    Utilisateur créé avec succès !
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Une invitation a été envoyée à <strong>{invitationSentTo}</strong> pour configurer son compte.
                  </p>
                </div>
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={resetAddUserForm}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Add user form for admins */}
          {isAdmin && !invitationSentTo && (
            <>
              {showAddUserForm ? (
                <div className="rounded-lg border border-border p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">Nouvel utilisateur</h4>
                    <Button variant="ghost" size="sm" onClick={resetAddUserForm}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">Prénom</Label>
                      <Input
                        id="firstName"
                        placeholder="Jean"
                        value={newUserFirstName}
                        onChange={(e) => setNewUserFirstName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Nom</Label>
                      <Input
                        id="lastName"
                        placeholder="Dupont"
                        value={newUserLastName}
                        onChange={(e) => setNewUserLastName(e.target.value)}
                      />
                    </div>
                  </div>

                  {previewEmail && (
                    <p className="text-xs text-muted-foreground">
                      Email Workspace : <span className="font-mono">{previewEmail}</span>
                    </p>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="personalEmail">Email personnel (pour l'invitation)</Label>
                    <Input
                      id="personalEmail"
                      type="email"
                      placeholder="jean.dupont@gmail.com"
                      value={newUserPersonalEmail}
                      onChange={(e) => setNewUserPersonalEmail(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      L'invitation pour rejoindre Google Workspace sera envoyée à cette adresse.
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="autoInvite"
                      checked={autoInvite}
                      onCheckedChange={(checked) => setAutoInvite(checked === true)}
                    />
                    <Label htmlFor="autoInvite" className="text-sm">
                      Inviter aussi dans l'application
                    </Label>
                  </div>

                  {autoInvite && (
                    <div className="space-y-2">
                      <Label>Rôle dans l'application</Label>
                      <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as typeof inviteRole)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="user">Utilisateur</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <Button 
                    onClick={handleCreateUser} 
                    disabled={isCreatingUser || !newUserFirstName.trim() || !newUserLastName.trim() || !newUserPersonalEmail.trim()}
                    className="w-full"
                  >
                    {isCreatingUser ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <UserPlus className="h-4 w-4 mr-2" />
                    )}
                    Créer et envoyer l'invitation
                  </Button>
                </div>
              ) : (
                <Button 
                  variant="outline" 
                  onClick={() => setShowAddUserForm(true)}
                  className="w-full"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Ajouter un utilisateur
                </Button>
              )}
            </>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher un utilisateur..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Users list */}
          <div className="max-h-[300px] overflow-y-auto space-y-2">
            {isLoadingUsers ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                <p className="text-sm text-muted-foreground">Chargement des utilisateurs...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="h-8 w-8 text-destructive mb-3" />
                <p className="text-sm text-destructive font-medium">Erreur de chargement</p>
                <p className="text-xs text-muted-foreground mt-1">{error}</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-4"
                  onClick={() => fetchGoogleUsers()}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Réessayer
                </Button>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="h-8 w-8 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">Aucun utilisateur trouvé</p>
              </div>
            ) : (
              filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-accent/50 transition-colors group"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm text-foreground truncate">
                        {user.name}
                      </p>
                      {user.isCurrentUser && (
                        <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                          <Shield className="h-3 w-3 mr-1" />
                          Vous
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {user.email}
                    </p>
                    {user.license?.skuName && (
                      <p className="text-xs text-muted-foreground/70 mt-0.5">
                        {user.license.skuName}
                      </p>
                    )}
                  </div>
                  {isAdmin && !user.isCurrentUser && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setUserToDelete(user)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Info banner */}
          {!isLoadingUsers && !error && googleUsers.length > 0 && (
            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              <p className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  Pour gérer les utilisateurs, vous devez être administrateur 
                  Google Workspace avec les permissions Directory API.
                </span>
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-between gap-2 mt-4">
          <Button 
            variant="destructive" 
            onClick={() => setConfirmDisconnectOpen(true)}
            disabled={isDisconnecting}
          >
            {isDisconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
            {isDisconnecting ? "Déconnexion..." : "Déconnecter"}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fermer
            </Button>
            <Button onClick={() => fetchGoogleUsers()} disabled={isLoadingUsers}>
              <RefreshCw className={`h-4 w-4 ${isLoadingUsers ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
          </div>
        </div>
      </DialogContent>

      <ConfirmModal
        open={confirmDisconnectOpen}
        onOpenChange={setConfirmDisconnectOpen}
        title="Déconnecter Google Workspace"
        description="Êtes-vous sûr de vouloir déconnecter Google Workspace ? Vous devrez vous reconnecter pour accéder aux utilisateurs de votre organisation."
        confirmText="Déconnecter"
        variant="destructive"
        onConfirm={handleDisconnect}
      />

      <ConfirmModal
        open={!!userToDelete}
        onOpenChange={(open) => !open && setUserToDelete(null)}
        title="Supprimer l'utilisateur"
        description={`Êtes-vous sûr de vouloir supprimer ${userToDelete?.name} (${userToDelete?.email}) de Google Workspace ? Cette action est irréversible.`}
        confirmText="Supprimer"
        variant="destructive"
        onConfirm={handleDeleteUser}
        isLoading={isDeletingUser}
      />
    </Dialog>
  );
}