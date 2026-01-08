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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ToolLogo } from "@/components/tools/ToolLogo";
import { toast } from "sonner";
import { Tool } from "@/components/tools/ToolCard";

interface AccessRequestModalProps {
  tool: Tool | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AccessRequestModal({ tool, open, onOpenChange }: AccessRequestModalProps) {
  const [reason, setReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  if (!tool) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast.success("Demande envoyée", {
      description: `Votre demande d'accès à ${tool.name} a été soumise.`
    });
    
    setIsLoading(false);
    setReason("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <ToolLogo name={tool.name} size="md" />
            <div>
              <DialogTitle className="font-display">Demander l'accès</DialogTitle>
              <p className="text-sm text-muted-foreground">{tool.name}</p>
            </div>
          </div>
          <DialogDescription>
            Expliquez pourquoi vous avez besoin d'accéder à cet outil.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="reason">Justification</Label>
            <Textarea
              id="reason"
              placeholder="Décrivez votre besoin et comment cet outil vous aidera dans votre travail..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              required
            />
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Envoi..." : "Envoyer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
