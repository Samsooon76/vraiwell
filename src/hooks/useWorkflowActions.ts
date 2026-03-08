import { useState, useEffect, useRef, useMemo } from 'react';
import { WorkflowAction } from '@/types/workflow';
import { ACTION_REGISTRY, getActionCountByIntegration, IntegrationId } from '@/config/workflowActions';
import { useGoogleAuth } from './useGoogleAuth';
import { useMicrosoftAuth } from './useMicrosoftAuth';
import { useSlackAuth } from './useSlackAuth';
import { useNotionAuth } from './useNotionAuth';
import { useHubSpotAuth } from './useHubSpotAuth';

interface ConnectedIntegrations {
    google: boolean;
    microsoft: boolean;
    slack: boolean;
    notion: boolean;
    hubspot: boolean;
}

interface UseWorkflowActionsReturn {
    actions: WorkflowAction[];
    isLoading: boolean;
    error: string | null;
    connectedIntegrations: ConnectedIntegrations;
    actionCounts: Record<IntegrationId, number>;
    refetch: () => Promise<void>;
    getActionsByIntegration: (integrationId: string) => WorkflowAction[];
    getActionsByCategory: (category: string) => WorkflowAction[];
}

export function useWorkflowActions(): UseWorkflowActionsReturn {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [connectedIntegrations, setConnectedIntegrations] = useState<ConnectedIntegrations>({
        google: false,
        microsoft: false,
        slack: false,
        notion: false,
        hubspot: false,
    });

    // Use refs to store check functions to avoid dependency loops
    const { checkGoogleConnection } = useGoogleAuth();
    const { checkMicrosoftConnection } = useMicrosoftAuth();
    const { hasToken: hasSlackToken } = useSlackAuth();
    const { hasToken: hasNotionToken } = useNotionAuth();
    const { hasToken: hasHubSpotToken } = useHubSpotAuth();

    const checkGoogleRef = useRef(checkGoogleConnection);
    const checkMicrosoftRef = useRef(checkMicrosoftConnection);

    // Keep refs updated
    useEffect(() => {
        checkGoogleRef.current = checkGoogleConnection;
        checkMicrosoftRef.current = checkMicrosoftConnection;
    }, [checkGoogleConnection, checkMicrosoftConnection]);

    // Actions come from the local registry - no DB fetch needed!
    // This is scalable: just add new actions to workflowActions.ts
    const actions = useMemo<WorkflowAction[]>(() => {
        return ACTION_REGISTRY.filter(a => a.is_active).map((action, index) => ({
            ...action,
            id: `${action.integration_id}-${action.action_key}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }));
    }, []);

    // Action counts from registry
    const actionCounts = useMemo(() => getActionCountByIntegration(), []);

    // Check connections on mount only
    useEffect(() => {
        let cancelled = false;

        const checkConnections = async () => {
            setIsLoading(true);

            try {
                let isGoogleConnected = false;
                let isMicrosoftConnected = false;

                try {
                    isGoogleConnected = await checkGoogleRef.current();
                } catch (e) {
                    console.error('Error checking Google connection:', e);
                }

                try {
                    isMicrosoftConnected = await checkMicrosoftRef.current();
                } catch (e) {
                    console.error('Error checking Microsoft connection:', e);
                }

                if (cancelled) return;

                setConnectedIntegrations({
                    google: isGoogleConnected,
                    microsoft: isMicrosoftConnected,
                    slack: hasSlackToken,
                    notion: hasNotionToken,
                    hubspot: hasHubSpotToken,
                });
            } catch (err) {
                console.error('Error checking connections:', err);
                setError('Erreur lors de la vérification des connexions');
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        checkConnections();

        return () => {
            cancelled = true;
        };
    }, []); // Empty deps - only run on mount

    // Update token states when they change
    useEffect(() => {
        setConnectedIntegrations(prev => ({
            ...prev,
            slack: hasSlackToken,
            notion: hasNotionToken,
            hubspot: hasHubSpotToken,
        }));
    }, [hasSlackToken, hasNotionToken, hasHubSpotToken]);

    const refetch = async () => {
        setIsLoading(true);
        setError(null);

        try {
            let isGoogleConnected = false;
            let isMicrosoftConnected = false;

            try {
                isGoogleConnected = await checkGoogleRef.current();
            } catch (e) {
                console.error('Error refetching Google connection:', e);
            }

            try {
                isMicrosoftConnected = await checkMicrosoftRef.current();
            } catch (e) {
                console.error('Error refetching Microsoft connection:', e);
            }

            setConnectedIntegrations({
                google: isGoogleConnected,
                microsoft: isMicrosoftConnected,
                slack: hasSlackToken,
                notion: hasNotionToken,
                hubspot: hasHubSpotToken,
            });
        } catch (err) {
            console.error('Error refetching:', err);
            setError('Erreur lors du rafraîchissement');
        } finally {
            setIsLoading(false);
        }
    };

    const getActionsByIntegration = (integrationId: string) => {
        return actions.filter(action => action.integration_id === integrationId);
    };

    const getActionsByCategory = (category: string) => {
        return actions.filter(action => action.category === category);
    };

    return {
        actions,
        isLoading,
        error,
        connectedIntegrations,
        actionCounts,
        refetch,
        getActionsByIntegration,
        getActionsByCategory,
    };
}
