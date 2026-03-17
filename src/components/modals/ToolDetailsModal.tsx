import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ToolLogo } from "@/components/tools/ToolLogo";
import { ExternalLink, Calendar, Settings } from "lucide-react";
import { Tool } from "@/components/tools/ToolCard";

interface ToolDetailsModalProps {
  tool: Tool | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRequestAccess?: (toolId: string) => void;
}

export function ToolDetailsModal({ tool, open, onOpenChange, onRequestAccess }: ToolDetailsModalProps) {
  if (!tool) return null;

  const detailStats = tool.stats?.length
    ? tool.stats.slice(0, 2)
    : [
        {
          label: tool.seats !== undefined && tool.usedSeats !== undefined ? "Licences" : "Statut",
          value: tool.seats !== undefined && tool.usedSeats !== undefined
            ? `${tool.usedSeats}/${tool.seats}`
            : "Connecté",
        },
        {
          label: "Coût mensuel",
          value: `€${tool.monthlySpend?.toLocaleString() ?? 0}`,
        },
      ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <div className="flex items-center gap-4">
            <ToolLogo name={tool.name} size="lg" />
            <div>
              <DialogTitle className="font-display text-xl">{tool.name}</DialogTitle>
              <Badge variant="outline" className="mt-1">{tool.category}</Badge>
            </div>
          </div>
        </DialogHeader>
        
        <div className="space-y-6 mt-4">
          <p className="text-muted-foreground">{tool.description}</p>
          
          {tool.status === "active" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                {detailStats.map((stat) => (
                  <div key={`${tool.id}-${stat.label}`} className="rounded-lg border border-border p-4">
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>
              
              <div className="flex gap-2">
                <Button className="flex-1">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Ouvrir l'outil
                </Button>
                <Button variant="outline">
                  <Settings className="h-4 w-4 mr-2" />
                  Gérer
                </Button>
              </div>
            </>
          )}
          
          {tool.status === "available" && (
            <div className="flex flex-col items-center py-6 text-center">
              <p className="text-muted-foreground mb-4">
                Cet outil n'est pas encore activé pour votre équipe.
              </p>
              <Button onClick={() => onRequestAccess?.(tool.id)}>
                Demander l'accès
              </Button>
            </div>
          )}
          
          {tool.status === "pending" && (
            <div className="flex flex-col items-center py-6 text-center bg-muted/50 rounded-lg">
              <Calendar className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="font-medium text-foreground">Demande en attente</p>
              <p className="text-sm text-muted-foreground">
                Votre demande est en cours d'examen par l'administrateur.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
