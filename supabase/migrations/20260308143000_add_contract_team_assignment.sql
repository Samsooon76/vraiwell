ALTER TABLE public.contracts
ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contracts_team_id ON public.contracts(team_id);

DROP POLICY IF EXISTS "Users can insert their own contracts" ON public.contracts;
DROP POLICY IF EXISTS "Users can update their own contracts" ON public.contracts;

CREATE POLICY "Users can insert their own contracts"
  ON public.contracts FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      team_id IS NULL
      OR public.is_team_member(auth.uid(), team_id)
      OR public.is_admin_or_manager(auth.uid())
    )
  );

CREATE POLICY "Users can update their own contracts"
  ON public.contracts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (
      team_id IS NULL
      OR public.is_team_member(auth.uid(), team_id)
      OR public.is_admin_or_manager(auth.uid())
    )
  );
