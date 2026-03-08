
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
import { useSlackAuth, SlackUser } from "@/hooks/useSlackAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
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
    Hash,
    HelpCircle,
    ExternalLink
} from "lucide-react";
import { ConfirmModal } from "./ConfirmModal";
import { toast } from "sonner";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface SlackWorkspaceModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onDisconnect?: () => void;
}

export function SlackWorkspaceModal({ open, onOpenChange, onDisconnect }: SlackWorkspaceModalProps) {
    const [search, setSearch] = useState("");
    const [confirmDisconnectOpen, setConfirmDisconnectOpen] = useState(false);
    const [showInviteForm, setShowInviteForm] = useState(false);
    const [inviteEmail, setInviteEmail] = useState("");
    const [tokenInput, setTokenInput] = useState("");
    const [clientIdInput, setClientIdInput] = useState(import.meta.env.VITE_SLACK_CLIENT_ID || "10301293598432.10285916908609");
    const [userToDelete, setUserToDelete] = useState<SlackUser | null>(null);

    const {
        fetchSlackUsers,
        disconnectSlack,
        inviteSlackUser,
        deleteSlackUser,
        setManualToken,
        slackUsers,
        workspaceInfo,
        isLoadingUsers,
        isDisconnecting,
        isInvitingUser,
        isDeletingUser,
        isConnecting,
        hasToken,
        error,
        connectSlack
    } = useSlackAuth();

    const { isAdmin, isManager } = useUserProfile();
    const canManageUsers = isAdmin || isManager;

    useEffect(() => {
        if (open && hasToken) {
            fetchSlackUsers();
        }
    }, [open, hasToken]);

    const handleManualConnect = async () => {
        if (!tokenInput.trim()) return;

        const result = await setManualToken(tokenInput.trim());
        if (result.success) {
            toast.success("Connecté à Slack avec succès !");
            setTokenInput("");
        } else {
            toast.error(result.error || "Erreur de connexion");
        }
    };

    const handleOAuthConnect = async () => {
        const id = clientIdInput.trim();
        if (!id) {
            toast.error("Veuillez entrer un Client ID");
            return;
        }
        await connectSlack(id);
    };

    const handleDisconnect = async () => {
        const result = await disconnectSlack();
        setConfirmDisconnectOpen(false);
        if (result.success) {
            onDisconnect?.();
            // Don't close modal, show connect screen
        }
    };

    const handleInviteUser = async () => {
        if (!inviteEmail.trim()) {
            toast.error("Veuillez entrer une adresse email");
            return;
        }

        const result = await inviteSlackUser(inviteEmail.trim());

        if (result.success) {
            toast.success(result.message || `Invitation envoyée à ${inviteEmail}`);
            setInviteEmail("");
            setShowInviteForm(false);
        } else {
            toast.error(result.error || "Erreur lors de l'invitation");
        }
    };

    const handleDeleteUser = async () => {
        if (!userToDelete) return;

        const result = await deleteSlackUser(userToDelete.id);

        if (result.success) {
            toast.success(`Utilisateur ${userToDelete.name} désactivé`);
        } else {
            toast.error(result.error || "Erreur lors de la désactivation");
        }

        setUserToDelete(null);
    };

    const filteredUsers = slackUsers.filter(user =>
        user.name.toLowerCase().includes(search.toLowerCase()) ||
        (user.email && user.email.toLowerCase().includes(search.toLowerCase()))
    );

    return (
        <Dialog open={open} onOpenChange={(isOpen) => {
            if (!isOpen) {
                setShowInviteForm(false);
                setInviteEmail("");
            }
            onOpenChange(isOpen);
        }}>
            <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col">
                <DialogHeader className="shrink-0">
                    <DialogTitle className="font-display text-xl flex items-center gap-2">
                        <img src="https://cdn.worldvectorlogo.com/logos/slack-new-logo.svg" className="w-5 h-5 shrink-0" alt="Slack" />
                        Slack
                    </DialogTitle>
                    <DialogDescription>
                        {workspaceInfo
                            ? <span className="flex flex-col gap-1">
                                <span className="font-medium text-foreground">{workspaceInfo.name}</span>
                                <span>Espace de travail avec {workspaceInfo.totalMembers} membres</span>
                            </span>
                            : "Gérez votre espace de travail Slack"}
                    </DialogDescription>
                </DialogHeader>

                {!hasToken ? (
                    <div className="flex flex-col gap-6 py-8 px-4 items-center justify-center">

                        {/* Primary OAuth Action */}
                        <div className="w-full max-w-sm space-y-6 text-center">
                            <div className="space-y-2">
                                <h3 className="font-semibold text-lg">Connecter Slack à Wellcom</h3>
                                <p className="text-sm text-muted-foreground">
                                    Importez vos membres et gérez-les directement depuis l'application.
                                </p>
                            </div>

                            {/* Hidden Client ID input - keeps state logic working but cleans UI */}
                            {/* Only show if troubleshooting is needed? No, just keep it hidden since we have env var */}
                            <Input
                                type="hidden"
                                value={clientIdInput}
                                onChange={(e) => setClientIdInput(e.target.value)}
                            />

                            <Button onClick={handleOAuthConnect} disabled={isConnecting} className="w-full bg-[#4A154B] hover:bg-[#360F37] text-white h-12 text-base font-medium shadow-sm transition-all hover:scale-[1.02]">
                                {isConnecting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Slack_icon_2019.svg/2048px-Slack_icon_2019.svg.png" className="w-5 h-5 mr-2 brightness-0 invert" />}
                                Se connecter avec Slack
                            </Button>

                            <p className="text-xs text-muted-foreground">
                                En cliquant, vous serez redirigé vers Slack pour autoriser l'accès.
                            </p>
                        </div>

                        {/* Subtle Manual Option */}
                        <div className="pt-8 w-full max-w-sm border-t">
                            <details className="group">
                                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground text-center list-none flex items-center justify-center gap-1">
                                    <span>J'ai un token manuel (Avancé)</span>
                                </summary>
                                <div className="mt-4 space-y-2 animate-in slide-in-from-top-2 fade-in duration-200">
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="xoxp-..."
                                            value={tokenInput}
                                            onChange={(e) => setTokenInput(e.target.value)}
                                            type="password"
                                            className="text-xs"
                                        />
                                        <Button onClick={handleManualConnect} disabled={isConnecting || !tokenInput} variant="outline" size="sm">
                                            Valider
                                        </Button>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground text-center">
                                        Utilisez le "User OAuth Token" depuis api.slack.com
                                    </p>
                                </div>
                            </details>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto space-y-4 mt-4 pr-2">

                        {/* Invite form for admins/managers */}
                        {canManageUsers && (
                            <>
                                {showInviteForm ? (
                                    <div className="rounded-lg border border-border p-4 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-sm font-medium">Inviter par email</h4>
                                            <Button variant="ghost" size="sm" onClick={() => setShowInviteForm(false)}><X className="h-4 w-4" /></Button>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="inviteEmail">Adresse email</Label>
                                            <Input id="inviteEmail" type="email" placeholder="collegue@entreprise.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
                                        </div>
                                        <div className="bg-yellow-500/10 text-yellow-600 p-2 rounded text-xs flex gap-2 items-start">
                                            <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                                            <span>L'invitation par API peut nécessiter un plan Enterprise. Si cela échoue, utilisez l'interface Slack.</span>
                                        </div>
                                        <Button onClick={handleInviteUser} disabled={isInvitingUser || !inviteEmail.trim()} className="w-full">
                                            {isInvitingUser ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                                            Envoyer l'invitation
                                        </Button>
                                    </div>
                                ) : (
                                    <Button variant="outline" onClick={() => setShowInviteForm(true)} className="w-full">
                                        <UserPlus className="h-4 w-4 mr-2" /> Inviter un membre
                                    </Button>
                                )}
                            </>
                        )}

                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input placeholder="Rechercher un membre..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
                        </div>

                        {/* Users list */}
                        <div className="space-y-2">
                            {isLoadingUsers ? (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <Loader2 className="h-8 w-8 animate-spin text-purple-600 mb-3" />
                                    <p className="text-sm text-muted-foreground">Chargement des membres...</p>
                                </div>
                            ) : error ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <AlertCircle className="h-8 w-8 text-destructive mb-3" />
                                    <p className="text-sm text-destructive font-medium">Erreur de chargement</p>
                                    <p className="text-xs text-muted-foreground mt-1">{error}</p>
                                    <Button variant="outline" size="sm" className="mt-4" onClick={() => fetchSlackUsers()}>
                                        <RefreshCw className="h-4 w-4 mr-2" /> Réessayer
                                    </Button>
                                </div>
                            ) : filteredUsers.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <Users className="h-8 w-8 text-muted-foreground mb-3" />
                                    <p className="text-sm text-muted-foreground">Aucun membre trouvé</p>
                                </div>
                            ) : (
                                filteredUsers.map((user) => (
                                    <div key={user.id} className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-accent/50 transition-colors group">
                                        <Avatar className="h-10 w-10">
                                            <AvatarImage src={user.avatar} alt={user.name} />
                                            <AvatarFallback className="bg-purple-500/10 text-purple-600">
                                                {user.name.substring(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="font-medium text-sm text-foreground truncate">{user.name}</p>
                                                {user.isAdmin && (
                                                    <Badge variant="secondary" className="text-xs">
                                                        {user.status === 'owner' ? 'Propriétaire' : 'Admin'}
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                                                <Mail className="h-3 w-3" /> {user.email || "Pas d'email"}
                                            </p>
                                            {user.jobTitle && (
                                                <p className="text-xs text-muted-foreground/70 mt-0.5">
                                                    {user.jobTitle}
                                                </p>
                                            )}
                                        </div>
                                        {canManageUsers && (
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setUserToDelete(user)}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>Désactiver (Admin/Owner seulement)</TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        )}
                                    </div>
                                ))
                            )}
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
                            <Button onClick={() => fetchSlackUsers()} disabled={isLoadingUsers}>
                                <RefreshCw className={`h-4 w-4 ${isLoadingUsers ? 'animate-spin' : ''}`} /> Actualiser
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>

            <ConfirmModal open={confirmDisconnectOpen} onOpenChange={setConfirmDisconnectOpen} title="Déconnecter Slack"
                description="Êtes-vous sûr de vouloir déconnecter Slack ? Le token sera supprimé de ce navigateur." confirmText="Déconnecter" variant="destructive" onConfirm={handleDisconnect} />

            <ConfirmModal open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)} title="Désactiver le membre"
                description={`Êtes-vous sûr de vouloir désactiver ${userToDelete?.name} ? Cette action peut nécessiter des droits d'administration élevés.`} confirmText="Désactiver" variant="destructive" onConfirm={handleDeleteUser} isLoading={isDeletingUser} />
        </Dialog>
    );
}
