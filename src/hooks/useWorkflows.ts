import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Workflow, WorkflowStep, WorkflowAction } from '@/types/workflow';
import { getIntegrationLabel, getWorkflowExecutionAction, resolveWorkflowAction } from '@/config/workflowActions';
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

interface PersistedWorkflowStepRow {
    id: string;
    workflow_id: string;
    action_id: string | null;
    step_order: number;
    config: Record<string, unknown> | null;
    integration_id?: string | null;
    action_key?: string | null;
    action_snapshot?: Partial<WorkflowAction> | null;
    action?: Partial<WorkflowAction> | null;
}

interface IntegrationProfileTokens {
    slack_token: string | null;
    notion_token: string | null;
    hubspot_token: string | null;
    onoff_api_key: string | null;
}

interface IntegrationCredentials {
    provider_token?: string | null;
    api_key?: string | null;
}

const PROVIDER_TOKEN_INTEGRATIONS = new Set(['google', 'microsoft', 'slack', 'notion', 'hubspot']);

function getBrowserStorageValue(
    storageType: 'localStorage' | 'sessionStorage',
    key: string,
) {
    if (typeof window === 'undefined') {
        return null;
    }

    return window[storageType].getItem(key);
}

function hydrateWorkflowSteps(stepsData: PersistedWorkflowStepRow[]): Array<WorkflowStep & { action: WorkflowAction }> {
    return stepsData.map((step) => {
        const resolved = resolveWorkflowAction({
            integration_id: step.integration_id ?? step.action?.integration_id,
            action_key: step.action_key ?? step.action?.action_key,
            action_snapshot: step.action_snapshot ?? step.action ?? null,
        });

        return {
            ...step,
            config: step.config ?? {},
            integration_id: step.integration_id ?? step.action?.integration_id ?? null,
            action_key: step.action_key ?? step.action?.action_key ?? null,
            action_snapshot: step.action_snapshot ?? step.action ?? null,
            action: resolved.action,
        };
    });
}

async function fetchWorkflowSteps(workflowId: string): Promise<Array<WorkflowStep & { action: WorkflowAction }>> {
    try {
        const { data, error } = await supabase
            .from('workflow_steps')
            .select('id, workflow_id, action_id, step_order, config, integration_id, action_key, action_snapshot')
            .eq('workflow_id', workflowId)
            .order('step_order', { ascending: true });

        if (error) {
            throw error;
        }

        return hydrateWorkflowSteps(data ?? []);
    } catch {
        const { data, error } = await supabase
            .from('workflow_steps')
            .select('id, workflow_id, action_id, step_order, config, action:workflow_actions(*)')
            .eq('workflow_id', workflowId)
            .order('step_order', { ascending: true });

        if (error) {
            throw error;
        }

        return hydrateWorkflowSteps(data ?? []);
    }
}

function getIntegrationCredentials(
    integrationId: string,
    session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'],
    profileTokens: IntegrationProfileTokens | null,
): IntegrationCredentials {
    const currentProvider = String(session?.user?.app_metadata?.provider ?? '');
    const currentProviderToken = session?.provider_token ?? null;

    const googleProviderToken =
        getBrowserStorageValue('sessionStorage', 'google_provider_token')
        ?? (currentProvider === 'google' ? currentProviderToken : null);

    const microsoftProviderToken =
        getBrowserStorageValue('sessionStorage', 'microsoft_provider_token')
        ?? (currentProvider === 'azure' ? currentProviderToken : null);

    switch (integrationId) {
        case 'google':
            return { provider_token: googleProviderToken };
        case 'microsoft':
            return { provider_token: microsoftProviderToken };
        case 'slack':
            return { provider_token: profileTokens?.slack_token ?? null };
        case 'notion':
            return { provider_token: profileTokens?.notion_token ?? null };
        case 'hubspot':
            return { provider_token: profileTokens?.hubspot_token ?? null };
        case 'onoff':
            return {
                api_key: getBrowserStorageValue('localStorage', 'onoff_api_key')
                    ?? profileTokens?.onoff_api_key
                    ?? null,
            };
        default:
            return {};
    }
}

function resolveStepConfig(
    config: Record<string, unknown>,
    variables: Record<string, string>,
) {
    const resolvedConfig: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(config)) {
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

    return resolvedConfig;
}

export function useWorkflows(): UseWorkflowsReturn {
    const [workflows, setWorkflows] = useState<WorkflowWithSteps[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchWorkflows = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const { data: workflowsData, error: workflowsError } = await supabase
                .from('workflows')
                .select('*')
                .order('created_at', { ascending: false });

            if (workflowsError) {
                throw workflowsError;
            }

            const workflowsWithSteps: WorkflowWithSteps[] = await Promise.all(
                (workflowsData || []).map(async (workflow: Workflow) => ({
                    ...workflow,
                    steps: await fetchWorkflowSteps(workflow.id),
                })),
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
        void fetchWorkflows();
    }, [fetchWorkflows]);

    const deleteWorkflow = useCallback(async (id: string): Promise<boolean> => {
        try {
            const { error } = await supabase
                .from('workflows')
                .delete()
                .eq('id', id);

            if (error) {
                throw error;
            }

            setWorkflows((prev) => prev.filter((workflow) => workflow.id !== id));
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

            if (error) {
                throw error;
            }

            setWorkflows((prev) =>
                prev.map((workflow) => (workflow.id === id ? { ...workflow, is_active: isActive } : workflow)),
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
        variables: Record<string, string>,
    ): Promise<boolean> => {
        const workflow = workflows.find((item) => item.id === id);
        if (!workflow) {
            toast.error('Workflow introuvable');
            return false;
        }

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                toast.error('Session expirée');
                return false;
            }

            const { data: profileTokens } = await supabase
                .from('profiles')
                .select('slack_token, notion_token, hubspot_token, onoff_api_key')
                .eq('user_id', session.user.id)
                .maybeSingle();

            const { data: log, error: logError } = await supabase
                .from('workflow_logs')
                .insert({
                    workflow_id: id,
                    status: 'running',
                    input_data: variables,
                    executed_by: session.user.id,
                })
                .select()
                .single();

            if (logError) {
                throw logError;
            }

            let hasError = false;

            for (const step of workflow.steps) {
                if (hasError) {
                    break;
                }

                const resolvedConfig = resolveStepConfig(step.config, variables);

                try {
                    if (!step.action.is_active) {
                        await supabase
                            .from('workflow_logs')
                            .insert({
                                workflow_id: id,
                                step_id: step.id,
                                status: 'skipped',
                                input_data: resolvedConfig,
                                error_message: `L'action "${step.action.name}" n'est plus disponible.`,
                                executed_by: session.user.id,
                            });
                        continue;
                    }

                    if (!step.action.edge_function) {
                        await supabase
                            .from('workflow_logs')
                            .insert({
                                workflow_id: id,
                                step_id: step.id,
                                status: 'skipped',
                                input_data: resolvedConfig,
                                error_message: `L'action "${step.action.name}" n'est plus exécutable.`,
                                executed_by: session.user.id,
                            });
                        continue;
                    }

                    const credentials = getIntegrationCredentials(step.action.integration_id, session, profileTokens);
                    if (PROVIDER_TOKEN_INTEGRATIONS.has(step.action.integration_id) && !credentials.provider_token) {
                        throw new Error(`L'intégration ${getIntegrationLabel(step.action.integration_id)} n'est pas connectée.`);
                    }

                    if (step.action.integration_id === 'onoff' && !credentials.api_key) {
                        throw new Error('La clé API OnOff est manquante.');
                    }

                    const response = await supabase.functions.invoke(step.action.edge_function, {
                        body: {
                            action: getWorkflowExecutionAction(step.action),
                            ...credentials,
                            ...resolvedConfig,
                        },
                    });

                    if (response.error) {
                        throw new Error(response.error.message);
                    }

                    await supabase
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

                    await supabase
                        .from('workflow_logs')
                        .insert({
                            workflow_id: id,
                            step_id: step.id,
                            status: 'failed',
                            input_data: resolvedConfig,
                            error_message: stepError instanceof Error ? stepError.message : 'Unknown error',
                            executed_by: session.user.id,
                        });
                }
            }

            await supabase
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
