-- Fix 1: Teams table - restrict access to team members only
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can view teams" ON public.teams;
DROP POLICY IF EXISTS "Authenticated users can insert teams" ON public.teams;
DROP POLICY IF EXISTS "Authenticated users can update teams" ON public.teams;

-- Create restrictive policies for teams
-- Users can view teams they are members of OR admins/managers can view all
CREATE POLICY "Users can view their teams"
ON public.teams FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.team_members WHERE team_id = teams.id AND user_id = auth.uid())
  OR is_admin_or_manager(auth.uid())
);

-- Any authenticated user can create a team (they become the first member)
CREATE POLICY "Authenticated users can create teams"
ON public.teams FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Only team leads or admins can update teams
CREATE POLICY "Team leads can update teams"
ON public.teams FOR UPDATE
USING (
  is_team_lead(auth.uid(), id)
  OR has_role(auth.uid(), 'admin')
);

-- Fix 2: Invitations table - restrict token exposure
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can view invitation by token" ON public.invitations;

-- Create a function to check invitation token safely (for signup flow)
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(_token text)
RETURNS TABLE (
  id uuid,
  email text,
  role app_role,
  status text,
  expires_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, email, role, status, expires_at
  FROM public.invitations
  WHERE token = _token
    AND status = 'pending'
    AND expires_at > now();
$$;

-- Admins and managers who created invitations can still view them via existing policies
-- No additional SELECT policy needed - the function handles token lookups securely
;
