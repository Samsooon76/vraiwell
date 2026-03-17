-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'manager', 'user')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create teams table
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#0f766e',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view teams"
  ON public.teams FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert teams"
  ON public.teams FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update teams"
  ON public.teams FOR UPDATE
  TO authenticated
  USING (true);

-- Create team_members junction table
CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('lead', 'member')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE(team_id, user_id)
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view team members"
  ON public.team_members FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage team members"
  ON public.team_members FOR ALL
  TO authenticated
  USING (true);

-- Create tools table
CREATE TABLE public.tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  logo_url TEXT,
  website_url TEXT,
  is_active BOOLEAN DEFAULT false,
  monthly_cost DECIMAL(10,2) DEFAULT 0,
  total_seats INTEGER DEFAULT 0,
  used_seats INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view tools"
  ON public.tools FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage tools"
  ON public.tools FOR ALL
  TO authenticated
  USING (true);

-- Create access_requests table
CREATE TABLE public.access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tool_id UUID REFERENCES public.tools(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES auth.users(id),
  notes TEXT
);

ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own requests"
  ON public.access_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all requests"
  ON public.access_requests FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create requests"
  ON public.access_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update requests"
  ON public.access_requests FOR UPDATE
  TO authenticated
  USING (true);

-- Create workflows table
CREATE TABLE public.workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  type TEXT CHECK (type IN ('onboarding', 'offboarding', 'custom')),
  is_active BOOLEAN DEFAULT true,
  steps JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view workflows"
  ON public.workflows FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage workflows"
  ON public.workflows FOR ALL
  TO authenticated
  USING (true);

-- Insert some default tools
INSERT INTO public.tools (name, description, category, is_active, monthly_cost, total_seats, used_seats) VALUES
  ('HubSpot', 'CRM et marketing automation pour gérer vos prospects et clients.', 'CRM', true, 890, 50, 42),
  ('Slack', 'Communication d''équipe et messagerie instantanée.', 'Communication', true, 1250, 100, 95),
  ('Notion', 'Documentation et gestion de projet collaborative.', 'Productivité', true, 640, 80, 72),
  ('GitHub', 'Hébergement de code source et collaboration développeur.', 'Développement', false, 0, 0, 0),
  ('Figma', 'Design collaboratif et prototypage.', 'Design', false, 0, 0, 0),
  ('Salesforce', 'CRM enterprise pour grandes équipes commerciales.', 'CRM', false, 0, 0, 0),
  ('Payfit', 'Gestion de la paie et des RH simplifiée.', 'RH', true, 2100, 300, 285),
  ('Asana', 'Gestion de projet et suivi des tâches d''équipe.', 'Productivité', false, 0, 0, 0),
  ('Google Workspace', 'Suite bureautique cloud complète.', 'Productivité', true, 1800, 150, 142),
  ('Microsoft 365', 'Suite Microsoft pour entreprises.', 'Productivité', false, 0, 0, 0),
  ('Trello', 'Tableaux Kanban pour gestion de tâches.', 'Productivité', false, 0, 0, 0),
  ('Deel', 'Gestion des contrats et paie internationale.', 'RH', false, 0, 0, 0);

-- Insert default teams
INSERT INTO public.teams (name, description, color) VALUES
  ('Engineering', 'Équipe technique et développement', '#2563eb'),
  ('Sales', 'Équipe commerciale', '#f59e0b'),
  ('Marketing', 'Équipe marketing et communication', '#8b5cf6'),
  ('Product', 'Équipe produit et design', '#0f766e'),
  ('Finance', 'Équipe finance et comptabilité', '#dc2626'),
  ('HR', 'Ressources humaines', '#ec4899');

-- Insert default workflows
INSERT INTO public.workflows (name, description, type, steps) VALUES
  ('Onboarding Standard', 'Workflow d''onboarding pour nouveaux employés', 'onboarding', '[{"name": "Créer compte Google", "tool": "Google Workspace"}, {"name": "Inviter sur Slack", "tool": "Slack"}, {"name": "Ajouter à Notion", "tool": "Notion"}]'),
  ('Onboarding Tech', 'Workflow d''onboarding pour développeurs', 'onboarding', '[{"name": "Créer compte Google", "tool": "Google Workspace"}, {"name": "Inviter sur Slack", "tool": "Slack"}, {"name": "Accès GitHub", "tool": "GitHub"}, {"name": "Ajouter à Notion", "tool": "Notion"}]'),
  ('Offboarding Standard', 'Workflow de départ collaborateur', 'offboarding', '[{"name": "Désactiver Google", "tool": "Google Workspace"}, {"name": "Retirer de Slack", "tool": "Slack"}, {"name": "Archiver Notion", "tool": "Notion"}]');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tools_updated_at BEFORE UPDATE ON public.tools FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON public.workflows FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
;
