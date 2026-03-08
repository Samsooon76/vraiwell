-- Fix mutable search path for security trigger function
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;

-- Harden workflows table
-- 1. Add user_id column
ALTER TABLE public.workflows ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();

-- 2. Clean up existing data to attribute to a user (best effort for dev)
DO $$
DECLARE
    first_user UUID;
BEGIN
    SELECT user_id INTO first_user FROM public.profiles LIMIT 1;
    IF first_user IS NOT NULL THEN
        UPDATE public.workflows SET user_id = first_user WHERE user_id IS NULL;
    END IF;
END $$;

-- 3. Workflows RLS
-- Remove legacy overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can manage workflows" ON public.workflows;
DROP POLICY IF EXISTS "Authenticated users can view workflows" ON public.workflows;

-- Add strict owner-based policies
CREATE POLICY "Users can view their own workflows" ON public.workflows
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own workflows" ON public.workflows
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own workflows" ON public.workflows
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own workflows" ON public.workflows
  FOR DELETE USING (auth.uid() = user_id);

-- Workflow Steps RLS
-- Remove legacy overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can manage workflow steps" ON public.workflow_steps;
DROP POLICY IF EXISTS "Workflow steps can be deleted by authenticated users" ON public.workflow_steps;
DROP POLICY IF EXISTS "Workflow steps can be inserted by authenticated users" ON public.workflow_steps;
DROP POLICY IF EXISTS "Workflow steps can be updated by authenticated users" ON public.workflow_steps;

CREATE POLICY "Users can manage their own workflow steps" ON public.workflow_steps
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.workflows WHERE workflows.id = workflow_steps.workflow_id AND workflows.user_id = auth.uid()));

-- Workflow Variables RLS
-- Remove legacy overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can manage workflow variables" ON public.workflow_variables;
DROP POLICY IF EXISTS "Workflow variables are readable by authenticated users" ON public.workflow_variables;
DROP POLICY IF EXISTS "Workflow variables can be inserted by authenticated users" ON public.workflow_variables;

CREATE POLICY "Users can manage their own workflow variables" ON public.workflow_variables
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.workflows WHERE workflows.id = workflow_variables.workflow_id AND workflows.user_id = auth.uid()));

-- Workflow Logs RLS
-- Remove legacy overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can view and create logs" ON public.workflow_logs;
DROP POLICY IF EXISTS "Workflow logs are readable by authenticated users" ON public.workflow_logs;
DROP POLICY IF EXISTS "Workflow logs can be inserted by authenticated users" ON public.workflow_logs;

CREATE POLICY "Users can manage their own workflow logs" ON public.workflow_logs
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.workflows WHERE workflows.id = workflow_logs.workflow_id AND workflows.user_id = auth.uid()));

-- Access Requests RLS
-- Remove legacy overly permissive policy for UPDATE
DROP POLICY IF EXISTS "Authenticated users can update requests" ON public.access_requests;

-- Only admins/managers should be able to update access requests (to change status)
CREATE POLICY "Admins and managers can update requests" ON public.access_requests
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.user_id = auth.uid() 
      AND (profiles.role = 'admin' OR profiles.role = 'manager')
    )
  );
