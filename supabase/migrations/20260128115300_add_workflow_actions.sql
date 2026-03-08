-- Create workflow_actions table for dynamic action registry
CREATE TABLE IF NOT EXISTS public.workflow_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id TEXT NOT NULL,
  action_key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  category TEXT,
  input_schema JSONB NOT NULL DEFAULT '{"type": "object", "properties": {}}'::jsonb,
  edge_function TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(integration_id, action_key)
);

-- Create workflow_steps table for storing step configurations
CREATE TABLE IF NOT EXISTS public.workflow_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  action_id UUID NOT NULL REFERENCES public.workflow_actions(id) ON DELETE RESTRICT,
  step_order INTEGER NOT NULL DEFAULT 1,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create workflow_variables table for dynamic variable definitions
CREATE TABLE IF NOT EXISTS public.workflow_variables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  label TEXT NOT NULL,
  type TEXT CHECK (type IN ('string', 'email', 'select')) DEFAULT 'string',
  required BOOLEAN DEFAULT true,
  options JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(workflow_id, name)
);

-- Create workflow_logs table for execution tracking
CREATE TABLE IF NOT EXISTS public.workflow_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES public.workflows(id) ON DELETE CASCADE,
  step_id UUID REFERENCES public.workflow_steps(id) ON DELETE SET NULL,
  status TEXT CHECK (status IN ('pending', 'running', 'success', 'failed', 'skipped')) DEFAULT 'pending',
  input_data JSONB,
  output_data JSONB,
  error_message TEXT,
  executed_by UUID NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.workflow_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_variables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for workflow_actions (readable by all authenticated users)
CREATE POLICY "Workflow actions are readable by authenticated users"
  ON public.workflow_actions FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for workflow_steps
CREATE POLICY "Workflow steps are readable by authenticated users"
  ON public.workflow_steps FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Workflow steps can be inserted by authenticated users"
  ON public.workflow_steps FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Workflow steps can be updated by authenticated users"
  ON public.workflow_steps FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Workflow steps can be deleted by authenticated users"
  ON public.workflow_steps FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for workflow_variables
CREATE POLICY "Workflow variables are readable by authenticated users"
  ON public.workflow_variables FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Workflow variables can be inserted by authenticated users"
  ON public.workflow_variables FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for workflow_logs
CREATE POLICY "Workflow logs are readable by authenticated users"
  ON public.workflow_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Workflow logs can be inserted by authenticated users"
  ON public.workflow_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Workflow logs can be updated by executors"
  ON public.workflow_logs FOR UPDATE
  TO authenticated
  USING (executed_by = auth.uid());

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_workflow_actions_integration ON public.workflow_actions(integration_id);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_workflow ON public.workflow_steps(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_order ON public.workflow_steps(workflow_id, step_order);
CREATE INDEX IF NOT EXISTS idx_workflow_variables_workflow ON public.workflow_variables(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_logs_workflow ON public.workflow_logs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_logs_status ON public.workflow_logs(status);

-- Seed default workflow actions
INSERT INTO public.workflow_actions (integration_id, action_key, name, description, category, input_schema, edge_function) VALUES
-- Google Workspace Actions
('google', 'create_user', 'Créer un utilisateur Google', 'Crée un compte utilisateur dans Google Workspace', 'user_management', 
 '{"type": "object", "required": ["firstName", "lastName", "email"], "properties": {"firstName": {"type": "string", "title": "Prénom"}, "lastName": {"type": "string", "title": "Nom"}, "email": {"type": "string", "title": "Email", "format": "email"}, "personalEmail": {"type": "string", "title": "Email personnel", "format": "email"}}}'::jsonb, 
 'manage-google-user'),

('google', 'delete_user', 'Supprimer un utilisateur Google', 'Supprime un compte utilisateur de Google Workspace', 'user_management',
 '{"type": "object", "required": ["email"], "properties": {"email": {"type": "string", "title": "Email", "format": "email"}}}'::jsonb,
 'manage-google-user'),

-- Microsoft 365 Actions  
('microsoft', 'create_user', 'Créer un utilisateur Microsoft 365', 'Crée un compte utilisateur dans Microsoft 365', 'user_management',
 '{"type": "object", "required": ["firstName", "lastName", "email"], "properties": {"firstName": {"type": "string", "title": "Prénom"}, "lastName": {"type": "string", "title": "Nom"}, "email": {"type": "string", "title": "Email", "format": "email"}, "displayName": {"type": "string", "title": "Nom d''affichage"}, "personalEmail": {"type": "string", "title": "Email personnel", "format": "email"}}}'::jsonb,
 'manage-microsoft-user'),

('microsoft', 'delete_user', 'Supprimer un utilisateur Microsoft 365', 'Supprime un compte utilisateur de Microsoft 365', 'user_management',
 '{"type": "object", "required": ["email"], "properties": {"email": {"type": "string", "title": "Email", "format": "email"}}}'::jsonb,
 'manage-microsoft-user'),

-- Slack Actions
('slack', 'send_message', 'Envoyer un message Slack', 'Envoie un message dans un canal ou à un utilisateur', 'communication',
 '{"type": "object", "required": ["channel", "message"], "properties": {"channel": {"type": "string", "title": "Canal"}, "message": {"type": "string", "title": "Message"}}}'::jsonb,
 'slack-message'),

('slack', 'invite_user', 'Inviter dans un canal Slack', 'Invite un utilisateur dans un canal Slack', 'communication',
 '{"type": "object", "required": ["email", "channel"], "properties": {"email": {"type": "string", "title": "Email", "format": "email"}, "channel": {"type": "string", "title": "Canal"}}}'::jsonb,
 'slack-invite'),

-- Notion Actions
('notion', 'create_page', 'Créer une page Notion', 'Crée une nouvelle page dans un espace Notion', 'documentation',
 '{"type": "object", "required": ["title", "parentId"], "properties": {"title": {"type": "string", "title": "Titre"}, "parentId": {"type": "string", "title": "ID Parent"}, "content": {"type": "string", "title": "Contenu"}}}'::jsonb,
 'notion-create-page'),

('notion', 'add_to_database', 'Ajouter à une base Notion', 'Ajoute une entrée dans une base de données Notion', 'documentation',
 '{"type": "object", "required": ["databaseId"], "properties": {"databaseId": {"type": "string", "title": "ID Base de données"}, "properties": {"type": "object", "title": "Propriétés"}}}'::jsonb,
 'notion-add-to-db'),

-- HubSpot Actions
('hubspot', 'create_contact', 'Créer un contact HubSpot', 'Crée un nouveau contact dans HubSpot CRM', 'crm',
 '{"type": "object", "required": ["email", "firstName", "lastName"], "properties": {"email": {"type": "string", "title": "Email", "format": "email"}, "firstName": {"type": "string", "title": "Prénom"}, "lastName": {"type": "string", "title": "Nom"}, "company": {"type": "string", "title": "Entreprise"}, "phone": {"type": "string", "title": "Téléphone"}}}'::jsonb,
 'hubspot-create-contact'),

('hubspot', 'update_contact', 'Mettre à jour un contact HubSpot', 'Met à jour un contact existant dans HubSpot', 'crm',
 '{"type": "object", "required": ["email"], "properties": {"email": {"type": "string", "title": "Email", "format": "email"}, "properties": {"type": "object", "title": "Propriétés à mettre à jour"}}}'::jsonb,
 'hubspot-update-contact')

ON CONFLICT (integration_id, action_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  input_schema = EXCLUDED.input_schema,
  edge_function = EXCLUDED.edge_function;
