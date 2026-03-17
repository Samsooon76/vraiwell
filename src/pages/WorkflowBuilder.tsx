import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
    ArrowLeft,
    Save,
    Play,
    Plus,
    Settings2,
    Trash2,
    ChevronRight,
    Loader2,
    UserPlus,
    UserMinus,
    Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { WorkflowAction } from "@/types/workflow";
import { useWorkflowActions } from "@/hooks/useWorkflowActions";
import { ActionSelector } from "@/components/workflow/ActionSelector";
import { StepConfigEditor } from "@/components/workflow/StepConfigEditor";
import { ToolLogo } from "@/components/tools/ToolLogo";
import { canonicalActionId, createActionSnapshot, getIntegrationLabel, resolveWorkflowAction } from "@/config/workflowActions";

interface WorkflowStepDraft {
    id: string;
    action: WorkflowAction;
    config: Record<string, unknown>;
}

const workflowTypes = [
    { id: "onboarding", name: "Onboarding", icon: UserPlus, color: "bg-success/10 text-success border-success/30" },
    { id: "offboarding", name: "Offboarding", icon: UserMinus, color: "bg-warning/10 text-warning border-warning/30" },
    { id: "custom", name: "Personnalisé", icon: Zap, color: "bg-primary/10 text-primary border-primary/30" },
] as const;

type WorkflowType = typeof workflowTypes[number]["id"];

export default function WorkflowBuilder() {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const isEditMode = !!id;

    // Workflow state
    const [name, setName] = useState("Nouveau workflow");
    const [type, setType] = useState<WorkflowType>("onboarding");
    const [description, setDescription] = useState("");
    const [steps, setSteps] = useState<WorkflowStepDraft[]>([]);

    // UI state
    const [selectedStepIndex, setSelectedStepIndex] = useState<number | null>(null);
    const [isAddingStep, setIsAddingStep] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(isEditMode);

    // Actions from database
    const { actions, connectedIntegrations, isLoading: actionsLoading } = useWorkflowActions();

    const insertStepsLegacy = async (workflowId: string, stepsToInsert: Array<{
        action: WorkflowAction;
        config: Record<string, unknown>;
        step_order: number;
    }>) => {
        const byIntegration = new Map<string, Set<string>>();
        stepsToInsert.forEach(s => {
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

        const legacySteps: Array<Record<string, unknown>> = stepsToInsert.map(step => {
            const actionId = idByCanonical.get(canonicalActionId(step.action.integration_id, step.action.action_key));
            if (!actionId) {
                throw new Error(`Action introuvable dans workflow_actions: ${step.action.integration_id}:${step.action.action_key}`);
            }
            return {
                workflow_id: workflowId,
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

    const loadWorkflow = useCallback(async (workflowId: string) => {
        setIsLoading(true);
        try {
            // Fetch workflow
            const { data: workflow, error: workflowError } = await supabase
                .from('workflows')
                .select('*')
                .eq('id', workflowId)
                .single();

            if (workflowError) throw workflowError;

            setName(workflow.name);
            setType(workflow.type as WorkflowType);
            setDescription(workflow.description || "");

            let stepsData: unknown[] = [];
            try {
                const { data, error } = await supabase
                    .from('workflow_steps')
                    .select('id, config, step_order, integration_id, action_key, action_snapshot, action_id')
                    .eq('workflow_id', workflowId)
                    .order('step_order', { ascending: true });
                if (error) throw error;
                stepsData = data ?? [];
            } catch (err) {
                // Backward compatibility: schema may not have integration_id/action_key yet.
                const { data, error } = await supabase
                    .from('workflow_steps')
                    .select('*, action:workflow_actions(*)')
                    .eq('workflow_id', workflowId)
                    .order('step_order', { ascending: true });
                if (error) throw error;
                stepsData = data ?? [];
            }

            setSteps(stepsData.map((s: unknown) => {
                const typed = s as {
                    id: string;
                    config?: Record<string, unknown> | null;
                    integration_id?: string | null;
                    action_key?: string | null;
                    action_snapshot?: unknown;
                    action?: { integration_id?: string | null; action_key?: string | null } & Record<string, unknown>;
                };
                const resolved = resolveWorkflowAction({
                    integration_id: typed.integration_id ?? typed.action?.integration_id,
                    action_key: typed.action_key ?? typed.action?.action_key,
                    action_snapshot: typed.action_snapshot ?? typed.action ?? null,
                });

                return {
                    id: typed.id,
                    action: resolved.action,
                    config: typed.config || {},
                };
            }));

        } catch (error) {
            console.error('Error loading workflow:', error);
            toast.error("Erreur lors du chargement du workflow");
            navigate('/dashboard/workflows');
        } finally {
            setIsLoading(false);
        }
    }, [navigate]);

    // Load existing workflow if editing
    useEffect(() => {
        if (isEditMode && id) {
            void loadWorkflow(id);
        }
    }, [id, isEditMode, loadWorkflow]);

    const handleAddAction = (action: WorkflowAction) => {
        const newStep: WorkflowStepDraft = {
            id: crypto.randomUUID(),
            action,
            config: {},
        };
        setSteps([...steps, newStep]);
        setSelectedStepIndex(steps.length);
        setIsAddingStep(false);
    };

    const handleUpdateStepConfig = (config: Record<string, unknown>) => {
        if (selectedStepIndex === null) return;

        setSteps(prev => {
            const updated = [...prev];
            updated[selectedStepIndex] = {
                ...updated[selectedStepIndex],
                config,
            };
            return updated;
        });
    };

    const handleRemoveStep = (index: number) => {
        setSteps(prev => prev.filter((_, i) => i !== index));
        if (selectedStepIndex === index) {
            setSelectedStepIndex(null);
        } else if (selectedStepIndex !== null && selectedStepIndex > index) {
            setSelectedStepIndex(selectedStepIndex - 1);
        }
    };

    const handleSave = async () => {
        if (!name.trim()) {
            toast.error("Le nom du workflow est requis");
            return;
        }

        if (steps.length === 0) {
            toast.error("Ajoutez au moins une action");
            return;
        }

        setIsSaving(true);

        try {
            let workflowId = id;

            if (isEditMode && id) {
                // Update existing workflow
                const { error: updateError } = await supabase
                    .from('workflows')
                    .update({
                        name,
                        description: description || null,
                        type,
                    })
                    .eq('id', id);

                if (updateError) throw updateError;

                // Delete existing steps
                await supabase
                    .from('workflow_steps')
                    .delete()
                    .eq('workflow_id', id);

            } else {
                // Create new workflow
                const { data: workflow, error: createError } = await supabase
                    .from('workflows')
                    .insert({
                        name,
                        description: description || null,
                        type,
                        is_active: true,
                        steps: [],
                    })
                    .select()
                    .single();

                if (createError) throw createError;
                workflowId = workflow.id;
            }

            // Insert steps
            if (steps.length > 0 && workflowId) {
                const stepsPayload = steps.map((step, index) => ({
                    action: step.action,
                    config: step.config,
                    step_order: index + 1,
                }));

                try {
                    const stepsToInsert = stepsPayload.map(step => ({
                        workflow_id: workflowId,
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
                } catch (err) {
                    // Legacy fallback: action_id is required and integration_id/action_key columns may not exist.
                    await insertStepsLegacy(workflowId, stepsPayload);
                }
            }

            // Extract and save variables
            const variables = new Set<string>();
            steps.forEach(step => {
                Object.values(step.config).forEach(value => {
                    if (typeof value === 'string') {
                        const matches = value.match(/\{\{(\w+)\}\}/g);
                        if (matches) {
                            matches.forEach(match => variables.add(match.replace(/\{\{|\}\}/g, '')));
                        }
                    }
                });
            });

            if (workflowId) {
                // Always reset variables to avoid stale prompts after edits.
                await supabase
                    .from('workflow_variables')
                    .delete()
                    .eq('workflow_id', workflowId);

                if (variables.size > 0) {
                    const variablesToInsert = Array.from(variables).map(varName => ({
                        workflow_id: workflowId,
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
            }

            toast.success(isEditMode ? "Workflow mis à jour" : "Workflow créé", {
                description: `Le workflow "${name}" a été ${isEditMode ? 'mis à jour' : 'créé'} avec ${steps.length} action(s).`
            });

            navigate('/dashboard/workflows');

        } catch (error) {
            console.error('Error saving workflow:', error);
            toast.error("Erreur lors de la sauvegarde");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const selectedStep = selectedStepIndex !== null ? steps[selectedStepIndex] : null;
    const typeConfig = workflowTypes.find(t => t.id === type);
    const TypeIcon = typeConfig?.icon || Zap;

    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* Toolbar */}
            <header className="border-b border-border bg-card px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate('/dashboard/workflows')}
                        >
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Retour
                        </Button>

                        <div className="h-6 w-px bg-border" />

                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="text-lg font-semibold border-0 bg-transparent focus-visible:ring-0 w-64"
                            placeholder="Nom du workflow"
                        />

                        <div className="flex gap-1">
                            {workflowTypes.map(wt => (
                                <button
                                    key={wt.id}
                                    onClick={() => setType(wt.id)}
                                    className={`p-2 rounded-lg border transition-all ${type === wt.id ? wt.color + ' border-current' : 'border-transparent hover:bg-muted'
                                        }`}
                                >
                                    <wt.icon className="h-4 w-4" />
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button variant="outline" disabled={steps.length === 0}>
                            <Play className="h-4 w-4 mr-2" />
                            Tester
                        </Button>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Save className="h-4 w-4 mr-2" />
                            )}
                            {isEditMode ? 'Mettre à jour' : 'Sauvegarder'}
                        </Button>
                    </div>
                </div>
            </header>

            {/* Main content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left sidebar - Action palette */}
                <aside className={`
          w-80 border-r border-border bg-card flex flex-col transition-all
          ${isAddingStep ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
                    <div className="p-4 border-b border-border">
                        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                            Actions disponibles
                        </h2>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4">
                        {actionsLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : (
                            <ActionSelector
                                actions={actions}
                                connectedIntegrations={connectedIntegrations as unknown as Record<string, boolean>}
                                selectedAction={null}
                                onSelect={handleAddAction}
                            />
                        )}
                    </div>
                </aside>

                {/* Canvas */}
                <main className="flex-1 overflow-auto bg-muted/30 p-8">
                    <div className="max-w-xl mx-auto">
                        {/* Trigger node */}
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex flex-col items-center"
                        >
                            <div className={`
                rounded-xl border-2 bg-card p-4 shadow-lg w-full
                ${typeConfig?.color} border-current
              `}>
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/50">
                                        <TypeIcon className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="font-semibold">Déclencheur</p>
                                        <p className="text-sm opacity-75">{typeConfig?.name}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Connector */}
                            <div className="w-0.5 h-8 bg-border" />
                        </motion.div>

                        {/* Steps */}
                        {steps.map((step, index) => (
                            <motion.div
                                key={step.id}
                                initial={{ opacity: 0, y: -20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                className="flex flex-col items-center"
                            >
                                <button
                                    onClick={() => setSelectedStepIndex(index)}
                                    className={`
                    rounded-xl border-2 bg-card p-4 shadow-lg w-full text-left transition-all
                    ${selectedStepIndex === index
                                            ? 'border-primary ring-2 ring-primary/20'
                                            : 'border-border hover:border-primary/50'
                                        }
                  `}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                                            <ToolLogo
                                                name={getIntegrationLabel(step.action.integration_id)}
                                                size="sm"
                                                className="h-5 w-5"
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold truncate">{step.action.name}</p>
                                            <p className="text-sm text-muted-foreground truncate">
                                                {getIntegrationLabel(step.action.integration_id)}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Badge variant="secondary" className="text-xs">
                                                {Object.keys(step.config).length} param
                                            </Badge>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleRemoveStep(index);
                                                }}
                                            >
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </div>
                                    </div>
                                </button>

                                {/* Connector */}
                                <div className="w-0.5 h-8 bg-border" />
                            </motion.div>
                        ))}

                        {/* Add step button */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: steps.length * 0.1 }}
                            className="flex justify-center"
                        >
                            <Button
                                variant="outline"
                                size="lg"
                                className="rounded-xl border-dashed"
                                onClick={() => setIsAddingStep(true)}
                            >
                                <Plus className="h-5 w-5 mr-2" />
                                Ajouter une action
                            </Button>
                        </motion.div>

                        {/* Variables preview */}
                        {(() => {
                            const variables = new Set<string>();
                            steps.forEach(step => {
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
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="mt-8 rounded-xl border border-border bg-card p-4"
                                >
                                    <p className="text-sm font-medium mb-2 flex items-center gap-2">
                                        <Settings2 className="h-4 w-4" />
                                        Variables requises
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {Array.from(variables).map(v => (
                                            <Badge key={v} variant="secondary" className="font-mono">
                                                {`{{${v}}}`}
                                            </Badge>
                                        ))}
                                    </div>
                                </motion.div>
                            );
                        })()}
                    </div>
                </main>

                {/* Right sidebar - Step config */}
                <aside className={`
          w-96 border-l border-border bg-card flex flex-col transition-all
          ${selectedStep ? 'translate-x-0' : 'translate-x-full md:translate-x-0 md:w-0 md:border-0'}
        `}>
                    {selectedStep && (
                        <>
                            <div className="p-4 border-b border-border flex items-center justify-between">
                                <h2 className="font-semibold">Configuration</h2>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSelectedStepIndex(null)}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4">
                                <div className="flex items-center gap-3 mb-6 p-3 rounded-lg bg-muted">
                                    <ToolLogo
                                        name={getIntegrationLabel(selectedStep.action.integration_id)}
                                        size="sm"
                                        className="h-6 w-6"
                                    />
                                    <div>
                                        <p className="font-medium">{selectedStep.action.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {getIntegrationLabel(selectedStep.action.integration_id)}
                                        </p>
                                    </div>
                                </div>

                                <StepConfigEditor
                                    action={selectedStep.action}
                                    config={selectedStep.config}
                                    onChange={handleUpdateStepConfig}
                                />
                            </div>

                            <div className="p-4 border-t border-border">
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    className="w-full"
                                    onClick={() => {
                                        handleRemoveStep(selectedStepIndex!);
                                    }}
                                >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Supprimer cette action
                                </Button>
                            </div>
                        </>
                    )}
                </aside>
            </div>
        </div>
    );
}
