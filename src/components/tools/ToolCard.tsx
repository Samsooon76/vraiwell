import { motion } from "framer-motion";
import { ExternalLink, Check, Clock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ToolLogo } from "./ToolLogo";

export interface ToolStat {
  label: string;
  value: string;
}

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
  stats?: ToolStat[];
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
  const fallbackStats: ToolStat[] = [
    {
      label: tool.seats && tool.usedSeats !== undefined ? "Licences" : "Statut",
      value: tool.seats && tool.usedSeats !== undefined
        ? `${tool.usedSeats}/${tool.seats}`
        : "Connecté",
    },
    {
      label: "Coût",
      value: `€${tool.monthlySpend?.toLocaleString() ?? 0}/mois`,
    },
  ];

  const displayStats = (tool.stats?.length ? tool.stats : fallbackStats).slice(0, 2);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className="group relative flex h-full flex-col rounded-xl border border-border bg-card p-5 shadow-card transition-all duration-200 hover:shadow-card-hover hover:border-primary/20"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <ToolLogo name={tool.name} size="lg" />
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
      <p className="mt-3 min-h-[3.5rem] text-sm text-muted-foreground line-clamp-2">
        {tool.description}
      </p>

      {/* Stats (for active tools) */}
      {tool.status === "active" && (
        <div className="mt-4 grid min-h-[88px] grid-cols-2 overflow-hidden rounded-lg bg-muted/50">
          {displayStats.map((stat, index) => (
            <div
              key={`${tool.id}-${stat.label}`}
              className={cn(
                "flex flex-col justify-center px-4 py-3",
                index === 0 && "border-r border-border",
              )}
            >
              <p className="text-3xl font-semibold leading-none text-foreground">
                {stat.value}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="mt-auto pt-4 flex gap-2">
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
