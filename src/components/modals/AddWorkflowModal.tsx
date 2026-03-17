import { useState, useCallback } from "react";
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
import { toast } from "sonner";
import { UserPlus, UserMinus, Zap, ChevronLeft, ChevronRight, Plus, Loader2 } from "lucide-react";
import { WorkflowAction } from "@/types/workflow";
import { useWorkflowActions } from "@/hooks/useWorkflowActions";
import { ActionSelector } from "@/components/workflow/ActionSelector";
import { StepConfigEditor } from "@/components/workflow/StepConfigEditor";
import { StepsList } from "@/components/workflow/StepsList";
import { supabase } from "@/integrations/supabase/client";
import { canonicalActionId, createActionSnapshot } from "@/config/workflowActions";

interface AddWorkflowModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onWorkflowCreated?: () => void;
}

interface WorkflowStepDraft {
  id: string;
  action: WorkflowAction;
  config: Record<string, unknown>;
}

const workflowTypes = [
  { id: "onboarding", name: "Onboarding", icon: UserPlus, description: "Automatiser l'arrivée des nouveaux collaborateurs" },
  { id: "offboarding", name: "Offboarding", icon: UserMinus, description: "Gérer le départ des collaborateurs" },
  { id: "custom", name: "Personnalisé", icon: Zap, description: "Créer un workflow sur mesure" },
] as const;

type WorkflowType = typeof workflowTypes[number]["id"];

export function AddWorkflowModal({ open, onOpenChange, onWorkflowCreated }: AddWorkflowModalProps) {
  // Multi-step state
  const [currentStep, setCurrentStep] = useState(0);

  // Form data
  const [name, setName] = useState("");
  const [type, setType] = useState<WorkflowType | "">("");
  const [description, setDescription] = useState("");
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStepDraft[]>([]);

  // Action selection state
  const [selectedAction, setSelectedAction] = useState<WorkflowAction | null>(null);
  const [stepConfig, setStepConfig] = useState<Record<string, unknown>>({});
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);

  const [isLoading, setIsLoading] = useState(false);

  // Fetch available actions
  const { actions, connectedIntegrations, isLoading: actionsLoading } = useWorkflowActions();

  const resetForm = useCallback(() => {
    setCurrentStep(0);
    setName("");
    setType("");
    setDescription("");
    setWorkflowSteps([]);
    setSelectedAction(null);
    setStepConfig({});
    setEditingStepIndex(null);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onOpenChange(false);
  }, [resetForm, onOpenChange]);

  // Step navigation
  const canProceed = () => {
    switch (currentStep) {
      case 0: return name.trim() !== "" && type !== "";
      case 1: return workflowSteps.length > 0;
      default: return true;
    }
  };

  const handleNext = () => {
    if (currentStep < 2) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Step management
  const handleAddStep = () => {
    if (!selectedAction) return;

    if (editingStepIndex !== null) {
      // Editing existing step
      setWorkflowSteps(prev => {
        const updated = [...prev];
        updated[editingStepIndex] = {
          ...updated[editingStepIndex],
          action: selectedAction,
          config: stepConfig,
        };
        return updated;
      });
      setEditingStepIndex(null);
    } else {
      // Adding new step
      setWorkflowSteps(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          action: selectedAction,
          config: stepConfig,
        },
      ]);
    }

    setSelectedAction(null);
    setStepConfig({});
  };

  const handleEditStep = (index: number) => {
    const step = workflowSteps[index];
    setSelectedAction(step.action);
    setStepConfig(step.config);
    setEditingStepIndex(index);
  };

  const handleRemoveStep = (index: number) => {
    setWorkflowSteps(prev => prev.filter((_, i) => i !== index));
    if (editingStepIndex === index) {
      setEditingStepIndex(null);
      setSelectedAction(null);
      setStepConfig({});
    }
  };

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= workflowSteps.length) return;

    setWorkflowSteps(prev => {
      const updated = [...prev];
      [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
      return updated;
    });
  };

  // Submit workflow
  const handleSubmit = async () => {
    if (!type) return;

    setIsLoading(true);

    try {
      // 1. Create workflow
      const { data: workflow, error: workflowError } = await supabase
        .from('workflows')
        .insert({
          name,
          description: description || null,
          type,
          is_active: true,
          steps: [], // Legacy field, we use workflow_steps table now
        })
        .select()
        .single();

      if (workflowError) throw workflowError;

      // 2. Create workflow steps
      if (workflowSteps.length > 0) {
        const stepsPayload = workflowSteps.map((step, index) => ({
          action: step.action,
          config: step.config,
          step_order: index + 1,
        }));

        const insertStepsLegacy = async () => {
          const byIntegration = new Map<string, Set<string>>();
          stepsPayload.forEach(s => {
            const set = byIntegration.get(s.action.integration_id) ?? new Set<string>();
            set.add(s.action.action_key);
            byIntegration.set(s.action.integration_id, set);
          });

          const idByCanonical = new Map<string, string>();
          for (const [integrationId, actionKeys] of byIntegration.entries()) {
            const { data, error } = await supabase
              .from('workflow_actions')
              .select('id, integration_id, action_key')
              .eq('integration_id', integrationId)
              // @ts-expect-error supabase types are stale in this repo
              .in('action_key', Array.from(actionKeys));

            if (error) throw error;

            (data ?? []).forEach((row: unknown) => {
              const typed = row as { id: string; integration_id: string; action_key: string };
              idByCanonical.set(canonicalActionId(typed.integration_id, typed.action_key), typed.id);
            });
          }

          const legacySteps: Array<Record<string, unknown>> = stepsPayload.map(step => {
            const actionId = idByCanonical.get(canonicalActionId(step.action.integration_id, step.action.action_key));
            if (!actionId) {
              throw new Error(`Action introuvable dans workflow_actions: ${step.action.integration_id}:${step.action.action_key}`);
            }
            return {
              workflow_id: workflow.id,
              action_id: actionId,
              step_order: step.step_order,
              config: step.config,
            };
          });

          const { error: stepsError } = await supabase
            .from('workflow_steps')
            // @ts-expect-error Supabase row types are stale in this repo.
            .insert(legacySteps);

          if (stepsError) throw stepsError;
        };

        try {
          const stepsToInsert = stepsPayload.map(step => ({
            workflow_id: workflow.id,
            action_id: null,
            integration_id: step.action.integration_id,
            action_key: step.action.action_key,
            action_snapshot: createActionSnapshot(step.action),
            step_order: step.step_order,
            config: step.config,
          }));

          const { error: stepsError } = await supabase
            .from('workflow_steps')
            // @ts-expect-error Supabase row types are stale in this repo.
            .insert(stepsToInsert as unknown as Record<string, unknown>[]);

          if (stepsError) {
            throw stepsError;
          }
        } catch {
          await insertStepsLegacy();
        }
      }

      // 3. Create workflow variables based on config
      const variables = new Set<string>();
      workflowSteps.forEach(step => {
        Object.values(step.config).forEach(value => {
          if (typeof value === 'string') {
            const matches = value.match(/\{\{(\w+)\}\}/g);
            if (matches) {
              matches.forEach(match => {
                variables.add(match.replace(/\{\{|\}\}/g, ''));
              });
            }
          }
        });
      });

      if (variables.size > 0) {
        const variablesToInsert = Array.from(variables).map(varName => ({
          workflow_id: workflow.id,
          name: varName,
          label: varName.charAt(0).toUpperCase() + varName.slice(1).replace(/([A-Z])/g, ' $1'),
          type: varName.toLowerCase().includes('email') ? 'email' : 'string',
          required: true,
        }));

        await supabase
          .from('workflow_variables')
          // @ts-expect-error Supabase row types are stale in this repo.
          .insert(variablesToInsert as unknown as Record<string, unknown>[]);
      }

      toast.success("Workflow créé", {
        description: `Le workflow "${name}" a été créé avec ${workflowSteps.length} action(s).`
      });

      onWorkflowCreated?.();
      handleClose();
    } catch (error) {
      console.error('Error creating workflow:', error);
      toast.error("Erreur", {
        description: "Impossible de créer le workflow. Veuillez réessayer."
      });
    } finally {
      setIsLoading(false);
    }
  };

  const stepTitles = ["Informations", "Actions", "Résumé"];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Créer un workflow</DialogTitle>
          <DialogDescription>
            Étape {currentStep + 1} sur 3 : {stepTitles[currentStep]}
          </DialogDescription>

          {/* Progress bar */}
          <div className="flex gap-2 pt-2">
            {stepTitles.map((_, index) => (
              <div
                key={index}
                className={`h-1 flex-1 rounded-full transition-colors ${index <= currentStep ? "bg-primary" : "bg-muted"
                  }`}
              />
            ))}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {/* Step 0: Basic Info */}
          {currentStep === 0 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom du workflow</Label>
                <Input
                  id="name"
                  placeholder="Ex: Onboarding Développeur..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Type de workflow</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {workflowTypes.map((wf) => (
                    <button
                      key={wf.id}
                      type="button"
                      onClick={() => setType(wf.id)}
                      className={`flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-all ${type === wf.id
                        ? "border-primary bg-accent"
                        : "border-border hover:border-primary/50"
                        }`}
                    >
                      <wf.icon className={`h-6 w-6 ${type === wf.id ? "text-primary" : "text-muted-foreground"}`} />
                      <p className="font-medium text-sm">{wf.name}</p>
                      <p className="text-xs text-muted-foreground">{wf.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (optionnel)</Label>
                <Textarea
                  id="description"
                  placeholder="Décrivez ce que ce workflow automatise..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* Step 1: Actions Builder */}
          {currentStep === 1 && (
            <div className="space-y-6">
              {/* Current steps list */}
              <div className="space-y-2">
                <Label>Actions configurées ({workflowSteps.length})</Label>
                <StepsList
                  steps={workflowSteps}
                  onMoveUp={(i) => handleMoveStep(i, 'up')}
                  onMoveDown={(i) => handleMoveStep(i, 'down')}
                  onRemove={handleRemoveStep}
                  onEdit={handleEditStep}
                />
              </div>

              {/* Add/Edit action section */}
              <div className="border-t pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <Label>
                    {editingStepIndex !== null ? "Modifier l'action" : "Ajouter une action"}
                  </Label>
                  {editingStepIndex !== null && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingStepIndex(null);
                        setSelectedAction(null);
                        setStepConfig({});
                      }}
                    >
                      Annuler modification
                    </Button>
                  )}
                </div>

                {actionsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Action selector */}
                    <div className="border rounded-lg p-3">
                      <ActionSelector
                        actions={actions}
                        connectedIntegrations={connectedIntegrations as unknown as Record<string, boolean>}
                        selectedAction={selectedAction}
                        onSelect={(action) => {
                          setSelectedAction(action);
                          setStepConfig({});
                        }}
                      />
                    </div>

                    {/* Config editor */}
                    <div className="border rounded-lg p-3">
                      {selectedAction ? (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <Label>Configuration</Label>
                            <Button size="sm" onClick={handleAddStep}>
                              <Plus className="h-4 w-4 mr-1" />
                              {editingStepIndex !== null ? "Mettre à jour" : "Ajouter"}
                            </Button>
                          </div>
                          <StepConfigEditor
                            action={selectedAction}
                            config={stepConfig}
                            onChange={setStepConfig}
                          />
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                          Sélectionnez une action pour la configurer
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Summary */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="rounded-lg border bg-card p-4 space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Nom</p>
                  <p className="font-medium">{name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Type</p>
                  <p className="font-medium">{workflowTypes.find(t => t.id === type)?.name}</p>
                </div>
                {description && (
                  <div>
                    <p className="text-sm text-muted-foreground">Description</p>
                    <p className="text-sm">{description}</p>
                  </div>
                )}
              </div>

              <div>
                <Label className="mb-2 block">Séquence d'actions ({workflowSteps.length})</Label>
                <StepsList
                  steps={workflowSteps}
                  onMoveUp={(i) => handleMoveStep(i, 'up')}
                  onMoveDown={(i) => handleMoveStep(i, 'down')}
                  onRemove={handleRemoveStep}
                  onEdit={(i) => {
                    setCurrentStep(1);
                    handleEditStep(i);
                  }}
                />
              </div>

              {/* Variables preview */}
              {(() => {
                const variables = new Set<string>();
                workflowSteps.forEach(step => {
                  Object.values(step.config).forEach(value => {
                    if (typeof value === 'string') {
                      const matches = value.match(/\{\{(\w+)\}\}/g);
                      if (matches) {
                        matches.forEach(match => variables.add(match.replace(/\{\{|\}\}/g, '')));
                      }
                    }
                  });
                });

                if (variables.size === 0) return null;

                return (
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <p className="text-sm font-medium mb-2">Variables à remplir lors de l'exécution</p>
                    <div className="flex flex-wrap gap-2">
                      {Array.from(variables).map(v => (
                        <span key={v} className="px-2 py-1 bg-primary/10 text-primary text-xs rounded font-mono">
                          {`{{${v}}}`}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 gap-2 sm:gap-0">
          {currentStep > 0 && (
            <Button variant="outline" onClick={handleBack}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Retour
            </Button>
          )}

          {currentStep < 2 ? (
            <Button onClick={handleNext} disabled={!canProceed()}>
              Suivant
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Création...
                </>
              ) : (
                "Créer le workflow"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
