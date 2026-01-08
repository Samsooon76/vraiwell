import { motion } from "framer-motion";
import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ToolLogo } from "@/components/tools/ToolLogo";
import { 
  Plus, 
  Play,
  Pause,
  Settings,
  MoreHorizontal,
  Zap,
  ArrowRight,
  Users,
  UserMinus
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AddWorkflowModal } from "@/components/modals/AddWorkflowModal";

interface Workflow {
  id: string;
  name: string;
  description: string;
  type: "onboarding" | "offboarding" | "custom";
  isActive: boolean;
  steps: { name: string; tool: string }[];
  lastRun?: string;
  runsCount: number;
}

const mockWorkflows: Workflow[] = [
  {
    id: "1",
    name: "Onboarding Standard",
    description: "Workflow d'onboarding pour nouveaux employés",
    type: "onboarding",
    isActive: true,
    steps: [
      { name: "Créer compte Google", tool: "Google Workspace" },
      { name: "Inviter sur Slack", tool: "Slack" },
      { name: "Ajouter à Notion", tool: "Notion" },
    ],
    lastRun: "Il y a 2h",
    runsCount: 45,
  },
  {
    id: "2",
    name: "Onboarding Tech",
    description: "Workflow d'onboarding pour développeurs",
    type: "onboarding",
    isActive: true,
    steps: [
      { name: "Créer compte Google", tool: "Google Workspace" },
      { name: "Inviter sur Slack", tool: "Slack" },
      { name: "Accès GitHub", tool: "GitHub" },
      { name: "Ajouter à Notion", tool: "Notion" },
    ],
    lastRun: "Il y a 1j",
    runsCount: 23,
  },
  {
    id: "3",
    name: "Offboarding Standard",
    description: "Workflow de départ collaborateur",
    type: "offboarding",
    isActive: true,
    steps: [
      { name: "Désactiver Google", tool: "Google Workspace" },
      { name: "Retirer de Slack", tool: "Slack" },
      { name: "Archiver Notion", tool: "Notion" },
    ],
    lastRun: "Il y a 5j",
    runsCount: 12,
  },
];

const typeConfig = {
  onboarding: { label: "Onboarding", icon: Users, color: "bg-success/10 text-success" },
  offboarding: { label: "Offboarding", icon: UserMinus, color: "bg-warning/10 text-warning" },
  custom: { label: "Personnalisé", icon: Zap, color: "bg-primary/10 text-primary" },
};

export default function Workflows() {
  const [workflows] = useState(mockWorkflows);
  const [addWorkflowOpen, setAddWorkflowOpen] = useState(false);

  const activeCount = workflows.filter(w => w.isActive).length;
  const totalRuns = workflows.reduce((sum, w) => sum + w.runsCount, 0);

  return (
    <DashboardLayout>
      <div className="p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div>
            <h1 className="font-display text-display-md text-foreground">Workflows</h1>
            <p className="mt-1 text-body-md text-muted-foreground">
              Automatisez l'onboarding et l'offboarding de vos équipes
            </p>
          </div>
          <Button variant="hero" size="lg" onClick={() => setAddWorkflowOpen(true)}>
            <Plus className="h-4 w-4" />
            Nouveau workflow
          </Button>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8 grid gap-4 sm:grid-cols-3"
        >
          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{workflows.length}</p>
                <p className="text-sm text-muted-foreground">Workflows</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 text-success">
                <Play className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{activeCount}</p>
                <p className="text-sm text-muted-foreground">Actifs</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 shadow-card">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/10 text-secondary">
                <ArrowRight className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{totalRuns}</p>
                <p className="text-sm text-muted-foreground">Exécutions totales</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Workflows list */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="space-y-4"
        >
          {workflows.map((workflow, index) => {
            const TypeIcon = typeConfig[workflow.type].icon;
            return (
              <motion.div
                key={workflow.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
                className="rounded-xl border border-border bg-card p-6 shadow-card transition-all duration-200 hover:shadow-card-hover"
              >
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  {/* Workflow info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-display text-lg font-semibold text-foreground">
                        {workflow.name}
                      </h3>
                      <Badge className={typeConfig[workflow.type].color}>
                        <TypeIcon className="h-3 w-3 mr-1" />
                        {typeConfig[workflow.type].label}
                      </Badge>
                      {workflow.isActive ? (
                        <Badge className="bg-success/10 text-success border-0">Actif</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">Inactif</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      {workflow.description}
                    </p>

                    {/* Steps */}
                    <div className="flex flex-wrap items-center gap-2">
                      {workflow.steps.map((step, stepIndex) => (
                        <div key={stepIndex} className="flex items-center gap-2">
                          <div className="flex items-center gap-2 rounded-full bg-muted px-3 py-1.5">
                            <ToolLogo name={step.tool} size="sm" className="h-5 w-5 text-[10px]" />
                            <span className="text-xs font-medium text-foreground">{step.name}</span>
                          </div>
                          {stepIndex < workflow.steps.length - 1 && (
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Stats & Actions */}
                  <div className="flex items-center gap-4 lg:gap-6">
                    <div className="text-center">
                      <p className="text-lg font-semibold text-foreground">{workflow.runsCount}</p>
                      <p className="text-xs text-muted-foreground">Exécutions</p>
                    </div>
                    {workflow.lastRun && (
                      <div className="text-center">
                        <p className="text-sm font-medium text-foreground">{workflow.lastRun}</p>
                        <p className="text-xs text-muted-foreground">Dernière exécution</p>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button variant="soft" size="sm">
                        <Play className="h-4 w-4" />
                        Exécuter
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Settings className="h-4 w-4 mr-2" />
                            Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Pause className="h-4 w-4 mr-2" />
                            {workflow.isActive ? "Désactiver" : "Activer"}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Empty state for new workflow */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-6 rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center"
        >
          <Zap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-display text-lg font-semibold text-foreground mb-2">
            Créez votre premier workflow personnalisé
          </h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
            Combinez plusieurs outils pour automatiser des tâches complexes comme l'onboarding d'un nouveau collaborateur.
          </p>
          <Button variant="hero" onClick={() => setAddWorkflowOpen(true)}>
            <Plus className="h-4 w-4" />
            Créer un workflow
          </Button>
        </motion.div>
      </div>
      
      <AddWorkflowModal open={addWorkflowOpen} onOpenChange={setAddWorkflowOpen} />
    </DashboardLayout>
  );
}
