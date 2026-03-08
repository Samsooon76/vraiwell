/**
 * Workflow Action Registry
 * 
 * This file defines all available workflow actions based on REAL edge functions.
 * Each action maps directly to an edge function that handles the actual execution.
 * 
 * To add a new action:
 * 1. Create the edge function in supabase/functions/
 * 2. Add the action definition here with the edge function name
 * 3. The action will automatically appear in the workflow builder
 */

import { WorkflowAction } from '@/types/workflow';

// Integration IDs that map to our supported integrations
export type IntegrationId = 'google' | 'microsoft' | 'slack' | 'notion' | 'hubspot';

// Integration display info
export const INTEGRATIONS: Record<IntegrationId, {
    name: string;
    description: string;
    category: string;
}> = {
    google: {
        name: 'Google Workspace',
        description: 'Suite bureautique cloud Google',
        category: 'Productivité',
    },
    microsoft: {
        name: 'Microsoft 365',
        description: 'Suite Microsoft (Teams, Outlook, etc.)',
        category: 'Productivité',
    },
    slack: {
        name: 'Slack',
        description: 'Communication d\'équipe',
        category: 'Communication',
    },
    notion: {
        name: 'Notion',
        description: 'Documentation collaborative',
        category: 'Productivité',
    },
    hubspot: {
        name: 'HubSpot',
        description: 'CRM et marketing',
        category: 'CRM',
    },
};

// Action definitions based on REAL edge functions
// Each action specifies which edge function handles it and with what parameters
export const ACTION_REGISTRY: Omit<WorkflowAction, 'id' | 'created_at' | 'updated_at'>[] = [
    // ============================================
    // GOOGLE WORKSPACE ACTIONS
    // Edge function: manage-google-user
    // ============================================
    {
        integration_id: 'google',
        action_key: 'create_user',
        name: 'Créer un utilisateur Google',
        description: 'Crée un compte utilisateur dans Google Workspace avec invitation par email',
        icon: null,
        category: 'user_management',
        input_schema: {
            type: 'object',
            required: ['firstName', 'lastName', 'personalEmail'],
            properties: {
                firstName: { type: 'string', title: 'Prénom' },
                lastName: { type: 'string', title: 'Nom' },
                personalEmail: {
                    type: 'string',
                    title: 'Email personnel',
                    format: 'email',
                    description: 'L\'email personnel où l\'invitation sera envoyée'
                },
            },
        },
        edge_function: 'manage-google-user',
        is_active: true,
    },
    {
        integration_id: 'google',
        action_key: 'delete_user',
        name: 'Supprimer un utilisateur Google',
        description: 'Supprime définitivement un compte utilisateur Google Workspace',
        icon: null,
        category: 'user_management',
        input_schema: {
            type: 'object',
            required: ['userId'],
            properties: {
                userId: { type: 'string', title: 'ID utilisateur Google' },
            },
        },
        edge_function: 'manage-google-user',
        is_active: true,
    },

    // ============================================
    // MICROSOFT 365 ACTIONS
    // Edge function: manage-microsoft-user
    // ============================================
    {
        integration_id: 'microsoft',
        action_key: 'create_user',
        name: 'Créer un utilisateur Microsoft 365',
        description: 'Crée un compte utilisateur dans Microsoft 365 avec mot de passe temporaire',
        icon: null,
        category: 'user_management',
        input_schema: {
            type: 'object',
            required: ['firstName', 'lastName'],
            properties: {
                firstName: { type: 'string', title: 'Prénom' },
                lastName: { type: 'string', title: 'Nom' },
                personalEmail: {
                    type: 'string',
                    title: 'Email personnel',
                    format: 'email',
                    description: 'Email pour envoyer les identifiants (optionnel)'
                },
            },
        },
        edge_function: 'manage-microsoft-user',
        is_active: true,
    },
    {
        integration_id: 'microsoft',
        action_key: 'delete_user',
        name: 'Supprimer un utilisateur Microsoft 365',
        description: 'Supprime définitivement un compte utilisateur Microsoft 365',
        icon: null,
        category: 'user_management',
        input_schema: {
            type: 'object',
            required: ['userId'],
            properties: {
                userId: { type: 'string', title: 'ID utilisateur Microsoft' },
            },
        },
        edge_function: 'manage-microsoft-user',
        is_active: true,
    },

    // ============================================
    // SLACK ACTIONS
    // Edge function: manage-slack-user (needs implementation)
    // ============================================
    // TODO: Implement manage-slack-user edge function
    // {
    //   integration_id: 'slack',
    //   action_key: 'invite_user',
    //   name: 'Inviter sur Slack',
    //   ...
    // },

    // ============================================
    // NOTION ACTIONS
    // Edge function: manage-notion-user (needs implementation)
    // ============================================
    // TODO: Implement manage-notion-user edge function

    // ============================================
    // HUBSPOT ACTIONS
    // Edge function: manage-hubspot-contact (needs implementation)
    // ============================================
    // TODO: Implement manage-hubspot-contact edge function
];

// Helper to get action count per integration
export function getActionCountByIntegration(): Record<IntegrationId, number> {
    const counts: Record<IntegrationId, number> = {
        google: 0,
        microsoft: 0,
        slack: 0,
        notion: 0,
        hubspot: 0,
    };

    ACTION_REGISTRY.forEach(action => {
        if (action.is_active) {
            counts[action.integration_id as IntegrationId]++;
        }
    });

    return counts;
}

// Helper to get actions for a specific integration
export function getActionsByIntegration(integrationId: IntegrationId): typeof ACTION_REGISTRY {
    return ACTION_REGISTRY.filter(
        action => action.integration_id === integrationId && action.is_active
    );
}

// Helper to get a specific action by key
export function getActionByKey(integrationId: IntegrationId, actionKey: string) {
    return ACTION_REGISTRY.find(
        action => action.integration_id === integrationId && action.action_key === actionKey
    );
}
