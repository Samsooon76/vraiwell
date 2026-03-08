import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Team, TeamMember, useTeams } from "@/hooks/useTeams";
import { useUserProfile } from "@/hooks/useUserProfile";
import {
    Users,
    MoreVertical,
    Crown,
    Trash2,
    UserMinus,
    Loader2,
    Edit2,
    Check,
    X,
    UserPlus,
} from "lucide-react";
import { ConfirmModal } from "./ConfirmModal";
import { AddTeamMemberModal } from "./AddTeamMemberModal";
import { toast } from "sonner";

interface TeamDetailsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    team: Team | null;
    onTeamDeleted?: () => void;
}

const colorOptions = [
    { name: "Bleu", value: "#3b82f6" },
    { name: "Vert", value: "#22c55e" },
    { name: "Violet", value: "#8b5cf6" },
    { name: "Orange", value: "#f97316" },
    { name: "Rose", value: "#ec4899" },
    { name: "Cyan", value: "#06b6d4" },
];

export function TeamDetailsModal({ open, onOpenChange, team, onTeamDeleted }: TeamDetailsModalProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState("");
    const [editDescription, setEditDescription] = useState("");
    const [editColor, setEditColor] = useState("");
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
    const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);
    const [addMemberOpen, setAddMemberOpen] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const { updateTeam, deleteTeam, removeMember, updateMemberRole, fetchTeams } = useTeams();
    const { isAdmin } = useUserProfile();

    const startEditing = () => {
        if (!team) return;
        setEditName(team.name);
        setEditDescription(team.description || "");
        setEditColor(team.color);
        setIsEditing(true);
    };

    const cancelEditing = () => {
        setIsEditing(false);
    };

    const saveChanges = async () => {
        if (!team) return;
        setIsUpdating(true);

        const result = await updateTeam(team.id, {
            name: editName,
            description: editDescription,
            color: editColor,
        });

        if (result.success) {
            toast.success("Équipe modifiée");
            setIsEditing(false);
        } else {
            toast.error(result.error || "Erreur lors de la modification");
        }

        setIsUpdating(false);
    };

    const handleDeleteTeam = async () => {
        if (!team) return;
        setIsDeleting(true);

        const result = await deleteTeam(team.id);

        if (result.success) {
            toast.success("Équipe supprimée");
            setConfirmDeleteOpen(false);
            onOpenChange(false);
            onTeamDeleted?.();
        } else {
            toast.error(result.error || "Erreur lors de la suppression");
        }

        setIsDeleting(false);
    };

    const handleRemoveMember = async () => {
        if (!team || !memberToRemove) return;

        const result = await removeMember(team.id, memberToRemove.user_id);

        if (result.success) {
            toast.success("Membre retiré de l'équipe");
        } else {
            toast.error(result.error || "Erreur lors du retrait");
        }

        setMemberToRemove(null);
    };

    const handlePromoteToLead = async (member: TeamMember) => {
        if (!team) return;

        const result = await updateMemberRole(team.id, member.user_id, "lead");

        if (result.success) {
            toast.success(`${member.profile?.full_name || "Membre"} est maintenant responsable`);
        } else {
            toast.error(result.error || "Erreur lors de la promotion");
        }
    };

    const handleDemoteToMember = async (member: TeamMember) => {
        if (!team) return;

        const result = await updateMemberRole(team.id, member.user_id, "member");

        if (result.success) {
            toast.success(`${member.profile?.full_name || "Membre"} est maintenant membre`);
        } else {
            toast.error(result.error || "Erreur lors de la modification");
        }
    };

    if (!team) return null;

    const currentMembers = team.members || [];
    const leads = currentMembers.filter((m) => m.role === "lead");
    const members = currentMembers.filter((m) => m.role === "member");

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-[550px] max-h-[85vh] flex flex-col">
                    <DialogHeader className="shrink-0">
                        {isEditing ? (
                            <div className="space-y-3">
                                <Input
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    placeholder="Nom de l'équipe"
                                    className="text-lg font-semibold"
                                />
                                <div className="flex gap-2">
                                    {colorOptions.map((opt) => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => setEditColor(opt.value)}
                                            className={`h-6 w-6 rounded-full transition-all ${editColor === opt.value ? "ring-2 ring-offset-2 ring-primary" : ""
                                                }`}
                                            style={{ backgroundColor: opt.value }}
                                        />
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <DialogTitle className="font-display text-xl flex items-center gap-3">
                                <div
                                    className="flex h-10 w-10 items-center justify-center rounded-lg text-white font-semibold"
                                    style={{ backgroundColor: team.color }}
                                >
                                    {team.name.charAt(0)}
                                </div>
                                {team.name}
                            </DialogTitle>
                        )}
                        {isEditing ? (
                            <Textarea
                                value={editDescription}
                                onChange={(e) => setEditDescription(e.target.value)}
                                placeholder="Description de l'équipe"
                                rows={2}
                            />
                        ) : (
                            <DialogDescription>
                                {team.description || "Aucune description"}
                            </DialogDescription>
                        )}
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto space-y-4 mt-4 pr-2">
                        {/* Members section */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-medium flex items-center gap-2">
                                    <Users className="h-4 w-4" />
                                    Membres ({currentMembers.length})
                                </h4>
                                {(isAdmin || leads.some((l) => l.user_id === team.id)) && (
                                    <Button size="sm" variant="outline" onClick={() => setAddMemberOpen(true)}>
                                        <UserPlus className="h-4 w-4 mr-1" />
                                        Ajouter
                                    </Button>
                                )}
                            </div>

                            {/* Leads */}
                            {leads.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-xs text-muted-foreground font-medium">Responsables</p>
                                    {leads.map((member) => (
                                        <MemberRow
                                            key={member.id}
                                            member={member}
                                            isLead
                                            onRemove={() => setMemberToRemove(member)}
                                            onDemote={() => handleDemoteToMember(member)}
                                            canManage={isAdmin}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Regular members */}
                            {members.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-xs text-muted-foreground font-medium">Membres</p>
                                    {members.map((member) => (
                                        <MemberRow
                                            key={member.id}
                                            member={member}
                                            isLead={false}
                                            onRemove={() => setMemberToRemove(member)}
                                            onPromote={() => handlePromoteToLead(member)}
                                            canManage={isAdmin}
                                        />
                                    ))}
                                </div>
                            )}

                            {currentMembers.length === 0 && (
                                <p className="text-sm text-muted-foreground text-center py-4">
                                    Aucun membre dans cette équipe
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="shrink-0 flex justify-between gap-2 mt-4 pt-4 border-t">
                        {isEditing ? (
                            <>
                                <Button variant="ghost" onClick={cancelEditing}>
                                    <X className="h-4 w-4 mr-1" />
                                    Annuler
                                </Button>
                                <Button onClick={saveChanges} disabled={isUpdating}>
                                    {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                                    Enregistrer
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button variant="destructive" onClick={() => setConfirmDeleteOpen(true)}>
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    Supprimer
                                </Button>
                                <div className="flex gap-2">
                                    <Button variant="outline" onClick={startEditing}>
                                        <Edit2 className="h-4 w-4 mr-1" />
                                        Modifier
                                    </Button>
                                    <Button onClick={() => onOpenChange(false)}>Fermer</Button>
                                </div>
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Confirm delete team */}
            <ConfirmModal
                open={confirmDeleteOpen}
                onOpenChange={setConfirmDeleteOpen}
                title="Supprimer l'équipe"
                description={`Êtes-vous sûr de vouloir supprimer l'équipe "${team.name}" ? Cette action est irréversible et tous les membres seront retirés.`}
                confirmText="Supprimer"
                variant="destructive"
                onConfirm={handleDeleteTeam}
                isLoading={isDeleting}
            />

            {/* Confirm remove member */}
            <ConfirmModal
                open={!!memberToRemove}
                onOpenChange={(open) => !open && setMemberToRemove(null)}
                title="Retirer le membre"
                description={`Êtes-vous sûr de vouloir retirer ${memberToRemove?.profile?.full_name || "ce membre"} de l'équipe ?`}
                confirmText="Retirer"
                variant="destructive"
                onConfirm={handleRemoveMember}
            />

            {/* Add member modal */}
            <AddTeamMemberModal
                open={addMemberOpen}
                onOpenChange={setAddMemberOpen}
                team={team}
                onMemberAdded={fetchTeams}
            />
        </>
    );
}

// Member row component
interface MemberRowProps {
    member: TeamMember;
    isLead: boolean;
    onRemove: () => void;
    onPromote?: () => void;
    onDemote?: () => void;
    canManage: boolean;
}

function MemberRow({ member, isLead, onRemove, onPromote, onDemote, canManage }: MemberRowProps) {
    const initials = member.profile?.full_name
        ?.split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) || "?";

    return (
        <div className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-accent/50 transition-colors">
            <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                    <AvatarImage src={member.profile?.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                        {initials}
                    </AvatarFallback>
                </Avatar>
                <div>
                    <p className="text-sm font-medium">{member.profile?.full_name || "Utilisateur"}</p>
                    {isLead && (
                        <Badge variant="outline" className="text-xs mt-0.5">
                            <Crown className="h-3 w-3 mr-1 text-amber-500" />
                            Responsable
                        </Badge>
                    )}
                </div>
            </div>
            {canManage && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {isLead && onDemote && (
                            <DropdownMenuItem onClick={onDemote}>
                                <UserMinus className="h-4 w-4 mr-2" />
                                Rétrograder en membre
                            </DropdownMenuItem>
                        )}
                        {!isLead && onPromote && (
                            <DropdownMenuItem onClick={onPromote}>
                                <Crown className="h-4 w-4 mr-2" />
                                Promouvoir responsable
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={onRemove} className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Retirer de l'équipe
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
        </div>
    );
}
