import { motion } from "framer-motion";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
  UserMinus,
  Trash2,
  Loader2
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ExecuteWorkflowModal } from "@/components/modals/ExecuteWorkflowModal";
import { useWorkflows } from "@/hooks/useWorkflows";

const typeConfig = {
  onboarding: { label: "Onboarding", icon: Users, color: "bg-success/10 text-success" },
  offboarding: { label: "Offboarding", icon: UserMinus, color: "bg-warning/10 text-warning" },
  custom: { label: "Personnalisé", icon: Zap, color: "bg-primary/10 text-primary" },
};

const integrationLabels: Record<string, string> = {
  google: "Google Workspace",
  microsoft: "Microsoft 365",
  slack: "Slack",
  notion: "Notion",
  hubspot: "HubSpot",
};

export default function Workflows() {
  const navigate = useNavigate();
  const { workflows, isLoading, refetch, deleteWorkflow, toggleWorkflow } = useWorkflows();
  const [executeModalOpen, setExecuteModalOpen] = useState(false);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [workflowToDelete, setWorkflowToDelete] = useState<string | null>(null);

  const activeCount = workflows.filter(w => w.is_active).length;
  const totalRuns = 0; // TODO: Count from logs

  const handleExecute = (workflowId: string) => {
    setSelectedWorkflowId(workflowId);
    setExecuteModalOpen(true);
  };

  const handleDelete = (workflowId: string) => {
    setWorkflowToDelete(workflowId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (workflowToDelete) {
      await deleteWorkflow(workflowToDelete);
      setWorkflowToDelete(null);
    }
    setDeleteDialogOpen(false);
  };

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
          <Button variant="hero" size="lg" onClick={() => navigate('/dashboard/workflows/new')}>
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

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Workflows list */}
        {!isLoading && workflows.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="space-y-4"
          >
            {workflows.map((workflow, index) => {
              const TypeIcon = typeConfig[workflow.type as keyof typeof typeConfig]?.icon || Zap;
              const typeInfo = typeConfig[workflow.type as keyof typeof typeConfig] || typeConfig.custom;

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
                        <Badge className={typeInfo.color}>
                          <TypeIcon className="h-3 w-3 mr-1" />
                          {typeInfo.label}
                        </Badge>
                        {workflow.is_active ? (
                          <Badge className="bg-success/10 text-success border-0">Actif</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">Inactif</Badge>
                        )}
                      </div>
                      {workflow.description && (
                        <p className="text-sm text-muted-foreground mb-4">
                          {workflow.description}
                        </p>
                      )}

                      {/* Steps */}
                      <div className="flex flex-wrap items-center gap-2">
                        {workflow.steps.map((step, stepIndex) => (
                          <div key={step.id} className="flex items-center gap-2">
                            <div className="flex items-center gap-2 rounded-full bg-muted px-3 py-1.5">
                              <ToolLogo
                                name={integrationLabels[step.action?.integration_id] || ''}
                                size="sm"
                                className="h-4 w-4"
                              />
                              <span className="text-xs font-medium text-foreground">
                                {step.action?.name || 'Action'}
                              </span>
                            </div>
                            {stepIndex < workflow.steps.length - 1 && (
                              <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        ))}
                        {workflow.steps.length === 0 && (
                          <span className="text-xs text-muted-foreground">Aucune action configurée</span>
                        )}
                      </div>
                    </div>

                    {/* Stats & Actions */}
                    <div className="flex items-center gap-4 lg:gap-6">
                      <div className="text-center">
                        <p className="text-lg font-semibold text-foreground">{workflow.steps.length}</p>
                        <p className="text-xs text-muted-foreground">Actions</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="soft"
                          size="sm"
                          onClick={() => handleExecute(workflow.id)}
                          disabled={workflow.steps.length === 0}
                        >
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
                            <DropdownMenuItem onClick={() => navigate(`/dashboard/workflows/${workflow.id}`)}>
                              <Settings className="h-4 w-4 mr-2" />
                              Modifier
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggleWorkflow(workflow.id, !workflow.is_active)}>
                              {workflow.is_active ? (
                                <>
                                  <Pause className="h-4 w-4 mr-2" />
                                  Désactiver
                                </>
                              ) : (
                                <>
                                  <Play className="h-4 w-4 mr-2" />
                                  Activer
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDelete(workflow.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
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
        )}

        {/* Empty state */}
        {!isLoading && workflows.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center"
          >
            <Zap className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-display text-lg font-semibold text-foreground mb-2">
              Créez votre premier workflow
            </h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
              Combinez plusieurs outils pour automatiser des tâches complexes comme l'onboarding d'un nouveau collaborateur.
            </p>
            <Button variant="hero" onClick={() => navigate('/dashboard/workflows/new')}>
              <Plus className="h-4 w-4" />
              Créer un workflow
            </Button>
          </motion.div>
        )}
      </div>



      {selectedWorkflowId && (
        <ExecuteWorkflowModal
          open={executeModalOpen}
          onOpenChange={setExecuteModalOpen}
          workflowId={selectedWorkflowId}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce workflow ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le workflow et toutes ses actions seront définitivement supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
