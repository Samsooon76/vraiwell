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
import { Input } from "@/components/ui/input";
import { useNotionAuth } from "@/hooks/useNotionAuth";
import {
    Users,
    Search,
    Loader2,
    RefreshCw,
    Unlink,
    ExternalLink,
    AlertCircle
} from "lucide-react";
import { ConfirmModal } from "./ConfirmModal";

interface NotionWorkspaceModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onDisconnect?: () => void;
}

export function NotionWorkspaceModal({ open, onOpenChange, onDisconnect }: NotionWorkspaceModalProps) {
    const [search, setSearch] = useState("");
    const [confirmDisconnectOpen, setConfirmDisconnectOpen] = useState(false);

    const {
        fetchNotionUsers,
        disconnectNotion,
        connectNotion,
        notionUsers,
        workspaceInfo,
        isLoadingUsers,
        isDisconnecting,
        isConnecting,
        hasToken,
        error
    } = useNotionAuth();

    useEffect(() => {
        if (open && hasToken) {
            fetchNotionUsers();
        }
    }, [open, hasToken]);

    const handleOAuthConnect = async () => {
        await connectNotion();
    };

    const handleDisconnect = async () => {
        const result = await disconnectNotion();
        setConfirmDisconnectOpen(false);
        if (result.success) {
            onDisconnect?.();
        }
    };

    const filteredUsers = notionUsers.filter(user =>
        user.name.toLowerCase().includes(search.toLowerCase()) ||
        (user.email && user.email.toLowerCase().includes(search.toLowerCase()))
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col">
                <DialogHeader className="shrink-0">
                    <DialogTitle className="font-display text-xl flex items-center gap-2">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/4/45/Notion_app_logo.png" className="w-5 h-5 shrink-0" alt="Notion" />
                        Notion
                    </DialogTitle>
                    <DialogDescription>
                        {workspaceInfo
                            ? <span className="flex flex-col gap-1">
                                <span className="font-medium text-foreground">{workspaceInfo.name}</span>
                                <span>Espace de travail avec {workspaceInfo.totalMembers} membres</span>
                            </span>
                            : "Gérez votre espace de travail Notion"}
                    </DialogDescription>
                </DialogHeader>

                {!hasToken ? (
                    <div className="flex flex-col gap-6 py-8 px-4 items-center justify-center">

                        {/* Primary OAuth Action */}
                        <div className="w-full max-w-sm space-y-6 text-center">
                            <div className="space-y-2">
                                <h3 className="font-semibold text-lg">Connecter Notion à Wellcom</h3>
                                <p className="text-sm text-muted-foreground">
                                    Affichez la liste des membres de votre espace Notion directement dans Wellcom.
                                </p>
                            </div>

                            <Button onClick={handleOAuthConnect} disabled={isConnecting} className="w-full bg-black hover:bg-black/80 text-white h-12 text-base font-medium shadow-sm transition-all hover:scale-[1.02]">
                                {isConnecting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <img src="https://upload.wikimedia.org/wikipedia/commons/4/45/Notion_app_logo.png" className="w-5 h-5 mr-2 invert brightness-0" />}
                                Se connecter avec Notion
                            </Button>

                            <p className="text-xs text-muted-foreground">
                                Vous serez redirigé vers Notion pour sélectionner les pages auxquelles l'intégration a accès.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto space-y-4 mt-4 pr-2">

                        <div className="bg-blue-50 text-blue-700 p-3 rounded-lg text-xs flex gap-2 items-start">
                            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                            <span>
                                Note : L'API Notion ne permet pas d'inviter ou de supprimer des membres directement.
                                Vous devez gérer cela depuis l'interface Notion ("Settings & Members").
                            </span>
                        </div>

                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input placeholder="Rechercher un membre..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
                        </div>

                        {/* Users list */}
                        <div className="space-y-2">
                            {isLoadingUsers ? (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <Loader2 className="h-8 w-8 animate-spin text-black mb-3" />
                                    <p className="text-sm text-muted-foreground">Chargement des membres...</p>
                                </div>
                            ) : error ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <AlertCircle className="h-8 w-8 text-destructive mb-3" />
                                    <p className="text-sm text-destructive font-medium">Erreur de chargement</p>
                                    <p className="text-xs text-muted-foreground mt-1">{error}</p>
                                    <Button variant="outline" size="sm" className="mt-4" onClick={() => fetchNotionUsers()}>
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
                                            <AvatarFallback className="bg-gray-100 text-gray-600">
                                                {user.name.substring(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className="font-medium text-sm text-foreground truncate">{user.name}</p>
                                                {user.type === 'bot' && (
                                                    <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded uppercase font-bold text-muted-foreground">Bot</span>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                                                {user.email || "Pas d'email public"}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="pt-4 flex justify-center">
                            <Button variant="outline" className="w-full" onClick={() => window.open("https://www.notion.so/my-integrations", "_blank")}>
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Gérer les membres dans Notion
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
                            <Button onClick={() => fetchNotionUsers()} disabled={isLoadingUsers}>
                                <RefreshCw className={`h-4 w-4 ${isLoadingUsers ? 'animate-spin' : ''}`} /> Actualiser
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>

            <ConfirmModal open={confirmDisconnectOpen} onOpenChange={setConfirmDisconnectOpen} title="Déconnecter Notion"
                description="Êtes-vous sûr de vouloir déconnecter Notion ?" confirmText="Déconnecter" variant="destructive" onConfirm={handleDisconnect} />
        </Dialog>
    );
}
