-- Fix team_members security: restrict access to own teams only
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can manage team members" ON public.team_members;
DROP POLICY IF EXISTS "Authenticated users can view team members" ON public.team_members;

-- Create helper function to check if user is a team lead (avoids infinite recursion)
CREATE OR REPLACE FUNCTION public.is_team_lead(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE user_id = _user_id
      AND team_id = _team_id
      AND role = 'lead'
  )
$$;

-- Create helper function to check if user is member of a team
CREATE OR REPLACE FUNCTION public.is_team_member(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE user_id = _user_id
      AND team_id = _team_id
  )
$$;

-- Users can only view team memberships for teams they belong to
CREATE POLICY "Users can view memberships for their teams"
  ON public.team_members
  FOR SELECT
  TO authenticated
  USING (public.is_team_member(auth.uid(), team_id));

-- Team leads can insert new members to their teams
CREATE POLICY "Team leads can add members"
  ON public.team_members
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_team_lead(auth.uid(), team_id));

-- Team leads can update members in their teams
CREATE POLICY "Team leads can update members"
  ON public.team_members
  FOR UPDATE
  TO authenticated
  USING (public.is_team_lead(auth.uid(), team_id));

-- Team leads can remove members from their teams (but not themselves)
CREATE POLICY "Team leads can remove members"
  ON public.team_members
  FOR DELETE
  TO authenticated
  USING (public.is_team_lead(auth.uid(), team_id) AND user_id != auth.uid());

-- Users can leave teams themselves (delete their own membership)
CREATE POLICY "Users can leave teams"
  ON public.team_members
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow users to be added to a team as the first member (team creator becomes lead)
CREATE POLICY "First member can be added to new team"
  ON public.team_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    NOT EXISTS (
      SELECT 1 FROM public.team_members tm WHERE tm.team_id = team_members.team_id
    )
  );
;
