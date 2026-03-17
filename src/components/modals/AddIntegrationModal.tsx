import { useState } from "react";
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
import { Label } from "@/components/ui/label";
import { ToolLogo } from "@/components/tools/ToolLogo";
import { toast } from "sonner";
import { Search, Check } from "lucide-react";

interface AddIntegrationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const availableIntegrations = [
  { id: "google", name: "Google Workspace", category: "Identity" },
  { id: "microsoft", name: "Microsoft 365", category: "Identity" },
  { id: "okta", name: "Okta", category: "Identity" },
  { id: "slack", name: "Slack", category: "Communication" },
  { id: "onoff", name: "OnOff Business", category: "Téléphonie" },
  { id: "jira", name: "Jira", category: "Projet" },
  { id: "github", name: "GitHub", category: "Développement" },
  { id: "salesforce", name: "Salesforce", category: "CRM" },
  { id: "hubspot", name: "HubSpot", category: "CRM" },
];

export function AddIntegrationModal({ open, onOpenChange }: AddIntegrationModalProps) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const filteredIntegrations = availableIntegrations.filter(
    (int) => int.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleConnect = async () => {
    if (!selected) return;
    
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const integration = availableIntegrations.find(i => i.id === selected);
    toast.success("Intégration connectée", {
      description: `${integration?.name} a été connecté avec succès.`
    });
    
    setIsLoading(false);
    setSelected(null);
    setSearch("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Ajouter une intégration</DialogTitle>
          <DialogDescription>
            Connectez vos services pour synchroniser automatiquement vos données.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Rechercher une intégration..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
            {filteredIntegrations.map((int) => (
              <button
                key={int.id}
                type="button"
                onClick={() => setSelected(int.id)}
                className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-all ${
                  selected === int.id 
                    ? "border-primary bg-accent" 
                    : "border-border hover:border-primary/50"
                }`}
              >
                <ToolLogo name={int.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{int.name}</p>
                  <p className="text-xs text-muted-foreground">{int.category}</p>
                </div>
                {selected === int.id && (
                  <Check className="h-4 w-4 text-primary shrink-0" />
                )}
              </button>
            ))}
          </div>
          
          {filteredIntegrations.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              Aucune intégration trouvée
            </p>
          )}
        </div>
        
        <DialogFooter className="mt-6">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleConnect} disabled={!selected || isLoading}>
            {isLoading ? "Connexion..." : "Connecter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
