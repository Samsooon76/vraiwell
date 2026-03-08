-- Add more workflow actions to match the Integrations page

-- Additional Google Workspace Actions (total: 8)
INSERT INTO public.workflow_actions (integration_id, action_key, name, description, category, input_schema, edge_function) VALUES
('google', 'add_to_group', 'Ajouter à un groupe Google', 'Ajoute un utilisateur à un groupe Google', 'user_management',
 '{"type": "object", "required": ["email", "groupId"], "properties": {"email": {"type": "string", "title": "Email utilisateur", "format": "email"}, "groupId": {"type": "string", "title": "ID du groupe"}}}'::jsonb,
 'manage-google-user'),

('google', 'remove_from_group', 'Retirer d''un groupe Google', 'Retire un utilisateur d''un groupe Google', 'user_management',
 '{"type": "object", "required": ["email", "groupId"], "properties": {"email": {"type": "string", "title": "Email utilisateur", "format": "email"}, "groupId": {"type": "string", "title": "ID du groupe"}}}'::jsonb,
 'manage-google-user'),

('google', 'suspend_user', 'Suspendre un utilisateur Google', 'Suspend temporairement un compte Google', 'user_management',
 '{"type": "object", "required": ["email"], "properties": {"email": {"type": "string", "title": "Email", "format": "email"}}}'::jsonb,
 'manage-google-user'),

('google', 'unsuspend_user', 'Réactiver un utilisateur Google', 'Réactive un compte Google suspendu', 'user_management',
 '{"type": "object", "required": ["email"], "properties": {"email": {"type": "string", "title": "Email", "format": "email"}}}'::jsonb,
 'manage-google-user'),

('google', 'reset_password', 'Réinitialiser mot de passe Google', 'Réinitialise le mot de passe d''un utilisateur', 'user_management',
 '{"type": "object", "required": ["email"], "properties": {"email": {"type": "string", "title": "Email", "format": "email"}, "newPassword": {"type": "string", "title": "Nouveau mot de passe"}}}'::jsonb,
 'manage-google-user'),

('google', 'create_shared_drive', 'Créer un Drive partagé', 'Crée un nouveau Drive partagé pour l''équipe', 'documentation',
 '{"type": "object", "required": ["name"], "properties": {"name": {"type": "string", "title": "Nom du Drive"}}}'::jsonb,
 'manage-google-drive'),

-- Additional Microsoft 365 Actions (total: 12)
('microsoft', 'add_to_group', 'Ajouter à un groupe Microsoft', 'Ajoute un utilisateur à un groupe Microsoft 365', 'user_management',
 '{"type": "object", "required": ["email", "groupId"], "properties": {"email": {"type": "string", "title": "Email utilisateur", "format": "email"}, "groupId": {"type": "string", "title": "ID du groupe"}}}'::jsonb,
 'manage-microsoft-user'),

('microsoft', 'remove_from_group', 'Retirer d''un groupe Microsoft', 'Retire un utilisateur d''un groupe Microsoft 365', 'user_management',
 '{"type": "object", "required": ["email", "groupId"], "properties": {"email": {"type": "string", "title": "Email utilisateur", "format": "email"}, "groupId": {"type": "string", "title": "ID du groupe"}}}'::jsonb,
 'manage-microsoft-user'),

('microsoft', 'assign_license', 'Assigner une licence Microsoft', 'Assigne une licence Microsoft 365 à un utilisateur', 'user_management',
 '{"type": "object", "required": ["email", "licenseId"], "properties": {"email": {"type": "string", "title": "Email", "format": "email"}, "licenseId": {"type": "string", "title": "ID de la licence"}}}'::jsonb,
 'manage-microsoft-user'),

('microsoft', 'remove_license', 'Retirer une licence Microsoft', 'Retire une licence Microsoft 365 d''un utilisateur', 'user_management',
 '{"type": "object", "required": ["email", "licenseId"], "properties": {"email": {"type": "string", "title": "Email", "format": "email"}, "licenseId": {"type": "string", "title": "ID de la licence"}}}'::jsonb,
 'manage-microsoft-user'),

('microsoft', 'block_signin', 'Bloquer la connexion Microsoft', 'Bloque la connexion pour un utilisateur', 'user_management',
 '{"type": "object", "required": ["email"], "properties": {"email": {"type": "string", "title": "Email", "format": "email"}}}'::jsonb,
 'manage-microsoft-user'),

('microsoft', 'unblock_signin', 'Débloquer la connexion Microsoft', 'Débloque la connexion pour un utilisateur', 'user_management',
 '{"type": "object", "required": ["email"], "properties": {"email": {"type": "string", "title": "Email", "format": "email"}}}'::jsonb,
 'manage-microsoft-user'),

('microsoft', 'reset_password', 'Réinitialiser mot de passe Microsoft', 'Réinitialise le mot de passe d''un utilisateur Microsoft 365', 'user_management',
 '{"type": "object", "required": ["email"], "properties": {"email": {"type": "string", "title": "Email", "format": "email"}, "newPassword": {"type": "string", "title": "Nouveau mot de passe"}}}'::jsonb,
 'manage-microsoft-user'),

('microsoft', 'create_team', 'Créer une équipe Teams', 'Crée une nouvelle équipe Microsoft Teams', 'communication',
 '{"type": "object", "required": ["name"], "properties": {"name": {"type": "string", "title": "Nom de l''équipe"}, "description": {"type": "string", "title": "Description"}}}'::jsonb,
 'manage-microsoft-teams'),

('microsoft', 'add_to_team', 'Ajouter à une équipe Teams', 'Ajoute un membre à une équipe Teams', 'communication',
 '{"type": "object", "required": ["email", "teamId"], "properties": {"email": {"type": "string", "title": "Email", "format": "email"}, "teamId": {"type": "string", "title": "ID de l''équipe"}}}'::jsonb,
 'manage-microsoft-teams'),

('microsoft', 'send_email', 'Envoyer un email Outlook', 'Envoie un email via Outlook', 'communication',
 '{"type": "object", "required": ["to", "subject", "body"], "properties": {"to": {"type": "string", "title": "Destinataire", "format": "email"}, "subject": {"type": "string", "title": "Sujet"}, "body": {"type": "string", "title": "Contenu"}}}'::jsonb,
 'manage-microsoft-mail'),

-- Additional Slack Actions (total: 5)
('slack', 'create_channel', 'Créer un canal Slack', 'Crée un nouveau canal Slack', 'communication',
 '{"type": "object", "required": ["name"], "properties": {"name": {"type": "string", "title": "Nom du canal"}, "isPrivate": {"type": "boolean", "title": "Canal privé", "default": false}}}'::jsonb,
 'slack-channel'),

('slack', 'archive_channel', 'Archiver un canal Slack', 'Archive un canal Slack existant', 'communication',
 '{"type": "object", "required": ["channelId"], "properties": {"channelId": {"type": "string", "title": "ID du canal"}}}'::jsonb,
 'slack-channel'),

('slack', 'remove_from_channel', 'Retirer d''un canal Slack', 'Retire un utilisateur d''un canal Slack', 'communication',
 '{"type": "object", "required": ["email", "channelId"], "properties": {"email": {"type": "string", "title": "Email", "format": "email"}, "channelId": {"type": "string", "title": "ID du canal"}}}'::jsonb,
 'slack-channel'),

-- Additional Notion Actions (total: 3)
('notion', 'share_page', 'Partager une page Notion', 'Partage une page avec un utilisateur', 'documentation',
 '{"type": "object", "required": ["pageId", "email"], "properties": {"pageId": {"type": "string", "title": "ID de la page"}, "email": {"type": "string", "title": "Email", "format": "email"}, "permission": {"type": "string", "title": "Permission", "enum": ["read", "edit", "full_access"]}}}'::jsonb,
 'notion-share'),

-- Additional HubSpot Actions (total: 4)
('hubspot', 'create_deal', 'Créer une affaire HubSpot', 'Crée une nouvelle affaire dans HubSpot CRM', 'crm',
 '{"type": "object", "required": ["dealName", "amount"], "properties": {"dealName": {"type": "string", "title": "Nom de l''affaire"}, "amount": {"type": "number", "title": "Montant"}, "stage": {"type": "string", "title": "Étape"}}}'::jsonb,
 'hubspot-deals'),

('hubspot', 'add_to_list', 'Ajouter à une liste HubSpot', 'Ajoute un contact à une liste marketing', 'crm',
 '{"type": "object", "required": ["email", "listId"], "properties": {"email": {"type": "string", "title": "Email", "format": "email"}, "listId": {"type": "string", "title": "ID de la liste"}}}'::jsonb,
 'hubspot-lists')

ON CONFLICT (integration_id, action_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  input_schema = EXCLUDED.input_schema,
  edge_function = EXCLUDED.edge_function;
