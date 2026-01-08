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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { UserPlus, UserMinus, RefreshCw, Bell } from "lucide-react";

interface AddWorkflowModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const workflowTypes = [
  { id: "onboarding", name: "Onboarding", icon: UserPlus, description: "Automatiser l'arrivée des nouveaux collaborateurs" },
  { id: "offboarding", name: "Offboarding", icon: UserMinus, description: "Gérer le départ des collaborateurs" },
  { id: "renewal", name: "Renouvellement", icon: RefreshCw, description: "Gérer les renouvellements de licences" },
  { id: "notification", name: "Notification", icon: Bell, description: "Envoyer des alertes automatiques" },
];

export function AddWorkflowModal({ open, onOpenChange }: AddWorkflowModalProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast.success("Workflow créé", {
      description: `Le workflow "${name}" a été créé avec succès.`
    });
    
    setIsLoading(false);
    setName("");
    setType("");
    setDescription("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Créer un workflow</DialogTitle>
          <DialogDescription>
            Automatisez vos processus de gestion SaaS.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nom du workflow</Label>
            <Input
              id="name"
              placeholder="Ex: Onboarding Marketing..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label>Type de workflow</Label>
            <div className="grid grid-cols-2 gap-2">
              {workflowTypes.map((wf) => (
                <button
                  key={wf.id}
                  type="button"
                  onClick={() => setType(wf.id)}
                  className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-all ${
                    type === wf.id 
                      ? "border-primary bg-accent" 
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <wf.icon className={`h-5 w-5 ${type === wf.id ? "text-primary" : "text-muted-foreground"}`} />
                  <div>
                    <p className="font-medium text-sm">{wf.name}</p>
                    <p className="text-xs text-muted-foreground">{wf.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Décrivez ce que ce workflow automatise..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isLoading || !type}>
              {isLoading ? "Création..." : "Créer le workflow"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
