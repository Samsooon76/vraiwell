import { motion } from "framer-motion";
import { Check, X, Clock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface AccessRequest {
  id: string;
  userName: string;
  userEmail: string;
  userAvatar?: string;
  toolName: string;
  toolIcon: string;
  status: "pending" | "approved" | "rejected";
  requestedAt: string;
  team: string;
}

interface RequestItemProps {
  request: AccessRequest;
  onApprove?: (requestId: string) => void;
  onReject?: (requestId: string) => void;
}

const statusConfig = {
  pending: {
    label: "En attente",
    variant: "secondary" as const,
    className: "bg-warning/10 text-warning border-warning/20",
  },
  approved: {
    label: "Approuvée",
    variant: "default" as const,
    className: "bg-success/10 text-success border-success/20",
  },
  rejected: {
    label: "Refusée",
    variant: "destructive" as const,
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
};

export function RequestItem({ request, onApprove, onReject }: RequestItemProps) {
  const config = statusConfig[request.status];

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/30"
    >
      {/* User info */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent shrink-0">
          {request.userAvatar ? (
            <img 
              src={request.userAvatar} 
              alt={request.userName} 
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <User className="h-5 w-5 text-accent-foreground" />
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{request.userName}</p>
          <p className="truncate text-sm text-muted-foreground">{request.team}</p>
        </div>
      </div>

      {/* Tool info */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xl">{request.toolIcon}</span>
        <span className="text-sm font-medium text-foreground">{request.toolName}</span>
      </div>

      {/* Status */}
      <Badge 
        variant="outline" 
        className={cn("shrink-0", config.className)}
      >
        {config.label}
      </Badge>

      {/* Date */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground shrink-0">
        <Clock className="h-4 w-4" />
        {request.requestedAt}
      </div>

      {/* Actions */}
      {request.status === "pending" && (
        <div className="flex gap-2 shrink-0">
          <Button 
            variant="success" 
            size="sm"
            onClick={() => onApprove?.(request.id)}
          >
            <Check className="h-4 w-4" />
            Approuver
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => onReject?.(request.id)}
          >
            <X className="h-4 w-4" />
            Refuser
          </Button>
        </div>
      )}
    </motion.div>
  );
}
