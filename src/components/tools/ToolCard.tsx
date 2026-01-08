import { motion } from "framer-motion";
import { ExternalLink, Check, Clock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface Tool {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  status: "available" | "pending" | "active";
  seats?: number;
  usedSeats?: number;
  monthlySpend?: number;
}

interface ToolCardProps {
  tool: Tool;
  onRequestAccess?: (toolId: string) => void;
  onOpenTool?: (toolId: string) => void;
}

const statusConfig = {
  available: {
    label: "Disponible",
    variant: "outline" as const,
    icon: Plus,
  },
  pending: {
    label: "En attente",
    variant: "secondary" as const,
    icon: Clock,
  },
  active: {
    label: "Actif",
    variant: "default" as const,
    icon: Check,
  },
};

export function ToolCard({ tool, onRequestAccess, onOpenTool }: ToolCardProps) {
  const config = statusConfig[tool.status];
  const StatusIcon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className="group relative flex flex-col rounded-xl border border-border bg-card p-5 shadow-card transition-all duration-200 hover:shadow-card-hover hover:border-primary/20"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-2xl">
            {tool.icon}
          </div>
          <div>
            <h3 className="font-display text-base font-semibold text-foreground group-hover:text-primary transition-colors">
              {tool.name}
            </h3>
            <p className="text-xs text-muted-foreground">{tool.category}</p>
          </div>
        </div>
        <Badge 
          variant={tool.status === "active" ? "default" : tool.status === "pending" ? "secondary" : "outline"}
          className={cn(
            "gap-1",
            tool.status === "active" && "bg-success text-success-foreground"
          )}
        >
          <StatusIcon className="h-3 w-3" />
          {config.label}
        </Badge>
      </div>

      {/* Description */}
      <p className="mt-3 flex-1 text-sm text-muted-foreground line-clamp-2">
        {tool.description}
      </p>

      {/* Stats (for active tools) */}
      {tool.status === "active" && tool.seats && (
        <div className="mt-4 flex items-center gap-4 rounded-lg bg-muted/50 px-3 py-2">
          <div className="text-center">
            <p className="text-lg font-semibold text-foreground">
              {tool.usedSeats}/{tool.seats}
            </p>
            <p className="text-xs text-muted-foreground">Licences</p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="text-center">
            <p className="text-lg font-semibold text-foreground">
              €{tool.monthlySpend?.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">/mois</p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex gap-2">
        {tool.status === "available" && (
          <Button 
            variant="default" 
            size="sm" 
            className="flex-1"
            onClick={() => onRequestAccess?.(tool.id)}
          >
            <Plus className="h-4 w-4" />
            Demander l'accès
          </Button>
        )}
        {tool.status === "pending" && (
          <Button variant="secondary" size="sm" className="flex-1" disabled>
            <Clock className="h-4 w-4" />
            En attente d'approbation
          </Button>
        )}
        {tool.status === "active" && (
          <>
            <Button 
              variant="soft" 
              size="sm" 
              className="flex-1"
              onClick={() => onOpenTool?.(tool.id)}
            >
              <ExternalLink className="h-4 w-4" />
              Ouvrir
            </Button>
            <Button variant="outline" size="sm">
              Gérer
            </Button>
          </>
        )}
      </div>
    </motion.div>
  );
}
