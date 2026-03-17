-- =====================================================
-- WORKFLOW ACTIONS REGISTRY
-- Dynamic action discovery system for scalable workflows
-- =====================================================

-- Table des actions disponibles par intégration
CREATE TABLE public.workflow_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id TEXT NOT NULL,           -- 'google', 'microsoft', 'slack', 'hubspot', 'notion'
  action_key TEXT NOT NULL,               -- 'create_user', 'delete_user', 'invite_channel'
  name TEXT NOT NULL,                     -- "Créer un utilisateur"
  description TEXT,
  icon TEXT,                              -- Lucide icon name
  category TEXT,                          -- 'user_management', 'communication', 'data'
  input_schema JSONB NOT NULL DEFAULT '{}',  -- JSON Schema des paramètres requis
  edge_function TEXT,                     -- Edge function à appeler
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index pour recherche rapide par intégration
CREATE INDEX idx_workflow_actions_integration ON public.workflow_actions(integration_id);
CREATE UNIQUE INDEX idx_workflow_actions_unique ON public.workflow_actions(integration_id, action_key);

-- Table des steps d'un workflow (plus flexible que JSONB)
CREATE TABLE public.workflow_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES public.workflows(id) ON DELETE CASCADE NOT NULL,
  action_id UUID REFERENCES public.workflow_actions(id) NOT NULL,
  step_order INTEGER NOT NULL,
  config JSONB DEFAULT '{}',              -- Configuration spécifique au step
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workflow_id, step_order)
);

-- Index pour récupérer les steps en ordre
CREATE INDEX idx_workflow_steps_order ON public.workflow_steps(workflow_id, step_order);

-- Variables du workflow (pour les templates)
CREATE TABLE public.workflow_variables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES public.workflows(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,                     -- 'firstName', 'lastName', 'email'
  label TEXT NOT NULL,                    -- 'Prénom', 'Nom', 'Email'
  type TEXT DEFAULT 'string' CHECK (type IN ('string', 'email', 'select')),
  required BOOLEAN DEFAULT true,
  options JSONB,                          -- Pour type 'select'
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workflow_id, name)
);

-- Logs d'exécution des workflows
CREATE TABLE public.workflow_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES public.workflows(id) ON DELETE SET NULL,
  step_id UUID REFERENCES public.workflow_steps(id) ON DELETE SET NULL,
  status TEXT CHECK (status IN ('pending', 'running', 'success', 'failed', 'skipped')) DEFAULT 'pending',
  input_data JSONB,
  output_data JSONB,
  error_message TEXT,
  executed_by UUID REFERENCES auth.users(id),
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Index pour récupérer les logs récents
CREATE INDEX idx_workflow_logs_workflow ON public.workflow_logs(workflow_id, started_at DESC);

-- RLS Policies
ALTER TABLE public.workflow_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_variables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_logs ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut voir les actions (lecture seule, gérées par admin)
CREATE POLICY "Anyone can view workflow actions"
  ON public.workflow_actions FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can manage workflow steps
CREATE POLICY "Authenticated users can manage workflow steps"
  ON public.workflow_steps FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage workflow variables"
  ON public.workflow_variables FOR ALL
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view and create logs"
  ON public.workflow_logs FOR ALL
  TO authenticated
  USING (true);

-- =====================================================
-- SEED: Actions par défaut pour chaque intégration
-- =====================================================

INSERT INTO public.workflow_actions (integration_id, action_key, name, description, icon, category, edge_function, input_schema) VALUES
-- Google Workspace
('google', 'create_user', 'Créer un utilisateur Google', 'Crée un compte Google Workspace avec email professionnel', 'UserPlus', 'user_management', 'manage-google-user', 
  '{"type": "object", "required": ["firstName", "lastName", "personalEmail"], "properties": {"firstName": {"type": "string", "title": "Prénom"}, "lastName": {"type": "string", "title": "Nom"}, "personalEmail": {"type": "string", "format": "email", "title": "Email personnel (pour invitation)"}}}'),
('google', 'delete_user', 'Supprimer un utilisateur Google', 'Supprime un compte Google Workspace', 'UserMinus', 'user_management', 'manage-google-user',
  '{"type": "object", "required": ["userId"], "properties": {"userId": {"type": "string", "title": "ID utilisateur Google"}}}'),

-- Microsoft 365
('microsoft', 'create_user', 'Créer un utilisateur Microsoft 365', 'Crée un compte Microsoft 365 avec email professionnel', 'UserPlus', 'user_management', 'manage-microsoft-user',
  '{"type": "object", "required": ["firstName", "lastName"], "properties": {"firstName": {"type": "string", "title": "Prénom"}, "lastName": {"type": "string", "title": "Nom"}, "personalEmail": {"type": "string", "format": "email", "title": "Email personnel"}}}'),
('microsoft', 'delete_user', 'Supprimer un utilisateur Microsoft 365', 'Supprime un compte Microsoft 365', 'UserMinus', 'user_management', 'manage-microsoft-user',
  '{"type": "object", "required": ["userId"], "properties": {"userId": {"type": "string", "title": "ID utilisateur Microsoft"}}}'),

-- Slack
('slack', 'invite_user', 'Inviter sur Slack', 'Invite un utilisateur dans le workspace Slack', 'MessageSquare', 'communication', 'manage-slack-user',
  '{"type": "object", "required": ["email"], "properties": {"email": {"type": "string", "format": "email", "title": "Email à inviter"}, "channels": {"type": "array", "title": "Channels à rejoindre", "items": {"type": "string"}}}}'),
('slack', 'remove_user', 'Retirer de Slack', 'Retire un utilisateur du workspace Slack', 'UserMinus', 'communication', 'manage-slack-user',
  '{"type": "object", "required": ["userId"], "properties": {"userId": {"type": "string", "title": "ID utilisateur Slack"}}}'),
('slack', 'create_channel', 'Créer un channel Slack', 'Crée un nouveau channel dans le workspace', 'Hash', 'communication', 'manage-slack-user',
  '{"type": "object", "required": ["name"], "properties": {"name": {"type": "string", "title": "Nom du channel"}, "isPrivate": {"type": "boolean", "title": "Channel privé", "default": false}}}'),

-- Notion
('notion', 'invite_user', 'Inviter sur Notion', 'Invite un utilisateur dans le workspace Notion', 'FileText', 'documentation', null,
  '{"type": "object", "required": ["email"], "properties": {"email": {"type": "string", "format": "email", "title": "Email à inviter"}}}'),

-- HubSpot
('hubspot', 'create_contact', 'Créer un contact HubSpot', 'Crée un nouveau contact dans HubSpot CRM', 'UserPlus', 'crm', null,
  '{"type": "object", "required": ["email", "firstName", "lastName"], "properties": {"email": {"type": "string", "format": "email", "title": "Email"}, "firstName": {"type": "string", "title": "Prénom"}, "lastName": {"type": "string", "title": "Nom"}, "company": {"type": "string", "title": "Entreprise"}}}'),
('hubspot', 'create_team', 'Créer une équipe HubSpot', 'Crée une nouvelle équipe dans HubSpot', 'Users', 'crm', null,
  '{"type": "object", "required": ["name"], "properties": {"name": {"type": "string", "title": "Nom de l''équipe"}, "description": {"type": "string", "title": "Description"}}}');
;
