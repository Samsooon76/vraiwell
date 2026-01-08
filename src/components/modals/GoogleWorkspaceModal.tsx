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
import { useGoogleAuth, GoogleUser } from "@/hooks/useGoogleAuth";
import { 
  Users, 
  Search, 
  Loader2, 
  RefreshCw,
  Mail,
  Shield,
  AlertCircle
} from "lucide-react";

interface GoogleWorkspaceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GoogleWorkspaceModal({ open, onOpenChange }: GoogleWorkspaceModalProps) {
  const [search, setSearch] = useState("");
  const { fetchGoogleUsers, googleUsers, isLoadingUsers, error } = useGoogleAuth();

  useEffect(() => {
    if (open) {
      fetchGoogleUsers();
    }
  }, [open]);

  const filteredUsers = googleUsers.filter(user =>
    user.name.toLowerCase().includes(search.toLowerCase()) ||
    user.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
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
          <div className="max-h-[350px] overflow-y-auto space-y-2">
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
                  className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-accent/50 transition-colors"
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
                  </div>
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
                  Pour lister tous les utilisateurs de votre organisation, vous devez être administrateur 
                  Google Workspace et activer l'API Admin Directory.
                </span>
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
          <Button onClick={() => fetchGoogleUsers()} disabled={isLoadingUsers}>
            <RefreshCw className={`h-4 w-4 ${isLoadingUsers ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
