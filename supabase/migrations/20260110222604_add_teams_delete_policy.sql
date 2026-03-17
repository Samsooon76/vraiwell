-- Add DELETE policy for teams
-- Only team leads or admins/managers can delete teams

CREATE POLICY "Team leads and admins can delete teams"
ON public.teams FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.team_members 
    WHERE team_id = teams.id 
    AND user_id = auth.uid() 
    AND role = 'lead'
  )
  OR public.is_admin_or_manager(auth.uid())
);;
