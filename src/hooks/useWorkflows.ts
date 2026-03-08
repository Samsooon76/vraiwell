import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Workflow, WorkflowStep, WorkflowAction } from '@/types/workflow';
import { toast } from 'sonner';

interface WorkflowWithSteps extends Workflow {
    steps: Array<WorkflowStep & { action: WorkflowAction }>;
}

interface UseWorkflowsReturn {
    workflows: WorkflowWithSteps[];
    isLoading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
    deleteWorkflow: (id: string) => Promise<boolean>;
    toggleWorkflow: (id: string, isActive: boolean) => Promise<boolean>;
    executeWorkflow: (id: string, variables: Record<string, string>) => Promise<boolean>;
}

export function useWorkflows(): UseWorkflowsReturn {
    const [workflows, setWorkflows] = useState<WorkflowWithSteps[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchWorkflows = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            // Fetch workflows
            const { data: workflowsData, error: workflowsError } = await supabase
                .from('workflows')
                .select('*')
                .order('created_at', { ascending: false });

            if (workflowsError) throw workflowsError;

            // Fetch steps with actions for each workflow
            const workflowsWithSteps: WorkflowWithSteps[] = await Promise.all(
                (workflowsData || []).map(async (workflow: any) => {
                    const { data: stepsData } = await (supabase as any)
                        .from('workflow_steps')
                        .select(`
              *,
              action:workflow_actions(*)
            `)
                        .eq('workflow_id', workflow.id)
                        .order('step_order', { ascending: true });

                    return {
                        ...workflow,
                        steps: (stepsData || []).map((step: any) => ({
                            ...step,
                            action: step.action as WorkflowAction,
                        })),
                    };
                })
            );

            setWorkflows(workflowsWithSteps);
        } catch (err) {
            console.error('Error fetching workflows:', err);
            setError(err instanceof Error ? err.message : 'Failed to fetch workflows');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchWorkflows();
    }, [fetchWorkflows]);

    const deleteWorkflow = useCallback(async (id: string): Promise<boolean> => {
        try {
            const { error } = await supabase
                .from('workflows')
                .delete()
                .eq('id', id);

            if (error) throw error;

            setWorkflows(prev => prev.filter(w => w.id !== id));
            toast.success('Workflow supprimé');
            return true;
        } catch (err) {
            console.error('Error deleting workflow:', err);
            toast.error('Erreur lors de la suppression');
            return false;
        }
    }, []);

    const toggleWorkflow = useCallback(async (id: string, isActive: boolean): Promise<boolean> => {
        try {
            const { error } = await supabase
                .from('workflows')
                .update({ is_active: isActive })
                .eq('id', id);

            if (error) throw error;

            setWorkflows(prev =>
                prev.map(w => (w.id === id ? { ...w, is_active: isActive } : w))
            );
            toast.success(isActive ? 'Workflow activé' : 'Workflow désactivé');
            return true;
        } catch (err) {
            console.error('Error toggling workflow:', err);
            toast.error('Erreur lors de la mise à jour');
            return false;
        }
    }, []);

    const executeWorkflow = useCallback(async (
        id: string,
        variables: Record<string, string>
    ): Promise<boolean> => {
        const workflow = workflows.find(w => w.id === id);
        if (!workflow) {
            toast.error('Workflow introuvable');
            return false;
        }

        try {
            // Get auth session
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                toast.error('Session expirée');
                return false;
            }

            // Create execution log
            const { data: log, error: logError } = await (supabase as any)
                .from('workflow_logs')
                .insert({
                    workflow_id: id,
                    status: 'running',
                    input_data: variables,
                    executed_by: session.user.id,
                })
                .select()
                .single();

            if (logError) throw logError;

            // Execute each step in order
            let hasError = false;
            for (const step of workflow.steps) {
                if (hasError) break;

                try {
                    // Replace variables in config
                    const resolvedConfig: Record<string, unknown> = {};
                    for (const [key, value] of Object.entries(step.config)) {
                        if (typeof value === 'string') {
                            let resolved = value;
                            for (const [varName, varValue] of Object.entries(variables)) {
                                resolved = resolved.replace(new RegExp(`\\{\\{${varName}\\}\\}`, 'g'), varValue);
                            }
                            resolvedConfig[key] = resolved;
                        } else {
                            resolvedConfig[key] = value;
                        }
                    }

                    // Call the appropriate edge function if available
                    if (step.action.edge_function) {
                        // Get provider token based on integration
                        // This would need to be enhanced to get actual tokens
                        const response = await supabase.functions.invoke(step.action.edge_function, {
                            body: {
                                action: step.action.action_key,
                                ...resolvedConfig,
                            },
                        });

                        if (response.error) {
                            throw new Error(response.error.message);
                        }
                    }

                    // Log step success
                    await (supabase as any)
                        .from('workflow_logs')
                        .insert({
                            workflow_id: id,
                            step_id: step.id,
                            status: 'success',
                            input_data: resolvedConfig,
                            executed_by: session.user.id,
                        });
                } catch (stepError) {
                    console.error(`Error executing step ${step.id}:`, stepError);
                    hasError = true;

                    // Log step failure
                    await (supabase as any)
                        .from('workflow_logs')
                        .insert({
                            workflow_id: id,
                            step_id: step.id,
                            status: 'failed',
                            input_data: step.config,
                            error_message: stepError instanceof Error ? stepError.message : 'Unknown error',
                            executed_by: session.user.id,
                        });
                }
            }

            // Update main log status
            await (supabase as any)
                .from('workflow_logs')
                .update({
                    status: hasError ? 'failed' : 'success',
                    completed_at: new Date().toISOString(),
                })
                .eq('id', log.id);

            if (hasError) {
                toast.error('Workflow terminé avec des erreurs');
                return false;
            }

            toast.success('Workflow exécuté avec succès');
            return true;
        } catch (err) {
            console.error('Error executing workflow:', err);
            toast.error('Erreur lors de l\'exécution');
            return false;
        }
    }, [workflows]);

    return {
        workflows,
        isLoading,
        error,
        refetch: fetchWorkflows,
        deleteWorkflow,
        toggleWorkflow,
        executeWorkflow,
    };
}
