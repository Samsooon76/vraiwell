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

import { WorkflowAction, JSONSchemaType } from '@/types/workflow';

// Integration IDs that map to our supported integrations
export type IntegrationId = 'google' | 'microsoft' | 'slack' | 'notion' | 'hubspot' | 'onoff';

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
    onoff: {
        name: 'OnOff Business',
        description: 'Téléphonie cloud professionnelle',
        category: 'Téléphonie',
    },
};

export function getIntegrationLabel(integrationId: string): string {
    const integration = INTEGRATIONS[integrationId as IntegrationId];
    return integration?.name ?? integrationId;
}

export function listIntegrationIds(): IntegrationId[] {
    return Object.keys(INTEGRATIONS) as IntegrationId[];
}

export function canonicalActionId(integrationId: string, actionKey: string) {
    return `${integrationId}:${actionKey}`;
}

const IMPLEMENTED_EDGE_FUNCTIONS = new Set([
    'manage-google-user',
    'manage-microsoft-user',
    'manage-onoff-member',
]);

function emptySchema(): JSONSchemaType {
    return { type: 'object', properties: {} };
}

function isWorkflowActionImplemented(action: Pick<WorkflowAction, 'action_key' | 'edge_function' | 'execution_action' | 'integration_id' | 'is_active'>) {
    if (!action.is_active || !action.edge_function) {
        return false;
    }

    if (!IMPLEMENTED_EDGE_FUNCTIONS.has(action.edge_function)) {
        return false;
    }

    if (
        (action.edge_function === 'manage-google-user' || action.edge_function === 'manage-microsoft-user')
        && !action.execution_action
    ) {
        return false;
    }

    return true;
}

export interface ResolveActionInput {
    integration_id?: string | null;
    action_key?: string | null;
    action_snapshot?: Partial<WorkflowAction> | null;
}

export function resolveWorkflowAction(input: ResolveActionInput): {
    action: WorkflowAction;
    source: 'registry' | 'snapshot' | 'missing';
} {
    const integrationId = input.integration_id ?? 'unknown';
    const actionKey = input.action_key ?? 'unknown';

    if (integrationId !== 'unknown' && actionKey !== 'unknown') {
        const registryAction = getActionByKey(integrationId, actionKey);
        if (registryAction) {
            return {
                action: {
                    ...registryAction,
                    id: canonicalActionId(registryAction.integration_id, registryAction.action_key),
                    input_schema: registryAction.input_schema ?? emptySchema(),
                    is_active: isWorkflowActionImplemented(registryAction),
                },
                source: 'registry',
            };
        }
    }

    const snapshot = input.action_snapshot;
    if (snapshot?.integration_id && snapshot?.action_key) {
        return {
            action: {
                id: canonicalActionId(snapshot.integration_id, snapshot.action_key),
                integration_id: snapshot.integration_id,
                action_key: snapshot.action_key,
                name: snapshot.name ?? `${snapshot.integration_id}:${snapshot.action_key}`,
                description: snapshot.description ?? null,
                icon: snapshot.icon ?? null,
                category: snapshot.category ?? null,
                input_schema: (snapshot.input_schema as JSONSchemaType | undefined) ?? emptySchema(),
                edge_function: snapshot.edge_function ?? null,
                execution_action: snapshot.execution_action ?? null,
                is_active: false,
            },
            source: 'snapshot',
        };
    }

    return {
        action: {
            id: canonicalActionId(integrationId, actionKey),
            integration_id: integrationId,
            action_key: actionKey,
            name: `Action inconnue (${integrationId}:${actionKey})`,
            description: 'Cette action n’existe plus dans le registre.',
            icon: null,
            category: null,
            input_schema: emptySchema(),
            edge_function: null,
            execution_action: null,
            is_active: false,
        },
        source: 'missing',
    };
}

// Action definitions based on REAL edge functions
// Each action specifies which edge function handles it and with what parameters
export const ACTION_REGISTRY: Array<Omit<WorkflowAction, 'id'>> = [
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
        execution_action: 'create',
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
        execution_action: 'delete',
        is_active: true,
    },
    {
        integration_id: 'google',
        action_key: 'add_to_group',
        name: 'Ajouter à un groupe Google',
        description: 'Ajoute un utilisateur à un groupe Google',
        icon: null,
        category: 'user_management',
        input_schema: {
            type: 'object',
            required: ['email', 'groupId'],
            properties: {
                email: { type: 'string', title: 'Email utilisateur', format: 'email' },
                groupId: { type: 'string', title: 'ID du groupe' },
            },
        },
        edge_function: 'manage-google-user',
        is_active: true,
    },
    {
        integration_id: 'google',
        action_key: 'remove_from_group',
        name: 'Retirer d\'un groupe Google',
        description: 'Retire un utilisateur d\'un groupe Google',
        icon: null,
        category: 'user_management',
        input_schema: {
            type: 'object',
            required: ['email', 'groupId'],
            properties: {
                email: { type: 'string', title: 'Email utilisateur', format: 'email' },
                groupId: { type: 'string', title: 'ID du groupe' },
            },
        },
        edge_function: 'manage-google-user',
        is_active: true,
    },
    {
        integration_id: 'google',
        action_key: 'suspend_user',
        name: 'Suspendre un utilisateur Google',
        description: 'Suspend temporairement un compte Google',
        icon: null,
        category: 'user_management',
        input_schema: {
            type: 'object',
            required: ['email'],
            properties: {
                email: { type: 'string', title: 'Email', format: 'email' },
            },
        },
        edge_function: 'manage-google-user',
        is_active: true,
    },
    {
        integration_id: 'google',
        action_key: 'unsuspend_user',
        name: 'Réactiver un utilisateur Google',
        description: 'Réactive un compte Google suspendu',
        icon: null,
        category: 'user_management',
        input_schema: {
            type: 'object',
            required: ['email'],
            properties: {
                email: { type: 'string', title: 'Email', format: 'email' },
            },
        },
        edge_function: 'manage-google-user',
        is_active: true,
    },
    {
        integration_id: 'google',
        action_key: 'reset_password',
        name: 'Réinitialiser mot de passe Google',
        description: 'Réinitialise le mot de passe d\'un utilisateur',
        icon: null,
        category: 'user_management',
        input_schema: {
            type: 'object',
            required: ['email', 'newPassword'],
            properties: {
                email: { type: 'string', title: 'Email', format: 'email' },
                newPassword: { type: 'string', title: 'Nouveau mot de passe' },
            },
        },
        edge_function: 'manage-google-user',
        is_active: true,
    },
    {
        integration_id: 'google',
        action_key: 'create_shared_drive',
        name: 'Créer un Drive partagé',
        description: 'Crée un nouveau Drive partagé pour l\'équipe',
        icon: null,
        category: 'documentation',
        input_schema: {
            type: 'object',
            required: ['name'],
            properties: {
                name: { type: 'string', title: 'Nom du Drive' },
            },
        },
        edge_function: 'manage-google-drive',
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
        execution_action: 'create',
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
        execution_action: 'delete',
        is_active: true,
    },
    {
        integration_id: 'microsoft',
        action_key: 'add_to_group',
        name: 'Ajouter à un groupe Microsoft',
        description: 'Ajoute un utilisateur à un groupe Microsoft 365',
        icon: null,
        category: 'user_management',
        input_schema: {
            type: 'object',
            required: ['email', 'groupId'],
            properties: {
                email: { type: 'string', title: 'Email utilisateur', format: 'email' },
                groupId: { type: 'string', title: 'ID du groupe' },
            },
        },
        edge_function: 'manage-microsoft-user',
        is_active: true,
    },
    {
        integration_id: 'microsoft',
        action_key: 'remove_from_group',
        name: 'Retirer d\'un groupe Microsoft',
        description: 'Retire un utilisateur d\'un groupe Microsoft 365',
        icon: null,
        category: 'user_management',
        input_schema: {
            type: 'object',
            required: ['email', 'groupId'],
            properties: {
                email: { type: 'string', title: 'Email utilisateur', format: 'email' },
                groupId: { type: 'string', title: 'ID du groupe' },
            },
        },
        edge_function: 'manage-microsoft-user',
        is_active: true,
    },
    {
        integration_id: 'microsoft',
        action_key: 'assign_license',
        name: 'Assigner une licence Microsoft',
        description: 'Assigne une licence Microsoft 365 à un utilisateur',
        icon: null,
        category: 'user_management',
        input_schema: {
            type: 'object',
            required: ['email', 'licenseId'],
            properties: {
                email: { type: 'string', title: 'Email', format: 'email' },
                licenseId: { type: 'string', title: 'ID de la licence' },
            },
        },
        edge_function: 'manage-microsoft-user',
        is_active: true,
    },
    {
        integration_id: 'microsoft',
        action_key: 'remove_license',
        name: 'Retirer une licence Microsoft',
        description: 'Retire une licence Microsoft 365 d\'un utilisateur',
        icon: null,
        category: 'user_management',
        input_schema: {
            type: 'object',
            required: ['email', 'licenseId'],
            properties: {
                email: { type: 'string', title: 'Email', format: 'email' },
                licenseId: { type: 'string', title: 'ID de la licence' },
            },
        },
        edge_function: 'manage-microsoft-user',
        is_active: true,
    },
    {
        integration_id: 'microsoft',
        action_key: 'block_signin',
        name: 'Bloquer la connexion Microsoft',
        description: 'Bloque la connexion pour un utilisateur',
        icon: null,
        category: 'user_management',
        input_schema: {
            type: 'object',
            required: ['email'],
            properties: {
                email: { type: 'string', title: 'Email', format: 'email' },
            },
        },
        edge_function: 'manage-microsoft-user',
        is_active: true,
    },
    {
        integration_id: 'microsoft',
        action_key: 'unblock_signin',
        name: 'Débloquer la connexion Microsoft',
        description: 'Débloque la connexion pour un utilisateur',
        icon: null,
        category: 'user_management',
        input_schema: {
            type: 'object',
            required: ['email'],
            properties: {
                email: { type: 'string', title: 'Email', format: 'email' },
            },
        },
        edge_function: 'manage-microsoft-user',
        is_active: true,
    },
    {
        integration_id: 'microsoft',
        action_key: 'reset_password',
        name: 'Réinitialiser mot de passe Microsoft',
        description: 'Réinitialise le mot de passe d\'un utilisateur Microsoft 365',
        icon: null,
        category: 'user_management',
        input_schema: {
            type: 'object',
            required: ['email', 'newPassword'],
            properties: {
                email: { type: 'string', title: 'Email', format: 'email' },
                newPassword: { type: 'string', title: 'Nouveau mot de passe' },
            },
        },
        edge_function: 'manage-microsoft-user',
        is_active: true,
    },
    {
        integration_id: 'microsoft',
        action_key: 'create_team',
        name: 'Créer une équipe Teams',
        description: 'Crée une nouvelle équipe Microsoft Teams',
        icon: null,
        category: 'communication',
        input_schema: {
            type: 'object',
            required: ['name'],
            properties: {
                name: { type: 'string', title: 'Nom de l\'équipe' },
                description: { type: 'string', title: 'Description' },
            },
        },
        edge_function: 'manage-microsoft-teams',
        is_active: true,
    },
    {
        integration_id: 'microsoft',
        action_key: 'add_to_team',
        name: 'Ajouter à une équipe Teams',
        description: 'Ajoute un membre à une équipe Teams',
        icon: null,
        category: 'communication',
        input_schema: {
            type: 'object',
            required: ['email', 'teamId'],
            properties: {
                email: { type: 'string', title: 'Email', format: 'email' },
                teamId: { type: 'string', title: 'ID de l\'équipe' },
            },
        },
        edge_function: 'manage-microsoft-teams',
        is_active: true,
    },
    {
        integration_id: 'microsoft',
        action_key: 'send_email',
        name: 'Envoyer un email Outlook',
        description: 'Envoie un email via Outlook',
        icon: null,
        category: 'communication',
        input_schema: {
            type: 'object',
            required: ['to', 'subject', 'body'],
            properties: {
                to: { type: 'string', title: 'Destinataire', format: 'email' },
                subject: { type: 'string', title: 'Sujet' },
                body: { type: 'string', title: 'Contenu' },
            },
        },
        edge_function: 'manage-microsoft-mail',
        is_active: true,
    },

    // ============================================
    // SLACK ACTIONS
    // ============================================
    {
        integration_id: 'slack',
        action_key: 'send_message',
        name: 'Envoyer un message Slack',
        description: 'Envoie un message dans un canal ou à un utilisateur',
        icon: null,
        category: 'communication',
        input_schema: {
            type: 'object',
            required: ['channel', 'message'],
            properties: {
                channel: { type: 'string', title: 'Canal' },
                message: { type: 'string', title: 'Message' },
            },
        },
        edge_function: 'slack-message',
        is_active: true,
    },
    {
        integration_id: 'slack',
        action_key: 'invite_user',
        name: 'Inviter dans un canal Slack',
        description: 'Invite un utilisateur dans un canal Slack',
        icon: null,
        category: 'communication',
        input_schema: {
            type: 'object',
            required: ['email', 'channel'],
            properties: {
                email: { type: 'string', title: 'Email', format: 'email' },
                channel: { type: 'string', title: 'Canal' },
            },
        },
        edge_function: 'slack-invite',
        is_active: true,
    },
    {
        integration_id: 'slack',
        action_key: 'create_channel',
        name: 'Créer un canal Slack',
        description: 'Crée un nouveau canal Slack',
        icon: null,
        category: 'communication',
        input_schema: {
            type: 'object',
            required: ['name'],
            properties: {
                name: { type: 'string', title: 'Nom du canal' },
                isPrivate: { type: 'boolean', title: 'Canal privé', default: false },
            },
        },
        edge_function: 'slack-channel',
        is_active: true,
    },
    {
        integration_id: 'slack',
        action_key: 'archive_channel',
        name: 'Archiver un canal Slack',
        description: 'Archive un canal Slack existant',
        icon: null,
        category: 'communication',
        input_schema: {
            type: 'object',
            required: ['channelId'],
            properties: {
                channelId: { type: 'string', title: 'ID du canal' },
            },
        },
        edge_function: 'slack-channel',
        is_active: true,
    },
    {
        integration_id: 'slack',
        action_key: 'remove_from_channel',
        name: 'Retirer d\'un canal Slack',
        description: 'Retire un utilisateur d\'un canal Slack',
        icon: null,
        category: 'communication',
        input_schema: {
            type: 'object',
            required: ['email', 'channelId'],
            properties: {
                email: { type: 'string', title: 'Email', format: 'email' },
                channelId: { type: 'string', title: 'ID du canal' },
            },
        },
        edge_function: 'slack-channel',
        is_active: true,
    },

    // ============================================
    // NOTION ACTIONS
    // ============================================
    {
        integration_id: 'notion',
        action_key: 'create_page',
        name: 'Créer une page Notion',
        description: 'Crée une nouvelle page dans un espace Notion',
        icon: null,
        category: 'documentation',
        input_schema: {
            type: 'object',
            required: ['title', 'parentId'],
            properties: {
                title: { type: 'string', title: 'Titre' },
                parentId: { type: 'string', title: 'ID Parent' },
                content: { type: 'string', title: 'Contenu' },
            },
        },
        edge_function: 'notion-create-page',
        is_active: true,
    },
    {
        integration_id: 'notion',
        action_key: 'add_to_database',
        name: 'Ajouter à une base Notion',
        description: 'Ajoute une entrée dans une base de données Notion',
        icon: null,
        category: 'documentation',
        input_schema: {
            type: 'object',
            required: ['databaseId'],
            properties: {
                databaseId: { type: 'string', title: 'ID Base de données' },
                properties: { type: 'object', title: 'Propriétés' },
            },
        },
        edge_function: 'notion-add-to-db',
        is_active: true,
    },
    {
        integration_id: 'notion',
        action_key: 'invite_user',
        name: 'Inviter sur Notion',
        description: 'Invite un utilisateur dans le workspace Notion',
        icon: null,
        category: 'documentation',
        input_schema: {
            type: 'object',
            required: ['email'],
            properties: {
                email: { type: 'string', title: 'Email', format: 'email' },
            },
        },
        edge_function: null,
        is_active: true,
    },
    {
        integration_id: 'notion',
        action_key: 'share_page',
        name: 'Partager une page Notion',
        description: 'Partage une page avec un utilisateur',
        icon: null,
        category: 'documentation',
        input_schema: {
            type: 'object',
            required: ['pageId', 'email'],
            properties: {
                pageId: { type: 'string', title: 'ID de la page' },
                email: { type: 'string', title: 'Email', format: 'email' },
                permission: { type: 'string', title: 'Permission', enum: ['read', 'edit', 'full_access'] },
            },
        },
        edge_function: 'notion-share',
        is_active: true,
    },

    // ============================================
    // HUBSPOT ACTIONS
    // ============================================
    {
        integration_id: 'hubspot',
        action_key: 'create_contact',
        name: 'Créer un contact HubSpot',
        description: 'Crée un nouveau contact dans HubSpot CRM',
        icon: null,
        category: 'crm',
        input_schema: {
            type: 'object',
            required: ['email', 'firstName', 'lastName'],
            properties: {
                email: { type: 'string', title: 'Email', format: 'email' },
                firstName: { type: 'string', title: 'Prénom' },
                lastName: { type: 'string', title: 'Nom' },
                company: { type: 'string', title: 'Entreprise' },
                phone: { type: 'string', title: 'Téléphone' },
            },
        },
        edge_function: 'hubspot-create-contact',
        is_active: true,
    },
    {
        integration_id: 'hubspot',
        action_key: 'update_contact',
        name: 'Mettre à jour un contact HubSpot',
        description: 'Met à jour un contact existant dans HubSpot',
        icon: null,
        category: 'crm',
        input_schema: {
            type: 'object',
            required: ['email'],
            properties: {
                email: { type: 'string', title: 'Email', format: 'email' },
                properties: { type: 'object', title: 'Propriétés à mettre à jour' },
            },
        },
        edge_function: 'hubspot-update-contact',
        is_active: true,
    },
    {
        integration_id: 'hubspot',
        action_key: 'create_team',
        name: 'Créer une équipe HubSpot',
        description: 'Crée une nouvelle équipe dans HubSpot',
        icon: null,
        category: 'crm',
        input_schema: {
            type: 'object',
            required: ['name'],
            properties: {
                name: { type: 'string', title: 'Nom de l\'équipe' },
                description: { type: 'string', title: 'Description' },
            },
        },
        edge_function: null,
        is_active: true,
    },
    {
        integration_id: 'hubspot',
        action_key: 'create_deal',
        name: 'Créer une affaire HubSpot',
        description: 'Crée une nouvelle affaire dans HubSpot CRM',
        icon: null,
        category: 'crm',
        input_schema: {
            type: 'object',
            required: ['dealName', 'amount'],
            properties: {
                dealName: { type: 'string', title: 'Nom de l\'affaire' },
                amount: { type: 'number', title: 'Montant' },
                stage: { type: 'string', title: 'Étape' },
            },
        },
        edge_function: 'hubspot-deals',
        is_active: true,
    },
    {
        integration_id: 'hubspot',
        action_key: 'add_to_list',
        name: 'Ajouter à une liste HubSpot',
        description: 'Ajoute un contact à une liste marketing',
        icon: null,
        category: 'crm',
        input_schema: {
            type: 'object',
            required: ['email', 'listId'],
            properties: {
                email: { type: 'string', title: 'Email', format: 'email' },
                listId: { type: 'string', title: 'ID de la liste' },
            },
        },
        edge_function: 'hubspot-lists',
        is_active: true,
    },

    // ============================================
    // ONOFF ACTIONS
    // ============================================
    {
        integration_id: 'onoff',
        action_key: 'create_member',
        name: 'Créer un membre OnOff',
        description: 'Crée un membre OnOff Business avec attribution optionnelle d\'un numéro disponible',
        icon: null,
        category: 'user_management',
        input_schema: {
            type: 'object',
            required: ['firstName', 'lastName', 'email'],
            properties: {
                firstName: { type: 'string', title: 'Prénom' },
                lastName: { type: 'string', title: 'Nom' },
                email: { type: 'string', title: 'Email', format: 'email' },
                role: {
                    type: 'string',
                    title: 'Rôle OnOff',
                    enum: ['ROLE_USER', 'ROLE_ADMIN'],
                },
                assignNumber: {
                    type: 'boolean',
                    title: 'Attribuer un numéro',
                    description: 'Si activé, attribue un numéro existant ou le premier numéro disponible du pays indiqué',
                    default: false,
                },
                countryCode: {
                    type: 'string',
                    title: 'Code pays',
                    description: 'Obligatoire si aucun numéro précis n\'est fourni et que l\'attribution est activée',
                },
                phoneNumber: {
                    type: 'string',
                    title: 'Numéro à attribuer',
                    description: 'Optionnel. Si vide, le premier numéro disponible du pays sera utilisé',
                },
            },
        },
        edge_function: 'manage-onoff-member',
        execution_action: 'create_member',
        is_active: true,
    },
    {
        integration_id: 'onoff',
        action_key: 'assign_number',
        name: 'Attribuer un numéro OnOff',
        description: 'Attribue un numéro OnOff existant à un membre',
        icon: null,
        category: 'user_management',
        input_schema: {
            type: 'object',
            required: ['memberIdRef', 'phoneNumber'],
            properties: {
                memberIdRef: { type: 'string', title: 'ID du membre OnOff' },
                phoneNumber: { type: 'string', title: 'Numéro OnOff à attribuer' },
            },
        },
        edge_function: 'manage-onoff-member',
        execution_action: 'assign_number',
        is_active: true,
    },
    {
        integration_id: 'onoff',
        action_key: 'delete_member',
        name: 'Supprimer un membre OnOff',
        description: 'Supprime un membre dans OnOff Business',
        icon: null,
        category: 'user_management',
        input_schema: {
            type: 'object',
            required: ['memberId'],
            properties: {
                memberId: { type: 'string', title: 'ID du membre' },
            },
        },
        edge_function: 'manage-onoff-member',
        is_active: true,
    },
    {
        integration_id: 'onoff',
        action_key: 'list_numbers',
        name: 'Lister les numeros OnOff',
        description: 'Liste les numeros OnOff (utilise la cle API OnOff)',
        icon: null,
        category: 'user_management',
        input_schema: {
            type: 'object',
            required: [],
            properties: {
                memberId: { type: 'string', title: 'ID du membre (optionnel)' },
                status: { type: 'string', title: 'Statut', enum: ['used', 'available'] },
            },
        },
        edge_function: 'manage-onoff-member',
        is_active: true,
    },
];

// Helper to get action count per integration
export function getActionCountByIntegration(): Record<IntegrationId, number> {
    const counts: Record<IntegrationId, number> = {
        google: 0,
        microsoft: 0,
        slack: 0,
        notion: 0,
        hubspot: 0,
        onoff: 0,
    };

    ACTION_REGISTRY.forEach(action => {
        if (isWorkflowActionImplemented(action)) {
            counts[action.integration_id as IntegrationId]++;
        }
    });

    return counts;
}

// Helper to get actions for a specific integration
export function getActionsByIntegration(integrationId: string): typeof ACTION_REGISTRY {
    return ACTION_REGISTRY.filter(
        action => action.integration_id === integrationId && isWorkflowActionImplemented(action)
    );
}

// Helper to get a specific action by key
export function getActionByKey(integrationId: string, actionKey: string) {
    return ACTION_REGISTRY.find(
        action => action.integration_id === integrationId && action.action_key === actionKey
    );
}

export function getWorkflowExecutionAction(action: Pick<WorkflowAction, 'action_key' | 'execution_action'>): string {
    return action.execution_action ?? action.action_key;
}

export function listActiveWorkflowActions(): WorkflowAction[] {
    return ACTION_REGISTRY
        .filter(a => isWorkflowActionImplemented(a))
        .map(a => ({
            ...a,
            id: canonicalActionId(a.integration_id, a.action_key),
            input_schema: a.input_schema ?? emptySchema(),
        }));
}

export function createActionSnapshot(action: WorkflowAction): Partial<WorkflowAction> {
    return {
        integration_id: action.integration_id,
        action_key: action.action_key,
        name: action.name,
        description: action.description,
        icon: action.icon,
        category: action.category,
        input_schema: action.input_schema,
        edge_function: action.edge_function,
        execution_action: action.execution_action,
        is_active: action.is_active,
    };
}
