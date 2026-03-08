import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Team, useTeams } from "@/hooks/useTeams";
import { Search, Loader2, UserPlus, Crown, Users } from "lucide-react";
import { toast } from "sonner";

interface Profile {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
}

interface AddTeamMemberModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    team: Team | null;
    onMemberAdded?: () => void;
}

export function AddTeamMemberModal({ open, onOpenChange, team, onMemberAdded }: AddTeamMemberModalProps) {
    const [search, setSearch] = useState("");
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
    const [role, setRole] = useState<"member" | "lead">("member");
    const [isAdding, setIsAdding] = useState(false);

    const { addMember } = useTeams();

    // Fetch available profiles
    useEffect(() => {
        if (!open || !team) return;

        const fetchProfiles = async () => {
            setIsLoading(true);

            try {
                // Get existing member IDs
                const existingMemberIds = team.members?.map((m) => m.user_id) || [];

                // Fetch all profiles
                const { data, error } = await supabase
                    .from("profiles")
                    .select("id, full_name, avatar_url")
                    .order("full_name");

                if (error) throw error;

                // Filter out existing members
                const availableProfiles = (data || []).filter(
                    (p) => !existingMemberIds.includes(p.id)
                );

                setProfiles(availableProfiles);
            } catch (err) {
                console.error("Error fetching profiles:", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchProfiles();
    }, [open, team]);

    const filteredProfiles = profiles.filter((p) =>
        p.full_name?.toLowerCase().includes(search.toLowerCase())
    );

    const handleAddMember = async () => {
        if (!team || !selectedProfile) return;
        setIsAdding(true);

        const result = await addMember(team.id, selectedProfile.id, role);

        if (result.success) {
            toast.success("Membre ajouté", {
                description: `${selectedProfile.full_name} a été ajouté à l'équipe.`,
            });
            setSelectedProfile(null);
            setRole("member");
            setSearch("");
            onOpenChange(false);
            onMemberAdded?.();
        } else {
            toast.error(result.error || "Erreur lors de l'ajout");
        }

        setIsAdding(false);
    };

    const resetAndClose = () => {
        setSelectedProfile(null);
        setRole("member");
        setSearch("");
        onOpenChange(false);
    };

    if (!team) return null;

    return (
        <Dialog open={open} onOpenChange={resetAndClose}>
            <DialogContent className="sm:max-w-[450px]">
                <DialogHeader>
                    <DialogTitle className="font-display text-xl flex items-center gap-2">
                        <UserPlus className="h-5 w-5 text-primary" />
                        Ajouter un membre
                    </DialogTitle>
                    <DialogDescription>
                        Ajoutez un utilisateur à l'équipe "{team.name}"
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 mt-4">
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

                    {/* Profiles list */}
                    <div className="max-h-[250px] overflow-y-auto space-y-2">
                        {isLoading ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : filteredProfiles.length === 0 ? (
                            <div className="text-center py-8 text-sm text-muted-foreground">
                                {profiles.length === 0
                                    ? "Tous les utilisateurs sont déjà membres"
                                    : "Aucun utilisateur trouvé"}
                            </div>
                        ) : (
                            filteredProfiles.map((profile) => {
                                const initials = profile.full_name
                                    ?.split(" ")
                                    .map((n) => n[0])
                                    .join("")
                                    .toUpperCase()
                                    .slice(0, 2) || "?";

                                const isSelected = selectedProfile?.id === profile.id;

                                return (
                                    <button
                                        key={profile.id}
                                        type="button"
                                        onClick={() => setSelectedProfile(profile)}
                                        className={`w-full flex items-center gap-3 rounded-lg border p-3 transition-colors text-left ${isSelected
                                                ? "border-primary bg-primary/5"
                                                : "border-border hover:bg-accent/50"
                                            }`}
                                    >
                                        <Avatar className="h-9 w-9">
                                            <AvatarImage src={profile.avatar_url || undefined} />
                                            <AvatarFallback className="bg-primary/10 text-primary text-sm">
                                                {initials}
                                            </AvatarFallback>
                                        </Avatar>
                                        <span className="text-sm font-medium">
                                            {profile.full_name || "Utilisateur sans nom"}
                                        </span>
                                        {isSelected && (
                                            <Badge className="ml-auto" variant="default">
                                                Sélectionné
                                            </Badge>
                                        )}
                                    </button>
                                );
                            })
                        )}
                    </div>

                    {/* Role selection */}
                    {selectedProfile && (
                        <div className="space-y-2 pt-2 border-t">
                            <Label className="text-sm font-medium">Rôle dans l'équipe</Label>
                            <RadioGroup
                                value={role}
                                onValueChange={(v) => setRole(v as "member" | "lead")}
                                className="flex gap-4"
                            >
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="member" id="role-member" />
                                    <Label htmlFor="role-member" className="flex items-center gap-1 cursor-pointer">
                                        <Users className="h-4 w-4" />
                                        Membre
                                    </Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="lead" id="role-lead" />
                                    <Label htmlFor="role-lead" className="flex items-center gap-1 cursor-pointer">
                                        <Crown className="h-4 w-4 text-amber-500" />
                                        Responsable
                                    </Label>
                                </div>
                            </RadioGroup>
                        </div>
                    )}
                </div>

                <DialogFooter className="mt-6">
                    <Button variant="outline" onClick={resetAndClose}>
                        Annuler
                    </Button>
                    <Button
                        onClick={handleAddMember}
                        disabled={!selectedProfile || isAdding}
                    >
                        {isAdding ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                            <UserPlus className="h-4 w-4 mr-1" />
                        )}
                        Ajouter
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
